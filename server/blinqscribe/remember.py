"""Remember: personal milestones the owner mentioned, kept only when the vet checks
them. Staff only.

Kept items never reach the note, the scribe's context, the owner summary, texts or the
PIMS: nothing
outside this module and the Remember routes reads them.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field

from .llm import MuseClient
from .prompts import REMEMBER_SYSTEM
from .schemas import Encounter, Segment
from .store import Store
from .text import split_label

KEEP_DAYS = 365

# Milestones and life events worth a mention next time, in the order they are checked.
MILESTONES: list[tuple[str, re.Pattern[str]]] = [
    (kind, re.compile(rx, re.I))
    for kind, rx in (
        ("birthday", r"\bbirthday\b|\bturn(s|ing)? \w+ (years? old\b|on\b)"),
        ("adoption", r"\badopt(ed|ion)\b|\bgotcha day\b"),
        ("graduation", r"\bgraduat(e|es|ed|ing|ion)\b"),
        ("wedding", r"\bwedding\b|\bgetting married\b|\bengaged\b|\bhoneymoon\b"),
        (
            "baby",
            r"\bnew baby\b|\bhaving a baby\b|\bbaby (is "
            r")?(due|coming|arriv)|\bnewborn\b|\bgrandbaby\b",
        ),
        ("move", r"\bmoving\b|\bnew (house|home|apartment|place)\b|\bjust moved\b"),
        ("trip", r"\b(trip|vacation|holiday|cruise|road trip)\b|\btraveling\b"),
        (
            "new_job",
            r"\bnew job\b|\bstart(ed|ing)? (a |my )?(new "
            r")?job\b|\bpromot(ed|ion)\b|\bretir(e|ed|ing)\b",
        ),
        (
            "new_pet",
            r"\bnew (puppy|kitten|dog|cat|pet)\b|\bgetting (a|another) "
            r"(puppy|kitten|dog|cat)\b",
        ),
    )
]

# Never kept, even when the owner brought it up: anyone's health, money, grief or loss,
# religion,
# politics or legal matters.
SENSITIVE = re.compile(
    "|".join(
        (
            r"\b(hospital|surgery|cancer|chemo\w*|dialysis|transplant\w*|sick|illness|diagnos\w*|therapy|doctor|pregnan\w*|miscarr\w*|injur\w*|"
            r"depress\w*|anxiety|rehab|disab\w*|medication|treatment|heart "
            r"attack|stroke|ivf|sober|sobriety)\b",
            r"\b(money|afford|loan|debt|bills?|budget|broke|laid off|lost "
            r"(my|his|her) job|unemploy\w*|bankrupt\w*|"
            r"salary|rent|mortgage|expensive|cost)\b",
            r"\b(died|dying|passed|death|funeral|memorial|grief|grieving|"
            r"divorc\w*|separat\w*|euthan\w*|put "
            r"\w+ down|"
            r"lost (my|our|his|her) "
            r"(mom|dad|mother|father|wife|husband|son|daughter|brother|sister|friend|grandma|grandpa))\b",
            r"\b(church|mosque|temple|synagogue|pray\w*|religio\w*|baptism|"
            r"christening|bar "
            r"mitzvah|bat mitzvah|"
            r"communion|ramadan|easter|christmas|hanukkah|diwali)\b",
            r"\b(election|vote|voting|campaign|politic\w*|protest|democrat\w*|republican\w*|congress)\b",
            r"\b(court|lawyer|attorney|lawsuit|sued|custody|arrest\w*|police|jail|immigration|visa|deport\w*|legal)\b",
        )
    ),
    re.I,
)

_MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ],
        start=1,
    )
}
_WEEKDAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
_MONTH_DAY = re.compile(
    r"\b(" + "|".join(_MONTHS) + r")\s+(\d{1,2})(?:st|nd|rd|th)?\b", re.I
)
_WEEKDAY = re.compile(r"\b(this |on |next )?(" + "|".join(_WEEKDAYS) + r")\b", re.I)


_CLAUSE = re.compile(r"(?<=[.!?])\s+|\s*[,;]\s*|\s+(?:but|and|so|because)\s+", re.I)


def owner_lines(transcript: str, segments: list[Segment] | None = None) -> list[str]:
    """The owner's lines, as said (speaker label removed). With speaker labels
    (requirement 64) they come from the lines labeled as the owner; a line with no
    sure speaker is never treated as the owner's."""
    if segments:
        return [s.text for s in segments if s.role == "owner" and s.text]
    out = []
    for raw in transcript.splitlines():
        who, text = split_label(raw)
        if who.lower().startswith("owner") and text:
            out.append(text)
    return out


