"""Transcript (+ record + photos) -> draft SOAP note + follow ups."""

from __future__ import annotations

import functools
import json
import re
import uuid
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from pydantic import BaseModel, Field

from . import note_types, sample
from .adapters.base import PracticeAdapter
from .llm import LONG_TOKENS, CutOff, MuseClient, garbled, runaway
from .prompts import SCRIBE_SYSTEM
from .remember import is_personal
from .schemas import (
    Appointment,
    Encounter,
    FollowUp,
    FollowUpKind,
    PastNote,
    PastVisit,
    Photo,
    SoapNote,
    followup_fallback,
)
from .text import bullets, cap, prose, sentences, split_label
from .voice import VoiceProfile, apply_format


class _FollowUpOut(BaseModel):
    kind: FollowUpKind
    reason: str = Field(
        max_length=80,
        description="A short label, like 'Recheck right ear in 2 weeks'",
    )
    due_in_days: int | None = None
    message_draft: str = ""

    @staticmethod
    def fallback(field: str, item: dict[str, Any]) -> str:
        """A reason the model garbled becomes a plain one: "Recheck in 14 days"."""
        try:
            kind = FollowUpKind(item.get("kind"))
        except ValueError:
            kind = FollowUpKind.task
        due = item.get("due_in_days")
        return followup_fallback(kind, due if isinstance(due, int) else None)


class NoteDraft(SoapNote):
    followups: list[_FollowUpOut] = []  # noqa: RUF012 (pydantic copies defaults)
    # Lines the provider asked to cover today (ticked in their last plan) that the
    # visit didn't talk about, quoted exactly.
    not_covered: list[str] = Field(
        default_factory=list,
        description="Each line of PROVIDER ASKED TO COVER TODAY the transcript never "
        "talked about, copied exactly as given",
    )


MAX_OTHER_VITALS = 6


class _OtherVital(BaseModel):
    """One more vital, as a fixed pair: never an open name-to-value map."""

    name: str = Field(max_length=40, description="Like 'CRT' or 'Mucous membranes'")
    value: str = Field(max_length=60, description="As said, like '<2 s' or 'pink'")


class _Vitals(BaseModel):
    """Vitals with fixed names. An open name-to-value map let Muse Spark pad the
    JSON with spaces after a key until it hit the token cap."""

    weight: str = Field("", description="As said, like '74 lb'; '' when not said")
    temperature: str = Field("", description="As said, like '101.8 F'; '' if not")
    heart_rate: str = Field("", description="As said, like '96'; '' when not said")
    respiratory_rate: str = Field("", description="As said; '' when not said")
    body_condition_score: str = Field("", description="As said, like '5/9'; '' if not")
    blood_pressure: str = Field("", description="As said, like '165'; '' if not")
    other: list[_OtherVital] = Field(
        default_factory=list,
        description="Any other vital the vet said (pulse quality, mucous membranes, "
        "CRT, pain score, pulse ox), up to 6",
        json_schema_extra={"maxItems": MAX_OTHER_VITALS},
    )


class _DraftOut(NoteDraft):
    """What Muse Spark fills in: the note with fixed vitals, and the follow ups."""

    vitals: _Vitals = Field(default_factory=_Vitals)  # type: ignore[assignment]


PREVIOUS_IN_PROMPT = 3  # most recent notes, from any vet
PREVIOUS_CHARS = 800


