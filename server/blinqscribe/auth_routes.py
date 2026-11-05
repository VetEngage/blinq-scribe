"""Sign in over REST: the Google and Microsoft OAuth redirects, plus helpers the
REST and GraphQL sign in share. Everything else about signing in is GraphQL
(gql/auth.py); the iPhone app's login and invite routes stay in api.py."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from .signin import OAUTH_MINUTES, SignInError, SignInResult, SignInService

# Ties an OAuth callback to the browser that started it. HttpOnly, sent only to the
# callback path, and Lax so it rides along on the provider's redirect back.
OAUTH_COOKIE = "blinq_oauth"


def client_address(request: Request) -> str:
    return request.client.host if request.client else ""


def set_oauth_cookie(
    response: Response, signin: SignInService, provider: str, secret: str
) -> None:
    response.set_cookie(
        OAUTH_COOKIE,
        secret,
        max_age=OAUTH_MINUTES * 60,
        path=f"/api/auth/oauth/{provider}/callback",
        secure=signin.public_url.startswith("https://"),
        httponly=True,
        samesite="lax",
    )


def signed_in(result: SignInResult) -> dict[str, Any]:
    if result.two_factor_ticket:
        return {
            "two_factor_required": True,
            "ticket": result.two_factor_ticket,
            "method": result.two_factor_method,
            "email_hint": result.email_hint,
        }
    return {"token": result.token, "user": result.user}


def http_error(exc: SignInError) -> HTTPException:
    return HTTPException(exc.status, str(exc))


def register(app: FastAPI, ctx: SimpleNamespace) -> None:
    signin: SignInService = ctx.signin

    @app.get("/api/auth/oauth/{provider}/start")
    async def oauth_start(
        provider: str, request: Request, remember: bool = False
    ) -> RedirectResponse:
        """Send the browser to Google or Microsoft. GraphQL start_oauth_sign_in
        returns the same address (and sets the same cookie) for the web app."""
        try:
            url, secret = await signin.oauth_start(
                provider, remember, client_address(request)
            )
        except SignInError as exc:
            raise http_error(exc) from exc
        response = RedirectResponse(url, status_code=302)
        set_oauth_cookie(response, signin, provider, secret)
        return response

    @app.get("/api/auth/oauth/{provider}/callback")
    async def oauth_callback(
        provider: str, request: Request, code: str = "", state: str = ""
    ) -> RedirectResponse:
        """The provider sends the browser back here. The browser then goes to the
        web app (at BLINQ_SCRIBE_PUBLIC_URL, never the request's host) with a
        one-time code in the #fragment, which the app redeems by POST."""
        if not signin.public_url or provider not in signin.oidc:
            raise HTTPException(400, "That sign in option isn't set up here.")
        try:
            if not code or not state:
                raise SignInError("The sign in was cancelled.")
            fragment = await signin.oauth_callback(
                provider, code, state, request.cookies.get(OAUTH_COOKIE, "")
            )
        except SignInError as exc:
            # The cookie stays: a forged or stale callback must not end the
            # sign in this browser has under way (it expires on its own).
            fragment = f"oauth_error={quote(str(exc))}"
            return RedirectResponse(signin.app_url(fragment), status_code=302)
        response = RedirectResponse(signin.app_url(fragment), status_code=302)
        response.delete_cookie(
            OAUTH_COOKIE, path=f"/api/auth/oauth/{provider}/callback"
        )
        return response
