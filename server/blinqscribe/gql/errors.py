"""The REST API's errors, as GraphQL errors: the same plain message, plus a code."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from inspect import isawaitable
from typing import Any

from fastapi import HTTPException
from graphql import GraphQLError
from pydantic import ValidationError
from strawberry.extensions import SchemaExtension

CODES = {
    400: "BAD_INPUT",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "TOO_LARGE",
    415: "UNSUPPORTED_FILE",
    429: "TOO_MANY_TRIES",
    502: "UPSTREAM_FAILED",
}


def as_graphql(exc: Exception) -> GraphQLError | None:
    """The GraphQL error for an exception the REST API also answers with, else None."""
    if isinstance(exc, HTTPException):
        return GraphQLError(
            str(exc.detail),
            original_error=exc,
            extensions={
                "code": CODES.get(exc.status_code, "ERROR"),
                "status": exc.status_code,
            },
        )
    if isinstance(exc, ValidationError):
        fields = sorted({".".join(str(p) for p in e["loc"]) for e in exc.errors()})
        return GraphQLError(
            f"Check these fields: {', '.join(fields)}.",
            original_error=exc,
            extensions={"code": "BAD_INPUT", "status": 400},
        )
    return None


class PlainErrors(SchemaExtension):
    """Turns HTTPException and Pydantic errors raised by shared handlers into GraphQL
    errors with the same message the REST API gives."""

    def resolve(
        self,
        _next: Callable[..., Any],
        root: Any,
        info: Any,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        try:
            result = _next(root, info, *args, **kwargs)
        except Exception as exc:
            if (err := as_graphql(exc)) is None:
                raise
            raise err from exc
        if isawaitable(result):
            return _awaited(result)
        return result


async def _awaited(result: Awaitable[Any]) -> Any:
    try:
        return await result
    except Exception as exc:
        if (err := as_graphql(exc)) is None:
            raise
        raise err from exc
