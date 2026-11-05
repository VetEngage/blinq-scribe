"""Vet accounts: each login is tied to one PIMS provider id.

An admin adds a vet (name, username, the provider they are in the practice
system) and gets a one-time invite link. The vet opens it, sets a password and
is signed in. From then on Blinq Scribe knows which provider is at the
keyboard: signing records their provider id, the console opens on their day,
and the audit log names them.

Passwords are PBKDF2-SHA256 hashed. Invite and session tokens are random and
stored only as SHA-256 hashes, so a copy of the database cannot be replayed.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import peewee
import pyotp
from pydantic import BaseModel

from .db import UserRow
from .store import Store

INVITE_DAYS = 7
REMEMBER_DAYS = 30  # "Remember me"
SHORT_SESSION_HOURS = 12
MIN_PASSWORD = 10
_ITERATIONS = 240_000
_USERNAME = re.compile(r"^[a-z0-9][a-z0-9._-]{1,39}$")
MAX_NAME = 80
_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Try the demo clinic signs in as this account. It never counts as "someone was
# invited", so trying the demo doesn't close the open demo console.
DEMO_USERNAME = "demo.vet"
TOTP_ISSUER = "Blinq Scribe"

Role = Literal["vet", "front_office", "admin"]
ROLES: tuple[Role, ...] = ("vet", "front_office", "admin")
# set on first login: an unknown username costs the same one hash as a real one
_DUMMY_HASH = ""


class AccountError(ValueError):
    """A request the accounts rules refuse. The message is safe to show."""


class User(BaseModel):
    id: str
    username: str
    name: str
    provider_id: str = ""  # the PIMS provider this login is; required for vets
    role: Role = "vet"
    active: bool = True
    has_password: bool = False
    created_at: datetime
    email: str = ""  # for reset links, 2FA codes and Google or Microsoft sign in
    two_factor: bool = False  # a 6 digit code by email after the password
    two_factor_required: bool = False  # set by an admin; the person can't turn it off
    authenticator: bool = False  # codes from an authenticator app; email is the backup


def _totp_step(secret: str, code: str) -> int | None:
    """The time step a 6 digit code is for (this one or the one either side, for a
    slow clock), or None when it doesn't match."""
    code = "".join(c for c in code if c.isdigit())
    if len(code) != 6:
        return None
    totp = pyotp.TOTP(secret)
    now = int(time.time()) // totp.interval
    for step in (now, now - 1, now + 1):
        if hmac.compare_digest(totp.at(step * totp.interval), code):
            return step
    return None


def _clean_name(name: str) -> str:
    """No control characters, at most MAX_NAME characters."""
    return _CONTROL.sub("", name).strip()[:MAX_NAME].strip()


def _now() -> datetime:
    return datetime.now(UTC)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        got = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        )
    except ValueError, TypeError:
        return False
    return hmac.compare_digest(got.hex(), digest)


class Caller(BaseModel):
    """Who is making a request: a signed-in person, the API token (glasses app,
    scripts), or the open demo."""

    via: Literal["session", "token", "open"]
    user: User | None = None

    @property
    def admin(self) -> bool:
        return self.via in ("token", "open") or (
            self.user is not None and self.user.role == "admin"
        )

    @property
    def actor(self) -> str:
        return self.user.username if self.user else "vet"