def milestone_kind(line: str) -> str:
    return next((kind for kind, rx in MILESTONES if rx.search(line)), "")


def is_personal(line: str) -> bool:
    """Owner small talk about their own life: a milestone or a sensitive topic about
    people, not the pet.

    The scribe leaves these lines out of the note, so a milestone never reaches the
    medical record.
    """
    return bool(milestone_kind(line)) or bool(
        re.search(
            r"\b(passed "
            r"away|funeral|divorc\w*|lawyer|attorney|court|church|election|laid "
            r"off|lost my job|"
            r"my "
            r"(mom|dad|mother|father|wife|husband|son|daughter|brother|sister|grandma|grandpa|neighbor|boss))\b",
            line,
            re.I,
        )
    )


def said_date(line: str, said_on: date) -> str:
    """A date only when the owner said one ("June 14", "on Saturday"), as YYYY-MM-DD;
    never a guess."""
    if m := _MONTH_DAY.search(line):
        month, day = _MONTHS[m.group(1).lower()], int(m.group(2))
        for year in (said_on.year, said_on.year + 1):
            try:
                d = date(year, month, day)
            except ValueError:
                return ""
            if d >= said_on:
                return d.isoformat()
        return ""
    if m := _WEEKDAY.search(line):
        ahead = (_WEEKDAYS.index(m.group(2).lower()) - said_on.weekday()) % 7 or 7
        if (m.group(1) or "").strip().lower() == "next":
            return ""  # "next Saturday" could mean either of two days, so no date
        return (said_on + timedelta(days=ahead)).isoformat()
    return ""


class _Found(BaseModel):
    text: str = Field(
        max_length=120,
        description="The milestone in a few plain words, like 'Daughter's wedding in "
        "June'",
    )
    kind: str = "other"
    transcript_lines: list[str] = []


class _FoundList(BaseModel):
    items: list[_Found] = []


def find_mock(
    transcript: str, segments: list[Segment] | None = None
) -> tuple[list[_Found], int]:
    """Deterministic: owner lines that name a milestone. Returns (found, how many
    sensitive ones were left out)."""
    found, left_out = [], 0
    for line in owner_lines(transcript, segments):
        kind = milestone_kind(line)
        if SENSITIVE.search(line):
            left_out += 1 if (kind or is_personal(line)) else 0
            continue
        if kind:
            # The owner's own words: only the clause that holds the milestone, not the
            # talk around it.
            # (A line with anything sensitive in it was left out whole, above.)
            said = (
                "; ".join(c for c in _CLAUSE.split(line) if milestone_kind(c)) or line
            )
            found.append(
                _Found(
                    text=said.strip().rstrip(".,;"), kind=kind, transcript_lines=[line]
                )
            )
    return found, left_out


async def find(
    muse: MuseClient, transcript: str, segments: list[Segment] | None = None
) -> tuple[list[_Found], int]:
    if not muse.enabled:
        return find_mock(transcript, segments)
    out = await muse.structured(
        REMEMBER_SYSTEM, f"TRANSCRIPT\n{transcript}", _FoundList
    )
    said = owner_lines(transcript, segments)
    found, left_out = [], 0
    for item in out.items:
        lines = [
            ln
            for ln in item.transcript_lines
            if any(ln.strip() and ln.strip() in s for s in said)
        ]
        # The same rules hold whatever the model says: owner's words only, nothing
        # sensitive.
        if not lines:
            continue
        if SENSITIVE.search(item.text) or any(SENSITIVE.search(ln) for ln in lines):
            left_out += 1
            continue
        # The text is the owner's words: the milestone clause of the matched lines, or
        # the model's text only
        # when it is a quote from one of them. Never free model text.
        clauses = [
            c.strip().rstrip(".,;")
            for ln in lines
            for c in _CLAUSE.split(ln)
            if milestone_kind(c)
        ]
        quoted = item.text.strip().rstrip(".,;")
        text = "; ".join(clauses) or (
            quoted if quoted and any(quoted in ln for ln in lines) else ""
        )
        if not text:
            continue
        kind = milestone_kind(text) or (
            item.kind if item.kind in {k for k, _ in MILESTONES} else "other"
        )
        found.append(_Found(text=text, kind=kind, transcript_lines=lines))
    return found, left_out


