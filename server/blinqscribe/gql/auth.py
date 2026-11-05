"""Signing in over GraphQL (requirement 57): email and password with Remember me,
the 6 digit code when 2FA is on, Continue with Google or Microsoft, Forgot
password, Try the demo clinic, and signing out. The OAuth redirects themselves stay
REST (auth_routes.py)."""

from __future__ import annotations

from collections.abc import Awaitable
from datetime import datetime
from typing import Any

import strawberry
from fastapi import HTTPException

from .. import api, permissions
from ..accounts import AccountError, Accounts, Caller
from ..auth_routes import client_address, http_error, set_oauth_cookie, signed_in
from ..signin import SignInError, SignInResult, SignInService
from .context import Context
from .types import User, shaped

Info = strawberry.Info[Context, None]


@strawberry.type(description="Which ways to sign in are on")
class SignInOptions:
    password: bool
    google: bool
    microsoft: bool
    demo: bool = strawberry.field(description="Try the demo clinic (demo mode only)")
    password_reset: bool = strawberry.field(
        description="Forgot password works (email is set up)"
    )


@strawberry.type
class AuthStatus:
    login_required: bool = strawberry.field(
        description="False only for the open demo: no API token, nobody invited"
    )
    options: SignInOptions


@strawberry.type(description="Who is calling")
class Me:
    via: str = strawberry.field(description='"session", "token" or "open"')
    user: User | None
    admin: bool
    role: str = strawberry.field(
        description='"vet", "front_office" or "admin"; "" for the API token and the '
        "open demo"
    )
    provider_id: str = strawberry.field(description="Who you are in the PIMS, or ''")
    permissions: list[str] = strawberry.field(
        description='What you may do, like "note.sign" or "letter.send" (clinical '
        "actions on your own visits). The API token and the open demo get all"
    )


@strawberry.type(description="A Google or Microsoft account that signs you in")
class ConnectedAccount:
    provider: str = strawberry.field(description='"google" or "microsoft"')
    email: str = strawberry.field(description="As the provider shows it; may be empty")
    connected_at: datetime | None


@strawberry.type
class InviteInfo:
    name: str
    username: str


@strawberry.type(
    description="Signed in (token and user), or a 6 digit code to enter first "
    "(two_factor_required with a ticket for verify_sign_in_code)"
)
class SignInPayload:
    token: str | None
    user: User | None
    two_factor_required: bool
    ticket: str | None
    two_factor_method: str | None = strawberry.field(
        description='"app": the code from their authenticator app (resend_sign_in_code '
        'emails a backup code); "email": a code we emailed'
    )
    email_hint: str | None = strawberry.field(
        description="Where the code went, like a•••@clinic.com"
    )


@strawberry.type(description="Add this to an authenticator app, then confirm a code")
class AuthenticatorSetup:
    secret: str = strawberry.field(description="To type in by hand")
    otpauth_uri: str = strawberry.field(description="Draw this as a QR code")


# ---------- helpers ----------
def _payload(out: dict[str, Any]) -> SignInPayload:
    return SignInPayload(
        token=out.get("token"),
        user=shaped(User, out.get("user")),
        two_factor_required=bool(out.get("two_factor_required")),
        ticket=out.get("ticket"),
        two_factor_method=out.get("method"),
        email_hint=out.get("email_hint"),
    )


def _signin(info: Info) -> SignInService:
    service: SignInService = info.context.parts.signin
    return service


def _accounts(info: Info) -> Accounts:
    accounts: Accounts = info.context.parts.accounts
    return accounts


def _address(info: Info) -> str:
    return client_address(info.context.http_request())


def _options(info: Info) -> SignInOptions:
    return SignInOptions(**_signin(info).options())


async def _run(step: Awaitable[SignInResult]) -> SignInPayload:
    try:
        result = await step
    except SignInError as exc:
        raise http_error(exc) from exc
    return _payload(signed_in(result))


def _own_account(info: Info) -> Caller:
    who = info.context.caller()
    if not who.user:
        raise HTTPException(400, "Sign in with your own account first.")
    return who


def _changeable_account(info: Info) -> Caller:
    """Your own account, unless it's the shared demo account."""
    who = _own_account(info)
    assert who.user
    try:
        _signin(info).changeable(who.user)
    except SignInError as exc:
        raise http_error(exc) from exc
    return who


async def _oauth_url(
    info: Info, provider: str, start: Awaitable[tuple[str, str]]
) -> str:
    """The provider's address. The cookie set on this response ties the callback
    to this browser."""
    signin = _signin(info)
    try:
        url, secret = await start
    except SignInError as exc:
        raise http_error(exc) from exc
    assert info.context.response is not None
    set_oauth_cookie(info.context.response, signin, provider, secret)
    return url


