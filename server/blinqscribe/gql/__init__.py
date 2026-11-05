"""Blinq Scribe's GraphQL API at /graphql, on the same FastAPI app as the REST routes.

Queries and mutations call the REST route handlers, so the two APIs can't drift:
same auth, same per-visit locks, same errors. Subscriptions run over graphql-ws.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from types import SimpleNamespace

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from strawberry.fastapi import GraphQLRouter

from .context import Context
from .schema import build_schema, schema

PATH = "/graphql"


def mount(app: FastAPI, parts: SimpleNamespace) -> None:
    async def context() -> Context:
        return Context(parts)

    @app.middleware("http")
    async def json_only(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # A form, multipart or text/plain POST is one another website can send
        # without asking first (no CORS preflight), so GraphQL refuses them all.
        kind = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if (
            request.url.path.rstrip("/") == PATH
            and request.method == "POST"
            and kind != "application/json"
        ):
            return JSONResponse(
                {"errors": [{"message": "Send GraphQL requests as application/json."}]},
                status_code=415,
            )
        return await call_next(request)

    # GraphiQL and introspection are for the open demo (judges explore the API).
    # With an API token, or real practice data, both are off.
    demo = not parts.settings.api_token and parts.adapter.name == "mock"
    router: GraphQLRouter[Context, None] = GraphQLRouter(
        schema if demo else build_schema(introspection=False),
        context_getter=context,
        multipart_uploads_enabled=False,
        graphql_ide="graphiql" if demo else None,
    )
    app.include_router(router, prefix=PATH)


__all__ = ["Context", "mount", "schema"]
