"""The GraphQL schema: snake_case fields, plain error messages, depth limited."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import strawberry
from graphql import GraphQLError
from strawberry.extensions import (
    AddValidationRules,
    DisableIntrospection,
    MaxAliasesLimiter,
    MaxTokensLimiter,
    QueryDepthLimiter,
)
from strawberry.schema.config import StrawberryConfig
from strawberry.tools import merge_types
from strawberry.types import ExecutionContext

from .auth import AuthMutation, AuthQuery
from .errors import PlainErrors
from .limits import OnePaidCall
from .mutation import Mutation
from .query import Query
from .referrals import LettersMutation, LettersQuery
from .speakers import SpeakersMutation
from .subscription import Subscription

MAX_DEPTH = 10
MAX_ALIASES = 15
MAX_TOKENS = 2000


def field_value(root: object, name: str) -> object:
    """Resolvers return the REST handlers' values: Pydantic models, or dicts where a
    key the source left out reads as null."""
    if isinstance(root, Mapping):
        return root.get(name)
    return getattr(root, name)


log = logging.getLogger(__name__)


class Schema(strawberry.Schema):
    def process_errors(
        self,
        errors: list[GraphQLError],
        execution_context: ExecutionContext | None = None,
    ) -> None:
        """A caller's mistake (a 4xx answer, or a query that doesn't validate) is
        logged in one line; tracebacks are kept for server errors and surprises."""
        unexpected = []
        for error in errors:
            status = (error.extensions or {}).get("status")
            if error.original_error is None or (
                isinstance(status, int) and status < 500
            ):
                log.info("GraphQL %s: %s", status or "invalid", error.message)
            else:
                unexpected.append(error)
        super().process_errors(unexpected, execution_context)


def build_schema(introspection: bool = True) -> Schema:
    """The schema. A live practice turns introspection off: only the open demo lets
    anyone explore it (the web app codes against the committed SDL)."""
    extensions: list[Any] = [
        lambda: QueryDepthLimiter(max_depth=MAX_DEPTH),
        lambda: MaxAliasesLimiter(max_alias_count=MAX_ALIASES),
        lambda: MaxTokensLimiter(max_token_count=MAX_TOKENS),
        lambda: AddValidationRules([OnePaidCall]),
        PlainErrors,
    ]
    if not introspection:
        extensions.append(DisableIntrospection)
    return Schema(
        query=merge_types("Query", (Query, AuthQuery, LettersQuery)),
        mutation=merge_types(
            "Mutation", (Mutation, AuthMutation, LettersMutation, SpeakersMutation)
        ),
        subscription=Subscription,
        config=StrawberryConfig(auto_camel_case=False, default_resolver=field_value),
        extensions=extensions,
    )


schema = build_schema()
