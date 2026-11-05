"""The sign in operations over GraphQL (gql/auth.py): the same rules as the service
tests in test_signin.py, through /graphql."""

import logging
import re
from dataclasses import replace
from email.message import EmailMessage
from typing import Any

import pytest
from fastapi.testclient import TestClient

from blinqscribe import mailer as mailer_module
from blinqscribe.accounts import DEMO_USERNAME
from blinqscribe.api import create_app

PASSWORD = "correct horse battery"
PAYLOAD = "{ token two_factor_required ticket email_hint user { username } }"


def _gql(
    client: TestClient, query: str, token: str = "", **variables: Any
) -> dict[str, Any]:
    r = client.post(
        "/graphql",
        json={"query": query, "variables": variables},
        headers={"Authorization": f"Bearer {token}"} if token else {},
    )
    assert r.status_code == 200, r.text
    body: dict[str, Any] = r.json()
    return body


def _ok(client: TestClient, query: str, token: str = "", **variables: Any) -> Any:
    body = _gql(client, query, token, **variables)
    assert not body.get("errors"), body
    return body["data"]


def _error(client: TestClient, query: str, token: str = "", **variables: Any) -> Any:
    body = _gql(client, query, token, **variables)
    assert body.get("errors"), body
    return body["errors"][0]


def _signin(client: TestClient) -> Any:
    return client.app.state.signin  # type: ignore[attr-defined]


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    out: list[EmailMessage] = []

    async def fake_send(msg: EmailMessage, **kwargs: Any) -> None:
        out.append(msg)

    monkeypatch.setattr(mailer_module.aiosmtplib, "send", fake_send)
    return out