def build_context(
    appt: Appointment,
    history: list[PastVisit],
    encounter: Encounter,
    earlier: Sequence[PastNote] = (),
) -> str:
    p = appt.patient
    lines = [
        f"Patient: {p.name}, {p.species} {p.breed}, age "
        f"{p.age if p.age is not None else 'unknown'}",
        f"Owner: {appt.client.full_name}",
        f"Visit reason: {appt.reason or appt.type}",
    ]
    if p.alerts:
        lines.append("Alerts: " + "; ".join(p.alerts))
    if history:
        lines.append("Recent visits:")
        lines += [
            f"- {v.date:%Y-%m-%d}: {v.reason}. {v.summary}".rstrip()
            for v in history[:5]
        ]
    if earlier:
        lines.append(
            "Previous notes (earlier visits, any vet; history only, not "
            "today's findings):"
        )
        for n in earlier[:PREVIOUS_IN_PROMPT]:
            text = (
                n.text
                if len(n.text) <= PREVIOUS_CHARS
                else n.text[:PREVIOUS_CHARS] + "..."
            )
            lines.append(
                f"--- {n.date:%Y-%m-%d} by {n.provider_name or 'unknown vet'}\n{text}"
            )
    if photos := in_note(encounter):
        lines.append("Photo findings:")
        lines += [
            f"- {ph.label + ': ' if ph.label else ''}{ph.caption}: {ph.findings} "
            f"({len(ph.outline)} region(s) outlined)"
            for ph in photos
        ]
    return "\n".join(lines)


def in_note(encounter: Encounter) -> list[Photo]:
    """The photos the vet keeps in the note; the others never reach the draft."""
    return [ph for ph in encounter.photos if ph.in_note]


def _vitals_dict(v: _Vitals) -> dict[str, str]:
    """The note's vitals: the named ones that were said, then up to 6 others."""
    out = {
        k: str(value).strip()
        for k, value in v.model_dump(exclude={"other"}).items()
        if str(value).strip()
    }
    for item in v.other[:MAX_OTHER_VITALS]:
        if item.name.strip() and item.value.strip():
            out.setdefault(item.name.strip(), item.value.strip())
    return out


async def draft_note(
    muse: MuseClient,
    appt: Appointment,
    history: list[PastVisit],
    encounter: Encounter,
    voice: VoiceProfile | None = None,
    earlier: Sequence[PastNote] = (),
    note_type: str = "sick",
    pets: Sequence[str] = (),
    asked: Sequence[str] = (),
) -> NoteDraft:
    """Draft the note for appt.patient. `pets` names every pet in the visit, first pet
    first. `asked` are lines of the provider's own last plan they ticked to cover
    today: the draft says which the visit didn't talk about (`not_covered`), quoted,
    and never adds anything about them."""
    context = build_context(appt, history, encounter, earlier)
    if not muse.enabled:
        draft = mock_draft(encounter.transcript, appt, pets)
        apply_format(draft, voice)
        draft.not_covered = [x for x in asked if not covered(x, encounter.transcript)]
        return draft
    user = (
        f"NOTE TYPE\n{note_types.guidance(note_type)}\n\nPATIENT RECORD\n{context}\n\n"
        f"TRANSCRIPT\n{encounter.transcript}"
    )
    if asked:
        user += "\n\nPROVIDER ASKED TO COVER TODAY\n" + "\n".join(
            f"- {x}" for x in asked
        )
    if len(pets) > 1:
        user += (
            f"\n\nPETS IN THIS VISIT\n{', '.join(pets)}. Write the note for "
            f"{appt.patient.name} only."
        )
    if voice:
        user += f"\n\nWRITING STYLE\n{voice.prompt_text()}"
    out = await muse.structured(
        SCRIBE_SYSTEM, user, _DraftOut, max_tokens=LONG_TOKENS, must_finish=True
    )
    if not any(
        getattr(out, s).strip()
        for s in ("subjective", "objective", "assessment", "plan")
    ):
        raise CutOff("Muse Spark's note came back empty.")
    draft = NoteDraft(
        **out.model_dump(exclude={"vitals", "followups", "not_covered"}),
        vitals=_vitals_dict(out.vitals),
        followups=out.followups,
        not_covered=quoted(out.not_covered, asked),
    )
    evidence = "\n".join(
        [
            encounter.transcript,
            *(f"{ph.caption} {ph.findings}" for ph in in_note(encounter)),
        ]
    )
    guard_vitals(
        draft, evidence, "\n".join(n.text for n in earlier[:PREVIOUS_IN_PROMPT])
    )
    return draft


