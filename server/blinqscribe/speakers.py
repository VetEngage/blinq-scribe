"""Who said each transcript line (requirement 64).

The speech model gives plain text: Muse Voice Transcribe's reply has the words (and
"turns" of them) but no speaker. So after each chunk, the new lines get a speaker:
the visit's vet, the owner on the appointment, or "Speaker N" for anyone else, until
the vet says who that is (one tap: Tech, Owner or Other), which then applies to
every line from that voice. When Blinq isn't sure, the line has no name rather than a
guess.

A line already written "Name: text" (the demo's sample visits, a typed transcript)
keeps that speaker; other lines go to Muse Spark with strict structured output. With
no model, an unlabeled line has no speaker.

enc.transcript stays the plain text for drafting and everything else; each segment
names its transcript line (1-based), the numbering Show sources uses.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Literal

from pydantic import BaseModel, Field

from . import permissions
from .accounts import Caller
from .llm import SECTION_TOKENS, MuseClient
from .notes import as_utc
from .schemas import Appointment, Encounter, EncounterStatus, Segment
from .store import Store
from .text import split_label

SpeakerRole = Literal["vet", "owner", "tech", "family", "other_vet", "other", "unknown"]
NAMEABLE: dict[str, str] = {  # Who is this?: the choices, as the label shows them
    "tech": "Tech",
    "owner": "Owner",  # the appointment's owner, by name, when known
    "other": "Other",
    "family": "Family member",
    "other_vet": "Another provider",
}
WORDS_PER_SECOND = 2.5  # a line's place in time, when only its words are known
_SPEAKER_N = re.compile(r"^speaker[ _-]?(\d{1,2})$", re.I)
_TITLE = re.compile(r"^(dr|doctor)\.?\s+", re.I)


class SpeakerError(ValueError):
    """A refused step. The message is safe to show."""

    status = 400


class SignedVisit(SpeakerError):
    status = 409


class _LineSpeaker(BaseModel):
    line: int = Field(description="The line's number, as given")
    speaker: str = Field(
        description='"vet", "owner", "speaker_2" (or another number) for anyone '
        'else, or "unsure"'
    )


class _SpeakerPass(BaseModel):
    lines: list[_LineSpeaker] = []


SPEAKER_SYSTEM = """You tell who said each line of a vet visit transcript. Speakers:
"vet" is {vet}, the vet seeing the pet; "owner" is {owner}, the pet's owner; anyone
else (a tech, a family member, another vet) is "speaker_2", "speaker_3" and so on, the
same number for the same voice throughout. Decide from what the line says and how it
says it: a vet examines, measures, explains and prescribes; an owner describes the
pet at home and asks. Answer "unsure" whenever the line could be either: a wrong name
is worse than none. Give every numbered line exactly once."""


def _words(text: str) -> int:
    return len(text.split())


def _last_name(name: str) -> str:
    parts = _TITLE.sub("", name).split()
    return parts[-1].lower() if parts else ""


class Speakers:
    def __init__(self, muse: MuseClient, store: Store):
        self.muse, self.store = muse, store

    def name(
        self, who: Caller, enc: Encounter, speaker_id: str, role: str, name: str = ""
    ) -> Encounter:
        """Who is this?, from the visit's own vet (or the open demo): the role and
        name for every line from that voice. Audited."""
        permissions.check(
            who, "note.edit", enc.provider_id, enc.provider_name, self.store, enc.id
        )
        if enc.status == EncounterStatus.signed:
            raise SignedVisit("This visit is signed, so the transcript can't change.")
        enc = name_speaker(enc, speaker_id, role, name)
        self.store.save(enc)
        self.store.audit(
            who.actor,
            "speaker_named",
            enc.id,
            {"speaker_id": speaker_id, "role": role, "named": bool(name.strip())},
        )
        return enc

    async def label(self, enc: Encounter, appt: Appointment | None = None) -> Encounter:
        """Give every transcript line a segment. Lines already labeled keep theirs
        (and any name the vet gave a speaker); new or changed lines are labeled."""
        lines = enc.transcript.splitlines()
        vet = enc.provider_name or (appt.provider_name if appt else "")
        owner = enc.owner_name or (appt.client.full_name if appt else "")
        named = {s.speaker_id: s for s in enc.segments if s.speaker_id}
        # Old segments follow their words: a line put in above moves the ones
        # below it down a number, but they keep their speakers.
        old = sorted(enc.segments, key=lambda s: s.line)
        texts = [_text_of(line) for line in lines]
        kept: list[Segment] = []
        for tag, i1, i2, j1, _ in SequenceMatcher(
            None, [s.text for s in old], texts, autojunk=False
        ).get_opcodes():
            if tag == "equal":
                kept += [
                    seg.model_copy(
                        update={"line": j1 + k + 1, "id": f"{enc.id}-{j1 + k + 1}"}
                    )
                    for k, seg in enumerate(old[i1:i2])
                ]
        done = {s.line for s in kept}
        todo = [
            (i + 1, line)
            for i, line in enumerate(lines)
            if line.strip() and i + 1 not in done
        ]
        if not todo:
            enc.segments = kept
            return enc
        guesses = await self._who(todo, vet, owner)
        # Where the new lines fall in time: they were just said, each taking as long
        # as its words do, and never before the line already there.
        last = max(kept, key=lambda s: s.line, default=None)
        after = (
            last.offset_seconds + _words(last.text) / WORDS_PER_SECOND if last else 0
        )
        said = sum(_words(_text_of(line)) for _, line in todo) / WORDS_PER_SECOND
        elapsed = (datetime.now(UTC) - as_utc(enc.created_at)).total_seconds()
        at = max(after, elapsed - said, 0.0)
        new: list[Segment] = []
        for number, line in todo:
            speaker_id, name, role = guesses.get(number, ("", "", "unknown"))
            if speaker_id in named and named[speaker_id].role in NAMEABLE:
                name, role = named[speaker_id].speaker_name, named[speaker_id].role
            text = _text_of(line)
            new.append(
                Segment(
                    id=f"{enc.id}-{number}",
                    line=number,
                    speaker_id=speaker_id,
                    speaker_name=name,
                    role=role,
                    offset_seconds=int(at),
                    text=text,
                )
            )
            at += _words(text) / WORDS_PER_SECOND
        enc.segments = sorted(kept + new, key=lambda s: s.line)
        return enc

    async def _who(
        self, todo: list[tuple[int, str]], vet: str, owner: str
    ) -> dict[int, tuple[str, str, SpeakerRole]]:
        """line number -> (speaker id, name, role)."""
        out: dict[int, tuple[str, str, SpeakerRole]] = {}
        unlabeled: list[tuple[int, str]] = []
        for number, line in todo:
            who, _ = split_label(line)
            if who:
                out[number] = _from_label(who, vet, owner)
            else:
                unlabeled.append((number, line))
        if unlabeled and self.muse.enabled:
            out |= await self._speaker_pass(unlabeled, vet, owner)
        return out

    async def _speaker_pass(
        self, lines: list[tuple[int, str]], vet: str, owner: str
    ) -> dict[int, tuple[str, str, SpeakerRole]]:
        system = SPEAKER_SYSTEM.format(vet=vet or "the vet", owner=owner or "the owner")
        ask = "\n".join(f"{n}. {text.strip()}" for n, text in lines)
        result = await self.muse.structured(
            system, ask, _SpeakerPass, max_tokens=SECTION_TOKENS
        )
        wanted = {n for n, _ in lines}
        out: dict[int, tuple[str, str, SpeakerRole]] = {}
        for item in result.lines:
            if item.line in wanted:  # only lines it was asked about
                # "unsure" (or anything else unknown) gives no speaker
                out[item.line] = _from_label(item.speaker, vet, owner)
        return out


def _text_of(line: str) -> str:
    return split_label(line)[1]


def _from_label(label: str, vet: str, owner: str) -> tuple[str, str, SpeakerRole]:
    """A written label: the visit's vet, the owner, Speaker N, or someone named."""
    low = label.strip().lower()
    if low in ("owner", "client") or (owner and low == owner.lower()):
        return "owner", owner, "owner"
    if low in ("vet", "doctor") or (vet and _last_name(label) == _last_name(vet)):
        return "vet", vet, "vet"
    if m := _SPEAKER_N.match(low):
        n = max(2, int(m.group(1)))
        return f"speaker-{n}", f"Speaker {n}", "unknown"
    if low in ("tech", "technician", "nurse"):
        return "tech", "Tech", "tech"
    if _TITLE.match(label):  # a doctor who isn't this visit's vet
        slug = re.sub(r"[^a-z0-9]+", "-", low).strip("-")
        return f"vet-{slug}", label.strip(), "other_vet"
    return "", "", "unknown"  # not sure who: no name rather than a guess


def name_speaker(
    enc: Encounter, speaker_id: str, role: str, name: str = ""
) -> Encounter:
    """Who is this?: the role (and name, if given) for every line from that voice."""
    if role not in NAMEABLE:
        raise SpeakerError('Pick "tech", "owner" or "other".')
    if not speaker_id or speaker_id in ("vet", "owner"):
        raise SpeakerError("That speaker can't be renamed here.")
    lines = [s for s in enc.segments if s.speaker_id == speaker_id]
    if not lines:
        raise SpeakerError("That speaker isn't in this transcript.")
    clean = " ".join(name.split())[:60]
    # Said to be the owner: the owner on the appointment, as Blinq names them.
    owner = enc.owner_name if role == "owner" else ""
    label = clean or owner or NAMEABLE[role]
    enc.segments = [
        s.model_copy(update={"speaker_name": label, "role": role})
        if s.speaker_id == speaker_id
        else s
        for s in enc.segments
    ]
    return enc
