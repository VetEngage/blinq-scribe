"""Doctor day assistant: morning brief, who's next, follow ups, recheck times, end of
day.

Muse Spark runs a tool calling loop over the PracticeAdapter and the local
store. It can read and draft. It cannot send or book: approvals happen in the
app, by the vet.
"""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from . import booking_links, permissions, plan_checks, record, remember
from . import day as days
from .accounts import Caller
from .adapters.base import PracticeAdapter
from .llm import MuseClient
from .notes import previous_notes, same_person, split_sections
from .phone import format_phones_in
from .plain import plain_answer, plain_words
from .prompts import ASSISTANT_OPEN_PATIENT, ASSISTANT_SHOWING, ASSISTANT_SYSTEM
from .schemas import (
    Appointment,
    AssistantReply,
    AssistantRequest,
    AssistLink,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
)
from .store import Store

MAX_STEPS = 6

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_schedule",
            "description": "Appointments for one day for this vet. Defaults to today.",
            "parameters": {
                "type": "object",
                "properties": {"day": {"type": "string", "description": "YYYY-MM-DD"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_brief",
            "description": "Patient, owner, alerts and recent visits for one "
            "appointment.",
            "parameters": {
                "type": "object",
                "properties": {"appointment_id": {"type": "string"}},
                "required": ["appointment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "pre_room_card",
            "description": "What to know before walking in: who the patient is, last "
            "visit, "
            "what was promised last time, alerts.",
            "parameters": {
                "type": "object",
                "properties": {"appointment_id": {"type": "string"}},
                "required": ["appointment_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_pending_followups",
            "description": "Follow ups from today's notes still waiting for the vet's "
            "approval.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "end_of_day",
            "description": "Wrap up the day: visits seen, notes still unsigned, "
            "follow ups "
            "waiting, rechecks approved.",
            "parameters": {
                "type": "object",
                "properties": {"day": {"type": "string", "description": "YYYY-MM-DD"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_patients",
            "description": "Find pets and owners by pet name, owner name, email or "
            "phone "
            "digits. Use for 'pull up Biscuit'.",
            "parameters": {
                "type": "object",
                "properties": {"q": {"type": "string"}},
                "required": ["q"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_record",
            "description": "One patient's record: details, alerts, latest weight, "
            "reminders "
            "due, owner, and recent visits.",
            "parameters": {
                "type": "object",
                "properties": {"patient_id": {"type": "string"}},
                "required": ["patient_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_recheck_slots",
            "description": "Open recheck times around N days after an appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "appointment_id": {"type": "string"},
                    "days_out": {"type": "integer"},
                },
                "required": ["appointment_id", "days_out"],
            },
        },
    },
]


def _gist(text: str, limit: int = 180) -> str:
    """The plan of a note, or its opening, short enough to say out loud."""
    sections = split_sections(text)
    body = (sections.plan or sections.assessment) if sections else ""
    # Bullet lines become sentences, so "- Continue cone\n- Recheck" reads "Continue
    # cone. Recheck".
    lines = [
        ln.strip().removeprefix("- ").strip() for ln in (body or text).splitlines()
    ]
    body = " ".join(ln if ln[-1] in ".!?:;," else ln + "." for ln in lines if ln)
    body = " ".join(body.split())
    return body if len(body) <= limit else body[:limit].rsplit(" ", 1)[0] + "..."


def _appt_line(a: Appointment) -> str:
    alert = f" | ALERT: {'; '.join(a.patient.alerts)}" if a.patient.alerts else ""
    return (
        f"{a.start:%-I:%M %p} {a.patient.name} ({a.patient.species}, "
        f"{a.patient.breed}) - {a.reason} [id {a.id}]{alert}"
    )


def _counted(items: list[dict[str, Any]]) -> str:
    """'1 note to sign, 2 texts that did not send'"""
    words = {
        "unsigned": ("note to sign", "notes to sign"),
        "followup": ("follow up waiting", "follow ups waiting"),
        "failed_text": ("text that did not send", "texts that did not send"),
        "queued": ("item queued for staff", "items queued for staff"),
        "prescription": ("prescription to enter", "prescriptions to enter"),
    }
    parts = []
    for kind, (one, many) in words.items():
        n = sum(i["kind"] == kind for i in items)
        if n:
            parts.append(f"{n} {one if n == 1 else many}")
    return ", ".join(parts)


def _next_date(value: str, on: date, yearly: bool) -> date | None:
    """A Remember date as the next day it falls on: a past birthday or adoption day
    comes round again."""
    try:
        d = date.fromisoformat(value[:10])
    except ValueError:
        return None
    if d >= on or not yearly:
        return d
    try:
        this_year = d.replace(year=on.year)
    except ValueError:  # Feb 29
        this_year = date(on.year, 3, 1)
    return this_year if this_year >= on else this_year.replace(year=on.year + 1)


def _said(value: str) -> str:
    try:
        return f"{datetime.fromisoformat(value):%b %-d}"
    except ValueError:
        return ""


_CLINICAL = re.compile(
    r"\b(dose|dosage|diagnos\w*|should i (give|prescribe|treat|start)|what "
    r"(drug|medication|treatment)|"
    r"how much \w+ (should|do) i|differential)",
    re.I,
)
_PULL_UP = re.compile(
    r"\b(?:pull up|find|search for|look up|open)\s+([A-Za-z][\w' @.-]+?)[.?!]*$", re.I
)
_ABOUT_PATIENT = re.compile(
    r"\b(history|last (visit|time)|weight|record|alerts?|how "
    r"is|how's|she|he|this patient|summary)\b",
    re.I,
)


# ---------- the brief as a conversation (requirement 71) ----------


def _n(count: int, one: str, many: str = "") -> str:
    return f"{count} {one if count == 1 else (many or one + 's')}"


def _clock(dt: datetime) -> str:
    return f"{dt:%-I:%M %p}"


def _at(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except TypeError, ValueError:
        return None


def _when(value: str, today: date) -> str:
    """When something came in, said in a sentence: "at 12:40 AM", "at 8:32 PM
    yesterday", "on Oct 30 at 8:32 PM"."""
    dt = _at(value)
    if not dt:
        return ""
    if dt.date() == today:
        return f"at {_clock(dt)}"
    if dt.date() == today - timedelta(days=1):
        return f"at {_clock(dt)} yesterday"
    return f"on {dt:%b %-d} at {_clock(dt)}"


def _stamp(value: str, today: date) -> str:
    """The same for a source line: "12:40 AM", "yesterday 8:32 PM", "Oct 30,
    8:32 PM"."""
    dt = _at(value)
    if not dt:
        return ""
    if dt.date() == today:
        return _clock(dt)
    if dt.date() == today - timedelta(days=1):
        return f"yesterday {_clock(dt)}"
    return f"{dt:%b %-d}, {_clock(dt)}"


# What is left for the vet, in the order the brief says it: (kind, one, many, emphasis).
# A failed item is "failed" so a screen can mark it; everything counted is bold.
_LEFT: tuple[tuple[str, str, str, str], ...] = (
    ("unsigned", "note to sign", "notes to sign", "bold"),
    ("pending", "note pending", "notes pending", "bold"),
    ("failed_text", "text that didn't send", "texts that didn't send", "failed"),
    (
        "pims_failed",
        "note that didn't reach the PIMS",
        "notes that didn't reach the PIMS",
        "failed",
    ),
    ("not_sent", "note to send to the PIMS", "notes to send to the PIMS", "bold"),
    ("followup", "follow up to decide", "follow ups to decide", "bold"),
    ("link", "recheck link not booked", "recheck links not booked", "bold"),
    ("prescription", "prescription to enter", "prescriptions to enter", "bold"),
    ("queued", "item queued for staff", "items queued for staff", "failed"),
)


def _joined(words: list[str]) -> str:
    """ "a", "a and b", "a, b and c"."""
    return words[0] if len(words) == 1 else f"{', '.join(words[:-1])} and {words[-1]}"


def _new_words(update: dict[str, Any]) -> str:
    """What came in, said as a thing: "Miso's kidney results", "a text from Jordan",
    "Pepper booked online"."""
    pet = str(update.get("patient_name") or "")
    if update.get("kind") == "result" and pet:
        return _result_question(update)
    if update.get("kind") == "reply":
        owner = _owner_said(update)[0]
        return f"a text from {_first_name(owner)}" if owner else "a text from an owner"
    if update.get("kind") == "booked" and pet:
        return f"{pet} booked online"
    return "an update"


def brief_sentence(
    visits: int,
    needs: list[dict[str, Any]],
    new: list[dict[str, Any]] | int,
) -> list[dict[str, str]]:
    """The brief in one sentence of facts, in parts the screen can bold without
    parsing: emphasis is "none", "bold" or "failed". `kind` names the counted parts
    ("visits", "needs", "failed", "new"). `needs` are what is left for the vet, each
    with its kind (a note to sign, a text that didn't send, a recheck link not booked),
    so the sentence counts what the screen lists: "5 visits today. 2 notes to sign
    and 1 text that didn't send. 2 new since yesterday: Miso's kidney results and a
    text from Jordan." Never advice, never a guess."""
    parts: list[tuple[str, str, str]] = []
    if visits:
        parts += [(_n(visits, "visit"), "bold", "visits"), (" today.", "none", "")]
    else:
        parts.append(("No visits today.", "none", ""))
    counted = [
        (_n(n, one, many), emphasis)
        for kind, one, many, emphasis in _LEFT
        if (n := sum(i.get("kind") == kind for i in needs))
    ]
    if counted:
        parts.append((" ", "none", ""))
        for i, (words, emphasis) in enumerate(counted):
            if i:
                joint = " and " if i == len(counted) - 1 else ", "
                parts.append((joint, "none", ""))
            parts.append(
                (words, emphasis, "failed" if emphasis == "failed" else "needs")
            )
        parts.append((".", "none", ""))
    else:
        parts.append((" Nothing needs you.", "none", ""))
    updates = new if isinstance(new, list) else []
    count = len(new) if isinstance(new, list) else new
    if count:
        parts += [(" ", "none", ""), (f"{count} new", "bold", "new")]
        if updates:
            said = _joined([_new_words(u) for u in updates])
            parts.append((f" since yesterday: {said}.", "none", ""))
        else:
            parts.append((" since yesterday.", "none", ""))
    merged: list[dict[str, str]] = []
    for text, emphasis, kind in parts:
        if merged and not kind and not merged[-1]["kind"]:
            merged[-1]["text"] += text
        else:
            merged.append({"text": text, "emphasis": emphasis, "kind": kind})
    return merged


def _owner_said(update: dict[str, Any]) -> tuple[str, str]:
    """(owner, what they wrote) from a reply: "Jordan Lee replied: ..."."""
    who, _, said = str(update.get("text", "")).partition(" replied: ")
    return (who.strip(), said.strip()) if said else ("", who.strip())


def _first_name(name: str) -> str:
    return name.split()[0] if name else "The owner"


def _result_question(update: dict[str, Any]) -> str:
    """ "Miso's kidney results", from the result's short line ("Kidney panel")."""
    words = str(update.get("detail") or "").lower().split()
    while words and words[-1] in ("panel", "result", "results", "test"):
        words.pop()
    topic = " ".join(words)
    return f"{update['patient_name']}'s {topic + ' ' if topic else ''}results"


def brief_suggestions(
    appts: list[Appointment],
    needs: list[dict[str, Any]],
    updates: list[dict[str, Any]],
    heads: list[dict[str, Any]],
    up_next: Appointment | None = None,
) -> list[str]:
    """Two or three questions to ask about today, from today's data. The Up next card
    already shows the first visit, so with one it asks what comes after."""
    out = []
    if up_next and _after(appts, up_next):
        out.append(_after_question(up_next))
    elif appts and not up_next:
        out.append("What's first?")
    result = next(
        (u for u in updates if u["kind"] == "result" and u.get("patient_name")), None
    )
    reply = next((u for u in updates if u["kind"] == "reply"), None)
    if result:
        out.append(_result_question(result))
    elif reply and (owner := _owner_said(reply)[0]):
        out.append(f"What did {_first_name(owner)} say?")
    if needs:
        out.append("What needs me?")
    elif heads:
        out.append("Any heads ups today?")
    elif updates:
        out.append("What's new since yesterday?")
    return out[:3]


def _after_question(a: Appointment) -> str:
    return f"What's after {a.patient.name}?"


def _after(appts: list[Appointment], a: Appointment) -> Appointment | None:
    """The next visit after `a` that isn't signed."""
    later = sorted(
        (
            x
            for x in appts
            if x.start > a.start and getattr(x, "visit_status", "") != "signed"
        ),
        key=lambda x: x.start,
    )
    return later[0] if later else None


def up_next(
    appts: list[Appointment], now: datetime | None = None
) -> Appointment | None:
    """What Morning's Up next card shows (the web picks it the same way): the visit
    being recorded, else the next one still to come, else the first not signed."""
    pending = sorted(
        (a for a in appts if getattr(a, "visit_status", "") != "signed"),
        key=lambda a: a.start,
    )
    now = now or datetime.now()
    return (
        next((a for a in pending if a.visit_status == "recording"), None)
        or next((a for a in pending if a.start >= now), None)
        or next(iter(pending), None)
    )


def _him(a: Appointment) -> str:
    """ "him" or "her" for the pet, from its sex; its name when unknown."""
    sex = (a.patient.sex or "").lower()
    return "her" if "female" in sex else "him" if "male" in sex else a.patient.name


def _wrote(update: dict[str, Any], pet: str, today: date) -> str:
    """ "Jordan wrote at 8:32 PM yesterday that Biscuit is shaking his head again." """
    owner, said = _owner_said(update)
    when = _when(str(update.get("at", "")), today)
    body = said.rstrip(". ")
    if pet and body.startswith(pet + " "):
        return f"{_first_name(owner)} wrote {when} that {body}."
    return f'{_first_name(owner)} wrote {when}: "{said}"'


def _visit_link(a: Appointment, label: str = "") -> AssistLink:
    return AssistLink(
        label=label or f"Open {a.patient.name}'s visit",
        to="visit",
        appointment_id=a.id,
        patient_id=a.patient.id,
        client_id=a.patient.client_id or a.client.id,
    )


def _record_link(patient_id: str, client_id: str, label: str) -> AssistLink:
    return AssistLink(
        label=label, to="record", patient_id=patient_id, client_id=client_id
    )


@dataclass
class _Today:
    """What Ask Blinq knows about the day: the same data the brief is made from."""

    on: date
    appts: list[Appointment]
    updates: list[dict[str, Any]]
    needs: list[dict[str, Any]]
    heads: list[dict[str, Any]]
    # Today's visits with their status, and the one Morning's Up next card shows.
    visits: list[Appointment]
    up_next: Appointment | None

    def appt(self, patient_id: str) -> Appointment | None:
        return next((a for a in self.appts if a.patient.id == patient_id), None)

    def named(self, text: str) -> Appointment | None:
        """Today's appointment for a pet named in `text`."""
        for a in sorted(self.appts, key=lambda a: -len(a.patient.name)):
            if a.patient.name and re.search(
                rf"\b{re.escape(a.patient.name)}\b", text, re.I
            ):
                return a
        return None

    def suggestions(self) -> list[str]:
        return brief_suggestions(
            self.visits, self.needs, self.updates, self.heads, self.up_next
        )


_DRAFT = re.compile(r"\bdraft\b.*\b(reply|text|message)\b", re.I)
_REPLY = re.compile(
    r"\b(say|said|says|wrote|write|replied|reply|replies|texted|message)\b", re.I
)
_RESULTS = re.compile(r"\b(results?|labs?|panel|bloodwork|kidney)\b", re.I)
_NEEDS = re.compile(
    r"\bneeds? (me|you)\b|\bto do\b|\bwaiting\b|\bwhat's left\b|\bleft to do\b",
    re.I,
)
_LAST = re.compile(r"\blast\b(\s+\w+)?\s+(visit|note|time)\b", re.I)
_FIRST = re.compile(r"\b(first|next)\b", re.I)
_AFTER = re.compile(r"\b(after|then)\b", re.I)
_HEADS = re.compile(r"\bheads? ?ups?\b|\bwatch out\b|\bcautions?\b", re.I)
_MORE = re.compile(
    r"^\s*(yes|yeah|yep|sure|ok|okay|please|go on|go ahead|tell me more|more)\b"
    r"|\bhear more\b|\bwhat's new\b|\bnew since\b|\bsince yesterday\b"
    r"|\banything new\b",
    re.I,
)


# Who the brief, the card or Ask Blinq is for: their tools answer only from what that
# person may see (permissions). Unset means the server itself, which sees everything.
_VIEWER: ContextVar[Caller | None] = ContextVar("assistant_viewer", default=None)


@contextmanager
def viewing(who: Caller) -> Iterator[None]:
    token = _VIEWER.set(who)
    try:
        yield
    finally:
        _VIEWER.reset(token)


def _owns(provider_id: str) -> bool:
    who = _VIEWER.get()
    return who is None or permissions.owns(who, provider_id)


def _reader(appt: Appointment) -> tuple[str, str]:
    """(provider id, name) of the person reading: a signed-in vet, else the
    appointment's vet (the open demo, the token, the server)."""
    who = _VIEWER.get()
    if who is not None and who.user is not None and who.user.provider_id:
        return who.user.provider_id, who.user.name
    return appt.provider_id, appt.provider_name


def _sees_notes() -> bool:
    who = _VIEWER.get()
    return who is None or permissions.sees_notes(who)


_RECHECK_IN = re.compile(
    r"\brecheck\s+(?:in\s+)?(\d+)\s*(d|days?|w|wks?|weeks?|mo|mos|months?)\b", re.I
)
_DRUG = re.compile(r"^(?:Rx:?\s+|Start\s+|Continue\s+)?([A-Za-z][A-Za-z-]+)\s+\d")


def _plan_lines(note: str | None) -> list[str]:
    """The plan of a note, one line each, as written ("Rx Apoquel 16 mg PO BID")."""
    sections = split_sections(note or "")
    body = sections.plan if sections else ""
    return [
        ln.strip().removeprefix("- ").removeprefix("• ").strip()
        for ln in body.splitlines()
        if ln.strip().strip("-• ")
    ]


def _recheck_status(line: str, on: date, seen_since: bool, booked: bool) -> str:
    """A recheck line's due day, from the plan's own words: "Was due Sep 28, not
    booked". Nothing when the pet was seen since (the record can't say which visit
    it was) or when a visit is booked."""
    m = _RECHECK_IN.search(line)
    if not m or seen_since:
        return ""
    n, unit = int(m.group(1)), m.group(2).lower()
    days_per = 30 if unit.startswith("mo") else 1 if unit.startswith("d") else 7
    due = on + timedelta(days=n * days_per)
    if due >= date.today():
        return f"Due {due:%b %-d}"
    return "" if booked else f"Was due {due:%b %-d}, not booked"


def _drug_of(line: str) -> str:
    """The drug a plan line gives ("Apoquel" in "Rx Apoquel 16 mg PO BID"), or ""."""
    m = _DRUG.match(line.strip())
    return m.group(1) if m else ""


def _visit_line(row: dict[str, Any]) -> str:
    """A past visit in plain words: "Ear infection, left. Resolved after 10 days of
    drops." """
    reason = (row.get("reason") or "").strip().rstrip(".")
    summary = (row.get("summary") or "").strip()
    said = [f"{reason}." if reason else "", summary]
    return plain_words(" ".join(x for x in said if x))


class DayAssistant:
    def __init__(self, muse: MuseClient, adapter: PracticeAdapter, store: Store):
        self.muse = muse
        self.adapter = adapter
        self.store = store

    # ---------- tools ----------
    async def get_schedule(
        self, provider_id: str = "", day: str | None = None
    ) -> list[Appointment]:
        d = date.fromisoformat(day) if day else date.today()
        return await self.adapter.get_schedule(d, provider_id or None)

    async def get_patient_brief(self, appointment_id: str) -> dict[str, Any]:
        appt = await self.adapter.get_appointment(appointment_id)
        if not appt:
            return {"error": "appointment not found"}
        history = await self.adapter.get_visit_history(
            appt.patient.id, appt.patient.name
        )
        return {
            "appointment": _appt_line(appt),
            "owner": appt.client.full_name,
            "alerts": appt.patient.alerts,
            "recent_visits": [
                f"{v.date:%Y-%m-%d} {v.reason}. {v.summary}".strip()
                for v in history[:3]
            ],
        }

    def list_pending_followups(self) -> list[dict[str, Any]]:
        """Draft follow ups waiting on the viewer: only their own visits'."""
        out = []
        for enc in self.store.list():
            if not _owns(enc.provider_id):
                continue
            for f in enc.followups:
                if f.status == FollowUpStatus.draft:
                    out.append(
                        {
                            "encounter_id": enc.id,
                            "followup_id": f.id,
                            "kind": f.kind.value,
                            "reason": f.reason,
                            "title": f"Approve follow up: {f.title}",
                            "patient_id": enc.patient_id,
                            "patient_name": enc.patient_name,
                            "appointment_id": enc.appointment_id,
                        }
                    )
        return out

    async def find_recheck_slots(self, appointment_id: str, days_out: int) -> list[str]:
        appt = await self.adapter.get_appointment(appointment_id)
        base = appt.start.date() if appt else date.today()
        target = base + timedelta(days=days_out)
        slots = await self.adapter.find_slots(
            target - timedelta(days=2),
            target + timedelta(days=2),
            appt.patient.species if appt else "",
        )
        slots.sort(key=lambda s: (abs((s.start.date() - target).days), s.start))
        return [f"{s.start:%a %b %-d %-I:%M %p}" for s in slots[:5]]

    async def _run_tool(self, name: str, args: dict[str, Any], provider_id: str) -> Any:
        if name == "get_schedule":
            return [
                _appt_line(a)
                for a in await self.get_schedule(provider_id, args.get("day"))
            ]
        if name == "get_patient_brief":
            return await self.get_patient_brief(args["appointment_id"])
        if name == "pre_room_card":
            return await self.pre_room_card(args["appointment_id"])
        if name == "list_pending_followups":
            return self.list_pending_followups()
        if name == "end_of_day":
            report = await self.end_of_day(provider_id, args.get("day"))
            report.pop("spoken")
            return report
        if name == "find_recheck_slots":
            return await self.find_recheck_slots(
                args["appointment_id"], int(args["days_out"])
            )
        if name == "search_patients":
            return await record.search(self.adapter, args["q"])
        if name == "get_patient_record":
            return await self.get_patient_record(args["patient_id"])
        return {"error": f"unknown tool {name}"}

    async def get_patient_record(self, patient_id: str) -> dict[str, Any]:
        profile = await record.profile(self.adapter, patient_id)
        if not profile:
            return {"error": "patient not found"}
        if not _sees_notes():
            profile["recent_visits"] = []  # visits carry notes: vets only
            return profile
        visits = await record.visits(self.adapter, self.store, patient_id)
        profile["recent_visits"] = [
            f"{v['date'][:10]} {v['reason']}. {v['summary']}".strip()
            for v in visits[:5]
        ]
        return profile

    async def _open_patient(self, req: AssistantRequest) -> tuple[str, str]:
        """(patient id, name) of the patient open on screen, or empty strings."""
        if req.appointment_id and (
            appt := await self.adapter.get_appointment(req.appointment_id)
        ):
            return appt.patient.id, appt.patient.name
        if req.patient_id and (pet := await self.adapter.get_patient(req.patient_id)):
            return pet.id, pet.name
        return "", ""

    # ---------- morning brief (deterministic, fast, safe to read aloud) ----------
    async def morning_brief(self, provider_id: str = "") -> dict[str, Any]:
        appts = await self.get_schedule(provider_id)
        pending = self.list_pending_followups()
        flagged = [a for a in appts if a.patient.alerts]
        lines = [
            f"You have {len(appts)} appointment{'s' if len(appts) != 1 else ''} today."
        ]
        if appts:
            lines.append(
                f"First up: {appts[0].patient.name} at "
                f"{appts[0].start:%-I:%M %p}, {appts[0].reason.lower()}."
            )
        for a in flagged[:3]:
            lines.append(
                f"Heads up on {a.patient.name}: {'; '.join(a.patient.alerts)}."
            )
        if pending:
            lines.append(
                f"{len(pending)} follow up{'s' if len(pending) != 1 else ''} "
                "waiting for your approval."
            )
        today = date.today()
        earlier = await self.carried_over(provider_id, today)
        if before := [i for i in earlier if i["date"] != today.isoformat()]:
            lines.append(f"From earlier days: {_counted(before)}.")
        if rx := len(earlier) - len(before):
            lines.append(
                f"Today: {_n(rx, 'prescription')} for the front desk to enter."
            )
        heads_up = self._heads_up(appts, today)
        updates = await self._updates(provider_id, appts, today)
        if updates:
            lines.append(f"{len(updates)} new since yesterday.")
        visits = days.with_status(appts, today, self.store)
        return {
            "spoken": plain_words(" ".join(lines)),
            # The screen's one line: what is left, counted the way Home lists it.
            "sentence": brief_sentence(
                len(appts), await self.left_for(provider_id, earlier), updates
            ),
            "suggestions": brief_suggestions(
                visits, earlier, updates, heads_up, up_next(visits)
            ),
            "appointments": [_appt_line(a) for a in appts],
            "pending_followups": pending,
            "date": today.isoformat(),
            "from_yesterday": earlier,
            "heads_up": heads_up,
            "new_since_yesterday": updates,
            "mock": self.adapter.name == "mock",
        }

    def _heads_up(self, appts: list[Appointment], today: date) -> list[dict[str, Any]]:
        """Each alert on today's patients, then Remember dates coming up."""
        heads = [
            {
                "text": f"{a.patient.name}: {alert}",
                "appointment_id": a.id,
                "patient_id": a.patient.id,
                "patient_name": a.patient.name,
                "time": f"{a.start:%H:%M}",
            }
            for a in appts
            for alert in a.patient.alerts
        ]
        return heads + self._remember_soon(appts, today)

    async def _today(self, provider_id: str) -> _Today:
        today = date.today()
        appts = await self.get_schedule(provider_id)
        visits = days.with_status(appts, today, self.store)
        return _Today(
            on=today,
            appts=appts,
            updates=await self._updates(provider_id, appts, today),
            needs=await self.carried_over(provider_id, today),
            heads=self._heads_up(appts, today),
            visits=visits,
            up_next=up_next(visits),
        )

    async def _updates(
        self, provider_id: str, appts: list[Appointment], today: date
    ) -> list[dict[str, Any]]:
        """What came in since yesterday, each with what the screen needs to open it:
        the pet, today's appointment, the owner (a reply) and the document (a result).
        A vet's brief keeps their own patients': today's schedule or their visits."""
        found = await self.adapter.get_updates(
            datetime.combine(today - timedelta(days=1), time.min)
        )
        if provider_id:
            mine = {a.patient.id for a in appts} | {
                e.patient_id for e in self.store.list() if e.provider_id == provider_id
            }
            found = [u for u in found if u.get("patient_id") in mine]
        day = {a.patient.id: a for a in await self.adapter.get_schedule(today)}
        out = []
        for u in found:
            pid = str(u.get("patient_id") or "")
            pet = await self.adapter.get_patient(pid) if pid else None
            docs = self.store.documents(pid) if pid and u["kind"] == "result" else []
            newest = max(docs, key=lambda d: d["uploaded_at"]) if docs else None
            out.append(
                {
                    **u,
                    "detail": u.get("detail") or u["text"],  # a short line to show
                    "patient_id": pid,
                    "appointment_id": day[pid].id if pid in day else "",
                    "client_id": pet.client_id if pet else "",
                    "document_id": newest["id"] if newest else "",
                }
            )
        return out

    async def left_for(
        self, provider_id: str, earlier: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """What is left for the vet, one entry per thing, by kind: every note not
        signed on any day (the Notes buckets), the other open items from earlier days,
        and each recheck link not booked yet."""
        notes = await days.unsigned_notes(self.store, self.adapter, provider_id)
        links = [
            w
            for w in booking_links.waiting_links(self.store)
            if not provider_id
            or (e := self.store.get(w["encounter_id"])) is None
            or e.provider_id == provider_id
        ]
        return (
            # The Notes buckets' words: ready ones are "to sign", the rest "pending".
            [
                {"kind": "unsigned" if n["bucket"] == "ready" else "pending"}
                for n in notes
            ]
            + [i for i in earlier if i["kind"] != "unsigned"]
            + [{"kind": "link"} for _ in links]
        )

    async def carried_over(
        self, provider_id: str = "", today: date | None = None, back: int = 7
    ) -> list[dict[str, Any]]:
        """To do: open items from the last `back` days before today, newest day
        first, then today's prescriptions for the front desk to enter, which can't
        wait for tomorrow."""
        today = today or date.today()
        everything, names, out = self.store.list(), days.Names(self.adapter), []
        for n in [*range(1, back + 1), 0]:
            d = today - timedelta(days=n)
            items = await days.open_items(
                d, days.encounters_on(self.store, d, provider_id, everything), names
            )
            out += [i for i in items if n or i["kind"] == "prescription"]
        return out

    def _remember_soon(
        self, appts: list[Appointment], on: date, within: int = 14
    ) -> list[dict[str, Any]]:
        """Kept Remember items for these patients whose date falls in the next `within`
        days."""
        out = []
        for a in appts:
            for item in remember.kept_for_patient(self.store, a.patient.id):
                when = _next_date(
                    item.get("date") or "",
                    on,
                    item.get("kind") in ("birthday", "adoption"),
                )
                if when and 0 <= (when - on).days <= within:
                    out.append(
                        {
                            "text": f"{a.patient.name}: {item.get('text', '')} "
                            f"({when:%b %-d})",
                            "appointment_id": a.id,
                            "patient_id": a.patient.id,
                            "patient_name": a.patient.name,
                            "time": f"{a.start:%H:%M}",
                        }
                    )
        return out

    # ---------- end of day (deterministic, what is left before the vet goes home)
    # ----------
    async def end_of_day(
        self, provider_id: str = "", day: str | None = None
    ) -> dict[str, Any]:
        on = date.fromisoformat(day) if day else date.today()
        appts = await self.get_schedule(provider_id, on.isoformat())
        by_appt = {days.appt_key(a.id) for a in appts}
        # Only this day's visits: the same appointment id on another day is another
        # visit.
        visits = [
            e
            for e in days.encounters_on(self.store, on)
            if days.appt_key(e.appointment_id) in by_appt
        ]
        seen = {days.appt_key(e.appointment_id) for e in visits}
        names = days.Names(self.adapter)
        # What is spoken comes from the same open items the screen lists, so the two
        # never disagree.
        left = await days.open_items(on, visits, names)
        # Earlier days' open items too, the same set To do lists, so the page, To do
        # and Read aloud count the same things.
        seen_items = {
            (i["kind"], i["encounter_id"], i.get("followup_id")) for i in left
        }
        left += [
            i
            for i in await self.carried_over(provider_id, on)
            if (i["kind"], i["encounter_id"], i.get("followup_id")) not in seen_items
        ]

        def of(kind: str) -> list[dict[str, Any]]:
            return [i for i in left if i["kind"] == kind]

        def booked_for(f: FollowUp) -> str | None:
            """When the recheck is booked: by the vet, or by the owner from the link."""
            link = f.booking_link
            when = f.booked_slot.start if f.booked_slot else None
            if not when and link and link.status == "booked":
                when = link.booked_start or link.sent_at
            return when.isoformat() if when else None

        rechecks = [
            {
                "encounter_id": e.id,
                "patient": await names.pet(e),
                "reason": f.reason,
                "due_in_days": f.due_in_days,
                "booked_for": booked_for(f),
                # "sent" once its booking link went to the owner (booked or not)
                "link": f.booking_link.status if f.booking_link else "",
            }
            for e in visits
            for f in e.followups
            if f.kind == FollowUpKind.recheck and f.status == FollowUpStatus.approved
        ]
        booked = sum(1 for r in rechecks if r["booked_for"])
        links = [r for r in rechecks if r["link"] not in ("", "queued")]
        links_booked = sum(1 for r in links if r["booked_for"])

        def n(count: int, word: str) -> str:
            return f"{count} {word}{'s' if count != 1 else ''}"

        lines = [f"You saw {len(seen)} of {n(len(appts), 'visit')} today."]
        unsigned, waiting, failed, queued = (
            of("unsigned"),
            of("followup"),
            of("failed_text"),
            of("queued"),
        )
        if unsigned:
            lines.append(
                f"{n(len(unsigned), 'note')} still to sign: "
                f"{', '.join(i['patient_name'] for i in unsigned)}."
            )
        if waiting:
            lines.append(f"{n(len(waiting), 'follow up')} waiting for your approval.")
        # What happened, counted as it happened: a link sent is not a booking.
        if links:
            lines.append(
                f"{n(len(links), 'recheck link')} sent, "
                + (f"{links_booked} booked." if links_booked else "none booked yet.")
            )
        if booked > links_booked:
            lines.append(f"{n(booked - links_booked, 'recheck')} booked.")
        if left_over := len(rechecks) - len(links) - (booked - links_booked):
            lines.append(f"{n(left_over, 'recheck')} approved but not booked yet.")
        if failed:
            lines.append(f"{n(len(failed), 'text')} did not send.")
        if not_sent := of("not_sent"):
            lines.append(
                f"{n(len(not_sent), 'note')} signed but not sent to the PIMS "
                f"yet: {', '.join(i['patient_name'] for i in not_sent)}."
            )
        if failing := of("pims_failed"):
            lines.append(
                f"{n(len(failing), 'note')} couldn't be saved to the PIMS "
                "yet. Blinq Scribe keeps trying."
            )
        # Anything that did not reach the practice system is on staff's list, so it is
        # said out loud.
        if queued:
            lines.append(
                f"{n(len(queued), 'item')} did not reach the PIMS "
                "and are queued for staff: "
                f"{', '.join(i['patient_name'] + ' ' + i['what'] for i in queued)}."
            )
        if seen and not left:
            lines.append("All notes signed and nothing waiting. Good night.")
        # The older lists, in the shapes the iPhone app reads, taken from the same open
        # items.
        return {
            "spoken": " ".join(lines),
            "date": on.isoformat(),
            "visits_seen": len(seen),
            "appointments": len(appts),
            "unsigned_notes": [
                {
                    "encounter_id": i["encounter_id"],
                    "patient": i["patient_name"],
                    "status": i["status"],
                }
                for i in unsigned
            ],
            "followups_waiting": [
                {
                    "encounter_id": i["encounter_id"],
                    "followup_id": i["followup_id"],
                    "patient": i["patient_name"],
                    "kind": i["followup_kind"],
                    "reason": i["reason"],
                }
                for i in waiting
            ],
            "rechecks_approved": rechecks,
            "rechecks_booked": booked,
            "rechecks_waiting": len(rechecks) - booked,
            "recheck_links_sent": len(links),
            "recheck_links_booked": links_booked,
            "queued_for_staff": [
                {
                    "encounter_id": i["encounter_id"],
                    "patient": i["patient_name"],
                    "what": i["what"],
                    "detail": i["detail"],
                }
                for i in queued
            ],
            "not_started": [
                _appt_line(a) for a in appts if days.appt_key(a.id) not in seen
            ],
            "left_to_do": left,
            "done_today": await days.done_items(visits, names),
            "waiting_on_owners": booking_links.waiting_links(
                self.store, older_than_days=3
            ),
            "tomorrow": await self._tomorrow(provider_id, on + timedelta(days=1)),
        }

    async def _tomorrow(self, provider_id: str, on: date) -> dict[str, Any]:
        appts = await self.get_schedule(provider_id, on.isoformat())
        prepare = [
            {
                "text": f"{a.patient.name} at {a.start:%-I:%M %p}: {alert}",
                "appointment_id": a.id,
                "patient_name": a.patient.name,
            }
            for a in appts
            for alert in a.patient.alerts
        ]
        prepare += [
            {
                "text": f"{a.patient.name} at {a.start:%-I:%M %p}: "
                f"{a.reason or 'recheck'}. Read the last note first",
                "appointment_id": a.id,
                "patient_name": a.patient.name,
            }
            for a in appts
            if "recheck" in a.type.lower() and not a.patient.alerts
        ]
        prepare += [
            {k: r[k] for k in ("text", "appointment_id", "patient_name")}
            for r in self._remember_soon(appts, on, within=0)
        ]
        return {
            "date": on.isoformat(),
            "visits": len(appts),
            "first": f"{appts[0].start:%H:%M}" if appts else "",
            "last": f"{appts[-1].start:%H:%M}" if appts else "",
            "prepare": prepare,
        }

    # ---------- pre-room card (deterministic, spoken as the vet walks in) ----------
    async def pre_room_card(self, appointment_id: str) -> dict[str, Any]:
        appt = await self.adapter.get_appointment(appointment_id)
        if not appt:
            return {"error": "appointment not found"}
        p = appt.patient
        history = await self.adapter.get_visit_history(p.id, p.name)
        # Earlier notes and what was promised in them are for vets only.
        promised = self._promised_for(p.id) if _sees_notes() else []
        age = f"{p.age} year old " if p.age is not None else ""
        lines = [
            f"{p.name}, "
            f"{age}{p.species.lower()}{', ' + p.breed if p.breed else ''}, in "
            f"for {appt.reason.lower() or appt.type.lower() or 'a visit'}."
        ]
        if history:
            v = history[0]
            days = (date.today() - v.date.date()).days
            when = (
                "today"
                if days == 0
                else f"{days} days ago"
                if days < 60
                else f"{days // 30} months ago"
            )
            lines.append(
                f"Last seen {when} for "
                f"{v.reason.lower()}.{(' ' + v.summary) if v.summary else ''}"
            )
        else:
            lines.append("First visit on record.")
        earlier = previous_notes(self.store, p.id) if _sees_notes() else []
        last_note = None
        if earlier:
            n = earlier[0]
            days = max(0, (date.today() - n.date.date()).days)
            when = (
                "today"
                if days == 0
                else "yesterday"
                if days == 1
                else f"{days} days ago"
            )
            # "Your" is whoever is reading: the signed-in vet, else the visit's vet.
            reader_id, reader_name = _reader(appt)
            other = (
                (n.provider_id != reader_id)
                if n.provider_id and reader_id
                else not same_person(n.provider_name, reader_name)
            )
            who = n.provider_name or "another provider"
            last_note = {
                "date": n.date.isoformat(),
                "by": who,
                "other_vet": other,
                "gist": _gist(n.text),
            }
            lines.append(
                f"{who} saw {p.name} {when}: {last_note['gist']}"
                if other
                else f"Your last note, {when}: {last_note['gist']}"
            )
        mine = _reader(appt)[0] == appt.provider_id
        for item in promised[:2]:
            lines.append(
                f"Last time you said: {item}." if mine else f"Last time: {item}."
            )
        for alert in p.alerts[:2]:
            lines.append(f"Heads up: {alert}.")
        kept = remember.kept_for_patient(self.store, p.id)
        said = [
            f"{item.get('text', '')}"
            f"{f' (said {w})' if (w := _said(item.get('said_at') or '')) else ''}"
            for item in kept
        ]
        lines += [f"Remember: {s}." for s in said[:2]]
        owner = appt.client.full_name
        # The newest visit's medications: practice history, synced notes and notes
        # signed here, as written.
        visits = await record.visits(
            self.adapter, self.store, p.id, related_to=appointment_id
        )
        why = await self._why(appt, history)
        return {
            "spoken": " ".join(lines),
            "take": await self._take(appt, history),
            "patient": p.name,
            "owner": owner,
            "reason": appt.reason,
            "room": appt.room,
            "alerts": p.alerts,
            "last_visit": lines[1],
            "promised": promised,
            "last_note": last_note,
            "previous_notes": len(earlier),
            "remember": said,
            "remember_items": kept,  # display strings (iPhone), full items (console)
            "medications": visits[0]["medications"] if visits else [],
            **why,
            **await self._walk_in(appt, visits, why["owner_message"]),
        }

    async def _walk_in(
        self,
        appt: Appointment,
        rows: list[dict[str, Any]],
        message: dict[str, str] | None,
    ) -> dict[str, Any]:
        """Before you walk in, as dated facts newest first: the owner's latest text and
        results that came in, the last visit's plan in the provider's own words (plain
        words, each line a checkbox, with what the record says about it: a recheck that
        was due and not booked, what was dispensed), then older visits about the same
        problem. And care due within 30 days as "can do today". Facts only: nothing is
        interpreted and nothing is suggested."""
        today, p = date.today(), appt.patient
        entries: list[dict[str, Any]] = []
        if message:
            entries.append(
                {
                    "date": message["at"][:10],
                    "kind": "message",
                    "who": message["who"],
                    "mine": False,
                    "text": message["text"],
                    "items": [],
                }
            )
        try:
            found = await self.adapter.get_updates(
                datetime.combine(today - timedelta(days=1), time.min)
            )
        except Exception:
            found = []
        entries += [
            {
                "date": str(u.get("at", ""))[:10],
                "kind": "result",
                "who": "",
                "mine": False,
                "text": f"{u.get('detail') or 'Results'} came in.",
                "items": [],
            }
            for u in found
            if u.get("patient_id") == p.id and u.get("kind") == "result"
        ]
        entries.sort(key=lambda e: e["date"], reverse=True)
        before = [r for r in rows if r["date"][:10] < today.isoformat()]
        if before:
            last, on = before[0], date.fromisoformat(before[0]["date"][:10])
            later = [r for r in rows if on.isoformat() < r["date"][:10] < str(today)]
            lines = _plan_lines(last["note"]) if _sees_notes() else []
            dispensed = await self._dispensed(appt, lines) if lines else {}
            booked = await self._booked_after(appt) if lines else True
            reader = _reader(appt)[1]
            ticked = set(plan_checks.read(self.store, appt.id, p.id))
            entries.append(
                {
                    "date": on.isoformat(),
                    "kind": "plan" if lines else "visit",
                    "who": last["provider_name"],
                    "mine": same_person(last["provider_name"], reader),
                    "text": _visit_line(last),
                    "items": [
                        {
                            "text": plain_words(line).rstrip("."),
                            "status": _recheck_status(line, on, bool(later), booked),
                            "note": dispensed.get(line, ""),
                            # Ticked before the visit: asked to cover today.
                            "checked": " ".join(plain_words(line).rstrip(".").split())
                            in ticked,
                        }
                        for line in lines
                    ],
                }
            )
            related = [r for r in before[1:] if r.get("related")][:2]
            entries += [
                {
                    "date": r["date"][:10],
                    "kind": "visit",
                    "who": r["provider_name"],
                    "mine": same_person(r["provider_name"], reader),
                    "text": _visit_line(r),
                    "items": [],
                }
                for r in related
            ]
        soon: list[str] = []
        try:
            profile = await self.adapter.get_patient_profile(p.id)
        except Exception:  # the card never fails on a nicety
            profile = None
        for r in profile.reminders if profile else []:
            try:
                due = date.fromisoformat(r.due[:10])
            except ValueError:
                continue
            if 0 <= (due - today).days <= 30:
                soon.append(f"{r.text} due {due:%b %-d}")
        return {"walk_in": entries, "can_do_today": soon}

    async def _dispensed(self, appt: Appointment, lines: list[str]) -> dict[str, str]:
        """Per plan line, the newest time its drug was dispensed, from the invoices:
        "30 tablets dispensed Aug 31, none since". Nothing about when it runs out."""
        try:
            found = await self.adapter.get_invoices(appt.client.id)
        except Exception:
            return {}
        out: dict[str, str] = {}
        for line in lines:
            drug = _drug_of(line)
            if not drug:
                continue
            hits = sorted(
                (
                    (inv.date, item.qty)
                    for inv in found.invoices
                    if inv.patient_id == appt.patient.id
                    for item in inv.items
                    if item.name.lower().startswith(drug.lower())
                ),
                reverse=True,
            )
            if hits:
                at, qty = hits[0]
                pills = " tablets" if re.search(r"\d\s*mg\b", line, re.I) else ""
                out[line] = f"{qty:g}{pills} dispensed {at:%b %-d}, none since"
        return out

    async def _booked_after(self, appt: Appointment) -> bool:
        """Whether this pet has another visit booked in the next four weeks."""
        today = date.today()
        try:
            days_ahead = await asyncio.gather(
                *(
                    self.adapter.get_schedule(today + timedelta(days=n))
                    for n in range(0, 29)
                )
            )
        except Exception:
            return True  # unknown: never claim "not booked"
        return any(
            a.patient.id == appt.patient.id and a.id != appt.id
            for day in days_ahead
            for a in day
        )

    async def _why(self, appt: Appointment, history: list[Any]) -> dict[str, Any]:
        """Why this visit matters, as facts the screen can show in Blinq's purple: the
        last visit, a recheck that was due, care due soon, what came in, and the
        owner's latest message, quoted. Each is something on record, never advice:
        no "check for", no "likely". `prep` is the same facts as short neutral chips."""
        today, p = date.today(), appt.patient
        why: list[str] = []
        prep: list[str] = []
        before = [v for v in history if v.date.date() < today]
        last_on = ""
        if before:
            v = before[0]
            last_on = v.date.date().isoformat()
            meds = "; ".join(v.medications)
            # Said in plain words, on screen and read aloud: "twice a day", not "BID".
            why.append(
                plain_words(
                    f"Last visit {v.date:%b %-d} for {v.reason.lower()}."
                    + (f" {meds}." if meds else "")
                )
            )
        for due, booked in self._rechecks_for(p.id):
            if due < today and not booked:
                why.append(f"Recheck was due {due:%b %-d}, not booked.")
                prep.append("Recheck overdue")
                break
        try:
            profile = await self.adapter.get_patient_profile(p.id)
        except Exception:  # the card never fails on a nicety
            profile = None
        weight = ""
        if profile and profile.weights:
            w = profile.weights[0]
            weight = f"{w.value:g} {w.unit}"
        for r in profile.reminders if profile else []:
            try:
                due_on = date.fromisoformat(r.due[:10])
            except ValueError:
                continue
            if (due_on - today).days <= 30:
                late = due_on < today
                line = f"{r.text} {'was due' if late else 'due'} {due_on:%b %-d}."
                why.append(plain_words(line))
                prep.append(f"{r.text} {'overdue' if late else 'due'}")
        try:
            found = await self.adapter.get_updates(
                datetime.combine(today - timedelta(days=1), time.min)
            )
        except Exception:
            found = []
        for u in found:
            if u.get("patient_id") == p.id and u.get("kind") == "result":
                what = u.get("detail") or "Results"
                why.append(f"{what} came in {_when(u['at'], today)}.")
                prep.append("Results in")
        message = None
        try:
            texts = await self.adapter.get_client_messages(appt.client.id)
        except Exception:
            texts = []
        # The newest text from the owner about this pet, else the newest from them.
        said = [m for m in texts if m.direction == "in"]
        latest = next(
            (m for m in said if p.name.lower() in m.text.lower()), None
        ) or next(iter(said), None)
        if latest and (today - latest.at.date()).days <= 2:
            who = appt.client.first_name or "The owner"
            when = _when(latest.at.isoformat(), today)
            message = {"who": who, "text": latest.text, "at": latest.at.isoformat()}
            why.append(f"{who} texted {when}: \u201c{latest.text}\u201d")
            prep.append("Owner messaged")
        return {
            "why": why,
            "prep": prep[:3],
            "owner_message": message,
            "last_visit_on": last_on,
            "weight": weight,
        }

    def _rechecks_for(self, patient_id: str) -> list[tuple[date, bool]]:
        """(due day, booked) for each recheck approved on this patient's signed visits,
        newest first."""
        out = []
        for e in self.store.list():
            if e.patient_id != patient_id or e.status != EncounterStatus.signed:
                continue
            for f in e.followups:
                if (
                    f.kind != FollowUpKind.recheck
                    or f.status != FollowUpStatus.approved
                ):
                    continue
                start = (e.signed_at or e.created_at).date()
                link = f.booking_link
                booked = bool(f.booked_slot) or bool(link and link.status == "booked")
                out.append((start + timedelta(days=f.due_in_days or 14), booked))
        return out

    async def _take(self, appt: Appointment, history: list[Any]) -> str:
        """Blinq's one line on a visit, facts only: what came in since yesterday,
        then the last visit."""
        today, parts = date.today(), []
        try:
            found = await self.adapter.get_updates(
                datetime.combine(today - timedelta(days=1), time.min)
            )
        except Exception:  # the line is a nicety: the card never fails on it
            found = []
        news = [u for u in found if u.get("patient_id") == appt.patient.id]
        if news and news[0]["kind"] == "reply":
            parts.append(_wrote(news[0], appt.patient.name, today))
        elif news and news[0]["kind"] == "result":
            what = news[0].get("detail") or "Results"
            parts.append(f"{what} came in {_when(news[0]['at'], today)}.")
        before = [v for v in history if v.date.date() < today]
        if before:
            v = before[0]
            parts.append(f"Last seen {v.date:%b %-d} for {v.reason.lower()}.")
        else:
            parts.append("First visit on record.")
        return plain_words(" ".join(parts))

    def _promised_for(self, patient_id: str) -> list[str]:
        """Follow ups the vet approved on this patient's earlier visits, newest
        first."""
        out = []
        for enc in self.store.list():  # newest first
            if enc.patient_id != patient_id or enc.status != EncounterStatus.signed:
                continue
            for f in enc.followups:
                if f.status == FollowUpStatus.approved:
                    due = f" in {f.due_in_days} days" if f.due_in_days else ""
                    out.append(f"{f.reason}{due}")
        return out

    # ---------- chat ----------
    async def checking(self, tool: str, args: dict[str, Any]) -> str:
        """What the vet sees while a tool runs, like "Reading Biscuit's record"."""
        pet = ""
        if args.get("appointment_id"):
            appt = await self.adapter.get_appointment(str(args["appointment_id"]))
            pet = appt.patient.name if appt else ""
        elif args.get("patient_id"):
            found = await self.adapter.get_patient(str(args["patient_id"]))
            pet = found.name if found else ""
        if tool in ("get_patient_brief", "pre_room_card", "get_patient_record"):
            return f"Reading {pet}'s record" if pet else "Reading the record"
        if tool == "search_patients":
            return f"Looking up {args.get('q') or 'the patient'}"
        if tool == "find_recheck_slots":
            return (
                f"Finding recheck times for {pet}" if pet else "Finding recheck times"
            )
        return {
            "get_schedule": "Checking the schedule",
            "list_pending_followups": "Checking follow ups",
            "end_of_day": "Checking what's left today",
        }.get(tool, "Checking")

    async def chat(
        self, req: AssistantRequest, on_check: Callable[[str], None] | None = None
    ) -> AssistantReply:
        """Answer one question. on_check hears each thing it checks before the reply
        (assistant_turn, requirement 58)."""

        async def check(tool: str, args: dict[str, Any]) -> None:
            if on_check:
                on_check(await self.checking(tool, args))

        if not self.muse.enabled:
            day = await self._today(req.provider_id)
            reply = self._finish(await self._mock_chat(req, check, day), req, day)
            return reply.model_copy(update={"reply": format_phones_in(reply.reply)})
        pid, pet = await self._open_patient(req)
        open_patient = (
            ASSISTANT_OPEN_PATIENT.format(
                patient=pet,
                patient_id=pid,
                appointment=f", appointment id {req.appointment_id}"
                if req.appointment_id
                else "",
            )
            if pid
            else ""
        )
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": ASSISTANT_SYSTEM.format(
                    today=date.today().isoformat(),
                    provider_id=req.provider_id or "any",
                    open_patient=open_patient,
                    showing=await self._showing(req.showing),
                ),
            }
        ]
        messages += [t.model_dump() for t in req.history[-10:]]
        messages.append({"role": "user", "content": req.message})
        used: list[str] = []
        for _ in range(MAX_STEPS):
            msg = await self.muse.chat(messages, tools=TOOLS)
            calls = getattr(msg, "tool_calls", None) or []
            if not calls:
                # Phone numbers read the way people write them, whatever the model did.
                text = format_phones_in(msg.content or "")
                return await self._decorate(
                    AssistantReply(reply=text, tools_used=used), req
                )
            messages.append(msg.model_dump(exclude_none=True))
            for call in calls:
                used.append(call.function.name)
                try:
                    args = json.loads(call.function.arguments or "{}")
                    await check(call.function.name, args)
                    result = await self._run_tool(
                        call.function.name, args, req.provider_id
                    )
                except Exception as exc:  # report tool errors back to the model
                    result = {"error": str(exc)}
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": format_phones_in(json.dumps(result, default=str)),
                    }
                )
        return AssistantReply(
            reply="I couldn't finish that. Try asking in a simpler way.",
            tools_used=used,
        )

    async def _showing(self, appointment_id: str) -> str:
        """The system prompt's line on what the screen already shows."""
        appt = (
            await self.adapter.get_appointment(appointment_id)
            if appointment_id
            else None
        )
        if not appt:
            return ""
        return ASSISTANT_SHOWING.format(
            showing=f"the Up next card for {appt.patient.name} at "
            f"{_clock(appt.start)}, {appt.reason.lower() or 'a visit'}"
        )

    def _finish(
        self, reply: AssistantReply, req: AssistantRequest, day: _Today
    ) -> AssistantReply:
        """The answer in a few plain spoken sentences, then two or three questions to
        ask next: the answer's own, then today's, never one already asked or one about
        what the screen already shows."""
        asked = {t.content.strip().lower() for t in req.history if t.role == "user"}
        asked.add(req.message.strip().lower())
        after = (
            _after_question(day.up_next)
            if day.up_next and _after(day.visits, day.up_next)
            else ""
        )
        pool = [
            after if f == "What's first?" and after else f
            for f in reply.followups + day.suggestions()
        ]
        followups = [f for f in dict.fromkeys(pool) if f and f.lower() not in asked][:3]
        return reply.model_copy(
            update={"reply": plain_answer(reply.reply), "followups": followups}
        )

    async def _decorate(
        self, reply: AssistantReply, req: AssistantRequest
    ) -> AssistantReply:
        """A model's answer gets link chips to today's visits it names, and today's
        suggested questions."""
        try:
            day = await self._today(req.provider_id)
        except Exception:  # links are a nicety: the answer still goes out
            return reply
        named = [
            a
            for a in day.appts
            if a.patient.name
            and re.search(rf"\b{re.escape(a.patient.name)}\b", reply.reply)
        ]
        links = reply.links or [_visit_link(a) for a in named[:2]]
        return self._finish(reply.model_copy(update={"links": links}), req, day)

    async def _mock_chat(
        self,
        req: AssistantRequest,
        check: Callable[[str, dict[str, Any]], Awaitable[None]],
        day: _Today,
    ) -> AssistantReply:
        """Mock mode: answers from the same data as the brief, with links, sources and
        follow ups, so the demo clinic can be talked to."""
        q = req.message.lower()
        named = day.named(req.message)
        if _CLINICAL.search(q):
            return await self._your_call(req, named, check)
        if m := _PULL_UP.search(req.message):
            await check("search_patients", {"q": m.group(1)})
            found = await record.search(self.adapter, m.group(1))
            if not found["pets"]:
                return AssistantReply(
                    reply=f"I couldn't find {m.group(1)}.",
                    tools_used=["search_patients"],
                )
            lines = [
                f"- {p['name']} ({p['species']}, {p['breed']}), owner {p['owner_name']}"
                + (
                    f", last seen {p['last_visit']['date']} for "
                    f"{p['last_visit']['reason'].lower()}"
                    if p["last_visit"]
                    else ""
                )
                for p in found["pets"]
            ]
            return AssistantReply(
                reply="\n".join(lines), tools_used=["search_patients"]
            )
        if "follow" in q:
            await check("list_pending_followups", {})
            pending = self.list_pending_followups()
            reply = (
                "\n".join(f"- {p['kind']}: {p['reason']}" for p in pending)
                or "Nothing waiting."
            )
            return AssistantReply(reply=reply, tools_used=["list_pending_followups"])
        answer: AssistantReply | None = None
        if _DRAFT.search(q):
            answer = self._draft_reply(day, named, q)
        elif _REPLY.search(q):
            answer = self._replies(day, named, q)
        elif _RESULTS.search(q):
            answer = await self._results(day, named, check)
        elif _NEEDS.search(q):
            answer = self._needs(day)
        if answer:
            return answer
        pid, pet = (
            (named.patient.id, named.patient.name)
            if named
            else await self._open_patient(req)
        )
        if pid and (_ABOUT_PATIENT.search(q) or _LAST.search(q)):
            return await self._about(day, pid, pet, "note" in q, check)
        if _AFTER.search(q):
            await check("get_schedule", {})
            return self._after_answer(day, named or day.up_next)
        if _FIRST.search(q):
            await check("get_schedule", {})
            if req.showing and day.up_next and req.showing == day.up_next.id:
                return self._after_answer(day, day.up_next, now=True)
            return self._first(day, "next" in q)
        if _HEADS.search(q):
            return self._heads(day)
        if _MORE.search(q):
            return self._more(day)
        if "end of day" in q or "wrap" in q:
            await check("end_of_day", {})
            eod = await self.end_of_day(req.provider_id)
            return AssistantReply(reply=eod["spoken"], tools_used=["end_of_day"])
        await check("get_schedule", {})
        said = "".join(
            p["text"]
            for p in brief_sentence(len(day.appts), day.needs, len(day.updates))
        )
        return AssistantReply(
            reply=said + "\n\n(mock mode: add MODEL_API_KEY for full answers)",
            tools_used=["get_schedule", "list_pending_followups"],
        )

    async def _your_call(
        self,
        req: AssistantRequest,
        named: Appointment | None,
        check: Callable[[str, dict[str, Any]], Awaitable[None]],
    ) -> AssistantReply:
        """A clinical question: the call is the vet's; Blinq gives the facts on file."""
        pid, pet = (
            (named.patient.id, named.patient.name)
            if named
            else await self._open_patient(req)
        )
        if not pid:
            return AssistantReply(
                reply="That's your call. I can pull up the record or past notes."
            )
        await check("get_patient_record", {"patient_id": pid})
        rec = await self.get_patient_record(pid)
        if "error" in rec:
            return AssistantReply(
                reply="That's your call. I can pull up the record or past notes."
            )
        alerts = ", ".join(rec["patient"]["alerts"]) or "no alerts"
        lines = [f"That's your call. On file for {pet}: {alerts}."]
        if w := rec["weight"]["latest"]:
            lines.append(f"Latest weight {w['value']} {w['unit']} on {w['date']}.")
        client = rec["patient"].get("client_id", "")
        return AssistantReply(
            reply=" ".join(lines),
            tools_used=["get_patient_record"],
            sources=[_record_link(pid, client, f"{pet}'s record")],
            links=[_record_link(pid, client, f"Open {pet}'s record")],
        )

    def _owner_reply(
        self, day: _Today, named: Appointment | None, q: str
    ) -> dict[str, Any] | None:
        replies = [u for u in day.updates if u["kind"] == "reply"]
        for u in replies:
            owner = _first_name(_owner_said(u)[0]).lower()
            if (named and u.get("patient_id") == named.patient.id) or (
                owner and re.search(rf"\b{re.escape(owner)}\b", q)
            ):
                return u
        return None if named else (replies[0] if replies else None)

    def _replies(
        self, day: _Today, named: Appointment | None, q: str
    ) -> AssistantReply | None:
        u = self._owner_reply(day, named, q)
        if not u:
            return (
                None
                if named
                else AssistantReply(reply="No new texts from owners since yesterday.")
            )
        owner, _ = _owner_said(u)
        pet, appt = u["patient_name"], day.appt(u.get("patient_id", ""))
        text = _wrote(u, pet, day.on)
        if appt:
            text += f" {pet} is in at {_clock(appt.start)} today for "
            text += f"{appt.reason.lower() or 'a visit'}."
        return AssistantReply(
            reply=text,
            sources=[
                AssistLink(
                    label=f"Text from {owner or 'the owner'}, "
                    f"{_stamp(u['at'], day.on)}",
                    to="household",
                    client_id=u.get("client_id", ""),
                    patient_id=u.get("patient_id", ""),
                )
            ]
            if u.get("client_id")
            else [],
            links=[_visit_link(appt)] if appt else [],
            followups=[
                f"Draft a reply to {_first_name(owner)}",
                "What's first?",
                f"{pet}'s last visit",
            ],
        )

    def _draft_reply(
        self, day: _Today, named: Appointment | None, q: str
    ) -> AssistantReply:
        u = self._owner_reply(day, named, q) or next(
            (u for u in day.updates if u["kind"] == "reply"), None
        )
        if not u:
            return AssistantReply(reply="There's no new text from an owner to answer.")
        owner, _ = _owner_said(u)
        first, pet = _first_name(owner), u["patient_name"]
        appt = day.appt(u.get("patient_id", ""))
        at = f" at {_clock(appt.start)} today" if appt else ""
        draft = (
            f"Hi {first}, thanks for letting us know. "
            f"We'll take a close look at {pet}{at}."
        )
        return AssistantReply(
            reply=f'Here\'s a draft for {owner or "the owner"}: "{draft}" '
            "You can send it from the household page.",
            links=[
                AssistLink(
                    label=f"Open {first}'s household",
                    to="household",
                    client_id=u.get("client_id", ""),
                )
            ]
            if u.get("client_id")
            else [],
            followups=["What's first?", "What needs me?"],
        )

    async def _results(
        self,
        day: _Today,
        named: Appointment | None,
        check: Callable[[str, dict[str, Any]], Awaitable[None]],
    ) -> AssistantReply | None:
        results = [
            u
            for u in day.updates
            if u["kind"] == "result"
            and (not named or u.get("patient_id") == named.patient.id)
        ]
        if not results:
            return (
                None
                if named
                else AssistantReply(reply="No new results since yesterday.")
            )
        u = results[0]
        pid, pet = str(u.get("patient_id", "")), u["patient_name"]
        client, appt = u.get("client_id", ""), day.appt(pid)
        await check("get_patient_record", {"patient_id": pid})
        what = u.get("detail") or "Results"
        lines = [f"{pet}'s {what.lower()} came in {_when(u['at'], day.on)}."]
        topic = what.lower().split()[0]
        pet_alerts = appt.patient.alerts if appt else []
        if flag := next((a for a in pet_alerts if topic in a.lower()), ""):
            lines.append(f"The record flags {flag[0].lower() + flag[1:]}.")
        if appt:
            lines.append(
                f"{pet} is your {_clock(appt.start)} "
                f"{appt.reason.lower() or 'visit'} today."
            )
        notes = _sees_notes()
        if notes:
            lines.append("Want me to pull up the last note?")
        sources = [
            AssistLink(
                label=f"{what}, received {_stamp(u['at'], day.on)}",
                to="documents",
                patient_id=pid,
                client_id=client,
                document_id=u.get("document_id", ""),
            )
        ]
        history = await self.adapter.get_visit_history(pid, pet) if notes else []
        if history:
            sources.append(
                _record_link(pid, client, f"Last visit {history[0].date:%b %-d}")
            )
        return AssistantReply(
            reply=" ".join(lines),
            tools_used=["get_patient_record"],
            sources=sources,
            links=([_visit_link(appt)] if appt else [])
            + [_record_link(pid, client, f"Open {pet}'s record")],
            followups=[
                f"{pet}'s last note" if notes else f"{pet}'s last visit",
                "What's first?",
                "What needs me?",
            ],
        )

    def _needs(self, day: _Today) -> AssistantReply:
        """What To do holds, failed things first."""
        if not day.needs:
            return AssistantReply(reply="Nothing needs you from earlier days.")
        failed = ("failed_text", "pims_failed")
        items = sorted(day.needs, key=lambda i: i["kind"] not in failed)
        count = len(items)
        lines = [f"{count} {'thing needs' if count == 1 else 'things need'} you."]
        lines += [
            str(i["text"]).replace(" did not ", " didn't ").rstrip(".") + "."
            for i in items[:5]
        ]
        links = [
            AssistLink(label=i.get("label") or i["text"], to="household", client_id=c)
            if i["kind"] == "failed_text" and (c := i.get("client_id"))
            else AssistLink(
                label=i.get("label") or i["text"],
                to="visit",
                appointment_id=i.get("appointment_id", ""),
                encounter_id=i.get("encounter_id", ""),
                date=i.get("date", ""),
                patient_id=i.get("patient_id", ""),
            )
            for i in items[:3]
        ]
        return AssistantReply(
            reply=" ".join(lines),
            tools_used=["end_of_day"],
            links=links,
            followups=["What's first?", "What's new since yesterday?"],
        )

    async def _about(
        self,
        day: _Today,
        pid: str,
        pet: str,
        note: bool,
        check: Callable[[str, dict[str, Any]], Awaitable[None]],
    ) -> AssistantReply:
        """A patient's record: alerts, weight, recent visits; the last note when
        asked, for those who may read notes."""
        await check("get_patient_record", {"patient_id": pid})
        rec = await self.get_patient_record(pid)
        if "error" in rec:
            return AssistantReply(
                reply=f"I couldn't find {pet}'s record.",
                tools_used=["get_patient_record"],
            )
        lines = [f"{pet}: {', '.join(rec['patient']['alerts']) or 'no alerts'}."]
        if note and _sees_notes() and (earlier := previous_notes(self.store, pid)):
            n = earlier[0]
            lines.append(
                f"Last note, {n.date:%b %-d}, "
                f"by {n.provider_name or 'another provider'}: "
                f"{_gist(n.text)}"
            )
        if rec["weight"]["latest"]:
            w = rec["weight"]["latest"]
            lines.append(f"Latest weight {w['value']} {w['unit']} on {w['date']}.")
        if rec["recent_visits"]:
            lines.append(f"Last visit {rec['recent_visits'][0]}")
        client = rec["patient"].get("client_id", "")
        appt = day.appt(pid)
        sources = []
        if rec["recent_visits"]:
            when = date.fromisoformat(rec["recent_visits"][0][:10])
            sources.append(_record_link(pid, client, f"Last visit {when:%b %-d}"))
        result = next(
            (
                u
                for u in day.updates
                if u["kind"] == "result" and u.get("patient_id") == pid
            ),
            None,
        )
        return AssistantReply(
            reply="\n".join(lines),
            tools_used=["get_patient_record"],
            sources=sources,
            links=([_visit_link(appt)] if appt else [])
            + [_record_link(pid, client, f"Open {pet}'s record")],
            followups=([_result_question(result)] if result else [])
            + ["What's first?", "What needs me?"],
        )

    def _first(self, day: _Today, upcoming: bool) -> AssistantReply:
        """The first visit not signed yet; "next" means the next one still to come."""
        open_ = [
            a
            for a in days.with_status(day.appts, day.on, self.store)
            if a.visit_status != "signed"
        ]
        now = datetime.now()
        later = [a for a in open_ if a.start >= now] if upcoming else []
        a = next(iter(later or open_), None)
        if not a:
            return AssistantReply(
                reply="No more visits today.", tools_used=["get_schedule"]
            )
        pet = a.patient.name
        lines = [
            f"{'Next' if upcoming else 'First up'} is {pet} at {_clock(a.start)}, "
            f"{a.reason.lower() or 'a visit'}."
        ]
        if a.visit_status in ("recording", "draft_ready"):
            lines.append("The visit is already under way.")
        news = [u for u in day.updates if u.get("patient_id") == a.patient.id]
        reply = next((u for u in news if u["kind"] == "reply"), None)
        sources = []
        if reply:
            lines.append(_wrote(reply, pet, day.on))
            owner = _owner_said(reply)[0]
            sources.append(
                AssistLink(
                    label=f"Text from {owner or 'the owner'}, "
                    f"{_stamp(reply['at'], day.on)}",
                    to="household",
                    client_id=reply.get("client_id", ""),
                )
            )
        if a.patient.alerts:
            lines.append(f"Heads up: {'; '.join(a.patient.alerts[:2])}.")
        return AssistantReply(
            reply=" ".join(lines),
            tools_used=["get_schedule"],
            sources=sources,
            links=[_visit_link(a)],
            followups=[
                f"{pet}'s last visit",
                f"Draft a reply to {_first_name(_owner_said(reply)[0])}"
                if reply
                else "What needs me?",
                "What's new since yesterday?",
            ],
        )

    def _after_answer(
        self, day: _Today, a: Appointment | None, now: bool = False
    ) -> AssistantReply:
        """What comes after a visit. `now`: the screen shows that visit already, so
        it's said in a few words ("Biscuit is up now.")."""
        if not a:
            return self._first(day, False)
        b = _after(day.visits, a)
        him = _him(a)
        lead = f"{a.patient.name} is up now. " if now else ""
        if not b:
            return AssistantReply(
                reply=f"{lead}{a.patient.name} is the last visit today.",
                tools_used=["get_schedule"],
                followups=["What needs me?", "What's new since yesterday?"],
            )
        her = _him(b)
        said = (
            f"{lead}After {him if now else a.patient.name}, {b.patient.name} at "
            f"{_clock(b.start)} for {b.reason.lower() or 'a visit'}"
        )
        news = [u for u in day.updates if u.get("patient_id") == b.patient.id]
        sources = []
        if news and news[0]["kind"] == "result":
            u = news[0]
            what = (u.get("detail") or "results").lower()
            whose = her if her != b.patient.name else f"{b.patient.name}'s"
            said += f"; {whose} {what} came in {_when(u['at'], day.on)}"
            sources.append(
                AssistLink(
                    label=f"{u.get('detail') or 'Results'}, received "
                    f"{_stamp(u['at'], day.on)}",
                    to="documents",
                    patient_id=b.patient.id,
                    client_id=u.get("client_id", ""),
                    document_id=u.get("document_id", ""),
                )
            )
        elif news and news[0]["kind"] == "reply":
            said += ". " + _wrote(news[0], b.patient.name, day.on).rstrip(".")
        return AssistantReply(
            reply=said + ".",
            tools_used=["get_schedule"],
            sources=sources,
            links=[_visit_link(b)],
            followups=[
                _after_question(b) if _after(day.visits, b) else "What needs me?",
                _result_question(news[0])
                if news and news[0]["kind"] == "result"
                else "What needs me?",
            ],
        )

    def _heads(self, day: _Today) -> AssistantReply:
        if not day.heads:
            return AssistantReply(reply="No heads ups today.")
        by_visit: dict[str, list[str]] = {}
        for h in day.heads:
            name = h["patient_name"]
            text = str(h["text"]).removeprefix(f"{name}:").strip()
            by_visit.setdefault(h["appointment_id"], []).append(text)
        lines: list[str] = []
        links: list[AssistLink] = []
        for appt_id, texts in by_visit.items():
            a = next((x for x in day.appts if x.id == appt_id), None)
            if not a:
                continue
            lines.append(f"{a.patient.name} at {_clock(a.start)}: {'; '.join(texts)}.")
            if len(links) < 3:
                links.append(_visit_link(a))
        return AssistantReply(
            reply="\n".join(lines),
            links=links,
            followups=["What's first?", "What's new since yesterday?"],
        )

    def _more(self, day: _Today) -> AssistantReply:
        """ "Want to hear more?" "Yes": what came in since yesterday, then who needs
        care today."""
        lines: list[str] = []
        links: list[AssistLink] = []
        for u in day.updates[:4]:
            pet, pid = u["patient_name"], str(u.get("patient_id", ""))
            if u["kind"] == "result":
                what = (u.get("detail") or "results").lower()
                lines.append(f"{pet}'s {what} came in {_when(u['at'], day.on)}.")
                links.append(
                    AssistLink(
                        label=f"Open {pet}'s results",
                        to="documents",
                        patient_id=pid,
                        client_id=u.get("client_id", ""),
                        document_id=u.get("document_id", ""),
                    )
                )
            elif u["kind"] == "reply":
                lines.append(_wrote(u, pet, day.on))
                if u.get("client_id"):
                    first = _first_name(_owner_said(u)[0])
                    links.append(
                        AssistLink(
                            label=f"Open {first}'s texts",
                            to="household",
                            client_id=u["client_id"],
                        )
                    )
            else:
                lines.append(str(u["text"]).rstrip(".") + ".")
                if appt := day.appt(pid):
                    links.append(_visit_link(appt))
        pets = list(dict.fromkeys(h["patient_name"] for h in day.heads))
        if pets:
            names = ", ".join(pets[:-1]) + (" and " if len(pets) > 1 else "") + pets[-1]
            lines.append(f"Heads ups today for {names}.")
        if not lines:
            lines.append("Nothing new since yesterday.")
        return AssistantReply(
            reply=" ".join(lines),
            links=links[:3],
            followups=["Any heads ups today?", "What's first?", "What needs me?"],
        )