def quoted(lines: Sequence[str], asked: Sequence[str]) -> list[str]:
    """The model's not-covered lines, kept only where they are one of the provider's
    own asked lines (as the provider wrote it), each once: Blinq never words one
    itself."""
    own = {" ".join(a.split()).lower().rstrip("."): a for a in asked}
    out: list[str] = []
    for line in lines:
        hit = own.get(" ".join(line.split()).lower().rstrip("."))
        if hit and hit not in out:
            out.append(hit)
    return out


# Words in a plan line that say how or when, never what: they never show a line was
# talked about. "Apoquel 16 mg by mouth twice a day" is about Apoquel.
_PLAN_FILLER = {
    "about", "after", "again", "also", "before", "between", "daily", "days",
    "each", "every", "from", "give", "hours", "into", "keep", "more", "mouth",
    "months", "once", "only", "other", "over", "should", "start", "than", "that",
    "then", "them", "they", "this", "three", "times", "today", "twice", "until",
    "weeks", "what", "when", "with", "within", "would", "your",
}  # fmt: skip


def _stem(word: str) -> str:
    return re.sub(r"(?:ing|ed|es|s)$", "", word) if len(word) > 5 else word


def plan_keys(line: str) -> set[str]:
    """A plan line's key words: what it is about, without how or when."""
    words = re.findall(r"[a-z]{4,}", line.lower())
    return {_stem(w) for w in words if w not in _PLAN_FILLER}


def covered(line: str, transcript: str) -> bool:
    """Mock mode: whether the visit talked about a plan line, from its key words. At
    least half of them said in the room is covered; a line with no key words can't be
    told, so it never comes back as a reminder. Deterministic, like the rest of the
    mock."""
    keys = plan_keys(line)
    if not keys:
        return True
    said = {_stem(w) for w in re.findall(r"[a-z]{4,}", transcript.lower())}
    return 2 * len(keys & said) >= len(keys)


_NUMBER = re.compile(r"(?<![\d.])\d+(?:\.\d+)?(?![\d])")


def _said(number: str, evidence: str) -> bool:
    return re.search(rf"(?<![\d.]){re.escape(number)}(?![\d])", evidence) is not None


def guard_vitals(note: SoapNote, evidence: str, earlier: str = "") -> None:
    """Today's numbers must come from today, and the vet sees any that might not.

    A vital whose numbers were not said in the room (or seen in a photo) is flagged. In
    the exam and
    assessment text, a number that appears in an earlier note but not today is flagged
    too, so an old
    temperature or weight copied from history is caught rather than charted as today's.
    """
    for name, value in note.vitals.items():
        numbers = _NUMBER.findall(value)
        if numbers and not all(_said(n, evidence) for n in numbers):
            note.vitals[name] = f"[confirm: {value}]"
    if not earlier:
        return
    for section in ("objective", "assessment"):
        text = getattr(note, section)
        setattr(
            note,
            section,
            _NUMBER.sub(
                lambda m: (
                    m.group(0)
                    if _said(m.group(0), evidence) or not _said(m.group(0), earlier)
                    else f"[confirm: {m.group(0)}]"
                ),
                text,
            ),
        )


