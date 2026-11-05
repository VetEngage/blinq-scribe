"""Continue with Google and Continue with Microsoft (OpenID Connect).

Authorization code flow with PKCE and a nonce. Each provider is on only when its
client id and secret are set. The ID token is checked against the provider's own
signing keys (issuer, audience, expiry, nonce), and only an email the provider
has verified is returned: that email is what links a sign in to an invited person
the first time.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Literal, cast

import httpx2
from authlib.common.errors import AuthlibBaseError
from authlib.integrations.httpx_client import AsyncOAuth2Client
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet, KeySetSerialization

from .config import Settings

ProviderName = Literal["google", "microsoft"]
PROVIDERS: tuple[ProviderName, ...] = ("google", "microsoft")

_MICROSOFT_SHARED = ("common", "organizations", "consumers")
_DISCOVERY_SECONDS = 3600


class OidcError(Exception):
    """The provider refused, or its answer could not be trusted."""


@dataclass(frozen=True)
class Provider:
    name: ProviderName
    client_id: str
    client_secret: str
    discovery_url: str
    tenant: str = ""  # Microsoft: a tenant id here means only that tenant
    domains: tuple[str, ...] = ()  # Google: only these Workspace domains


@dataclass(frozen=True)
class Identity:
    subject: str
    email: str  # lowercased; empty when the provider doesn't vouch for one
    # The account's email as the provider shows it, verified or not: only ever
    # displayed (Account settings), never used to decide who someone is.
    shown_email: str = ""


def configured(settings: Settings) -> dict[ProviderName, Provider]:
    found: dict[ProviderName, Provider] = {}
    if settings.google_sign_in_client_id and settings.google_sign_in_secret:
        found["google"] = Provider(
            "google",
            settings.google_sign_in_client_id,
            settings.google_sign_in_secret,
            "https://accounts.google.com/.well-known/openid-configuration",
            domains=tuple(
                d.strip().lower()
                for d in settings.google_sign_in_domains.split(",")
                if d.strip()
            ),
        )
    if settings.microsoft_sign_in_client_id and settings.microsoft_sign_in_secret:
        tenant = settings.microsoft_sign_in_tenant
        found["microsoft"] = Provider(
            "microsoft",
            settings.microsoft_sign_in_client_id,
            settings.microsoft_sign_in_secret,
            f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration",
            tenant,
        )
    return found


class OidcClient:
    """Talks to one provider. `transport` lets tests stand in for the provider."""

    def __init__(
        self, provider: Provider, transport: httpx2.AsyncBaseTransport | None = None
    ):
        self.provider = provider
        self.transport = transport
        self._meta: tuple[float, dict[str, Any]] | None = None

    def _client(self, redirect_uri: str) -> AsyncOAuth2Client:
        return AsyncOAuth2Client(
            client_id=self.provider.client_id,
            client_secret=self.provider.client_secret,
            redirect_uri=redirect_uri,
            scope="openid email profile",
            code_challenge_method="S256",
            token_endpoint_auth_method="client_secret_post",
            transport=self.transport,
            timeout=20,
        )

    async def _get_json(self, url: str) -> dict[str, Any]:
        async with httpx2.AsyncClient(transport=self.transport, timeout=20) as http:
            r = await http.get(url)
        if r.status_code != 200:
            raise OidcError(f"{self.provider.name} answered {r.status_code}")
        body: dict[str, Any] = r.json()
        return body

    async def metadata(self) -> dict[str, Any]:
        if self._meta and time.monotonic() - self._meta[0] < _DISCOVERY_SECONDS:
            return self._meta[1]
        meta = await self._get_json(self.provider.discovery_url)
        self._meta = (time.monotonic(), meta)
        return meta

    async def authorization_url(
        self, redirect_uri: str, state: str, verifier: str, nonce: str
    ) -> str:
        meta = await self.metadata()
        async with self._client(redirect_uri) as client:
            url, _ = client.create_authorization_url(
                meta["authorization_endpoint"],
                state=state,
                code_verifier=verifier,
                nonce=nonce,
                prompt="select_account",
            )
        return str(url)

    async def identity(
        self, code: str, redirect_uri: str, verifier: str, nonce: str
    ) -> Identity:
        meta = await self.metadata()
        try:
            async with self._client(redirect_uri) as client:
                token = await client.fetch_token(
                    meta["token_endpoint"], code=code, code_verifier=verifier
                )
        except (httpx2.HTTPError, AuthlibBaseError, ValueError) as exc:
            raise OidcError(f"{self.provider.name} refused the sign in code") from exc
        id_token = token.get("id_token")
        if not isinstance(id_token, str):
            raise OidcError(f"{self.provider.name} sent no ID token")
        claims = await self._verified_claims(id_token, meta, nonce)
        shown = claims.get("email") or claims.get("preferred_username") or ""
        return Identity(
            str(claims["sub"]), self._trusted_email(claims), str(shown).lower()
        )

    async def _verified_claims(
        self, id_token: str, meta: dict[str, Any], nonce: str
    ) -> dict[str, Any]:
        jwks = await self._get_json(meta["jwks_uri"])
        keys = KeySet.import_key_set(cast(KeySetSerialization, jwks))
        try:
            token = jwt.decode(id_token, keys, algorithms=["RS256"])
            claims: dict[str, Any] = dict(token.claims)
            jwt.JWTClaimsRegistry(
                leeway=60,
                sub={"essential": True},
                aud={"essential": True, "value": self.provider.client_id},
                nonce={"essential": True, "value": nonce},
                exp={"essential": True},
            ).validate(claims)
        except (JoseError, ValueError) as exc:
            raise OidcError(
                f"{self.provider.name} sent an ID token we can't trust"
            ) from exc
        # Microsoft's shared endpoints publish "{tenantid}" in the issuer: the
        # token's own tenant fills it in.
        issuer = str(meta["issuer"]).replace("{tenantid}", str(claims.get("tid", "")))
        if claims.get("iss") != issuer:
            raise OidcError(f"{self.provider.name} sent a token from another issuer")
        tenant = self.provider.tenant
        if tenant and tenant not in _MICROSOFT_SHARED and claims.get("tid") != tenant:
            raise OidcError("That Microsoft account is from another organization")
        return claims

    def _trusted_email(self, claims: dict[str, Any]) -> str:
        email = str(claims.get("email") or "").strip().lower()
        if self.provider.name == "google":
            domains = self.provider.domains
            if claims.get("email_verified") is not True:
                return ""
            return email if not domains or claims.get("hd") in domains else ""
        # A Microsoft account's email (and preferred_username) is whatever its
        # tenant typed in, so any tenant could claim a vet's address. It counts
        # only when Microsoft says the tenant proved it owns the email's domain.
        verified = (
            claims.get("xms_edov") is True or claims.get("email_verified") is True
        )
        return email if verified else ""