@pytest.fixture
def client(settings, sent, caplog):
    """Demo mode with SMTP set up (faked) and the log captured."""
    caplog.set_level(logging.INFO)
    return TestClient(
        create_app(
            replace(
                settings, email_smtp_host="smtp.test", public_url="https://scribe.test"
            )
        ),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


@pytest.fixture
def ana(client: TestClient) -> str:
    """An admin made in the open demo, then a vet with an email."""
    accounts = _signin(client).accounts
    _, invite = accounts.create("maya", "Maya", role="admin", email="m@c.test")
    accounts.accept_invite(invite, PASSWORD)
    vet, invite = accounts.create("ana", "Ana", "prov-1", email="ana@clinic.test")
    accounts.accept_invite(invite, PASSWORD)
    return str(vet.id)


SIGN_IN = (
    "mutation($l: String!, $p: String!, $r: Boolean!) "
    "{ sign_in(login: $l, password: $p, remember: $r) " + PAYLOAD + " }"
)


def _sign_in(client: TestClient, login: str = "ana@clinic.test") -> Any:
    return _ok(client, SIGN_IN, l=login, p=PASSWORD, r=True)["sign_in"]


def test_status_and_options(client):
    data = _ok(
        client,
        "{ auth_status { login_required options "
        "{ password google microsoft demo password_reset } } }",
    )
    assert data["auth_status"] == {
        "login_required": False,
        "options": {
            "password": True,
            "google": False,
            "microsoft": False,
            "demo": True,
            "password_reset": True,
        },
    }


def test_sign_in_me_and_sign_out(client, ana):
    out = _sign_in(client)
    assert out["user"]["username"] == "ana" and out["two_factor_required"] is False
    me = _ok(client, "{ me { via admin user { username email } } }", out["token"])
    assert me["me"] == {
        "via": "session",
        "admin": False,
        "user": {"username": "ana", "email": "ana@clinic.test"},
    }
    _ok(client, "mutation { sign_out }", out["token"])
    err = _error(client, "{ me { via } }", out["token"])
    assert err["extensions"]["code"] == "UNAUTHENTICATED"


def test_wrong_password_and_rate_limit(client, ana):
    for _ in range(5):
        err = _error(client, SIGN_IN, l="ana", p="wrong password", r=False)
        assert err["extensions"]["status"] == 401
    err = _error(client, SIGN_IN, l="ana", p=PASSWORD, r=False)
    assert err["extensions"]["code"] == "TOO_MANY_TRIES"


def test_two_factor_over_graphql(client, ana, caplog):
    token = _sign_in(client)["token"]
    _ok(client, "mutation { set_two_factor(enabled: true) { two_factor } }", token)
    step = _sign_in(client)
    assert step["token"] is None and step["two_factor_required"] is True
    assert step["email_hint"] == "a•••@clinic.test"
    code = re.findall(r"Demo mode: sign in code for ana is (\d{6})", caplog.text)[-1]
    done = _ok(
        client,
        "mutation($t: String!, $c: String!) "
        "{ verify_sign_in_code(ticket: $t, code: $c) " + PAYLOAD + " }",
        t=step["ticket"],
        c=code,
    )["verify_sign_in_code"]
    assert done["token"] and done["user"]["username"] == "ana"


def test_sign_out_everywhere(client, ana):
    first, second = _sign_in(client)["token"], _sign_in(client)["token"]
    _ok(client, "mutation { sign_out_everywhere }", first)
    assert _error(client, "{ me { via } }", second)["extensions"]["status"] == 401


def test_admin_requires_two_factor_and_revokes_sessions(client, ana):
    admin = _sign_in(client, "maya")["token"]
    vet = _sign_in(client)["token"]
    out = _ok(
        client,
        "mutation($u: String!) { set_user_two_factor(user_id: $u, required: true) "
        "{ two_factor_required } }",
        admin,
        u=ana,
    )
    assert out["set_user_two_factor"]["two_factor_required"] is True
    err = _error(
        client,
        'mutation { set_two_factor(enabled: false, current_password: "'
        + PASSWORD
        + '") { id } }',
        vet,
    )
    assert "requires" in err["message"]
    forbidden = _error(
        client,
        "mutation($u: String!) { revoke_user_sessions(user_id: $u) }",
        vet,
        u=ana,
    )
    assert forbidden["extensions"]["status"] == 403
    _ok(
        client,
        "mutation($u: String!) { revoke_user_sessions(user_id: $u) }",
        admin,
        u=ana,
    )
    assert _error(client, "{ me { via } }", vet)["extensions"]["status"] == 401


def test_forgot_password_over_graphql(client, ana, sent):
    ask = "mutation($e: String!) { request_password_reset(email: $e) }"
    assert _ok(client, ask, e="nobody@x.test")["request_password_reset"] is True
    assert _ok(client, ask, e="ana@clinic.test")["request_password_reset"] is True
    body = sent[-1].get_body(("plain",)).get_content()  # type: ignore[union-attr]
    link = next(w for w in body.split() if "#reset=" in w)
    reset = (
        "mutation($t: String!, $p: String!) { reset_password(token: $t, password: $p) }"
    )
    token = link.split("#reset=")[1]
    assert _ok(client, reset, t=token, p="a brand new password")["reset_password"]
    assert (
        "already used"
        in _error(client, reset, t=token, p="another password 1")["message"]
    )


def test_try_the_demo_clinic(client):
    out = _ok(client, "mutation { try_demo_clinic " + PAYLOAD + " }")
    assert out["try_demo_clinic"]["user"]["username"] == DEMO_USERNAME
    assert out["try_demo_clinic"]["token"]


def test_invite_info_and_accept(client):
    _, invite = _signin(client).accounts.create("sam", "Sam", "prov-2")
    info = _ok(
        client,
        "query($t: String!) { invite_info(token: $t) { name username } }",
        t=invite,
    )
    assert info["invite_info"] == {"name": "Sam", "username": "sam"}
    out = _ok(
        client,
        "mutation($t: String!, $p: String!) { accept_invite(token: $t, password: $p) "
        + PAYLOAD
        + " }",
        t=invite,
        p=PASSWORD,
    )
    assert out["accept_invite"]["token"]


def test_oauth_start_needs_a_configured_provider(client):
    err = _error(
        client, 'mutation { start_oauth_sign_in(provider: "google", remember: true) }'
    )
    assert "isn't set up" in err["message"]


def test_connect_oauth_account_needs_your_own_session(client, ana):
    query = (
        'mutation($pw: String!) { connect_oauth_account(provider: "google", '
        "current_password: $pw) }"
    )
    assert _error(client, query, pw=PASSWORD)["extensions"]["status"] == 401
    token = _sign_in(client)["token"]
    assert "isn't set up" in _error(client, query, token, pw=PASSWORD)["message"]


RESET = "mutation($e: String!) { request_password_reset(email: $e) }"


def test_reset_link_ignores_a_forged_host(client, ana, sent):
    r = client.post(
        "/graphql",
        json={"query": RESET, "variables": {"e": "ana@clinic.test"}},
        headers={"Host": "evil.example"},
    )
    assert r.status_code == 200 and not r.json().get("errors"), r.text
    body = sent[-1].get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "https://scribe.test/#reset=" in body and "evil.example" not in body


def test_forged_host_without_a_public_url_mints_nothing(settings, sent):
    client = TestClient(
        create_app(replace(settings, email_smtp_host="smtp.test")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    accounts = _signin(client).accounts
    accounts.create("ana", "Ana", "prov-1", email="ana@clinic.test")
    r = client.post(
        "/graphql",
        json={"query": RESET, "variables": {"e": "ana@clinic.test"}},
        headers={"Host": "evil.example"},
    )
    assert "BLINQ_SCRIBE_PUBLIC_URL" in r.json()["errors"][0]["message"]
    assert not _signin(client).store.run("SELECT 1 FROM password_resets")
    assert not sent


def test_the_open_demo_may_do_everything(client):
    me = _ok(client, "{ me { role provider_id permissions } }")["me"]
    assert me["role"] == "" and me["provider_id"] == ""
    assert {"team.manage", "note.sign", "letter.send"} <= set(me["permissions"])


def test_me_has_the_role_and_permissions(client, ana):
    query = "{ me { role provider_id permissions } }"
    vet = _ok(client, query, _sign_in(client)["token"])["me"]
    assert vet["role"] == "vet" and vet["provider_id"] == "prov-1"
    assert "note.sign" in vet["permissions"] and "team.manage" not in vet["permissions"]
    accounts = _signin(client).accounts
    desk, invite = accounts.create("desk", "Front Desk", role="front_office")
    assert desk.role == "front_office" and desk.provider_id == ""
    accounts.accept_invite(invite, PASSWORD)
    front = _ok(client, query, _sign_in(client, "desk")["token"])["me"]
    assert front["role"] == "front_office" and "letter.send" in front["permissions"]
    assert "note.sign" not in front["permissions"]
    rest = client.get(
        "/api/me", headers={"Authorization": f"Bearer {_sign_in(client)['token']}"}
    )
    assert rest.json()["role"] == "vet" and "note.sign" in rest.json()["permissions"]
