"""Who is this? over REST (requirement 64), next to the visit's other routes."""

from __future__ import annotations

from types import SimpleNamespace

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from .accounts import Caller
from .schemas import Encounter
from .speakers import SpeakerError, Speakers


class NameSpeakerIn(BaseModel):
    role: str = Field(
        description='"tech", "owner" or "other" ("family" and "other_vet" too)'
    )
    name: str = Field("", max_length=60)


def register(app: FastAPI, ctx: SimpleNamespace) -> None:
    speakers: Speakers = ctx.speakers

    @app.post(
        "/api/encounters/{encounter_id}/speakers/{speaker_id}",
        response_model=Encounter,
        dependencies=[Depends(ctx.one_at_a_time)],
    )
    def name_speaker(
        encounter_id: str,
        speaker_id: str,
        body: NameSpeakerIn,
        who: Caller = Depends(ctx.auth),
    ) -> Encounter:
        try:
            return speakers.name(
                who, ctx.load(encounter_id), speaker_id, body.role, body.name
            )
        except SpeakerError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