async def plan_followups(
    draft: NoteDraft, appt: Appointment, adapter: PracticeAdapter
) -> list[FollowUp]:
    """Turn the follow ups the vet said into drafts. Rechecks get real open slots.
    The same follow up said twice (same kind and reason, or rechecks due within a few
    days of each other) is one; a reason or text the model garbled becomes a plain
    one (a recheck's text, the clinic's own template)."""
    out: list[FollowUp] = []
    for f in draft.followups:
        reason = " ".join(f.reason.split())
        if not reason or len(reason) > 80 or garbled(reason):
            reason = followup_fallback(f.kind, f.due_in_days)
        if any(_same(o, f.kind, reason, f.due_in_days) for o in out):
            continue
        fu = FollowUp(
            id=uuid.uuid4().hex[:10],
            kind=f.kind,
            reason=reason,
            due_in_days=f.due_in_days,
            message_draft="" if runaway(f.message_draft) else f.message_draft.strip(),
        )
        if f.kind == FollowUpKind.recheck and f.due_in_days:
            target = appt.start.date() + timedelta(days=f.due_in_days)
            window = max(2, f.due_in_days // 7)  # wider window for later rechecks
            slots = await adapter.find_slots(
                target - timedelta(days=window),
                target + timedelta(days=window),
                species=appt.patient.species,
            )
            # closest to the target day first
            slots.sort(key=lambda s: (abs((s.start.date() - target).days), s.start))
            fu.suggested_slots = slots[:3]
            if not fu.message_draft:
                fu.message_draft = (
                    f"Hi {appt.client.first_name}, Dr. "
                    f"{appt.provider_name.split()[-1] if appt.provider_name else ''} "
                    f"would like to see {appt.patient.name} again in about "
                    f"{f.due_in_days} days."
                ).replace("Dr.  ", "Dr. ")
        out.append(fu)
    return out


def _same(f: FollowUp, kind: FollowUpKind, reason: str, due: int | None) -> bool:
    if f.kind != kind:
        return False
    if f.reason.lower().strip(" .") == reason.lower().strip(" ."):
        return True
    # Two rechecks a few days apart are one recheck said twice.
    near = kind == FollowUpKind.recheck and None not in (f.due_in_days, due)
    return near and abs((f.due_in_days or 0) - (due or 0)) <= 3


# ---------------- mock mode (no API key) ----------------
# Deterministic and rule based. Good enough to demo the whole flow offline.

_NUM = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "ten": 10,
    "a": 1,
}
_UNIT = {"day": 1, "week": 7, "month": 30}


def _speaker_lines(transcript: str) -> list[tuple[str, str]]:
    out = []
    for raw in transcript.splitlines():
        who, text = split_label(raw, loose=True)
        if text or who:
            out.append((who.lower(), text))
    return out


SHORT_TALK = 4  # words: a shorter line is talk, never a finding to place


def place_lines(texts: list[str], pets: Sequence[str]) -> list[tuple[list[str], bool]]:
    """A visit with several pets (`pets`, first pet first): which pets each line is
    about, and whether Blinq is sure. A line naming pets is about those pets; a line
    naming none follows the pet named last, and lines before any name go to the
    first pet. A line naming none right after a line that named several can't be
    placed: it gets those pets, not sure, so the provider picks one and a finding is
    never charted on two pets by accident. Talk too short to chart ("Okay.") is
    never a question."""
    out: list[tuple[list[str], bool]] = []
    current = [pets[0]] if pets else []
    for text in texts:
        named = [n for n in pets if re.search(rf"\b{re.escape(n)}\b", text, re.I)]
        current = named or current
        sure = bool(named) or len(current) < 2 or len(text.split()) < SHORT_TALK
        out.append((list(current), sure))
    return out


def place_segments(encounter: Encounter, pets: Sequence[str]) -> None:
    """Mark each transcript line of a visit with several pets with the pets it is
    about (Segment.pets), so the transcript can show one pet's lines. One recording
    for the room, split the same way the note is."""
    if len(pets) < 2:
        return
    lines = encounter.transcript.splitlines()
    placed = place_lines([split_label(x, loose=True)[1] for x in lines], pets)
    for seg in encounter.segments:
        if 0 < seg.line <= len(placed):
            seg.pets, seg.pet_sure = placed[seg.line - 1]


def pet_marker(candidates: Sequence[str]) -> str:
    """The thing to confirm on a line Blinq couldn't place: which pet it is about,
    in plain words. "[confirm pet: Hazel or Mochi]"."""
    return f"[confirm pet: {' or '.join(candidates)}]"


def pet_lines(
    lines: list[tuple[str, str]], pet: str, pets: list[str]
) -> list[tuple[str, str]]:
    """The lines about `pet` (see place_lines). A line Blinq couldn't place goes to
    the first pet it could be about, marked so the provider confirms or moves it,
    and to no other pet."""
    if len(pets) < 2:
        return lines
    out = []
    for (who, text), (about, sure) in zip(
        lines, place_lines([t for _, t in lines], pets), strict=True
    ):
        if sure and pet in about:
            out.append((who, text))
        elif not sure and about and about[0] == pet:
            # Inside its sentence, so the mark stays with the line it is about.
            body = text.strip().rstrip(".!?")
            end = text.strip()[len(body) :]
            out.append((who, f"{body} {pet_marker(about)}{end}"))
    return out