class Accounts:
    def __init__(self, store: Store, demo: bool = False):
        self.store = store
        self.demo = demo  # the synthetic clinic: the only place the demo vet exists

    # ---------- reading ----------
    @staticmethod
    def _user(row: UserRow) -> User:
        return User(
            id=row.id,
            username=row.username,
            name=row.name,
            provider_id=row.provider_id,
            role=next((r for r in ROLES if r == row.role), "vet"),
            active=bool(row.active),
            has_password=bool(row.password_hash),
            created_at=datetime.fromisoformat(row.created_at),
            email=row.email,
            two_factor=bool(row.two_factor),
            two_factor_required=bool(row.two_factor_required),
            authenticator=bool(row.totp_secret),
        )

    def _one(self, **where: str | int) -> User | None:
        rows = self.store.users(**where)
        return self._user(rows[0]) if rows else None

    def any_users(self) -> bool:
        # The demo vet (made by Try the demo clinic) doesn't close the open demo.
        # Outside demo mode nobody is set aside.
        return self.store.any_users(except_username=DEMO_USERNAME if self.demo else "")

    def list(self) -> list[User]:
        return [self._user(r) for r in self.store.users()]

    def get(self, user_id: str) -> User | None:
        return self._one(id=user_id)

    def _existing(self, user_id: str) -> User:
        """A user this call just found or wrote, so the row is there."""
        user = self.get(user_id)
        assert user is not None
        return user

    def by_provider(self, provider_id: str) -> User | None:
        """The real account linked to a PIMS provider. The demo vet (Try the demo
        clinic) is left out: it stands in for the demo clinic's first provider, so it
        never blocks a real account for that provider, and a real one never blocks
        it."""
        rows = [
            r
            for r in self.store.users(provider_id=provider_id, active=1)
            if r.username != DEMO_USERNAME
        ]
        return self._user(rows[0]) if rows else None

    def by_email(self, email: str) -> User | None:
        email = email.strip().lower()
        return self._one(email=email) if email else None

    def _check_email(self, email: str, user_id: str = "") -> str:
        email = email.strip().lower()
        if email and not _EMAIL.match(email):
            raise AccountError("That email doesn't look right.")
        if email and (other := self.by_email(email)) and other.id != user_id:
            raise AccountError(f"That email is already used by {other.name}.")
        return email

    # ---------- admin ----------
    def create(
        self,
        username: str,
        name: str,
        provider_id: str = "",
        role: Role = "vet",
        email: str = "",
    ) -> tuple[User, str]:
        """Add a person and return them with a one-time invite token."""
        if username.strip().lower() == DEMO_USERNAME:  # reserved for Try the demo
            raise AccountError("That username is taken.")
        return self._create(username, name, provider_id, role, email)

    def _create(
        self,
        username: str,
        name: str,
        provider_id: str,
        role: Role,
        email: str,
        shared_provider: bool = False,
    ) -> tuple[User, str]:
        username, name, provider_id = (
            username.strip().lower(),
            _clean_name(name),
            provider_id.strip(),
        )
        if not _USERNAME.match(username):
            raise AccountError(
                "Usernames are 2 to 40 characters: lowercase letters, "
                "numbers, dots, dashes."
            )
        if not name:
            raise AccountError("Add the person's name.")
        if role == "vet" and not provider_id:
            raise AccountError("Pick which provider this person is in the PIMS.")
        if self.store.users(username=username):
            raise AccountError("That username is taken.")
        if (
            provider_id
            and not shared_provider
            and (other := self.by_provider(provider_id))
        ):
            raise AccountError(f"That provider is already linked to {other.name}.")
        email = self._check_email(email)
        uid = uuid.uuid4().hex[:12]
        try:
            self.store.add_user(
                id=uid,
                username=username,
                name=name,
                provider_id=provider_id,
                role=role,
                active=1,
                created_at=_now().isoformat(),
                email=email,
            )
        except peewee.IntegrityError as exc:  # two admins added them at once
            raise AccountError("That username or email is already used.") from exc
        return self._existing(uid), self.reinvite(uid)

    def update(
        self,
        user_id: str,
        name: str | None = None,
        provider_id: str | None = None,
        role: Role | None = None,
        email: str | None = None,
    ) -> User:
        user = self.get(user_id)
        if not user:
            raise AccountError("No such person.")
        name = user.name if name is None else _clean_name(name)
        if not name:
            raise AccountError("Add the person's name.")
        provider_id = user.provider_id if provider_id is None else provider_id.strip()
        role = role or user.role
        email = user.email if email is None else self._check_email(email, user_id)
        if role == "vet" and not provider_id:
            raise AccountError("A provider must be linked to a PIMS provider.")
        if (
            provider_id
            and (other := self.by_provider(provider_id))
            and other.id != user_id
        ):
            raise AccountError(f"That provider is already linked to {other.name}.")
        if not email and (user.two_factor or user.two_factor_required):
            raise AccountError("Two step sign in sends codes by email. Keep an email.")
        try:
            self.store.update_user(
                user_id, name=name, provider_id=provider_id, role=role, email=email
            )
        except peewee.IntegrityError as exc:  # two people took it at the same time
            raise AccountError("That email is already used.") from exc
        return self._existing(user_id)

    def set_two_factor(
        self, user_id: str, enabled: bool, *, required: bool | None = None
    ) -> User:
        """Turn 2FA codes on or off. `required` is the admin's lock."""
        user = self.get(user_id)
        if not user:
            raise AccountError("No such person.")
        if required is None:  # the person's own switch
            if not enabled and user.two_factor_required:
                raise AccountError("Your admin requires two step sign in.")
            required = user.two_factor_required
        if (enabled or required) and not user.email and not user.authenticator:
            raise AccountError("Add an email first: the codes are sent there.")
        self.store.update_user(
            user_id, two_factor=int(enabled), two_factor_required=int(required)
        )
        return self._existing(user_id)

    def reinvite(self, user_id: str) -> str:
        """A fresh one-time invite; any earlier invite for this person stops working."""
        token = secrets.token_urlsafe(32)
        self.store.set_invite(
            user_id, _token_hash(token), _now() + timedelta(days=INVITE_DAYS)
        )
        return token

    def set_active(self, user_id: str, active: bool) -> User:
        user = self.get(user_id)
        if not user:
            raise AccountError("No such person.")
        if (
            active
            and user.provider_id
            and (other := self.by_provider(user.provider_id))
            and other.id != user_id
        ):
            raise AccountError(
                f"Their provider is now linked to {other.name}. Turn that "
                "person off first."
            )
        self.store.update_user(user_id, active=int(active))
        if not active:  # signed out everywhere, and an open invite no longer works
            self.revoke_sessions(user_id)
            self.store.end_invites(user_id)
        return self._existing(user_id)

    # ---------- the demo clinic ----------
    def demo_user(self) -> User | None:
        return self._one(username=DEMO_USERNAME)

    def create_demo_user(self, provider_id: str, name: str) -> User:
        """The demo vet: no password, so only Try the demo clinic signs in as them."""
        if not self.demo:
            raise AccountError("The demo provider exists only in demo mode.")
        # Shares the provider with any real account for it (see by_provider).
        user, _ = self._create(
            DEMO_USERNAME, name, provider_id, "vet", "", shared_provider=True
        )
        self.store.end_invites(user.id)
        return user

    # ---------- invites and sign in ----------
    def invite_user(self, token: str) -> User | None:
        invite = self.store.invite(_token_hash(token))
        if not invite or datetime.fromisoformat(invite.expires) < _now():
            return None
        user = self.get(invite.user_id)
        return user if user and user.active else None

    def accept_invite(self, token: str, password: str) -> tuple[User, str]:
        """Set the password. The session is empty when 2FA must come first."""
        user = self.invite_user(token)
        if not user:
            raise AccountError(
                "This invite link has expired or was already used. Ask for a new one."
            )
        self.set_password(user.id, password)
        self.store.end_invites(user.id)
        if user.two_factor or user.two_factor_required:
            return self._existing(user.id), ""
        return self._existing(user.id), self.start_session(user.id, remember=True)

    def set_password(self, user_id: str, password: str, keep_token: str = "") -> None:
        """keep_token: the session making the change stays signed in."""
        if len(password) < MIN_PASSWORD:
            raise AccountError(f"Use at least {MIN_PASSWORD} characters.")
        self.store.update_user(user_id, password_hash=hash_password(password))
        # A new password ends every old session: a reinvite or a reset is also how a
        # stolen login gets cut off.
        self.revoke_sessions(user_id, keep_token)

    # ---------- two step sign in with an authenticator app (TOTP) ----------
    def start_authenticator(self, user_id: str) -> tuple[str, str]:
        """A new secret to add to an authenticator app, and its otpauth:// URI (the
        web app draws it as a QR code). Nothing changes until it's confirmed."""
        user = self.get(user_id)
        if not user:
            raise AccountError("No such person.")
        secret = pyotp.random_base32()
        self.store.update_user(user_id, totp_pending=secret)
        uri = pyotp.TOTP(secret).provisioning_uri(
            name=user.email or user.username, issuer_name=TOTP_ISSUER
        )
        return secret, uri

    def confirm_authenticator(self, user_id: str, code: str) -> User:
        """The first code from the app proves it's set up; 2FA is then on."""
        rows = self.store.users(id=user_id)
        pending = rows[0].totp_pending if rows else ""
        step = _totp_step(pending, code) if pending else None
        if step is None:
            raise AccountError("That code doesn't match. Check the app and try again.")
        self.store.update_user(
            user_id,
            totp_secret=pending,
            totp_pending="",
            totp_last_step=step,
            two_factor=1,
        )
        return self._existing(user_id)

    def remove_authenticator(self, user_id: str) -> User:
        """Back to emailed codes (2FA stays as it was)."""
        user = self.get(user_id)
        if not user:
            raise AccountError("No such person.")
        if (user.two_factor or user.two_factor_required) and not user.email:
            raise AccountError("Add an email first: codes are sent there instead.")
        self.store.update_user(user_id, totp_secret="", totp_pending="")
        return self._existing(user_id)

    def check_authenticator(self, user_id: str, code: str) -> bool:
        """A current code from the person's app, each usable once."""
        rows = self.store.users(id=user_id)
        if not rows or not rows[0].totp_secret:
            return False
        step = _totp_step(rows[0].totp_secret, code)
        return step is not None and self.store.claim_totp_step(user_id, step)

    def password_matches(self, user_id: str, password: str) -> bool:
        """False too when the person has no password yet."""
        rows = self.store.users(id=user_id)
        stored = rows[0].password_hash if rows else None
        return bool(stored) and check_password(password, stored or "")

    def fresh_session(self, token: str, minutes: int) -> bool:
        """This session began in the last few minutes: a sign in just now."""
        session = self.store.session(_token_hash(token)) if token else None
        if not session or not session.created_at:
            return False
        started = datetime.fromisoformat(session.created_at)
        return _now() - started < timedelta(minutes=minutes)

    def check_login(self, login: str, password: str) -> User:
        """The person with this username or email, if the password matches."""
        login = login.strip().lower()
        row = self.store.user_by_login(login)
        # Same work (one hash check) and the same answer whether or not the login
        # exists.
        global _DUMMY_HASH
        _DUMMY_HASH = _DUMMY_HASH or hash_password(secrets.token_hex(16))
        stored = row.password_hash if row and row.password_hash else _DUMMY_HASH
        if not (check_password(password, stored) and row and row.active):
            raise AccountError("That email and password don't match.")
        return self._user(row)

    def login(
        self, username: str, password: str, remember: bool = True
    ) -> tuple[User, str]:
        user = self.check_login(username, password)
        return user, self.start_session(user.id, remember)

    def start_session(self, user_id: str, remember: bool) -> str:
        token = secrets.token_urlsafe(32)
        length = (
            timedelta(days=REMEMBER_DAYS)
            if remember
            else timedelta(hours=SHORT_SESSION_HOURS)
        )
        self.store.add_session(user_id, _token_hash(token), _now() + length, remember)
        return token

    def session_user(self, token: str) -> User | None:
        if not token:
            return None
        session = self.store.session(_token_hash(token))
        if not session or datetime.fromisoformat(session.expires) < _now():
            return None
        user = self.get(session.user_id)
        return user if user and user.active else None

    def logout(self, token: str) -> None:
        self.store.end_sessions(token_hash=_token_hash(token))

    def revoke_sessions(self, user_id: str, keep_token: str = "") -> None:
        """Sign this person out everywhere (but keep_token's session, if given)."""
        self.store.end_sessions(
            user_id=user_id,
            keep_token_hash=_token_hash(keep_token) if keep_token else None,
        )
