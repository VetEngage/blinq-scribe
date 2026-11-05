"""A patient's earlier notes, from every vet, for treatment continuity.

Two sources, merged newest first: notes synced from the practice system
(onboarding pulls the last 24 months) and notes signed in Blinq Scribe. A note
Blinq Scribe wrote back to the practice system shows up once, not twice.
"""

from __future__ import annotations

import os
import re
import time
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from .schemas import Encounter, EncounterStatus, PastNote, SoapNote
from .store import Store

# 24 months: a provider walking in sees last year too, not just last quarter.
HISTORY_DAYS = 730
_HEADER = re.compile(
    r"^\s*(Subjective|Objective|Assessment|Plan|Comments|S|O|A|P)\s*[:\-]\s*(.*)$",
    re.IGNORECASE,
)
_SECTION = {"s": "subjective", "o": "objective", "a": "assessment", "p": "plan"}


def use_clinic_timezone(name: str) -> None:
    """Keep the clinic's days and times whatever the host's clock is set to: a server
    in a container runs in UTC, where an evening visit is already tomorrow and "14
    days from today" lands a day late. Every date.today(), local_naive() and visit
    day is then the clinic's. Blank keeps the host's own zone."""
    if not name:
        return
    ZoneInfo(name)  # an unknown zone fails at startup, not on the first visit
    os.environ["TZ"] = name
    time.tzset()


def local_naive(dt: datetime) -> datetime:
    """Clinic-local wall time without a timezone. Aware times are converted first, never
    just stripped."""
    return dt.astimezone().replace(tzinfo=None) if dt.tzinfo else dt


def as_utc(dt: datetime) -> datetime:
    """A stored time as an aware one: a naive time is taken to be UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def same_person(a: str, b: str) -> bool:
    """Two spellings of one vet's name: titles, degrees and case are ignored."""

    def key(name: str) -> str:
        name = re.sub(r"^dr\.?\s+", "", name.strip().lower())
        return re.sub(r",?\s+(dvm|vmd|bvsc|mrcvs)\.?$", "", name).strip()

    return bool(a.strip() and b.strip()) and key(a) == key(b)


def split_sections(text: str) -> SoapNote | None:
    """Read S/O/A/P headed text back into sections. None when the note has no
    headers."""
    parts: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        m = _HEADER.match(line)
        # A lone letter followed by a number is a vital ("P: 120" is pulse), not a
        # section header.
        if m and len(m.group(1)) == 1 and re.match(r"\d", m.group(2)):
            m = None
        if m and m.group(1).lower() == "comments":
            current = None  # staff comments are not part of the SOAP sections
        elif m:
            current = _SECTION[m.group(1)[0].lower()]
            parts.setdefault(current, [])
            if m.group(2).strip():
                parts[current].append(m.group(2).strip())
        elif current and line.strip():
            parts[current].append(line.rstrip())
    if not parts:
        return None
    return SoapNote.model_validate(
        {name: "\n".join(lines) for name, lines in parts.items()}
    )


def note_text(note: SoapNote) -> str:
    return "\n".join(
        f"{name[0].upper()}: {getattr(note, name)}"
        for name in ("subjective", "objective", "assessment", "plan")
        if getattr(note, name).strip()
    )


def author_provider_id(e: Encounter) -> str:
    """The PIMS provider who wrote this note. A signed-in vet's login says it exactly;
    without one we
    only know it was the booked vet when the typed name matches, so a relief vet's note
    stays unclaimed."""
    if e.signed_by_provider_id:
        return e.signed_by_provider_id
    return e.provider_id if same_person(e.signed_by, e.provider_name) else ""


def _from_encounter(e: Encounter) -> PastNote:
    assert e.note is not None  # only signed encounters, which have a note
    return PastNote(
        id=f"blinq-{e.id}",
        patient_id=e.patient_id,
        date=local_naive(e.signed_at or e.created_at),
        provider_id=author_provider_id(e),
        provider_name=e.signed_by or e.provider_name,
        text=note_text(e.note),
        source="blinq",
    )


def written_back_ids(store: Store) -> set[str]:
    """Practice-system ids of notes Blinq Scribe wrote back, whoever signed them:
    Blinq's copy is the source."""
    return {
        e.write_back.pims_id
        for e in store.list()
        if e.status == EncounterStatus.signed and e.write_back and e.write_back.pims_id
    }


def previous_notes(
    store: Store, patient_id: str, exclude_encounter: str = "", days: int = HISTORY_DAYS
) -> list[PastNote]:
    """Every vet's notes for this patient over the last `days`, newest first."""
    since = datetime.now() - timedelta(days=days)
    ours = [
        e
        for e in store.list()
        if e.patient_id == patient_id
        and e.id != exclude_encounter
        and e.status == EncounterStatus.signed
        and e.note
    ]
    written = written_back_ids(store)
    notes = [
        n
        for n in store.notes(patient_id=patient_id, since=since)
        if n.id not in written
    ]
    notes += [n for n in map(_from_encounter, ours) if n.date >= since]
    return sorted(notes, key=lambda n: n.date, reverse=True)
