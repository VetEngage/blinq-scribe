"""Voice profile: new drafts match how this vet writes, never what they wrote.

Built from every note the vet wrote in the last 90 days (VOICE_DAYS): notes
synced from the practice system at onboarding, plus notes they signed in Blinq
Scribe. So it is ready on day one and keeps up as they write. A new vet gets
one after 2 notes.
The result is a few style rules per SOAP section (bullets or prose, how long,
which abbreviations). The notes themselves never reach the model, so no other
patient's facts can leak into a new draft.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime, timedelta
from statistics import median
from typing import Literal

from pydantic import BaseModel

from .notes import (
    author_provider_id,
    local_naive,
    split_sections,
    written_back_ids,
)
from .schemas import EncounterStatus, SoapNote
from .store import Store

# Style comes from recent notes only: how a provider writes now, not two years
# ago. Notes for continuity reach back further (notes.HISTORY_DAYS).
VOICE_DAYS = 90

SECTIONS = ("subjective", "objective", "assessment", "plan")
# Encounters the demo clinic seeds for its earlier days (demo_seed.py): made up, so
# never the vet's style.
SEEDED_PREFIX = "demo-"
MIN_NOTES = 2
MAX_NOTES = 30
# Pure notation only: section labels, routes, dosing frequency, vital sign names.
# Shorthand that IS a
# finding or a side (BAR, WNL, NSF, PU/PD, OU, AD...) is left out, so a profile can
# never suggest that
# finding for a new patient. Only these are looked for, so a profile never carries free
# text.
ABBREVIATIONS = (
    "PE",
    "Hx",
    "Dx",
    "DDx",
    "Tx",
    "Rx",
    "r/o",
    "PO",
    "SQ",
    "IM",
    "IV",
    "SID",
    "BID",
    "TID",
    "QID",
    "PRN",
    "q8h",
    "q12h",
    "q24h",
    "BCS",
    "TPR",
    "HR",
    "RR",
    "CRT",
    "MM",
)
_ABBREV = {a: re.compile(rf"(?<![\w/]){re.escape(a)}(?![\w/])") for a in ABBREVIATIONS}
_BULLET = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")
_SENTENCE = re.compile(
    r"(?<!\bDr\.)(?<!\bMr\.)(?<!\bMs\.)(?<!Mrs\.)(?<=[.!?])\s+(?=[A-Z\[])"
)


class SectionStyle(BaseModel):
    format: Literal["bullets", "prose"]
    length: Literal["brief", "moderate", "detailed"]


class VoiceProfile(BaseModel):
    provider_id: str
    notes_used: int
    sections: dict[str, SectionStyle]
    abbreviations: list[str] = []
    # "synced": learned from the vet's own notes. "default": demo only, no notes to
    # learn from yet.
    source: Literal["synced", "default"] = "synced"

    def prompt_text(self) -> str:
        if self.source == "default":
            intro = "A default note style (this vet has no notes to learn from yet). "
        else:
            intro = (
                f"This vet's writing style, from their last {self.notes_used} "
                "signed notes. "
            )
        lines = [
            intro + "Match it for format and abbreviations, and keep each section no "
            "longer than its length. "
            "It says nothing about this patient."
        ]
        lines += [
            f"- {name.capitalize()}: {s.format}, {s.length}"
            for name, s in self.sections.items()
        ]
        if self.abbreviations:
            lines.append(
                f"- Abbreviations they use, only for things the transcript states: "
                f"{', '.join(self.abbreviations)}"
            )
        return "\n".join(lines)


def _is_bullets(text: str) -> bool:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return len(lines) >= 2 and sum(bool(_BULLET.match(ln)) for ln in lines) * 2 > len(
        lines
    )


def _length(words: float) -> Literal["brief", "moderate", "detailed"]:
    return "brief" if words < 25 else "moderate" if words <= 80 else "detailed"


def build_profile(
    provider_id: str, notes: list[SoapNote], free_text: Sequence[str] = ()
) -> VoiceProfile | None:
    """Style rules from the vet's notes, newest first. None until there are enough notes
    to learn from.

    `free_text` is notes with no S/O/A/P headers: they count toward abbreviations, not
    section format.
    """
    notes, free_text = (
        notes[:MAX_NOTES],
        list(free_text)[: max(0, MAX_NOTES - len(notes))],
    )
    if len(notes) + len(free_text) < MIN_NOTES:
        return None
    sections = {}
    for name in SECTIONS:
        texts = [
            t
            for t in (getattr(n, name).strip() for n in notes)
            if t and not t.startswith("[confirm")
        ]
        if not texts:
            continue
        bullets = sum(_is_bullets(t) for t in texts) * 2 > len(texts)  # ties stay prose
        sections[name] = SectionStyle(
            format="bullets" if bullets else "prose",
            length=_length(median(len(t.split()) for t in texts)),
        )
    text = ["\n".join(getattr(n, s) for s in SECTIONS) for n in notes] + free_text
    counts = {a: sum(bool(rx.search(t)) for t in text) for a, rx in _ABBREV.items()}
    used = sorted(
        (a for a, c in counts.items() if c >= MIN_NOTES), key=lambda a: (-counts[a], a)
    )
    return VoiceProfile(
        provider_id=provider_id,
        notes_used=len(text),
        sections=sections,
        abbreviations=used[:12],
    )


def profile_for(
    store: Store, provider_id: str, exclude_encounter: str = ""
) -> VoiceProfile | None:
    if not provider_id:
        return None
    since = datetime.now() - timedelta(days=VOICE_DAYS)
    # Only notes this vet wrote, wherever they were booked: covering for a colleague
    # still counts as theirs,
    # and a relief vet's note on this vet's patient does not.
    signed = [
        e
        for e in store.list()
        if e.id != exclude_encounter
        and e.status == EncounterStatus.signed
        and e.note
        and author_provider_id(e) == provider_id
        and not e.id.startswith(SEEDED_PREFIX)
    ]
    # Skip practice-system copies of every note Blinq wrote back, including a relief
    # vet's that the
    # practice system may have filed under the booked vet.
    written = written_back_ids(store)
    dated: list[tuple[datetime, SoapNote | str | None]] = [
        (local_naive(e.signed_at or e.created_at), e.note) for e in signed
    ]
    # Practice-system notes are by their author: other vets' notes on this vet's
    # patients never count.
    for n in store.notes(provider_id=provider_id, since=since):
        if n.id not in written:
            dated.append((n.date, split_sections(n.text) or n.text))
    dated = [d for d in dated if d[0] >= since]
    dated.sort(key=lambda d: d[0], reverse=True)
    dated = dated[:MAX_NOTES]
    return build_profile(
        provider_id,
        [n for _, n in dated if isinstance(n, SoapNote)],
        [n for _, n in dated if isinstance(n, str)],
    )


def default_profile(provider_id: str) -> VoiceProfile:
    """Demo only: a plain house style for a vet with no synced notes, so drafts still
    read like a vet's note.

    A live practice never gets this: a vet there has no profile until 2 of their notes
    are synced or signed.
    """
    return VoiceProfile(
        provider_id=provider_id,
        notes_used=0,
        source="default",
        sections={
            "subjective": SectionStyle(format="prose", length="brief"),
            "objective": SectionStyle(format="bullets", length="moderate"),
            "assessment": SectionStyle(format="prose", length="brief"),
            "plan": SectionStyle(format="bullets", length="moderate"),
        },
    )


def apply_format(note: SoapNote, profile: VoiceProfile | None) -> None:
    """Mock mode only: reshape sections the vet writes as bullets. Wording and facts are
    untouched."""
    if not profile:
        return
    for name, style in profile.sections.items():
        text = getattr(note, name)
        if (
            style.format == "bullets"
            and text
            and not text.startswith("[confirm")
            and not _is_bullets(text)
        ):
            setattr(
                note,
                name,
                "\n".join(f"- {s}" for s in _SENTENCE.split(text.strip()) if s),
            )