# ---------- queries ----------
def auth_status(info: Info) -> AuthStatus:
    out = info.context.parts.auth_ops.auth_status()
    return AuthStatus(login_required=out["login_required"], options=_options(info))


def sign_in_options(info: Info) -> SignInOptions:
    return _options(info)


def me(info: Info) -> Me:
    who = info.context.caller()
    return Me(
        via=who.via,
        user=shaped(User, who.user),
        admin=who.admin,
        role=who.user.role if who.user else "",
        provider_id=who.user.provider_id if who.user else "",
        permissions=permissions.allowed(who),
    )


def invite_info(info: Info, token: str) -> InviteInfo:
    out = info.context.parts.auth_ops.invite_info(
        api.InviteInfoIn(token=token), info.context.http_request()
    )
    return InviteInfo(name=out["name"], username=out["username"])


def my_connected_accounts(info: Info) -> list[ConnectedAccount]:
    who = _own_account(info)
    assert who.user
    return [
        ConnectedAccount(
            provider=a["provider"],
            email=a["email"],
            connected_at=(
                datetime.fromisoformat(a["connected_at"]) if a["connected_at"] else None
            ),
        )
        for a in _signin(info).connected_accounts(who.user)
    ]


@strawberry.type
class AuthQuery:
    auth_status: AuthStatus = strawberry.field(
        resolver=auth_status, description="Whether sign in is needed, and how"
    )
    sign_in_options: SignInOptions = strawberry.field(
        resolver=sign_in_options, description="Which ways to sign in are on"
    )
    me: Me = strawberry.field(resolver=me, description="Who is calling")
    invite_info: InviteInfo = strawberry.field(
        resolver=invite_info,
        description="The name on an invite link, before setting a password",
    )
    my_connected_accounts: list[ConnectedAccount] = strawberry.field(
        resolver=my_connected_accounts,
        description="Your connected Google and Microsoft accounts",
    )


# ---------- mutations: signing in ----------
async def sign_in(
    info: Info, login: str, password: str, remember: bool = False
) -> SignInPayload:
    step = _signin(info).with_password(login, password, remember, _address(info))
    return await _run(step)


async def verify_sign_in_code(info: Info, ticket: str, code: str) -> SignInPayload:
    return await _run(_signin(info).verify_code(ticket, code, _address(info)))


async def resend_sign_in_code(info: Info, ticket: str) -> SignInPayload:
    return await _run(_signin(info).resend_code(ticket))


async def start_oauth_sign_in(info: Info, provider: str, remember: bool = False) -> str:
    start = _signin(info).oauth_start(provider, remember, _address(info))
    return await _oauth_url(info, provider, start)


async def connect_oauth_account(
    info: Info, provider: str, current_password: str = ""
) -> str:
    who = _own_account(info)
    assert who.user
    start = _signin(info).connect_start(
        who.user, _token(info), provider, current_password, _address(info)
    )
    return await _oauth_url(info, provider, start)


async def finish_oauth_sign_in(info: Info, code: str) -> SignInPayload:
    return await _run(_signin(info).oauth_finish(code))


def finish_oauth_link(info: Info, code: str) -> User:
    who = _own_account(info)
    assert who.user
    try:
        return shaped(User, _signin(info).oauth_finish_link(code, who.user.id))
    except SignInError as exc:
        raise http_error(exc) from exc


async def try_demo_clinic(info: Info) -> SignInPayload:
    return await _run(_signin(info).try_demo())


async def accept_invite(info: Info, token: str, password: str) -> SignInPayload:
    body = api.InviteAcceptIn(token=token, password=password)
    out = await info.context.parts.auth_ops.accept_invite(
        body, info.context.http_request()
    )
    return _payload(out)


# ---------- mutations: forgot password ----------
async def request_password_reset(info: Info, email: str) -> bool:
    request = info.context.http_request()
    try:
        await _signin(info).request_reset(email, client_address(request))
    except SignInError as exc:
        raise http_error(exc) from exc
    return True


def reset_password(info: Info, token: str, password: str) -> bool:
    try:
        _signin(info).reset_password(token, password, _address(info))
    except SignInError as exc:
        raise http_error(exc) from exc
    return True


# ---------- mutations: sessions and 2FA ----------
# ---------- mutations: Account settings (your own account) ----------
def _token(info: Info) -> str:
    return info.context.authorization.removeprefix("Bearer ").strip()


