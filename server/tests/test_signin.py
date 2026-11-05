"""Sign in beyond username and password (requirement 57): Remember me, Forgot
password, 2FA codes by email, Continue with Google or Microsoft, Try the demo clinic.
SMTP is faked by replacing aiosmtplib.send; the OAuth providers by an httpx mock
transport."""

import base64
import hashlib
import logging
import re
import time
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import anyio
import httpx2
import pytest
from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import RSAKey

from blinqscribe import mailer as mailer_module
from blinqscribe.accounts import (
    DEMO_USERNAME,
    REMEMBER_DAYS,
    SHORT_SESSION_HOURS,
    AccountError,
)
from blinqscribe.api import create_app
from blinqscribe.mailer import Mailer
from blinqscribe.signin import CODE_TRIES, SignInError, TooManyTries

PASSWORD = "correct horse battery"


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _app_client(settings: Any) -> TestClient:
    return TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 50000)
    )


def _signin(client: TestClient) -> Any:
    return client.app.state.signin  # type: ignore[attr-defined]


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    """Every email handed to SMTP."""
    out: list[EmailMessage] = []

    async def fake_send(msg: EmailMessage, **kwargs: Any) -> None:
        out.append(msg)

    monkeypatch.setattr(mailer_module.aiosmtplib, "send", fake_send)
    return out


@pytest.fixture
def client(settings, sent, caplog):
    """Demo mode (the synthetic clinic), with SMTP set up and every log captured."""
    caplog.set_level(logging.DEBUG)
    return _app_client(
        replace(settings, email_smtp_host="smtp.test", public_url="https://scribe.test")
    )