@functools.cache
def _sample_drafts() -> list[tuple[list[str], str, bool, dict[str, Any]]]:
    """(what was said, pet, household, note) for each sample visit that ships with
    the app. A household sample has one note per pet in the room."""
    data = json.loads((sample.DATA / "sample_drafts.json").read_text())
    return [
        (
            _spoken((sample.DATA / path).read_text()),
            d["patient"],
            bool(d.get("household")),
            d["draft"],
        )
        for d in data["drafts"]
        for path in d["transcripts"]
    ]


def _spoken(transcript: str) -> list[str]:
    """What was said, line by line, without speaker labels, case or extra spaces, so a
    sample still matches after its speakers are renamed."""
    return [" ".join(t.split()).lower() for _, t in _speaker_lines(transcript)]


def sample_draft(
    transcript: str, pet: str, household: bool = False
) -> NoteDraft | None:
    """Demo mode: the note a real model writes for a sample visit, when `transcript` is
    that sample and the visit is for the sample's own pet (in a household sample,
    one of its pets)."""
    said = _spoken(transcript)
    for spoken, patient, many, draft in _sample_drafts():
        if spoken == said and patient.lower() == pet.lower() and many == household:
            return NoteDraft.model_validate(draft)
    return None


# Talk that opens a line or a sentence ("Okay.", "So,", "Um"): never a finding.
_LEAD = re.compile(
    # "Right" is filler only before punctuation ("Right, so"); "Right ear" is a side.
    r"^(?:(?:(?:okay|ok|so|alright|all right|well|now|and|but|um+|uh+|yeah|sorry)"
    r"\b[,.!]?|right[,.!])\s*)+",
    re.I,
)
_INNER_FILLER = re.compile(r"\b(?:um+|uh+|you know|I mean)\b,?\s*", re.I)
# Speech to note wording, applied in order. Kept small and literal on purpose.
_REWRITES = [
    (r"^(?:I think|I suspect|I'd say) (?:that )?(?:this is |it's |that's )?", ""),
    (r"\b(?:so )?(?:this|that|it) (?:looks|sounds|seems) like (?:an? )?", ""),
    (r"^(?:looking|look) (?:in|at|into) (?:the |his |her |their )?([^,]+), ", r"\1: "),
    (
        r"\bwhen I (?:press|palpate|touch|feel)(?: on| along| near)? ",
        "on palpation of ",
    ),
    (r"^(?:I|we) (?:can )?(?:feel|see|notice|hear|find|found) ", ""),
    (r"^(?:I|we)(?:'ll| will)\s+", ""),
    (r"\b(?:I|we)(?:'ll| will)\b", "will"),
    (
        r"\b(?:I|we)(?: want to| would like to|'d like to| need to|'m going to"
        r"| am going to|'re going to| are going to| can)\s+",
        "",
    ),
    (r"\blet's\s+", ""),
    (r"\bcall us\b", "owner to call"),
    (r"\b(?:looks?|sounds?|appears?) (?:normal|good|fine)\b", "normal"),
    (r"^(?:he|she|it|they)(?:'s| is| are| has| have| looks| seems)\s+", ""),
    (r"^(?:his|her|their|an?) ", ""),
]
_FIRST_PERSON = re.compile(
    r"\b(?:I|I'm|I'll|I've|I'd|me|my|we|we're|we'll|we've|us|our|you|your|you're)\b",
    re.I,
)
_SMALL_WORDS = {"his", "her", "their", "the", "and", "is", "was", "today", "now"}
# Each vital the mock reads: its key, its label in the exam line, how it's said (the
# groups are the value) and how the value is written in the note.
_VITALS = [
    (
        "weight",
        "Wt",
        r"\bweigh(?:s|t|ed)?(?:\s+(?:is|was|of))?\s*(\d+(?:\.\d+)?)\s*(lb|pounds|kg)s?\b"
        r"(?:\s+today)?",
        "{} {}",
    ),
    (
        "temperature",
        "T",
        r"\btemp(?:erature)?\D{0,12}?(\d{3}(?:\.\d)?)(?:\s*(?:F|degrees)\b)?",
        "{} F",
    ),
    ("heart_rate", "HR", r"\bheart rate\D{0,6}?(\d{2,3})", "{}"),
    ("respiratory_rate", "RR", r"\bresp(?:iratory)? rate\D{0,6}?(\d{1,3})", "{}"),
    ("blood_pressure", "BP", r"\bblood pressure\D{0,6}?(\d{2,3}(?:/\d{2,3})?)", "{}"),
]
# A vital said inside an exam sentence, taken out so the finding is what's left.
_VITAL_CLAUSE = re.compile(
    r"(?:\b(?:he|she|it|they)\s+)?(?:" + "|".join(p for _, _, p, _ in _VITALS) + ")",
    re.I,
)


