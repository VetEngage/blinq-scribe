"""Account settings over GraphQL: the signed-in person's own password, profile,
connected Google or Microsoft accounts and 2FA switch."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import peewee
import pytest
from fastapi.testclient import TestClient

from blinqscribe.accounts import DEMO_USERNAME
from blinqscribe.api import create_app
from blinqscribe.db import SessionRow
from blinqscribe.signin import SignInError, TooManyTries

PASSWORD = "correct horse battery"
NEW = "a brand new password"


@pytest.fixture
def client(settings: Any) -> TestClient:
    return TestClient(
        create_app(replace(settings, public_url="https://scribe.test")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _signin(client: TestClient) -> Any:
    return client.app.state.signin  # type: ignore[attr-defined]


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


def _error(client: TestClient, query: str, token: str = "", **variables: Any) -> str:
    body = _gql(client, query, token, **variables)
    assert body.get("errors"), body
    return str(body["errors"][0]["message"])


SIGN_IN = (
    "mutation($l: String!, $p: String!) "
    "{ sign_in(login: $l, password: $p, remember: true) { token } }"
)
CHANGE = (
    "mutation($n: String!, $c: String!) "
    "{ change_password(new_password: $n, current_password: $c) }"
)
PROFILE = (
    "mutation($name: String, $email: String, $c: String!) "
    "{ update_my_profile(name: $name, email: $email, current_password: $c) "
    "{ name email } }"
)
CONNECTED = "{ my_connected_accounts { provider email connected_at } }"
DISCONNECT = (
    'mutation($p: String!, $c: String! = "") '
    "{ disconnect_oauth_account(provider: $p, current_password: $c) }"
)
ME = "{ me { via user { username has_password } } }"
CONNECT = (
    'mutation($p: String!, $c: String! = "") '
    "{ connect_oauth_account(provider: $p, current_password: $c) }"
)


@pytest.fixture
def ana(client: TestClient) -> str:
    """Ana's user id; she has a password and an email."""
    accounts = _signin(client).accounts
    _, invite = accounts.create("maya", "Maya", role="admin", email="m@c.test")
    accounts.accept_invite(invite, PASSWORD)
    vet, invite = accounts.create("ana", "Ana", "prov-1", email="ana@clinic.test")
    accounts.accept_invite(invite, PASSWORD)
    return str(vet.id)


def _sign_in(client: TestClient, login: str = "ana", password: str = PASSWORD) -> str:
    return str(_ok(client, SIGN_IN, l=login, p=password)["sign_in"]["token"])


