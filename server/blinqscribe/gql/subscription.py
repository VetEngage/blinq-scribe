"""Subscriptions over graphql-ws: the steps of drafting a note, and what Ask Blinq is
checking. They drive the loading states (requirement 58)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import strawberry
from graphql import GraphQLError

from .. import permissions
from ..events import Events, draft_topic, turn_topic
from .context import Context
from .errors import as_graphql
from .types import AssistantTurn, DraftProgress, shaped

Info = strawberry.Info[Context, None]


def signed_in(info: Info) -> Events:
    """The event stream, for a signed-in caller. A generator's errors skip the schema
    extension, so the 401 is turned into a GraphQL error here."""
    try:
        info.context.caller()
    except Exception as exc:
        if (err := as_graphql(exc)) is None:
            raise
        raise err from exc
    events: Events = info.context.parts.events
    return events


async def draft_progress(
    info: Info, encounter_id: str
) -> AsyncGenerator[DraftProgress]:
    events = signed_in(info)
    # A draft in progress is its own vet's: nobody else follows it being written.
    store, who = info.context.parts.store, info.context.caller()
    enc = store.get(encounter_id)
    if enc and not permissions.owns(who, enc.provider_id):
        reason = "Draft in progress"
        store.audit(
            who.actor, "refused", enc.id, {"action": "draft.follow", "reason": reason}
        )  # audited like every other refusal
        raise GraphQLError(reason, extensions={"code": "FORBIDDEN", "status": 403})
    async for event in events.subscribe(draft_topic(encounter_id)):
        yield shaped(DraftProgress, event)


async def assistant_turn(info: Info, turn_id: str) -> AsyncGenerator[AssistantTurn]:
    async for event in signed_in(info).subscribe(turn_topic(turn_id)):
        yield shaped(AssistantTurn, event)


@strawberry.type
class Subscription:
    draft_progress: AsyncGenerator[DraftProgress] = strawberry.subscription(
        resolver=draft_progress,
        description="Each step of draft_note for this visit, then done. Subscribe "
        "before or just after calling draft_note",
    )
    assistant_turn: AsyncGenerator[AssistantTurn] = strawberry.subscription(
        resolver=assistant_turn,
        description="What Ask Blinq is checking, then its reply. Pass the same "
        "turn_id to ask_assistant",
    )