def _clinical(sentence: str, rewrite: bool = True) -> str | None:
    """One spoken sentence as note text, or None when it can't be made into one (a
    question, or still first or second person after the rewrites). The owner's words
    only lose their filler: `rewrite` is for the vet's."""
    s = sentence.strip()
    if not s or s.endswith("?"):
        return None
    s = _INNER_FILLER.sub("", _LEAD.sub("", s))
    for pattern, repl in _REWRITES if rewrite else ():
        s = re.sub(pattern, repl, s, flags=re.I).strip()
    s = s.strip(" ,;")
    if len(s.split()) < 2 or _FIRST_PERSON.search(s):
        return None
    return cap(s)


def _sentences(texts: list[str]) -> list[str]:
    return [s for t in texts for s in sentences(t)]


def _vitals_said(text: str) -> dict[str, str]:
    return {
        key: form.format(*m.groups())
        for key, _, pattern, form in _VITALS
        if (m := re.search(pattern, text, re.I))
    }


def _objective(findings: list[str], vitals: dict[str, str]) -> str:
    """Vitals as values, then each exam finding as a short statement. A finding that
    can't be put in note wording becomes a [confirm] marker, never raw speech."""
    said = ", ".join(
        f"{label} {vitals[key]}" for key, label, _, _ in _VITALS if key in vitals
    )
    exam = []
    for f in findings:
        rest = _VITAL_CLAUSE.sub("", f)
        words = re.findall(r"[A-Za-z]{2,}", _LEAD.sub("", rest.strip(" ,;")))
        if len([w for w in words if w.lower() not in _SMALL_WORDS]) >= 2:
            exam.append(re.sub(r"^[\s,;]*(?:and\s+)?", "", rest))
        # else only vitals, already charted above
    found = _section(exam, "exam findings", as_bullets=True).replace(" ,", ",")
    # Nothing found is a lone marker, a bullet here like every exam line.
    return "\n".join(x if x.startswith("- ") else f"- {x}" for x in (said, found) if x)


def _section(
    said: list[str],
    what: str,
    as_bullets: bool,
    rewrite: bool = True,
    prefix: str = "",
) -> str:
    """The sentences in note wording after `prefix`, with a [confirm] marker for any
    that couldn't be put that way (or when nothing was said)."""
    if not said:
        return f"[confirm: {what}]"
    kept = [c for s in said if (c := _clinical(s, rewrite))]
    marker = (
        ""
        if kept and len(kept) == len(said)
        else f"[confirm: {'other ' if kept else ''}{what}]"
    )
    lines = (
        [prefix + (bullets if as_bullets else prose)("\n".join(kept))] if kept else []
    )
    if marker:
        lines.append(f"- {marker}" if as_bullets else marker)
    return ("\n" if as_bullets else " ").join(lines)


def tech_name(label: str) -> str:
    """ "tech priya" or "priya (tech)" is "tech Priya"; a label without "tech" is "".
    Labels come lower case from _speaker_lines."""
    if not re.search(r"\btech(nician)?\b", label, re.I):
        return ""
    name = re.sub(r"\(?\btech(nician)?\b\)?", "", label, flags=re.I).strip(" ·,-")
    first = name.split()[0].capitalize() if name.split() else ""
    return f"tech {first}" if first else "the tech"