# ---------- storage ----------


def _visit_key(enc: Encounter) -> str:
    return enc.group_id or enc.id  # one list per visit, whichever pet's note is open


async def suggestions(store: Store, muse: MuseClient, enc: Encounter) -> dict[str, Any]:
    """Remember for next time: built once from the transcript after the draft, then read
    back."""
    key = _visit_key(enc)
    meta = store.get_meta(f"remember:{key}")
    if meta is None:
        found, left_out = await find(muse, enc.transcript, enc.segments)
        owner = next((s.speaker_name for s in enc.segments if s.role == "owner"), "")
        said_on = enc.created_at.date()
        bodies = []
        for f in found:
            body = {
                "id": uuid.uuid4().hex[:10],
                "client_id": enc.client_id,
                "patient_id": enc.patient_id,
                "patient_name": enc.patient_name,
                "text": f.text,
                "kind": f.kind,
                # A date said in the kept words; from the model, only one the owner's
                # own lines hold too.
                "date": said_date(f.text, said_on)
                if any(f.text in ln for ln in f.transcript_lines)
                else said_date(" ".join(f.transcript_lines), said_on),
                "said_at": enc.created_at.isoformat(),
                "encounter_id": enc.id,
                "transcript_lines": f.transcript_lines,
                # Who said it, as the transcript labels it: "Jordan Lee · Owner".
                "said_by": f"{owner} · Owner" if owner else "Owner",
                "expires_at": None,
                "kept_by": "",
            }
            bodies.append(body)
        store.add_remember(key, enc.client_id, enc.patient_id, bodies)
        meta = json.dumps({"left_out": left_out, "mock": not muse.enabled})
        store.set_meta(f"remember:{key}", meta)
    info = json.loads(meta)
    items = [
        {k: b[k] for k in ("id", "text", "kind", "date", "transcript_lines")}
        | {"kept": kept, "said_by": b.get("said_by", "Owner")}
        for _, kept, b in store.remember_for_visit(key)
    ]
    return {"suggestions": items, "left_out": info["left_out"], "mock": info["mock"]}


def keep(
    store: Store, enc: Encounter, ids: list[str], actor: str
) -> list[dict[str, Any]]:
    """Keep exactly the checked suggestions of this visit for 12 months. Returns what
    changed, for the audit."""
    changes = []
    now = datetime.now(UTC)
    for row_id, kept, body in store.remember_for_visit(_visit_key(enc)):
        want = row_id in ids
        if want == kept:
            continue
        body["kept_by"] = actor if want else ""
        body["expires_at"] = (
            (now + timedelta(days=KEEP_DAYS)).isoformat() if want else None
        )
        store.set_remember_kept(row_id, want, body["expires_at"], body)
        changes.append({"item": row_id, "kind": body["kind"], "kept": want})
    return changes


def delete(store: Store, client_id: str, item_id: str) -> dict[str, Any] | None:
    found = store.kept_remember(
        alive_at=datetime.now(UTC), client_id=client_id, item_id=item_id
    )  # an expired item is already gone, even before the cleanup deletes it
    if not found:
        return None
    store.delete_remember(item_id)
    return found[0]


def purge_expired(store: Store) -> int:
    """Kept items last 12 months, then they are deleted (a background job; reads
    skip expired ones meanwhile). Returns how many."""
    return store.purge_remember(datetime.now(UTC))


def _kept(
    store: Store, client_id: str | None = None, patient_id: str | None = None
) -> list[dict[str, Any]]:
    items = store.kept_remember(
        alive_at=datetime.now(UTC), client_id=client_id, patient_id=patient_id
    )
    for item in items:
        item.pop("transcript_lines", None)
    return sorted(items, key=lambda i: i["said_at"], reverse=True)


def kept_for_client(store: Store, client_id: str) -> list[dict[str, Any]]:
    """Kept, unexpired items for a household, newest first (shape in the API
    contract)."""
    return _kept(store, client_id=client_id) if client_id else []


def kept_for_patient(store: Store, patient_id: str) -> list[dict[str, Any]]:
    """Kept, unexpired items for one pet, newest first."""
    return _kept(store, patient_id=patient_id) if patient_id else []