def change_password(info: Info, new_password: str, current_password: str = "") -> bool:
    who = _own_account(info)
    assert who.user
    try:
        _signin(info).change_password(
            who.user, _token(info), current_password, new_password, _address(info)
        )
    except SignInError as exc:
        raise http_error(exc) from exc
    return True


def update_my_profile(
    info: Info,
    name: str | None = None,
    email: str | None = None,
    current_password: str = "",
) -> User:
    who = _own_account(info)
    assert who.user
    try:
        user = _signin(info).update_profile(
            who.user, _token(info), name, email, current_password, _address(info)
        )
    except SignInError as exc:
        raise http_error(exc) from exc
    return shaped(User, user)


def disconnect_oauth_account(
    info: Info, provider: str, current_password: str = ""
) -> bool:
    who = _own_account(info)
    assert who.user
    try:
        _signin(info).disconnect(
            who.user, _token(info), provider, current_password, _address(info)
        )
    except SignInError as exc:
        raise http_error(exc) from exc
    return True


def sign_out_other_sessions(info: Info) -> bool:
    who = _changeable_account(info)
    assert who.user
    _accounts(info).revoke_sessions(who.user.id, keep_token=_token(info))
    info.context.parts.store.audit(who.actor, "signed_out_other_sessions")
    return True


def sign_out(info: Info) -> bool:
    _accounts(info).logout(_token(info))
    return True


def sign_out_everywhere(info: Info) -> bool:
    who = _changeable_account(info)
    assert who.user
    _accounts(info).revoke_sessions(who.user.id)
    info.context.parts.store.audit(who.actor, "signed_out_everywhere")
    return True


def start_authenticator(info: Info, current_password: str = "") -> AuthenticatorSetup:
    who = _changeable_account(info)
    assert who.user
    try:
        _signin(info).prove(who.user, _token(info), current_password, _address(info))
        secret, uri = _accounts(info).start_authenticator(who.user.id)
    except (SignInError, AccountError) as exc:
        raise HTTPException(getattr(exc, "status", 400), str(exc)) from exc
    return AuthenticatorSetup(secret=secret, otpauth_uri=uri)


def confirm_authenticator(info: Info, code: str) -> User:
    who = _changeable_account(info)
    assert who.user
    try:
        user = _accounts(info).confirm_authenticator(who.user.id, code)
    except AccountError as exc:
        raise HTTPException(400, str(exc)) from exc
    info.context.parts.store.audit(who.actor, "authenticator_added")
    return shaped(User, user)


def remove_authenticator(info: Info, current_password: str = "") -> User:
    who = _changeable_account(info)
    assert who.user
    try:
        _signin(info).prove(who.user, _token(info), current_password, _address(info))
        user = _accounts(info).remove_authenticator(who.user.id)
    except (SignInError, AccountError) as exc:
        raise HTTPException(getattr(exc, "status", 400), str(exc)) from exc
    info.context.parts.store.audit(who.actor, "authenticator_removed")
    return shaped(User, user)


def set_two_factor(info: Info, enabled: bool, current_password: str = "") -> User:
    who = _changeable_account(info)
    assert who.user
    mail = _signin(info).demo or _signin(info).mailer.live
    if enabled and not (mail or who.user.authenticator):
        raise HTTPException(400, "Email isn't set up here, so codes can't be sent.")
    try:
        if not enabled:  # turning it off: a stolen session alone isn't enough
            _signin(info).prove(
                who.user, _token(info), current_password, _address(info)
            )
        user = _accounts(info).set_two_factor(who.user.id, enabled)
    except (SignInError, AccountError) as exc:
        raise HTTPException(getattr(exc, "status", 400), str(exc)) from exc
    info.context.parts.store.audit(
        who.actor, "two_factor_changed", None, {"enabled": enabled}
    )
    return shaped(User, user)


def set_user_two_factor(info: Info, user_id: str, required: bool) -> User:
    who = info.context.admin()
    accounts = _accounts(info)
    person = accounts.get(user_id)
    if not person:
        raise HTTPException(404, "No such person.")
    try:
        user = accounts.set_two_factor(
            user_id, person.two_factor or required, required=required
        )
    except AccountError as exc:
        raise HTTPException(400, str(exc)) from exc
    info.context.parts.store.audit(
        who.actor,
        "two_factor_required",
        None,
        {"user": user.username, "required": required},
    )
    return shaped(User, user)


def revoke_user_sessions(info: Info, user_id: str) -> bool:
    who = info.context.admin()
    accounts = _accounts(info)
    person = accounts.get(user_id)
    if not person:
        raise HTTPException(404, "No such person.")
    accounts.revoke_sessions(user_id)
    info.context.parts.store.audit(
        who.actor, "sessions_revoked", None, {"user": person.username}
    )
    return True


