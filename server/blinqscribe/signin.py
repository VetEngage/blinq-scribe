"""Signing in, beyond username and password: Remember me, Forgot password, 2FA codes
by email, Continue with Google or Microsoft, and Try the demo clinic.

Every secret handed out here (reset links, code tickets, OAuth state and hand-off
codes) is random, single use, short lived and stored only as a SHA-256 hash. A session
token never goes into a URL, and reset links and hand-off codes ride in the #fragment,
which browsers never send to a server.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel

from .accounts import DEMO_USERNAME, AccountError, Accounts, User
from .adapters import PracticeAdapter
from .db import SignInCodeRow
from .mailer import Mailer, masked
from .oidc import Identity, OidcClient, OidcError
from .store import Store

CODE_MINUTES = 10
CODE_TRIES = 5
CODE_SENDS = 3  # the first email plus two resends per sign in
FRESH_SIGN_IN_MINUTES = 10  # a password-less account proves itself by signing in
CODE_USER_MISSES = 10  # wrong codes per person in 15 minutes, across sign ins
RESET_MINUTES = 60
OAUTH_MINUTES = 10
HANDOFF_SECONDS = 120

log = logging.getLogger("blinqscribe.signin")


class SignInError(ValueError):
    """A refused step. The message is safe to show."""

    status = 400


class WrongLogin(SignInError):
    status = 401


class TooManyTries(SignInError):
    status = 429


class SignInResult(BaseModel):
    """Either a session, or a 2FA step to finish first."""

    token: str = ""
    user: User | None = None
    two_factor_ticket: str = ""
    # "app": the code from their authenticator app (an emailed code is the backup);
    # "email": a code we emailed.
    two_factor_method: str = ""
    email_hint: str = ""  # m•••@clinic.com, so the person knows where to look


class Limiter:
    """At most `limit` hits per key in a sliding window. In-process, like the
    sign in throttle in api.py: run one worker or move this to the database."""

    def __init__(self, limit: int, seconds: float):
        self.limit, self.seconds = limit, seconds
        self.hits: defaultdict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        recent = [t for t in self.hits[key] if now - t < self.seconds]
        if len(recent) >= self.limit:
            self.hits[key] = recent
            return False
        self.hits[key] = [*recent, now]
        return True

    def full(self, key: str) -> bool:
        """At the limit, without counting this check as a hit."""
        now = time.monotonic()
        self.hits[key] = [t for t in self.hits[key] if now - t < self.seconds]
        return len(self.hits[key]) >= self.limit

    def hit(self, key: str) -> None:
        self.hits[key].append(time.monotonic())


def _now() -> datetime:
    return datetime.now(UTC)


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _expired(iso: str) -> bool:
    return datetime.fromisoformat(iso) < _now()


class SignInService:
    def __init__(
        self,
        store: Store,
        accounts: Accounts,
        mailer: Mailer,
        adapter: PracticeAdapter,
        oidc: dict[str, OidcClient],
        demo: bool,
        public_url: str = "",
    ):
        self.store, self.accounts, self.mailer = store, accounts, mailer
        self.adapter, self.oidc, self.demo = adapter, oidc, demo
        # Emailed links are built only from this, never from a request's Host
        # header, which anyone can forge to have a reset link point at their site.
        self.public_url = public_url.rstrip("/")
        self.password_limit = Limiter(5, 15 * 60)  # per address and email
        self.code_limit = Limiter(10, 15 * 60)  # wrong codes per address
        # Wrong codes per person, across every ticket: a fresh password sign in
        # makes a new ticket but never resets this.
        self.code_user_limit = Limiter(CODE_USER_MISSES, 15 * 60)
        self.reset_ip_limit = Limiter(5, 60 * 60)
        self.reset_email_limit = Limiter(3, 60 * 60)  # silent: same answer
        self.oauth_limit = Limiter(20, 15 * 60)
        self.account_limit = Limiter(5, 15 * 60)  # current password, per address
        # Wrong current passwords per person, from any number of addresses.
        self.account_user_limit = Limiter(10, 60 * 60)

    # ---------- what the sign in page shows ----------
    def options(self) -> dict[str, bool]:
        return {
            "password": True,
            # Google and Microsoft come back to BLINQ_SCRIBE_PUBLIC_URL only.
            "google": "google" in self.oidc and bool(self.public_url),
            "microsoft": "microsoft" in self.oidc and bool(self.public_url),
            "demo": self.demo,
            # A reset link is only made when it can be emailed, to a known address.
            "password_reset": self.mailer.live and bool(self.public_url),
        }

    # ---------- email and password ----------
    async def with_password(
        self, login: str, password: str, remember: bool, address: str
    ) -> SignInResult:
        key = f"{address}|{login.strip().lower()}"
        if not self.password_limit.allow(key):
            raise TooManyTries("Too many tries. Wait 15 minutes and try again.")
        try:
            user = self.accounts.check_login(login, password)
        except AccountError as exc:
            self.store.audit("anonymous", "sign_in_failed", None, {"login": login[:64]})
            raise WrongLogin(str(exc)) from exc
        self.password_limit.hits.pop(key, None)
        return await self.finish(user, remember, "password")

    async def finish(self, user: User, remember: bool, method: str) -> SignInResult:
        """The person proved who they are; ask for a code first if 2FA is on."""
        if user.two_factor or user.two_factor_required:
            if user.authenticator:
                return self._app_ticket(user, remember)
            return await self._send_code(user, remember)
        token = self.accounts.start_session(user.id, remember)
        self.store.audit(user.username, "signed_in", None, {"method": method})
        return SignInResult(token=token, user=user)

    # ---------- 2FA: the authenticator app, or a code by email ----------
    def _app_ticket(self, user: User, remember: bool) -> SignInResult:
        ticket = secrets.token_urlsafe(32)
        self.store.add_sign_in_code(
            _hash(ticket),
            user.id,
            "",  # an emailed backup code, once asked for
            remember,
            _now() + timedelta(minutes=CODE_MINUTES),
            method="app",
        )
        return SignInResult(
            two_factor_ticket=ticket,
            two_factor_method="app",
            email_hint=masked(user.email) if user.email else "",
        )

    async def _send_code(self, user: User, remember: bool) -> SignInResult:
        if not user.email:
            raise SignInError(
                "Two step sign in is on, but your account has no email. "
                "Ask your admin to add one."
            )
        if not self.demo and not self.mailer.live:
            raise SignInError(
                "Two step sign in needs email, and email isn't set up here. "
                "Ask your admin."
            )
        ticket, code = secrets.token_urlsafe(32), f"{secrets.randbelow(10**6):06d}"
        self.store.add_sign_in_code(
            _hash(ticket),
            user.id,
            _hash(ticket + code),
            remember,
            _now() + timedelta(minutes=CODE_MINUTES),
        )
        await self._mail_code(user, code)
        return SignInResult(
            two_factor_ticket=ticket,
            two_factor_method="email",
            email_hint=masked(user.email),
        )

    async def _mail_code(self, user: User, code: str) -> None:
        if self.demo:
            # Demo mode shows the code in the server log instead of emailing it:
            # only the 6 digits, the one secret here that may ever be logged.
            log.warning("Demo mode: sign in code for %s is %s", user.username, code)
            return
        await self.mailer.send(
            user.email, "sign_in_code", name=user.name, code=code, minutes=CODE_MINUTES
        )

    def _code_row(self, ticket: str) -> SignInCodeRow | None:
        row = self.store.sign_in_code(_hash(ticket))
        if not row or _expired(row.expires) or row.tries >= CODE_TRIES:
            return None
        return row

    async def verify_code(self, ticket: str, code: str, address: str) -> SignInResult:
        if not self.code_limit.allow(address):
            raise TooManyTries("Too many tries. Wait 15 minutes and try again.")
        row = self._code_row(ticket)
        if not row:
            raise SignInError("That code has expired. Sign in again for a new one.")
        uid, remember = row.user_id, row.remember
        if self.code_user_limit.full(uid):
            raise TooManyTries("Too many wrong codes. Wait 15 minutes and try again.")
        emailed = bool(row.code_hash) and hmac.compare_digest(
            _hash(ticket + code.strip()), row.code_hash
        )
        from_app = (
            not emailed
            and row.method == "app"
            and self.accounts.check_authenticator(uid, code)
        )
        if not (emailed or from_app):
            self.store.sign_in_code_missed(_hash(ticket))
            self.code_user_limit.hit(uid)
            raise SignInError(
                "That code doesn't match. Check your authenticator app."
                if row.method == "app" and not row.code_hash
                else "That code doesn't match. Check the latest email."
            )
        self.store.end_sign_in_code(_hash(ticket))
        user = self.accounts.get(uid)
        if not user or not user.active:
            raise SignInError("That code has expired. Sign in again for a new one.")
        self.code_limit.hits.pop(address, None)
        token = self.accounts.start_session(uid, bool(remember))
        self.store.audit(
            user.username,
            "signed_in",
            None,
            {"method": "authenticator" if from_app else "code"},
        )
        return SignInResult(token=token, user=user)

    async def resend_code(self, ticket: str) -> SignInResult:
        """Email a (new) code. For someone with an authenticator app this is the
        backup: the emailed code works as well as the app's."""
        row = self._code_row(ticket)
        user = self.accounts.get(row.user_id) if row else None
        if not row or not user or not user.active:
            raise SignInError("That code has expired. Sign in again for a new one.")
        if not user.email:
            raise SignInError("Your account has no email. Ask your admin to add one.")
        if not self.demo and not self.mailer.live:
            raise SignInError("Email isn't set up here. Ask your admin.")
        if row.sends >= CODE_SENDS:
            raise TooManyTries("We've sent a few codes already. Sign in again.")
        code = f"{secrets.randbelow(10**6):06d}"
        self.store.resend_sign_in_code(
            _hash(ticket),
            _hash(ticket + code),
            _now() + timedelta(minutes=CODE_MINUTES),
        )
        await self._mail_code(user, code)
        return SignInResult(
            two_factor_ticket=ticket,
            two_factor_method=row.method,
            email_hint=masked(user.email),
        )

    # ---------- forgot password ----------
    async def request_reset(self, email: str, address: str) -> None:
        """Email a reset link if this is a person's email. The caller always gets
        the same answer, so the form can't be used to find out who has an account."""
        if not self.mailer.live:  # never make a link that can't be delivered
            raise SignInError("Password reset by email isn't set up here.")
        if not self.public_url:
            raise SignInError("Password reset needs BLINQ_SCRIBE_PUBLIC_URL to be set.")
        if not self.reset_ip_limit.allow(address):
            raise TooManyTries("Too many requests. Wait an hour and try again.")
        email = email.strip().lower()
        user = self.accounts.by_email(email) if email else None
        if not user or not user.active or not self.reset_email_limit.allow(email):
            return
        token = secrets.token_urlsafe(32)
        self.store.set_password_reset(
            user.id, _hash(token), _now() + timedelta(minutes=RESET_MINUTES)
        )
        self.store.audit(user.username, "password_reset_requested")
        # In the #fragment, like invite links: browsers never send it to the server.
        try:
            await self.mailer.send(
                user.email,
                "password_reset",
                name=user.name,
                link=f"{self.public_url}/#reset={token}",
                minutes=RESET_MINUTES,
            )
        except Exception:
            # Same answer as ever (no hint the email has an account), and no
            # live link left behind that nobody received.
            self.store.end_password_resets(user.id)
            log.exception("Password reset email to %s failed", masked(user.email))

    def reset_password(self, token: str, password: str, address: str) -> User:
        if not self.reset_ip_limit.allow(f"use|{address}"):
            raise TooManyTries("Too many tries. Wait an hour and try again.")
        reset = self.store.password_reset(_hash(token))
        user = self.accounts.get(reset.user_id) if reset else None
        if not reset or _expired(reset.expires) or not user or not user.active:
            raise SignInError(
                "This reset link has expired or was already used. Ask for a new one."
            )
        try:
            self.accounts.set_password(user.id, password)  # also ends every session
        except AccountError as exc:
            raise SignInError(str(exc)) from exc
        self.store.end_password_resets(user.id)
        self.store.audit(user.username, "password_reset")
        return user

    # ---------- Continue with Google or Microsoft ----------
    # Every address here comes from BLINQ_SCRIBE_PUBLIC_URL, never from the request,
    # so a forged Host header can't send a browser (or a code) somewhere else.
    def callback_url(self, provider: str) -> str:
        """The redirect URI each provider's app registration must list exactly."""
        return f"{self.public_url}/api/auth/oauth/{provider}/callback"

    def app_url(self, fragment: str) -> str:
        return f"{self.public_url}/#{fragment}"

    async def oauth_start(
        self, provider: str, remember: bool, address: str, link_user_id: str = ""
    ) -> tuple[str, str]:
        """The provider's sign in address, and a secret for an HttpOnly cookie in
        the browser that starts: the callback only counts in that same browser.
        link_user_id: a signed-in person connecting their account, who must have
        passed prove() first (see connect_start)."""
        client = self._provider(provider)
        if not self.oauth_limit.allow(address):
            raise TooManyTries("Too many tries. Wait 15 minutes and try again.")
        state, verifier, nonce, browser = (secrets.token_urlsafe(32) for _ in range(4))
        self.store.add_oauth_state(
            _hash(state),
            provider,
            verifier,
            nonce,
            remember,
            _now() + timedelta(minutes=OAUTH_MINUTES),
            link_user_id,
            _hash(browser),
        )
        url = await client.authorization_url(
            self.callback_url(provider), state, verifier, nonce
        )
        return url, browser

    async def connect_start(
        self, user: User, token: str, provider: str, password: str, address: str
    ) -> tuple[str, str]:
        """Connect Google or Microsoft to a signed-in person. Needs the current
        password (or a fresh sign in): otherwise a stolen session could connect the
        thief's own account and keep a way in."""
        self.changeable(user)
        self.prove(user, token, password, address)
        return await self.oauth_start(provider, False, address, link_user_id=user.id)

    async def oauth_callback(
        self, provider: str, code: str, state: str, browser: str
    ) -> str:
        """Check the provider's answer. Returns the #fragment for the web app, with
        a one-time code it redeems by POST: `oauth=<code>` for finish_oauth_sign_in,
        or `oauth_link=<code>` for finish_oauth_link. Nothing is linked here."""
        client = self._provider(provider)
        row = self.store.take_oauth_state(_hash(state))
        if not row or row.provider != provider or _expired(row.expires):
            raise SignInError("That sign in took too long. Try again.")
        if not browser or not hmac.compare_digest(_hash(browser), row.browser_hash):
            # Someone else's link, opened in this browser: refuse.
            raise SignInError("Start again from the Blinq Scribe page in this browser.")
        verifier, nonce, remember = row.verifier, row.nonce, bool(row.remember)
        link_user_id: str = row.link_user_id
        try:
            identity = await client.identity(
                code, self.callback_url(provider), verifier, nonce
            )
        except OidcError as exc:
            raise SignInError(
                "We couldn't confirm your account with the provider. Try again."
            ) from exc
        handoff = secrets.token_urlsafe(32)
        expires = _now() + timedelta(seconds=HANDOFF_SECONDS)
        if link_user_id:
            self.store.add_oauth_handoff(
                _hash(handoff),
                link_user_id,
                False,
                expires,
                kind="link",
                provider=provider,
                subject=identity.subject,
                email=identity.shown_email,
            )
            return f"oauth_link={handoff}"
        user = self._oauth_user(provider, identity)
        self.store.add_oauth_handoff(_hash(handoff), user.id, remember, expires)
        return f"oauth={handoff}"

    def _linked_user(self, provider: str, identity: Identity) -> User | None:
        user_id = self.store.oauth_identity_user(provider, identity.subject)
        return self.accounts.get(user_id) if user_id else None

    def oauth_finish_link(self, handoff: str, user_id: str) -> User:
        """Connect the account, redeemed by the signed-in person who started it:
        their session proved who they are, so the provider's email doesn't have to
        match or be verified."""
        row = self.store.take_oauth_handoff(_hash(handoff))
        if not row or row.kind != "link" or _expired(row.expires):
            raise SignInError("That took too long. Connect your account again.")
        if row.user_id != user_id:
            raise SignInError("Connect your account from your own sign in.")
        user = self.accounts.get(user_id)
        if not user or not user.active:
            raise SignInError("Sign in again, then connect your account.")
        provider, identity = row.provider, Identity(row.subject, "")
        other = self._linked_user(provider, identity)
        if other and other.id != user_id:
            raise SignInError(
                f"That {provider.title()} account is connected to someone else."
            )
        self.store.link_oauth_identity(
            provider, identity.subject, user_id, replace=True, email=row.email
        )
        self.store.audit(user.username, "sign_in_connected", None, {"method": provider})
        return user

    def _oauth_user(self, provider: str, identity: Identity) -> User:
        # Invite only: an account connected earlier, or an invited person whose
        # email the provider has verified (oidc.py decides what counts).
        user = self._linked_user(provider, identity)
        if not user and not identity.email:
            self.store.audit("anonymous", "sign_in_failed", None, {"method": provider})
            raise SignInError(
                "Sign in with your password first, then connect "
                f"{provider.title()} from your account."
            )
        if not user:
            user = self.accounts.by_email(identity.email)
            if user and user.active:
                self.store.link_oauth_identity(
                    provider,
                    identity.subject,
                    user.id,
                    replace=False,
                    email=identity.shown_email,
                )
        if not user or not user.active:
            self.store.audit("anonymous", "sign_in_failed", None, {"method": provider})
            raise SignInError(
                "There's no Blinq Scribe account for that email. Ask your admin for an "
                "invite."
            )
        return user

    async def oauth_finish(self, handoff: str) -> SignInResult:
        """Trade the hand-off code for a session, or for the 2FA code step when
        the person has 2FA on (also on their first Google or Microsoft sign in)."""
        row = self.store.take_oauth_handoff(_hash(handoff))
        user = self.accounts.get(row.user_id) if row else None
        bad = not row or row.kind != "sign_in" or _expired(row.expires)
        if bad or not row or not user or not user.active:
            raise SignInError("That sign in took too long. Try again.")
        return await self.finish(user, bool(row.remember), "oauth")

    def _provider(self, provider: str) -> OidcClient:
        client = self.oidc.get(provider)
        if not client or not self.public_url:
            raise SignInError("That sign in option isn't set up here.")
        return client

    # ---------- Account settings: the signed-in person's own account ----------
    def changeable(self, user: User) -> None:
        """Everyone shares the demo account, so nobody may change it."""
        if user.username == DEMO_USERNAME:
            raise SignInError("The demo account can't be changed.")

    def prove(self, user: User, token: str, password: str, address: str) -> None:
        """The current password, or for an account with none (Google or Microsoft
        only) a sign in in the last few minutes. Rate limited per address and per
        person. A session alone is never enough: it may be a stolen one."""
        key = f"{address}|{user.id}"
        if self.account_user_limit.full(user.id):
            raise TooManyTries("Too many wrong passwords. Wait an hour and try again.")
        if not self.account_limit.allow(key):
            raise TooManyTries("Too many tries. Wait 15 minutes and try again.")
        if user.has_password:
            if not self.accounts.password_matches(user.id, password):
                self.account_user_limit.hit(user.id)
                raise SignInError("That's not your current password.")
        elif not self.accounts.fresh_session(token, FRESH_SIGN_IN_MINUTES):
            raise SignInError(
                "Sign out and sign in again, then make this change within "
                f"{FRESH_SIGN_IN_MINUTES} minutes."
            )
        self.account_limit.hits.pop(key, None)

    def change_password(
        self, user: User, token: str, current: str, new: str, address: str
    ) -> None:
        """Keeps this session and signs out every other one."""
        self.changeable(user)
        self.prove(user, token, current, address)
        try:
            self.accounts.set_password(user.id, new, keep_token=token)
        except AccountError as exc:
            raise SignInError(str(exc)) from exc
        self.store.end_password_resets(user.id)
        self.store.audit(
            user.username, "password_changed", None, {"had_password": user.has_password}
        )

    def update_profile(
        self,
        user: User,
        token: str,
        name: str | None,
        email: str | None,
        current_password: str,
        address: str,
    ) -> User:
        """The name changes freely. A new email needs the current password (or a
        fresh sign in); connected Google or Microsoft accounts stay connected, since
        they are tied to the provider's account, not to an email."""
        self.changeable(user)
        if name is not None and not name.strip():
            raise SignInError("Add your name.")
        new_email = None if email is None else email.strip().lower()
        if new_email == user.email:
            new_email = None
        if new_email is not None:
            self.prove(user, token, current_password, address)
        try:
            updated = self.accounts.update(user.id, name=name, email=new_email)
        except AccountError as exc:
            raise SignInError(str(exc)) from exc
        if new_email is not None:  # a reset link sent to the old address stops
            self.store.end_password_resets(user.id)
        changed = {"name": name is not None and name != user.name}
        changed["email"] = new_email is not None
        self.store.audit(user.username, "profile_updated", None, changed)
        return updated

    def connected_accounts(self, user: User) -> list[dict[str, str]]:
        return [
            {"provider": r.provider, "email": r.email, "connected_at": r.connected_at}
            for r in self.store.oauth_identities(user.id)
        ]

    def disconnect(
        self, user: User, token: str, provider: str, password: str, address: str
    ) -> None:
        self.changeable(user)
        self.prove(user, token, password, address)
        # Checked and removed in one transaction, so two at once can't both pass.
        result = self.store.unlink_oauth_identity_unless_last(
            provider, user.id, keep_one=not user.has_password
        )
        if result == "missing":
            raise SignInError("That account isn't connected.")
        if result == "last":
            raise SignInError("Set a password first, or you'd have no way to sign in.")
        self.store.audit(
            user.username, "sign_in_disconnected", None, {"method": provider}
        )

    # ---------- Try the demo clinic ----------
    async def try_demo(self) -> SignInResult:
        if not self.demo:
            raise SignInError("The demo clinic is only in demo mode.")
        user = self.accounts.demo_user()
        if not user:
            # The demo vet is the synthetic clinic's first vet.
            providers = await self.adapter.list_providers()
            if not providers:
                raise SignInError("The demo clinic has no providers.")
            try:
                user = self.accounts.create_demo_user(
                    providers[0]["id"], providers[0]["name"]
                )
            except AccountError as exc:
                raise SignInError(str(exc)) from exc
        token = self.accounts.start_session(user.id, remember=False)
        self.store.audit(user.username, "signed_in", None, {"method": "demo"})
        return SignInResult(token=token, user=user)