def mock_draft(
    transcript: str, appt: Appointment, pets: Sequence[str] = ()
) -> NoteDraft:
    if golden := sample_draft(transcript, appt.patient.name, len(pets) > 1):
        return golden
    lines = pet_lines(_speaker_lines(transcript), appt.patient.name, list(pets))
    # Personal small talk ("my daughter graduates Saturday") is for Remember, never the
    # note.
    lines = [(w, t) for w, t in lines if not (w.startswith("owner") and is_personal(t))]
    # Filler that opens a line ("Okay.", "Sorry,") is talk, not a finding.
    lines = [(w, cap(f)) for w, t in lines if (f := _LEAD.sub("", t))]
    owner = _sentences(
        [t for w, t in lines if w.startswith("owner") and len(t.split()) > 4]
    )  # skip "thanks", "ok"
    vet = _sentences([t for w, t in lines if not w.startswith("owner")])
    assess = [
        t
        for t in vet
        if re.search(
            r"\b(looks like|consistent with|think|likely|diagnos|suspect)", t, re.I
        )
    ]
    plan = [
        t
        for t in vet
        if t not in assess
        and re.search(
            r"\b(start|prescrib|give|recheck|send home|we'll|we "
            r"will|cone|bloodwork|call us)",
            t,
            re.I,
        )
    ]
    obj = [
        t
        for t in vet
        if t not in assess
        and t not in plan
        and not t.rstrip().endswith("?")
        and re.search(
            r"\b(temp|weigh|heart|lungs|ear|eye|skin|coat|abdomen|belly|palpat|teeth|"
            r"gums|lesion|mass|lump|swollen|red|cytology|incision|wound|reflex|pain|kidney|"
            r"lymph|discharge|murmur|alert|blood pressure)",
            t,
            re.I,
        )
    ]

    text = " ".join(t for _, t in lines)
    vitals = _vitals_said(text)
    # Credit the tech who said the vitals, when their label says so ("Tech Priya").
    vitals_by = next(
        (tech_name(w) for w, t in lines if tech_name(w) and _vitals_said(t)),
        "",
    )
    meds = sorted(set(re.findall(r"\b([A-Z][a-z]+(?:\s[a-z]+)?\s\d+\s?mg)\b", text)))

    followups: list[_FollowUpOut] = []
    if m := re.search(
        r"recheck (?:him |her |them )?in (\w+) (day|week|month)s?", text, re.I
    ):
        n = int(m.group(1)) if m.group(1).isdigit() else _NUM.get(m.group(1).lower(), 1)
        followups.append(
            _FollowUpOut(
                kind=FollowUpKind.recheck,
                reason=f"Recheck {appt.reason.lower() or 'visit'}",
                due_in_days=n * _UNIT[m.group(2).lower()],
            )
        )
    # Only results that come back later (send-outs), not in-house tests already read in
    # the room.
    if re.search(
        r"\b(send (it |this )?out|send(ing)? (it )?to the lab|when (the "
        r")?results come)\b",
        text,
        re.I,
    ):
        followups.append(
            _FollowUpOut(
                kind=FollowUpKind.lab_result,
                reason="Call owner with lab results",
                due_in_days=2,
            )
        )

    name = appt.patient.name
    return NoteDraft(
        subjective=_section(
            owner,
            "owner history",
            as_bullets=False,
            rewrite=False,
            prefix="Per owner: ",
        ),
        objective=_objective(obj, vitals),
        assessment=_section(assess, "assessment", as_bullets=False),
        plan=_section(plan, "plan", as_bullets=True),
        vitals=vitals,
        vitals_by=vitals_by,
        medications=meds,
        client_summary=f"Thanks for bringing {name} in today. "
        + ("We'd like to see them again for a recheck. " if followups else "")
        + "Call us if anything changes or you have questions.",
        followups=followups,
    )
