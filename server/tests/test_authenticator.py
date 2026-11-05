"""Two step sign in with an authenticator app (TOTP), the emailed code as backup."""

import logging
import re
import time
from dataclasses import replace
from typing import Any
from urllib.parse import parse_qs, urlparse

import pyotp
import pytest
from fastapi.testclient import TestClient

from blinqscribe.api import create_app

PASSWORD = "correct horse battery"
SIGN_IN = (
    "mutation($l: String!, $p: String!) { sign_in(login: $l, password: $p) "
    "{ token two_factor_required two_factor_method ticket } }"
)
VERIFY = (
    "mutation($t: String!, $c: String!) "
    "{ verify_sign_in_code(ticket: $t, code: $c) { token } }"
)


@pytest.fixture
def client(settings: Any, caplog: pytest.LogCaptureFixture) -> TestClient:
    caplog.set_level(logging.INFO)
    return TestClient(
        create_app(replace(settings, public_url="https://scribe.test")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _gql(client: TestClient, query: str, token: str = "", **variables: Any) -> Any:
    r = client.post(
        "/graphql",
        json={"query": query, "variables": variables},
        headers={"Authorization": f"Bearer {token}"} if token else {},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _ok(client: TestClient, query: str, token: str = "", **variables: Any) -> Any:
    body = _gql(client, query, token, **variables)
    assert not body.get("errors"), body
    return body["data"]


@pytest.fixture
def ana(client: TestClient) -> str:
    accounts = client.app.state.signin.accounts  # type: ignore[attr-defined]
    _, invite = accounts.create("ana", "Ana", "prov-1", email="ana@clinic.test")
    accounts.accept_invite(invite, PASSWORD)
    return str(_ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]["token"])


def _later(secret: str, steps: int = 1) -> str:
    """The app's code for a coming time step (each code works once)."""
    return pyotp.TOTP(secret).at(time.time() + 30 * steps)


def _set_up(client: TestClient, token: str) -> str:
    out = _ok(
        client,
        'mutation { start_authenticator(current_password: "' + PASSWORD + '") '
        "{ secret otpauth_uri } }",
        token,
    )["start_authenticator"]
    uri = urlparse(out["otpauth_uri"])
    assert uri.scheme == "otpauth" and uri.netloc == "totp"
    assert parse_qs(uri.query)["issuer"] == ["Blinq Scribe"]
    assert parse_qs(uri.query)["secret"] == [out["secret"]]
    secret: str = out["secret"]
    done = _ok(
        client,
        "mutation($c: String!) { confirm_authenticator(code: $c) "
        "{ authenticator two_factor } }",
        token,
        c=pyotp.TOTP(secret).now(),
    )["confirm_authenticator"]
    assert done == {"authenticator": True, "two_factor": True}
    return secret


def test_setting_up_needs_the_password_and_a_right_code(client, ana):
    no = _gql(client, "mutation { start_authenticator { secret } }", ana)
    assert "current password" in no["errors"][0]["message"]
    _ok(
        client,
        'mutation { start_authenticator(current_password: "' + PASSWORD + '") '
        "{ secret } }",
        ana,
    )
    wrong = _gql(
        client, 'mutation { confirm_authenticator(code: "000000") { id } }', ana
    )
    assert "doesn't match" in wrong["errors"][0]["message"]
    me = _ok(client, "{ me { user { authenticator two_factor } } }", ana)
    assert me["me"]["user"] == {"authenticator": False, "two_factor": False}


def test_signing_in_with_the_app(client, ana):
    secret = _set_up(client, ana)
    step = _ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]
    assert step["token"] is None and step["two_factor_method"] == "app"
    code = _later(secret)
    token = _ok(client, VERIFY, t=step["ticket"], c=code)["verify_sign_in_code"]
    assert token["token"]
    # The same code can't be used twice.
    again = _ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]
    replay = _gql(client, VERIFY, t=again["ticket"], c=code)
    assert "authenticator app" in replay["errors"][0]["message"]


def test_the_emailed_code_is_the_backup(client, ana, caplog):
    _set_up(client, ana)
    step = _ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]
    assert "Demo mode: sign in code" not in caplog.text  # nothing emailed yet
    resend = (
        "mutation($t: String!) { resend_sign_in_code(ticket: $t) "
        "{ two_factor_method email_hint } }"
    )
    sent = _ok(client, resend, t=step["ticket"])["resend_sign_in_code"]
    assert sent == {"two_factor_method": "app", "email_hint": "a•••@clinic.test"}
    code = re.findall(r"Demo mode: sign in code for ana is (\d{6})", caplog.text)[-1]
    assert _ok(client, VERIFY, t=step["ticket"], c=code)["verify_sign_in_code"]["token"]


def test_removing_the_app_goes_back_to_email(client, ana):
    secret = _set_up(client, ana)
    token = _ok(
        client,
        VERIFY,
        t=_ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]["ticket"],
        c=_later(secret),
    )["verify_sign_in_code"]["token"]
    no = _gql(client, "mutation { remove_authenticator { id } }", token)
    assert "current password" in no["errors"][0]["message"]
    out = _ok(
        client,
        'mutation { remove_authenticator(current_password: "'
        + PASSWORD
        + '") { authenticator two_factor } }',
        token,
    )["remove_authenticator"]
    assert out == {"authenticator": False, "two_factor": True}
    step = _ok(client, SIGN_IN, l="ana", p=PASSWORD)["sign_in"]
    assert step["two_factor_method"] == "email"


def test_the_demo_account_cant_set_up_an_app(client):
    token = _ok(client, "mutation { try_demo_clinic { token } }")["try_demo_clinic"][
        "token"
    ]
    out = _gql(client, "mutation { start_authenticator { secret } }", token)
    assert out["errors"][0]["message"] == "The demo account can't be changed."


def test_one_code_signs_in_once_even_at_the_same_moment(client, ana):
    import threading

    secret = _set_up(client, ana)
    accounts = client.app.state.signin.accounts  # type: ignore[attr-defined]
    user_id = accounts.list()[0].id
    code = _later(secret)
    results: list[bool] = []
    start = threading.Barrier(4)

    def try_code() -> None:
        start.wait()
        results.append(accounts.check_authenticator(user_id, code))

    threads = [threading.Thread(target=try_code) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == [False, False, False, True]
    store = client.app.state.signin.store  # type: ignore[attr-defined]
    assert not store.claim_totp_step(user_id, 0)  # an older step never counts again