@strawberry.type
class AuthMutation:
    sign_in: SignInPayload = strawberry.mutation(
        resolver=sign_in,
        description="Sign in with email (or username) and password. remember keeps "
        "you signed in for 30 days instead of 12 hours",
    )
    verify_sign_in_code: SignInPayload = strawberry.mutation(
        resolver=verify_sign_in_code,
        description="Finish signing in with the 6 digit email code",
    )
    resend_sign_in_code: SignInPayload = strawberry.mutation(
        resolver=resend_sign_in_code, description="Email a new code for this sign in"
    )
    start_oauth_sign_in: str = strawberry.mutation(
        resolver=start_oauth_sign_in,
        description='Where to send the browser for "google" or "microsoft". It '
        "comes back to the web app with #oauth=<code> for finish_oauth_sign_in, or "
        "#oauth_error=<message>",
    )
    connect_oauth_account: str = strawberry.mutation(
        resolver=connect_oauth_account,
        description="Signed in: where to send the browser to connect Google or "
        "Microsoft to this account. Needs current_password (or a sign in in the "
        "last 10 minutes for an account with no password). It comes back with "
        "#oauth_link=<code> for finish_oauth_link",
    )
    finish_oauth_link: User = strawberry.mutation(
        resolver=finish_oauth_link,
        description="Signed in: connect the account from the one-time #oauth_link "
        "code. Only the person who started connecting can finish",
    )
    finish_oauth_sign_in: SignInPayload = strawberry.mutation(
        resolver=finish_oauth_sign_in,
        description="Trade the one-time #oauth code for a session",
    )
    try_demo_clinic: SignInPayload = strawberry.mutation(
        resolver=try_demo_clinic, description="Sign in as the demo vet (demo mode)"
    )
    accept_invite: SignInPayload = strawberry.mutation(
        resolver=accept_invite, description="Set a password from an invite link"
    )
    request_password_reset: bool = strawberry.mutation(
        resolver=request_password_reset,
        description="Email a reset link. True whether or not the email has an account",
    )
    reset_password: bool = strawberry.mutation(
        resolver=reset_password,
        description="Choose a new password from a #reset link. Signs out everywhere",
    )
    sign_out: bool = strawberry.mutation(
        resolver=sign_out, description="End this session"
    )
    sign_out_everywhere: bool = strawberry.mutation(
        resolver=sign_out_everywhere,
        description="End every session of yours, on every device",
    )
    start_authenticator: AuthenticatorSetup = strawberry.mutation(
        resolver=start_authenticator,
        description="Set up an authenticator app: needs current_password (or a sign "
        "in in the last 10 minutes). Nothing changes until confirm_authenticator",
    )
    confirm_authenticator: User = strawberry.mutation(
        resolver=confirm_authenticator,
        description="The first 6 digit code from the app: turns two step sign in on, "
        "with the app's codes (an emailed code stays the backup)",
    )
    remove_authenticator: User = strawberry.mutation(
        resolver=remove_authenticator,
        description="Stop using the app: codes come by email again. Needs "
        "current_password",
    )
    set_two_factor: User = strawberry.mutation(
        resolver=set_two_factor,
        description="Turn your own two step sign in on or off. Turning it off needs "
        "current_password (or a sign in in the last 10 minutes for an account with "
        "no password)",
    )
    set_user_two_factor: User = strawberry.mutation(
        resolver=set_user_two_factor,
        description="Require (or stop requiring) email codes for someone (admins)",
    )
    revoke_user_sessions: bool = strawberry.mutation(
        resolver=revoke_user_sessions,
        description="Sign someone out on every device (admins)",
    )
    sign_out_other_sessions: bool = strawberry.mutation(
        resolver=sign_out_other_sessions,
        description="End your sessions on every other device; this one stays",
    )
    change_password: bool = strawberry.mutation(
        resolver=change_password,
        description="Change your password. Needs the current one; an account with "
        "none yet (Google or Microsoft only) can set one within 10 minutes of "
        "signing in. Signs out your other sessions",
    )
    update_my_profile: User = strawberry.mutation(
        resolver=update_my_profile,
        description="Change your name, or your email (which needs current_password, "
        "or a sign in in the last 10 minutes for an account with no password)",
    )
    disconnect_oauth_account: bool = strawberry.mutation(
        resolver=disconnect_oauth_account,
        description="Disconnect Google or Microsoft. Needs current_password (or a "
        "recent sign in). Refused if it's your only way to sign in",
    )