@pytest.fixture
def audits(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    store = _signin(client).store
    seen: list[str] = []
    real = store.audit

    def record(actor: str, action: str, *rest: Any) -> None:
        seen.append(f"{actor}:{action}")
        real(actor, action, *rest)

    monkeypatch.setattr(store, "audit", record)
    return seen


def _age_sessions(client: TestClient, minutes: int) -> None:
    started = (datetime.now(UTC) - timedelta(minutes=minutes)).isoformat()
    store = _signin(client).store
    peewee.ModelUpdate(SessionRow, {SessionRow.created_at: started}).execute(store.db)


# ---------- who has a settings screen ----------
def test_the_open_demo_has_no_account(client):
    assert _ok(client, ME)["me"] == {"via": "open", "user": None}
    assert "own account" in _error(client, CONNECTED)


# ---------- change password ----------
def test_change_password_needs_the_current_one_and_keeps_this_session(
    client, ana, audits
):
    here, elsewhere = _sign_in(client), _sign_in(client)
    assert "current password" in _error(client, CHANGE, here, n=NEW, c="wrong one")
    assert "10 characters" in _error(client, CHANGE, here, n="short", c=PASSWORD)
    assert _ok(client, CHANGE, here, n=NEW, c=PASSWORD)["change_password"] is True
    assert _ok(client, ME, here)["me"]["user"]["username"] == "ana"
    assert "sign in" in _error(client, ME, elsewhere).lower()  # signed out
    assert _sign_in(client, "ana", NEW)
    assert "ana:password_changed" in audits


def test_change_password_is_rate_limited(client, ana):
    token = _sign_in(client)
    for _ in range(5):
        assert "current password" in _error(client, CHANGE, token, n=NEW, c="nope")
    body = _gql(client, CHANGE, token, n=NEW, c=PASSWORD)
    assert body["errors"][0]["extensions"]["code"] == "TOO_MANY_TRIES"


def test_an_account_with_no_password_sets_one_only_right_after_signing_in(client, ana):
    accounts = _signin(client).accounts
    sam, _ = accounts.create("sam", "Sam", "prov-2", email="sam@clinic.test")
    token = accounts.start_session(sam.id, True)  # as after Google sign in
    _age_sessions(client, 30)
    assert "sign in again" in _error(client, CHANGE, token, n=NEW, c="").lower()
    fresh = accounts.start_session(sam.id, True)
    assert _ok(client, CHANGE, fresh, n=NEW, c="")["change_password"] is True
    assert _ok(client, ME, fresh)["me"]["user"]["has_password"] is True


# ---------- profile ----------
def test_name_changes_freely_and_email_needs_the_password(client, ana, audits):
    token = _sign_in(client)
    out = _ok(client, PROFILE, token, name="Dr. Ana Rivera", c="")
    assert out["update_my_profile"]["name"] == "Dr. Ana Rivera"
    assert "current password" in _error(
        client, PROFILE, token, email="rivera@clinic.test", c=""
    )
    taken = _error(client, PROFILE, token, email="m@c.test", c=PASSWORD)
    assert "already used" in taken
    out = _ok(client, PROFILE, token, email="Rivera@Clinic.test", c=PASSWORD)
    assert out["update_my_profile"]["email"] == "rivera@clinic.test"
    assert "Add your name" in _error(client, PROFILE, token, name="  ", c="")
    assert audits.count("ana:profile_updated") == 2


def test_changing_email_keeps_connected_accounts(client, ana):
    store = _signin(client).store
    store.link_oauth_identity(
        "google", "g-1", ana, replace=False, email="ana@clinic.test"
    )
    token = _sign_in(client)
    _ok(client, PROFILE, token, email="rivera@clinic.test", c=PASSWORD)
    accounts = _ok(client, CONNECTED, token)["my_connected_accounts"]
    assert [a["provider"] for a in accounts] == ["google"]
    assert store.oauth_identity_user("google", "g-1") == ana


# ---------- connected accounts ----------
def test_list_and_disconnect_connected_accounts(client, ana, audits):
    store = _signin(client).store
    store.link_oauth_identity("microsoft", "m-1", ana, replace=False, email="a@x.test")
    token = _sign_in(client)
    listed = _ok(client, CONNECTED, token)["my_connected_accounts"]
    assert listed[0]["provider"] == "microsoft" and listed[0]["email"] == "a@x.test"
    assert listed[0]["connected_at"]
    assert "current password" in _error(client, DISCONNECT, token, p="microsoft")
    assert "isn't connected" in _error(
        client, DISCONNECT, token, p="google", c=PASSWORD
    )
    out = _ok(client, DISCONNECT, token, p="microsoft", c=PASSWORD)
    assert out["disconnect_oauth_account"] is True
    assert _ok(client, CONNECTED, token)["my_connected_accounts"] == []
    assert "ana:sign_in_disconnected" in audits


def test_the_last_way_to_sign_in_can_not_be_disconnected(client, ana):
    accounts, store = _signin(client).accounts, _signin(client).store
    sam, _ = accounts.create("sam", "Sam", "prov-2", email="sam@clinic.test")
    store.link_oauth_identity("google", "g-sam", sam.id, replace=False)
    token = accounts.start_session(sam.id, True)
    assert "no way to sign in" in _error(client, DISCONNECT, token, p="google")
    store.link_oauth_identity("microsoft", "m-sam", sam.id, replace=False)
    assert _ok(client, DISCONNECT, token, p="google")["disconnect_oauth_account"]


# ---------- 2FA switch ----------
def test_two_factor_switch_rules(client, ana):
    signin = _signin(client)
    token = _sign_in(client)
    on = "mutation { set_two_factor(enabled: true) { two_factor } }"
    off = (
        'mutation { set_two_factor(enabled: false, current_password: "'
        + PASSWORD
        + '") { two_factor } }'
    )
    bare = "mutation { set_two_factor(enabled: false) { two_factor } }"
    # Demo mode: no SMTP is fine, the code goes to the server terminal.
    assert _ok(client, on, token)["set_two_factor"]["two_factor"] is True
    assert "current password" in _error(client, bare, token)  # a session isn't enough
    signin.demo = False  # a real clinic with no SMTP can't send codes
    _ok(client, off, token)
    assert "Email isn't set up" in _error(client, on, token)
    signin.demo = True
    signin.accounts.set_two_factor(ana, False, required=True)
    assert "requires" in _error(client, off, token)


# ---------- the demo vet ----------
def test_the_demo_account_can_not_be_changed(client):
    demo = _ok(client, "mutation { try_demo_clinic { token } }")
    token = demo["try_demo_clinic"]["token"]
    me = _ok(client, ME, token)["me"]["user"]
    assert me["username"] == DEMO_USERNAME and me["has_password"] is False
    # Everyone shares it, so nothing about it can be changed by a visitor.
    for query, args in (
        (CHANGE, {"n": NEW, "c": ""}),
        (PROFILE, {"email": "demo@x.test", "c": ""}),
        (PROFILE, {"name": "Someone else", "c": ""}),
        ("mutation { set_two_factor(enabled: true) { id } }", {}),
        ("mutation { sign_out_other_sessions }", {}),
        ("mutation { sign_out_everywhere }", {}),
        (DISCONNECT, {"p": "google"}),
        (CONNECT, {"p": "google"}),
    ):
        assert _error(client, query, token, **args) == (
            "The demo account can't be changed."
        )
    assert _ok(client, CONNECTED, token)["my_connected_accounts"] == []


def test_sign_out_other_sessions_keeps_this_one(client, ana, audits):
    here, elsewhere = _sign_in(client), _sign_in(client)
    query = "mutation { sign_out_other_sessions }"
    assert _ok(client, query, here)["sign_out_other_sessions"] is True
    assert _ok(client, ME, here)["me"]["user"]["username"] == "ana"
    assert "sign in" in _error(client, ME, elsewhere).lower()
    assert "ana:signed_out_other_sessions" in audits


# ---------- a stolen session is not enough ----------
def test_connecting_an_account_needs_the_current_password(settings):
    client = TestClient(
        create_app(
            replace(
                settings,
                public_url="https://scribe.test",
                google_sign_in_client_id="gid",
                google_sign_in_secret="gs",
            )
        ),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    accounts = _signin(client).accounts
    vet, invite = accounts.create("ana", "Ana", "prov-1", email="ana@clinic.test")
    accounts.accept_invite(invite, PASSWORD)
    token = _sign_in(client)
    assert "current password" in _error(client, CONNECT, token, p="google")
    assert "current password" in _error(client, CONNECT, token, p="google", c="x")
    assert not _signin(client).store.oauth_identities(vet.id)
    # A password-less account needs a sign in in the last 10 minutes instead.
    sam, _ = accounts.create("sam", "Sam", "prov-2", email="sam@clinic.test")
    stale = accounts.start_session(sam.id, True)
    _age_sessions(client, 30)
    assert "sign in again" in _error(client, CONNECT, stale, p="google").lower()


def test_wrong_current_passwords_are_limited_per_person(client, ana):
    signin = _signin(client)
    user = signin.accounts.get(ana)
    token = _sign_in(client)
    for n in range(10):  # a new address every time
        with pytest.raises(SignInError, match="current password"):
            signin.prove(user, token, "wrong", f"10.9.{n}.1")
    with pytest.raises(TooManyTries):
        signin.prove(user, token, PASSWORD, "10.9.99.1")


# ---------- profile details ----------
def test_a_new_email_ends_pending_reset_links(client, ana):
    from blinqscribe.signin import _hash

    store = _signin(client).store
    store.set_password_reset(
        ana, _hash("old-link"), datetime.now(UTC) + timedelta(hours=1)
    )
    token = _sign_in(client)
    _ok(client, PROFILE, token, email="rivera@clinic.test", c=PASSWORD)
    assert store.password_reset(_hash("old-link")) is None


def test_names_are_trimmed_and_cleaned(client, ana):
    token = _sign_in(client)
    out = _ok(client, PROFILE, token, name="Dr.\x00 Ana\x1b" + "x" * 200, c="")
    name = out["update_my_profile"]["name"]
    assert len(name) == 80 and "\x00" not in name and "\x1b" not in name


def test_an_email_taken_at_the_same_moment_is_a_plain_error(client, ana, monkeypatch):
    store = _signin(client).store

    def clash(*_: Any, **__: Any) -> None:
        raise peewee.IntegrityError("UNIQUE constraint failed: users.email")

    monkeypatch.setattr(store, "update_user", clash)
    token = _sign_in(client)
    message = _error(client, PROFILE, token, email="new@clinic.test", c=PASSWORD)
    assert message == "That email is already used."
