"""Who is this? over GraphQL (requirement 64): name a transcript speaker. The labels
themselves come with the visit (Encounter.segments)."""

from __future__ import annotations

import strawberry
from fastapi import HTTPException

from ..speakers import SpeakerError, Speakers
from .context import Context
from .types import Encounter, shaped

Info = strawberry.Info[Context, None]


async def name_speaker(
    info: Info, encounter_id: str, speaker_id: str, role: str, name: str = ""
) -> Encounter:
    who = info.context.caller()
    speakers: Speakers = info.context.parts.speakers
    async with info.context.locked(encounter_id):
        enc = info.context.parts.load(encounter_id)
        try:
            out = speakers.name(who, enc, speaker_id, role, name)
        except SpeakerError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
    return shaped(Encounter, out)


@strawberry.type
class SpeakersMutation:
    name_speaker: Encounter = strawberry.mutation(
        resolver=name_speaker,
        description='Who is this?: role "tech", "owner" or "other" ("family" and '
        '"other_vet" too, and an optional name) for every line from that speaker. '
        "Only the visit's vet",
    )
