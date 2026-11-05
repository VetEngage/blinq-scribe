"""Per-request context: the app's shared pieces and who is calling."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from types import SimpleNamespace
from typing import Any, cast

from fastapi import Request
from strawberry.fastapi import BaseContext

from ..accounts import Caller


class Context(BaseContext):
    def __init__(self, parts: SimpleNamespace) -> None:
        super().__init__()
        # What api.py shares with its route modules: settings, adapter, store,
        # accounts, events, auth, admin, ops (the route handlers) and friends.
        self.parts = parts
        self._caller: Caller | None = None

    @property
    def ops(self) -> Any:
        """The REST route handlers. GraphQL resolves through them, so both APIs
        answer the same way."""
        return self.parts.ops

    @property
    def authorization(self) -> str:
        """The bearer credential: the Authorization header, or on a websocket the
        connection_init payload (browsers can't set websocket headers)."""
        params = self.connection_params
        if isinstance(params, dict):
            for key in ("authorization", "Authorization"):
                if isinstance(params.get(key), str):
                    return cast(str, params[key])
        return self.request.headers.get("authorization", "") if self.request else ""

    def caller(self) -> Caller:
        """Who is calling, with the same rules and the same 401 as the REST API.
        Looked up once per request: every `can` flag in a list asks again."""
        if self._caller is None or not isinstance(self.request, Request):
            # A websocket lives long: each subscription asks again.
            self._caller = self.parts.auth(authorization=self.authorization)
        return self._caller

    def admin(self) -> Caller:
        who: Caller = self.parts.admin(self.http_request(), self.caller())
        return who

    def http_request(self) -> Request:
        assert isinstance(self.request, Request), "only over HTTP"
        return self.request

    def locked(self, encounter_id: str) -> AbstractAsyncContextManager[None]:
        """One change at a time per visit, like the REST routes."""
        hold: Callable[[str], AsyncIterator[None]] = self.parts.one_at_a_time
        return asynccontextmanager(hold)(encounter_id)