def _person(
    client: TestClient,
    username: str,
    email: str,
    role: str = "vet",
    provider_id: str = "",
    headers: dict[str, str] | None = None,
) -> str:
    r = client.post(
        "/api/admin/users",
        json={
            "username": username,
            "name": username.title(),
            "email": email,
            "provider_id": provider_id,
            "role": role,
        },
        headers=headers or {},
    )
    assert r.status_code == 200, r.text
    invite = r.json()["invite_url"].split("#invite=")[1]
    r = client.post(
        "/api/auth/invite/accept", json={"token": invite, "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    return str(r.json()["token"])


@pytest.fixture
def team(client: TestClient) -> dict[str, str]:
    admin = _person(client, "maya", "maya@clinic.test", role="admin")
    vet = _person(client, "ana", "Ana@Clinic.test", "vet", "prov-1", _bearer(admin))
    return {"admin": admin, "vet": vet}


def _user(client: TestClient, username: str) -> Any:
    return next(u for u in _signin(client).accounts.list() if u.username == username)


def _expiry(client: TestClient, token: str) -> datetime:
    rows = _signin(client).store.run(
        "SELECT expires FROM sessions WHERE token_hash = ?",
        (hashlib.sha256(token.encode()).hexdigest(),),
    )
    return datetime.fromisoformat(rows[0][0])


def _login(client: TestClient, login: str, remember: bool = True) -> Any:
    return client.post(
        "/api/auth/login",
        json={"username": login, "password": PASSWORD, "remember": remember},
    )


# ---------- Remember me, email sign in, sessions ----------
def test_sign_in_with_email_and_remember_me(client, team):
    short = _login(client, "ANA@clinic.test", remember=False).json()["token"]
    long = _login(client, "ana", remember=True).json()["token"]
    now = datetime.now(UTC)
    assert _expiry(client, short) - now <= timedelta(hours=SHORT_SESSION_HOURS)
    assert _expiry(client, long) - now > timedelta(days=REMEMBER_DAYS - 1)
    bad = client.post(
        "/api/auth/login", json={"username": "ana@clinic.test", "password": "nope"}
    )
    assert bad.status_code == 401 and "don't match" in bad.json()["detail"]


def test_sign_out_everywhere_revokes_every_session(client, team):
    other = _login(client, "ana").json()["token"]
    _signin(client).accounts.revoke_sessions(_user(client, "ana").id)
    for token in (team["vet"], other):
        assert client.get("/api/me", headers=_bearer(token)).status_code == 401
    assert client.get("/api/me", headers=_bearer(team["admin"])).status_code == 200


def test_emails_are_checked_and_unique(client, team):
    accounts = _signin(client).accounts
    with pytest.raises(AccountError, match="already used"):
        accounts.create("ana2", "Ana Two", "prov-2", email="ana@clinic.test")
    with pytest.raises(AccountError, match="look right"):
        accounts.update(_user(client, "ana").id, email="not-an-email")
    r = client.patch(
        f"/api/admin/users/{_user(client, 'ana').id}",
        json={"email": "rivera@clinic.test"},
        headers=_bearer(team["admin"]),
    )
    assert r.status_code == 200 and r.json()["email"] == "rivera@clinic.test"


def test_sign_in_options_follow_the_settings(settings):
    plain = _app_client(settings)
    assert plain.get("/api/auth/options").json() == {
        "password": True,
        "google": False,
        "microsoft": False,
        "demo": True,
        "password_reset": False,
    }
    live = _app_client(
        replace(
            settings,
            google_sign_in_client_id="gid",
            google_sign_in_secret="gsecret",
            microsoft_sign_in_client_id="mid",
            microsoft_sign_in_secret="msecret",
            email_smtp_host="smtp.test",
            public_url="https://scribe.test",
        )
    )
    options = live.get("/api/auth/options").json()
    assert options["google"] and options["microsoft"] and options["password_reset"]


# ---------- 2FA codes by email ----------
_DEMO_CODE = re.compile(r"Demo mode: sign in code for \S+ is (\d{6})")


def _code(caplog: pytest.LogCaptureFixture) -> str:
    return _DEMO_CODE.findall(caplog.text)[-1]


def test_two_factor_code_finishes_sign_in(client, team, caplog, sent):
    _signin(client).accounts.set_two_factor(_user(client, "ana").id, True)
    r = _login(client, "ana", remember=False).json()
    # No session yet. Demo mode logs the code instead of emailing it, even with SMTP.
    assert "token" not in r and r["two_factor_required"] is True
    assert r["email_hint"] == "a•••@clinic.test" and not sent
    code = _code(caplog)
    result = anyio.run(_signin(client).verify_code, r["ticket"], code, "1.2.3.4")
    assert result.user.username == "ana"
    assert client.get("/api/me", headers=_bearer(result.token)).status_code == 200
    assert _expiry(client, result.token) - datetime.now(UTC) <= timedelta(hours=12)
    with pytest.raises(SignInError, match="expired"):  # single use
        anyio.run(_signin(client).verify_code, r["ticket"], code, "1.2.3.4")


def test_two_factor_code_allows_five_tries(client, team, caplog):
    _signin(client).accounts.set_two_factor(_user(client, "ana").id, True)
    ticket = _login(client, "ana").json()["ticket"]
    good = _code(caplog)
    wrong = f"{(int(good) + 1) % 10**6:06d}"
    for _ in range(CODE_TRIES):
        with pytest.raises(SignInError, match="doesn't match"):
            anyio.run(_signin(client).verify_code, ticket, wrong, "1.2.3.4")
    with pytest.raises(SignInError, match="expired"):
        anyio.run(_signin(client).verify_code, ticket, good, "1.2.3.4")


def test_two_factor_code_expires_after_ten_minutes(client, team, caplog):
    signin = _signin(client)
    signin.accounts.set_two_factor(_user(client, "ana").id, True)
    ticket = _login(client, "ana").json()["ticket"]
    signin.store.run(
        "UPDATE sign_in_codes SET expires = ?",
        ((datetime.now(UTC) - timedelta(seconds=1)).isoformat(),),
    )
    with pytest.raises(SignInError, match="expired"):
        anyio.run(signin.verify_code, ticket, _code(caplog), "1.2.3.4")


def test_resend_replaces_the_code_and_is_limited(client, team, caplog):
    signin = _signin(client)
    signin.accounts.set_two_factor(_user(client, "ana").id, True)
    ticket = _login(client, "ana").json()["ticket"]
    first = _code(caplog)
    anyio.run(signin.resend_code, ticket)
    anyio.run(signin.resend_code, ticket)
    with pytest.raises(TooManyTries):
        anyio.run(signin.resend_code, ticket)
    if first != _code(caplog):
        with pytest.raises(SignInError):
            anyio.run(signin.verify_code, ticket, first, "1.2.3.4")
    assert anyio.run(signin.verify_code, ticket, _code(caplog), "1.2.3.4").token


def test_wrong_codes_are_rate_limited_per_address(client, team):
    signin = _signin(client)
    for _ in range(10):
        with pytest.raises(SignInError):
            anyio.run(signin.verify_code, "made-up-ticket", "000000", "6.6.6.6")
    with pytest.raises(TooManyTries):
        anyio.run(signin.verify_code, "made-up-ticket", "000000", "6.6.6.6")


def test_admin_can_require_two_factor(client, team):
    accounts = _signin(client).accounts
    ana = _user(client, "ana")
    accounts.set_two_factor(ana.id, False, required=True)
    with pytest.raises(AccountError, match="requires"):
        accounts.set_two_factor(ana.id, False)
    assert _login(client, "ana").json()["two_factor_required"] is True
    nobody = accounts.create("noemail", "No Email", "prov-2")[0]
    with pytest.raises(AccountError, match="Add an email"):
        accounts.set_two_factor(nobody.id, False, required=True)


def test_invite_for_a_two_factor_person_asks_for_the_code(client, team):
    accounts = _signin(client).accounts
    sam, invite = accounts.create("sam", "Sam", "prov-2", email="sam@clinic.test")
    accounts.set_two_factor(sam.id, False, required=True)
    r = client.post(
        "/api/auth/invite/accept", json={"token": invite, "password": PASSWORD}
    ).json()
    assert "token" not in r and r["two_factor_required"] is True


def test_codes_are_emailed_outside_demo_mode_and_never_logged(
    client, team, caplog, sent
):
    signin = _signin(client)
    signin.demo = False
    signin.accounts.set_two_factor(_user(client, "ana").id, True)
    ticket = _login(client, "ana").json()["ticket"]
    body = sent[-1].get_body(("plain",)).get_content()  # type: ignore[union-attr]
    code = re.findall(r"\b\d{6}\b", body)[0]
    assert sent[-1]["To"] == "ana@clinic.test" and code not in caplog.text
    assert anyio.run(signin.verify_code, ticket, code, "1.2.3.4").token


def test_codes_need_email_outside_demo_mode(settings, caplog):
    client = _app_client(settings)  # no SMTP
    _person(client, "maya", "maya@clinic.test", role="admin")
    signin = _signin(client)
    signin.demo = False
    signin.accounts.set_two_factor(_user(client, "maya").id, True)
    r = _login(client, "maya")
    assert r.status_code == 400 and "email isn't set up" in r.json()["detail"]
    assert not _DEMO_CODE.search(caplog.text)


# ---------- Forgot password ----------
def _reset_token(sent: list[EmailMessage]) -> str:
    body = sent[-1].get_body(("plain",)).get_content()  # type: ignore[union-attr]
    link = next(w for w in body.split() if "#reset=" in w)
    # Built from BLINQ_SCRIBE_PUBLIC_URL, never the request; in the fragment.
    assert link.startswith("https://scribe.test/#reset=")
    return link.split("#reset=")[1]


def test_forgot_password_resets_once_and_signs_out_everywhere(client, team, sent):
    signin = _signin(client)
    anyio.run(signin.request_reset, "ana@clinic.test", "1.1.1.1")
    token = _reset_token(sent)
    with pytest.raises(SignInError, match="10 characters"):
        signin.reset_password(token, "short", "1.1.1.1")
    signin.reset_password(token, "a brand new password", "1.1.1.1")
    assert client.get("/api/me", headers=_bearer(team["vet"])).status_code == 401
    assert (
        client.post(
            "/api/auth/login",
            json={"username": "ana", "password": "a brand new password"},
        ).status_code
        == 200
    )
    with pytest.raises(SignInError, match="already used"):
        signin.reset_password(token, "another new password", "1.1.1.1")


def test_forgot_password_gives_the_same_answer_for_anyone(client, team, sent):
    signin = _signin(client)
    assert anyio.run(signin.request_reset, "nobody@x.test", "2.2.2.2") is None
    assert not sent
    # A person's email: the same (empty) answer, plus an email. Past three an hour,
    # nothing more is sent, still with the same answer.
    for _ in range(4):
        anyio.run(signin.request_reset, "ana@clinic.test", "2.2.2.3")
    assert len(sent) == 3


def test_forgot_password_is_rate_limited_per_address(client, team):
    signin = _signin(client)
    for _ in range(5):
        anyio.run(signin.request_reset, "x@x.test", "3.3.3.3")
    with pytest.raises(TooManyTries):
        anyio.run(signin.request_reset, "x@x.test", "3.3.3.3")


def test_reset_links_expire(client, team, sent):
    signin = _signin(client)
    anyio.run(signin.request_reset, "ana@clinic.test", "4.4.4.4")
    signin.store.run(
        "UPDATE password_resets SET expires = ?",
        ((datetime.now(UTC) - timedelta(seconds=1)).isoformat(),),
    )
    with pytest.raises(SignInError, match="expired"):
        signin.reset_password(_reset_token(sent), "a brand new password", "4.4.4.4")


@pytest.mark.parametrize("demo", [True, False])
def test_no_reset_without_smtp_and_no_secret_in_logs(settings, caplog, demo):
    caplog.set_level(logging.DEBUG)
    client = _app_client(settings)  # no SMTP
    _person(client, "maya", "maya@clinic.test", role="admin")
    signin = _signin(client)
    signin.demo = demo
    with pytest.raises(SignInError, match="isn't set up here"):
        anyio.run(signin.request_reset, "maya@clinic.test", "5.5.5.5")
    assert not signin.store.run("SELECT 1 FROM password_resets")
    assert "#reset=" not in caplog.text


def test_reset_links_never_reach_the_logs(client, team, caplog, sent):
    signin = _signin(client)
    anyio.run(signin.request_reset, "ana@clinic.test", "7.7.7.7")
    token = _reset_token(sent)
    assert token not in caplog.text and "#reset=" not in caplog.text
    assert "a•••@clinic.test" in caplog.text  # who and what, never the body


def test_a_failed_reset_email_leaves_no_live_link(client, team, monkeypatch, caplog):
    async def broken(*_: Any, **__: Any) -> None:
        raise OSError("smtp down")

    monkeypatch.setattr(mailer_module.aiosmtplib, "send", broken)
    signin = _signin(client)
    anyio.run(signin.request_reset, "ana@clinic.test", "8.8.8.8")
    assert not signin.store.run("SELECT 1 FROM password_resets")
    assert "#reset=" not in caplog.text


# ---------- Email over SMTP ----------
def test_mail_goes_over_smtp_when_a_host_is_set(settings, monkeypatch):
    calls: list[Any] = []

    async def fake_send(msg: Any, **kwargs: Any) -> None:
        calls.append((msg, kwargs))

    monkeypatch.setattr(mailer_module.aiosmtplib, "send", fake_send)
    mailer = Mailer(
        replace(settings, email_smtp_host="smtp.test", email_from="Scribe <s@x.test>")
    )
    assert anyio.run(
        lambda: mailer.send(
            "ana@clinic.test",
            "password_reset",
            name="Ana <b>",
            link="http://x/#reset=t",
            minutes=60,
        )
    )
    msg, kwargs = calls[0]
    assert msg["To"] == "ana@clinic.test" and kwargs["hostname"] == "smtp.test"
    assert kwargs["start_tls"] is True
    html = msg.get_body(("html",)).get_content()
    assert "Ana &lt;b&gt;" in html  # HTML templates escape what they are given


# ---------- Try the demo clinic ----------
def test_try_the_demo_clinic_signs_in_as_the_demo_vet(client):
    signin = _signin(client)
    result = anyio.run(signin.try_demo)
    assert result.user.username == DEMO_USERNAME
    assert result.user.provider_id == "prov-1" and result.user.role == "vet"
    me = client.get("/api/me", headers=_bearer(result.token)).json()
    assert me["via"] == "session" and me["admin"] is False
    # The open demo console stays open, and the demo vet has no password to steal.
    assert client.get("/api/auth/status").json() == {"login_required": False}
    assert not result.user.has_password
    assert anyio.run(signin.try_demo).user.id == result.user.id


def test_the_demo_vet_and_a_real_account_can_share_the_demo_provider(client, team):
    # A real account linked to the demo clinic's first provider (team's "ana", prov-1)
    # never locks Try the demo clinic out, and the demo vet never blocks a real one.
    signin = _signin(client)
    result = anyio.run(signin.try_demo)
    assert result.user.username == DEMO_USERNAME
    assert result.user.provider_id == "prov-1"
    admin = _bearer(team["admin"])
    r = client.post(
        "/api/admin/users",
        json={
            "username": "ana2",
            "name": "Ana Two",
            "email": "ana2@clinic.test",
            "provider_id": "prov-1",
            "role": "vet",
        },
        headers=admin,
    )
    # Still one real account per provider: ana has prov-1.
    assert r.status_code != 200 and "already linked to Ana" in r.text


def test_the_demo_clinic_is_only_in_demo_mode(client):
    signin = _signin(client)
    signin.demo = False
    with pytest.raises(SignInError, match="only in demo mode"):
        anyio.run(signin.try_demo)
    assert signin.options()["demo"] is False


# ---------- Continue with Google or Microsoft ----------
class FakeProvider:
    """A stand-in OpenID provider: discovery, signing keys and a token endpoint
    that checks PKCE and returns an ID token for whoever `claims` says."""

    def __init__(self, issuer: str, client_id: str, discovery: str):
        self.issuer, self.client_id, self.discovery = issuer, client_id, discovery
        self.key = RSAKey.generate_key(2048, parameters={"kid": "k1"}, private=True)
        self.claims: dict[str, Any] = {}
        self.challenge = self.nonce = ""
        self.token_calls = 0

    def authorized(self, url: str) -> str:
        """Read what the browser was sent to the provider with; return the state."""
        q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
        assert q["client_id"] == self.client_id and q["response_type"] == "code"
        assert q["code_challenge_method"] == "S256" and "openid" in q["scope"]
        self.challenge, self.nonce = q["code_challenge"], q["nonce"]
        return q["state"]

    def handler(self, request: httpx2.Request) -> httpx2.Response:
        url = str(request.url)
        if url == self.discovery:
            return httpx2.Response(
                200,
                json={
                    "issuer": self.issuer,
                    "authorization_endpoint": "https://idp.test/authorize",
                    "token_endpoint": "https://idp.test/token",
                    "jwks_uri": "https://idp.test/keys",
                },
            )
        if url == "https://idp.test/keys":
            return httpx2.Response(
                200, json={"keys": [self.key.as_dict(private=False)]}
            )
        if url == "https://idp.test/token":
            self.token_calls += 1
            form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            verifier = form.get("code_verifier", "")
            digest = hashlib.sha256(verifier.encode()).digest()
            pkce_ok = (
                base64.urlsafe_b64encode(digest).rstrip(b"=").decode() == self.challenge
            )
            if form.get("code") != "good-code" or not pkce_ok:
                return httpx2.Response(400, json={"error": "invalid_grant"})
            assert form["client_secret"] and form["redirect_uri"].endswith("/callback")
            now = int(time.time())
            claims = {
                "iss": self.issuer,
                "aud": self.client_id,
                "sub": "subject-1",
                "nonce": self.nonce,
                "iat": now,
                "exp": now + 300,
                **self.claims,
            }
            id_token = jwt.encode({"alg": "RS256", "kid": "k1"}, claims, self.key)
            return httpx2.Response(
                200,
                json={
                    "access_token": "a",
                    "token_type": "Bearer",
                    "id_token": id_token,
                },
            )
        return httpx2.Response(404)


GOOGLE_DISCOVERY = "https://accounts.google.com/.well-known/openid-configuration"
# OAuth only comes back to BLINQ_SCRIBE_PUBLIC_URL. Plain http here, so the test
# client sends the (otherwise Secure) browser cookie.
PUBLIC = "http://localhost"


@pytest.fixture
def google(settings):
    client = _app_client(
        replace(
            settings,
            google_sign_in_client_id="gid",
            google_sign_in_secret="gs",
            public_url=PUBLIC,
        )
    )
    fake = FakeProvider("https://accounts.google.com", "gid", GOOGLE_DISCOVERY)
    fake.claims = {"email": "ana@clinic.test", "email_verified": True}
    _signin(client).oidc["google"].transport = httpx2.MockTransport(fake.handler)
    admin = _person(client, "maya", "maya@clinic.test", role="admin")
    _person(client, "ana", "ana@clinic.test", "vet", "prov-1", _bearer(admin))
    return client, fake


def _oauth(client: TestClient, fake: FakeProvider, provider: str = "google") -> str:
    """Run the browser's side of the redirect dance; return the #fragment."""
    start = client.get(
        f"/api/auth/oauth/{provider}/start?remember=true", follow_redirects=False
    )
    assert start.status_code == 302, start.text
    assert start.headers["location"].startswith("https://idp.test/authorize?")
    state = fake.authorized(start.headers["location"])
    back = client.get(
        f"/api/auth/oauth/{provider}/callback?code=good-code&state={state}",
        follow_redirects=False,
    )
    assert back.status_code == 302
    location = back.headers["location"]
    assert location.startswith("http://localhost/#")
    return location.split("#", 1)[1]


def test_google_sign_in_for_an_invited_person(google):
    client, fake = google
    fragment = _oauth(client, fake)
    assert fragment.startswith("oauth=") and "token" not in fragment
    signin = _signin(client)
    result = anyio.run(signin.oauth_finish, fragment.removeprefix("oauth="))
    assert result.user.username == "ana" and result.token
    assert _expiry(client, result.token) - datetime.now(UTC) > timedelta(days=29)
    with pytest.raises(SignInError):  # the hand-off code works once
        anyio.run(signin.oauth_finish, fragment.removeprefix("oauth="))
    # Linked now: the same Google account still signs in after an email change.
    signin.accounts.update(_user(client, "ana").id, email="rivera@clinic.test")
    fake.claims["email"] = "someone-else@gmail.test"
    again = _oauth(client, fake).removeprefix("oauth=")
    assert anyio.run(signin.oauth_finish, again).user.username == "ana"


def test_google_sign_in_is_invite_only(google):
    client, fake = google
    fake.claims = {"email": "stranger@gmail.test", "email_verified": True}
    fragment = _oauth(client, fake)
    assert fragment.startswith("oauth_error=")
    assert "no Blinq Scribe account" in unquote(fragment)


def test_google_email_must_be_verified(google):
    client, fake = google
    fake.claims = {"email": "ana@clinic.test", "email_verified": False}
    assert _oauth(client, fake).startswith("oauth_error=")


def test_google_sign_in_still_asks_for_the_2fa_code(google):
    client, fake = google
    _signin(client).accounts.set_two_factor(_user(client, "ana").id, True)
    handoff = _oauth(client, fake).removeprefix("oauth=")
    result = anyio.run(_signin(client).oauth_finish, handoff)
    assert not result.token and result.two_factor_ticket


def test_oauth_state_is_single_use_and_checked(google):
    client, fake = google
    start = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    state = fake.authorized(start.headers["location"])
    forged = client.get(
        "/api/auth/oauth/google/callback?code=good-code&state=forged",
        follow_redirects=False,
    )
    assert "oauth_error=" in forged.headers["location"]
    ok = client.get(
        f"/api/auth/oauth/google/callback?code=good-code&state={state}",
        follow_redirects=False,
    )
    assert "#oauth=" in ok.headers["location"]
    replay = client.get(
        f"/api/auth/oauth/google/callback?code=good-code&state={state}",
        follow_redirects=False,
    )
    assert "oauth_error=" in replay.headers["location"]


def test_oauth_refuses_a_bad_code_or_a_wrong_nonce(google):
    client, fake = google
    start = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    state = fake.authorized(start.headers["location"])
    bad = client.get(
        f"/api/auth/oauth/google/callback?code=stolen&state={state}",
        follow_redirects=False,
    )
    assert "oauth_error=" in bad.headers["location"]
    fake.claims["nonce"] = "replayed"
    assert _oauth(client, fake).startswith("oauth_error=")


def test_oauth_refuses_a_token_signed_by_someone_else(google):
    client, fake = google
    published = fake.handler
    impostor = RSAKey.generate_key(2048, parameters={"kid": "k1"}, private=True)

    def other_keys(request: httpx2.Request) -> httpx2.Response:
        if str(request.url) == "https://idp.test/keys":
            return httpx2.Response(
                200, json={"keys": [impostor.as_dict(private=False)]}
            )
        return published(request)

    _signin(client).oidc["google"].transport = httpx2.MockTransport(other_keys)
    assert _oauth(client, fake).startswith("oauth_error=")


def test_unconfigured_providers_are_refused(client):
    r = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    assert r.status_code == 400 and "isn't set up" in r.json()["detail"]


MS_DISCOVERY = (
    "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
)
TENANT = "11111111-2222-3333-4444-555555555555"


def _microsoft(settings: Any, tenant: str = "common") -> tuple[TestClient, Any]:
    client = _app_client(
        replace(
            settings,
            microsoft_sign_in_client_id="mid",
            microsoft_sign_in_secret="m",
            microsoft_sign_in_tenant=tenant,
            public_url=PUBLIC,
        )
    )
    discovery = MS_DISCOVERY.replace("/common/", f"/{tenant}/")
    issuer = "https://login.microsoftonline.com/{tenantid}/v2.0"
    fake = FakeProvider(issuer, "mid", discovery)
    _signin(client).oidc["microsoft"].transport = httpx2.MockTransport(fake.handler)
    admin = _person(client, "maya", "maya@clinic.test", role="admin")
    _person(client, "ana", "ana@clinic.test", "vet", "prov-1", _bearer(admin))
    return client, fake


def _ms_claims(tid: str = TENANT, **more: Any) -> dict[str, Any]:
    return {
        "iss": f"https://login.microsoftonline.com/{tid}/v2.0",
        "tid": tid,
        "email": "ana@clinic.test",
        "preferred_username": "ana@clinic.test",
        **more,
    }


def test_microsoft_email_links_only_when_the_domain_is_verified(settings):
    client, fake = _microsoft(settings)
    # Any tenant can type any email for its users, so an unproven one never links.
    fake.claims = _ms_claims()
    fragment = unquote(_oauth(client, fake, "microsoft"))
    assert fragment.startswith("oauth_error=") and "password first" in fragment
    fake.claims = _ms_claims(xms_edov=True)
    assert _oauth(client, fake, "microsoft").startswith("oauth=")


def test_microsoft_own_tenant_still_needs_a_verified_email(settings):
    client, fake = _microsoft(settings, TENANT)
    fake.claims = _ms_claims()
    assert _oauth(client, fake, "microsoft").startswith("oauth_error=")
    fake.claims = _ms_claims(xms_edov=True)
    assert _oauth(client, fake, "microsoft").startswith("oauth=")


def test_microsoft_wrong_tenant_is_refused(settings):
    client, fake = _microsoft(settings, TENANT)
    other = "99999999-2222-3333-4444-555555555555"
    fake.claims = _ms_claims(other, xms_edov=True)
    assert _oauth(client, fake, "microsoft").startswith("oauth_error=")


def test_microsoft_token_from_another_issuer_is_refused(settings):
    client, fake = _microsoft(settings)
    fake.claims = _ms_claims(xms_edov=True)
    fake.claims["iss"] = "https://login.microsoftonline.com/another-tenant/v2.0"
    assert _oauth(client, fake, "microsoft").startswith("oauth_error=")


def test_google_workspace_domain_allowlist(settings):
    client = _app_client(
        replace(
            settings,
            google_sign_in_client_id="gid",
            google_sign_in_secret="gs",
            google_sign_in_domains="clinic.test",
            public_url=PUBLIC,
        )
    )
    fake = FakeProvider("https://accounts.google.com", "gid", GOOGLE_DISCOVERY)
    _signin(client).oidc["google"].transport = httpx2.MockTransport(fake.handler)
    _person(client, "maya", "maya@clinic.test", role="admin")
    fake.claims = {"email": "maya@clinic.test", "email_verified": True}
    assert _oauth(client, fake).startswith("oauth_error=")  # personal Gmail, no hd
    fake.claims["hd"] = "clinic.test"
    assert _oauth(client, fake).startswith("oauth=")


# ---------- connecting an account from a signed-in session ----------
GQL_LINK = (
    "mutation($p: String!, $pw: String!) "
    "{ connect_oauth_account(provider: $p, current_password: $pw) }",
    "mutation($c: String!) { finish_oauth_link(code: $c) { username } }",
)


def _gql(client: TestClient, query: str, token: str, **variables: Any) -> Any:
    r = client.post(
        "/graphql",
        json={"query": query, "variables": variables},
        headers=_bearer(token),
    )
    assert r.status_code == 200, r.text
    return r.json()


def _connect(client: TestClient, fake: FakeProvider, token: str, provider: str) -> str:
    """Connect from a signed-in session, as the web app does; returns the
    callback's #fragment."""
    started = _gql(client, GQL_LINK[0], token, p=provider, pw=PASSWORD)
    state = fake.authorized(started["data"]["connect_oauth_account"])
    back = client.get(
        f"/api/auth/oauth/{provider}/callback?code=good-code&state={state}",
        follow_redirects=False,
    )
    return str(back.headers["location"]).split("#", 1)[1]


def _sign_in_token(client: TestClient, login: str) -> str:
    return str(_login(client, login).json()["token"])


def test_connecting_from_a_signed_in_session_links_any_account(settings):
    client, fake = _microsoft(settings)
    ana = _sign_in_token(client, "ana")
    # No verified email: sign in refuses, but a signed-in vet can connect it.
    fake.claims = _ms_claims(email="ana.personal@outlook.test")
    assert _oauth(client, fake, "microsoft").startswith("oauth_error=")
    fragment = _connect(client, fake, ana, "microsoft")
    assert fragment.startswith("oauth_link=")  # nothing linked by the callback
    assert _oauth(client, fake, "microsoft").startswith("oauth_error=")
    done = _gql(client, GQL_LINK[1], ana, c=fragment.removeprefix("oauth_link="))
    assert done["data"]["finish_oauth_link"]["username"] == "ana"
    handoff = _oauth(client, fake, "microsoft").removeprefix("oauth=")
    assert anyio.run(_signin(client).oauth_finish, handoff).user.username == "ana"
    # The same Microsoft account can't then be connected to someone else.
    maya = _sign_in_token(client, "maya")
    code = _connect(client, fake, maya, "microsoft").removeprefix("oauth_link=")
    assert (
        "someone else"
        in _gql(client, GQL_LINK[1], maya, c=code)["errors"][0]["message"]
    )


def test_a_link_code_redeemed_by_someone_else_links_nothing(settings):
    client, fake = _microsoft(settings)
    ana, maya = _sign_in_token(client, "ana"), _sign_in_token(client, "maya")
    fake.claims = _ms_claims(email="ana.personal@outlook.test")
    code = _connect(client, fake, ana, "microsoft").removeprefix("oauth_link=")
    refused = _gql(client, GQL_LINK[1], maya, c=code)
    assert "your own sign in" in refused["errors"][0]["message"]
    assert not _signin(client).store.oauth_identity_user("microsoft", "subject-1")
    # The code was spent by the refusal, so it can't be retried either.
    assert _gql(client, GQL_LINK[1], ana, c=code)["errors"]


def test_a_sign_in_code_can_not_finish_a_link_or_the_reverse(google):
    client, fake = google
    sign_in_code = _oauth(client, fake).removeprefix("oauth=")
    ana = _sign_in_token(client, "ana")
    assert _gql(client, GQL_LINK[1], ana, c=sign_in_code)["errors"]
    link_code = _connect(client, fake, ana, "google").removeprefix("oauth_link=")
    with pytest.raises(SignInError):
        anyio.run(_signin(client).oauth_finish, link_code)


# ---------- the browser that starts is the browser that finishes ----------
def _started(client: TestClient, fake: FakeProvider) -> str:
    start = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    assert "blinq_oauth=" in start.headers["set-cookie"]
    cookie = start.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert "path=/api/auth/oauth/google/callback" in cookie
    return fake.authorized(start.headers["location"])


def test_the_callback_needs_the_starting_browsers_cookie(google):
    client, fake = google
    state = _started(client, fake)
    client.cookies.clear()  # the provider URL opened in another browser
    back = client.get(
        f"/api/auth/oauth/google/callback?code=good-code&state={state}",
        follow_redirects=False,
    )
    assert "oauth_error=" in back.headers["location"]
    assert fake.token_calls == 0  # refused before the code was even used


def test_another_browsers_cookie_does_not_count(google):
    client, fake = google
    victim_state = _started(client, fake)
    client.cookies.clear()
    _started(client, fake)  # the attacker's own flow sets the attacker's cookie
    back = client.get(
        f"/api/auth/oauth/google/callback?code=good-code&state={victim_state}",
        follow_redirects=False,
    )
    assert "oauth_error=" in back.headers["location"]


def test_a_secure_cookie_when_the_public_url_is_https(settings):
    client = _app_client(
        replace(
            settings,
            google_sign_in_client_id="gid",
            google_sign_in_secret="gs",
            public_url="https://scribe.test",
        )
    )
    fake = FakeProvider("https://accounts.google.com", "gid", GOOGLE_DISCOVERY)
    _signin(client).oidc["google"].transport = httpx2.MockTransport(fake.handler)
    start = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    assert "secure" in start.headers["set-cookie"].lower()
    assert "redirect_uri=https%3A%2F%2Fscribe.test%2Fapi" in start.headers["location"]


def test_oauth_needs_a_public_url_and_ignores_the_host(settings):
    plain = _app_client(
        replace(settings, google_sign_in_client_id="gid", google_sign_in_secret="gs")
    )
    assert plain.get("/api/auth/options").json()["google"] is False
    r = plain.get("/api/auth/oauth/google/start", follow_redirects=False)
    assert r.status_code == 400
    r = plain.get(
        "/api/auth/oauth/google/callback?code=x&state=y",
        headers={"Host": "evil.example"},
        follow_redirects=False,
    )
    assert r.status_code == 400 and "location" not in r.headers


def test_the_callback_redirects_to_the_public_url_whatever_the_host(google):
    client, fake = google
    state = _started(client, fake)
    back = client.get(
        f"/api/auth/oauth/google/callback?code=good-code&state={state}",
        headers={"Host": "evil.example"},
        follow_redirects=False,
    )
    assert back.headers["location"].startswith("http://localhost/#")


def test_no_reset_without_a_public_url(settings, sent, caplog):
    caplog.set_level(logging.DEBUG)
    client = _app_client(replace(settings, email_smtp_host="smtp.test"))
    _person(client, "maya", "maya@clinic.test", role="admin")
    signin = _signin(client)
    assert signin.options()["password_reset"] is False
    with pytest.raises(SignInError, match="BLINQ_SCRIBE_PUBLIC_URL"):
        anyio.run(signin.request_reset, "maya@clinic.test", "5.5.5.6")
    assert not signin.store.run("SELECT 1 FROM password_resets") and not sent


# ---------- review fixes ----------
def test_the_demo_username_is_reserved(client, team):
    accounts = _signin(client).accounts
    with pytest.raises(AccountError, match="taken"):
        accounts.create(DEMO_USERNAME, "Someone", role="admin")
    r = client.post(
        "/api/admin/users",
        json={"username": "Demo.Vet", "name": "Someone", "role": "admin"},
        headers=_bearer(team["admin"]),
    )
    assert r.status_code == 400


def test_outside_demo_mode_the_demo_username_closes_the_console(client):
    from blinqscribe.accounts import Accounts

    demo = _signin(client).accounts
    demo.create_demo_user("prov-1", "Dr. Ana Rivera")
    assert demo.any_users() is False  # demo mode: still the open demo
    live = Accounts(demo.store, demo=False)
    assert live.any_users() is True  # anywhere else it is a real account
    with pytest.raises(AccountError, match="only in demo mode"):
        live.create_demo_user("prov-2", "Dr. Sam Okafor")


def test_wrong_codes_are_limited_per_person_across_sign_ins(client, team, caplog):
    signin = _signin(client)
    signin.accounts.set_two_factor(_user(client, "ana").id, True)

    def fresh_ticket(n: int) -> str:
        r = anyio.run(signin.with_password, "ana", PASSWORD, False, f"10.0.0.{n}")
        return str(r.two_factor_ticket)

    for n in range(2):  # two sign ins, five misses each, each from a new address
        ticket = fresh_ticket(n)
        wrong = f"{(int(_code(caplog)) + 1) % 10**6:06d}"
        for _ in range(CODE_TRIES):
            with pytest.raises(SignInError, match="doesn't match"):
                anyio.run(signin.verify_code, ticket, wrong, f"10.0.1.{n}")
    # A third password sign in gets a ticket, but even the right code is refused.
    ticket = fresh_ticket(9)
    with pytest.raises(TooManyTries, match="wrong codes"):
        anyio.run(signin.verify_code, ticket, _code(caplog), "10.0.2.1")


def test_connected_accounts_remember_the_email_and_when(google):
    client, fake = google
    anyio.run(_signin(client).oauth_finish, _oauth(client, fake).removeprefix("oauth="))
    rows = _signin(client).store.oauth_identities(_user(client, "ana").id)
    assert rows[0].provider == "google" and rows[0].email == "ana@clinic.test"
    assert datetime.fromisoformat(rows[0].connected_at) <= datetime.now(UTC)
