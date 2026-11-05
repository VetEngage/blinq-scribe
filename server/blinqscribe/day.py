"""The vet's days: visit status on the schedule, the week strip, and what is still open
from each day.

A visit belongs to the day it happened. Other days' appointment ids may carry
their date (`appt-1@2026-10-30` in the demo clinic); otherwise the encounter's
own start time says which day it was.
"""

from __future__ import annotations

import asyncio
import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

from . import note_types
from .adapters.base import PracticeAdapter
from .notes import as_utc, local_naive
from .schemas import (
    Appointment,
    Encounter,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
    SoapNote,
    VisitPet,
)
from .store import Store

MAX_DAYS = 62  # longest range the week strip may ask for


_CONFIRM = re.compile(r"\[\s*confirm\b", re.I)


def to_confirm(note: SoapNote) -> int:
    """Things the vet must check: the draft marks each one "[confirm: ...]", in any
    section, the owner's summary, the medicines or a vital."""
    parts = [note.subjective, note.objective, note.assessment, note.plan]
    parts += [note.client_summary, *note.medications, *note.vitals.values()]
    return len(_CONFIRM.findall(" ".join(parts)))


def visit_day(e: Encounter) -> date:
    _, _, on = e.appointment_id.partition("@")
    try:
        return date.fromisoformat(on)
    except ValueError:
        return local_naive(e.created_at).date()


def appt_key(appointment_id: str) -> str:
    return appointment_id.partition("@")[0]


def encounters_on(
    store: Store,
    day: date,
    provider_id: str = "",
    encounters: list[Encounter] | None = None,
) -> list[Encounter]:
    """Encounters from one day, newest first, for one vet when a provider id is
    given."""
    return [
        e
        for e in (encounters if encounters is not None else store.list(visit_day=day))
        if visit_day(e) == day and (not provider_id or e.provider_id == provider_id)
    ]


def latest_by_appointment(encounters: list[Encounter]) -> dict[str, Encounter]:
    """The newest encounter per appointment (and per pet in a multi-pet visit, the
    primary one)."""
    out: dict[str, Encounter] = {}
    for e in encounters:  # newest first
        if e.group_id and e.group_id != e.id:
            # a sibling pet in a group: the primary encounter speaks for the visit
            continue
        out.setdefault(appt_key(e.appointment_id), e)
    return out


AUDIO_LIVE_SECONDS = 30


def audio_live(e: Encounter, now: datetime) -> bool:
    """Audio parts are still arriving: a recording visit whose latest part came in
    the last AUDIO_LIVE_SECONDS."""
    at = e.last_part_at
    if e.status != EncounterStatus.recording or at is None:
        return False
    return (now - as_utc(at)).total_seconds() <= AUDIO_LIVE_SECONDS


def household_pets(
    a: Appointment, e: Encounter | None, encounters: list[Encounter]
) -> list[VisitPet]:
    """Each pet of a household appointment with where its note stands: its own
    encounter once the visit is drafted (one note per pet), the visit's while it
    records, else not started (a pet left out of the visit, or no visit yet)."""
    gid = (e.group_id or e.id) if e else ""
    mine: dict[str, Encounter] = {}
    for o in encounters:  # newest first
        if gid and (o.group_id or o.id) == gid:
            mine.setdefault(o.patient_id, o)
    out = []
    for p in a.pets:
        x = mine.get(p.patient.id)
        if not x and e and p.patient.id in e.patient_ids:
            x = e  # recorded for every pet, not drafted yet
        out.append(
            p.model_copy(
                update={"visit_status": x.status.value, "encounter_id": x.id}
                if x
                else {"visit_status": "not_started", "encounter_id": ""}
            )
        )
    return out


def household_status(pets: list[VisitPet]) -> str:
    """A household visit as one row: recording while any pet's part is, signed once
    every pet in it is, a draft while any note waits, else not started."""
    states = [p.visit_status for p in pets if p.visit_status != "not_started"]
    if not states:
        return "not_started"
    if "recording" in states:
        return "recording"
    if all(s == "signed" for s in states):
        return "signed"
    return "draft_ready"


def with_status(appts: list[Appointment], day: date, store: Store) -> list[Appointment]:
    encounters = encounters_on(store, day)
    latest = latest_by_appointment(encounters)
    now = datetime.now(UTC)
    out = []
    for a in appts:
        e = latest.get(appt_key(a.id))
        visit: dict[str, Any] = (
            {
                "visit_status": e.status.value,
                "encounter_id": e.id,
                "audio_live": audio_live(e, now),
                "started_at": local_naive(as_utc(e.created_at)),
            }
            if e
            else {}
        )
        if a.pets:
            visit["pets"] = household_pets(a, e, encounters)
            visit["visit_status"] = household_status(visit["pets"])
        out.append(a.model_copy(update={"note_type": note_types.guess(a), **visit}))
    return out


class Names:
    """Patient and owner names for appointments, one schedule read per day."""

    def __init__(self, adapter: PracticeAdapter):
        self.adapter = adapter
        self._days: dict[date, dict[str, Appointment]] = {}

    async def appt(self, e: Encounter) -> Appointment | None:
        day = visit_day(e)
        if day not in self._days:
            try:
                self._days[day] = {
                    appt_key(a.id): a for a in await self.adapter.get_schedule(day)
                }
            except Exception:  # a slow or failing practice system only costs the names
                self._days[day] = {}
        return self._days[day].get(appt_key(e.appointment_id))

    async def pet(self, e: Encounter) -> str:
        if e.patient_name:
            return e.patient_name
        a = await self.appt(e)
        return a.patient.name if a else "a patient"

    async def owner(self, e: Encounter) -> str:
        if e.owner_name:
            return e.owner_name
        a = await self.appt(e)
        return a.client.full_name if a else "the owner"


def _failed_texts(e: Encounter) -> list[FollowUp]:
    return [
        f
        for f in e.followups
        if f.status == FollowUpStatus.approved and f.sms and f.sms.status == "failed"
    ]


def _queued(e: Encounter) -> list[tuple[str, str]]:
    """(what, detail) for each write that did not reach the practice system."""
    what = []
    if e.write_back and e.write_back.status == "queued_for_staff":
        what.append(("note", e.write_back.detail))
    what += [
        ("recheck booking", f.booking.detail)
        for f in e.followups
        if f.status == FollowUpStatus.approved
        and f.booking
        and f.booking.status != "written"
    ]
    return what


async def open_items(
    day: date, encounters: list[Encounter], names: Names
) -> list[dict[str, Any]]:
    """What is still open from one day: unsigned notes, follow ups waiting, failed
    texts, notes signed only or not saved to the PIMS yet, prescriptions for the
    front desk to enter, queued writes.
    A draft follow up on an unsigned note is part of reviewing that note, so it is not
    listed twice."""
    items: list[dict[str, Any]] = []

    for e in encounters:
        pet = await names.pet(e)

        # Only called within this iteration, so the loop variables are current.
        def item(kind: str, text: str, title: str, label: str, **extra: Any) -> None:
            items.append(
                {
                    "kind": kind,
                    "text": text,  # said aloud and on the glasses: keep it whole
                    "title": title,  # the row's short label, without the pet
                    "label": label,  # the To do row: short, with the pet or owner
                    "patient_id": e.patient_id,  # noqa: B023
                    # The owner, so a visit for them can show what failed (the banner).
                    "client_id": e.client_id,  # noqa: B023
                    # Rows for one owner's pets group under the owner.
                    "owner_name": e.owner_name,  # noqa: B023
                    "encounter_id": e.id,  # noqa: B023
                    "appointment_id": e.appointment_id,  # noqa: B023
                    "date": day.isoformat(),
                    "patient_name": pet,  # noqa: B023
                    **extra,
                }
            )

        if e.status != EncounterStatus.signed:
            if _superseded(e, encounters):
                continue
            item(
                "unsigned",
                f"Sign {pet}'s note"
                if e.status == EncounterStatus.draft_ready
                else f"Finish {pet}'s visit (still recording)",
                "Sign note"
                if e.status == EncounterStatus.draft_ready
                else "Finish visit",
                f"Sign {pet}'s note"
                if e.status == EncounterStatus.draft_ready
                else f"Finish {pet}'s visit",
                status=e.status.value,
                detail="Draft ready"
                if e.status == EncounterStatus.draft_ready
                else "Still recording",
            )
            continue
        for f in e.followups:
            if f.status == FollowUpStatus.draft:
                item(
                    "followup",
                    f"Approve or dismiss {pet}'s follow up: {f.reason}",
                    f"Approve follow up: {f.title}",
                    f"Approve {pet}'s follow up",
                    detail=f.reason,
                    followup_id=f.id,
                    followup_kind=f.kind.value,
                    reason=f.reason,
                )
        for f in _failed_texts(e):
            owner = await names.owner(e)
            item(
                "failed_text",
                f"Text to {owner} about {pet} did not send",
                "Text didn't send",
                f"Text to {first_name(owner)} didn't send",
                detail=f"To {owner}",
                followup_id=f.id,
            )
        wb = e.write_back
        if wb and wb.status == "not_sent":  # signed only: before you go, send it
            item(
                "not_sent",
                f"Send {pet}'s note to the PIMS",
                "Send to the PIMS",
                f"Send {pet}'s note to the PIMS",
                detail=wb.detail,
            )
        if wb and wb.status == "failed":  # retrying every 5 minutes
            item(
                "pims_failed",
                f"{pet}'s note couldn't be saved to the PIMS yet",
                "Couldn't save to the PIMS",
                f"{pet}'s note didn't save to the PIMS",
                detail=wb.detail,
            )
        rx = e.prescription_task
        if rx and not rx.done_at:  # the front desk enters it in the PIMS
            item(
                "prescription",
                rx.text,
                "Enter prescription",
                rx.text,
                detail="; ".join(rx.medications),
            )
        for what, detail in _queued(e):
            item(
                "queued",
                f"{pet}'s {what} is queued for staff to add to the PIMS",
                f"{what.capitalize()} queued for staff",
                f"{pet}'s {what} is queued for staff",
                what=what,
                detail=detail,
            )
    return items


def first_name(name: str) -> str:
    """ "Jordan Lee" -> "Jordan". "Dr. Ana Rivera" stays whole; no name is "the
    owner"."""
    parts = name.split()
    if not parts:
        return "the owner"
    if parts[0].lower() == "the":  # "the owner" when the name isn't known
        return name.strip()
    if parts[0].rstrip(".").lower() in ("dr", "mr", "mrs", "ms", "mx"):
        return name.strip()
    return parts[0]


def _superseded(e: Encounter, encounters: list[Encounter]) -> bool:
    """An abandoned encounter: the same appointment has a newer one."""
    return any(
        o.created_at > e.created_at
        and appt_key(o.appointment_id) == appt_key(e.appointment_id)
        and o.patient_id == e.patient_id
        for o in encounters
    )


def marker(
    day: date, today: date, items: list[dict[str, Any]], encounters: list[Encounter]
) -> str:
    if any(i["kind"] in ("failed_text", "queued", "pims_failed") for i in items):
        return "failed"
    if items:
        return "open"
    if day <= today and encounters:
        return "done"
    return "none"


async def strip(
    adapter: PracticeAdapter,
    store: Store,
    start: date,
    end: date,
    provider_id: str = "",
    today: date | None = None,
) -> list[dict[str, Any]]:
    """The week strip: one entry per day, oldest first."""
    today = today or date.today()
    everything = store.list()
    names = Names(adapter)
    dates = [start + timedelta(days=n) for n in range((end - start).days + 1)]
    schedules = await asyncio.gather(
        *(adapter.get_schedule(d, provider_id or None) for d in dates)
    )
    out = []
    for day, appts in zip(dates, schedules, strict=False):
        encs = encounters_on(store, day, provider_id, everything)
        items = await open_items(day, encs, names)
        out.append(
            {
                "date": day.isoformat(),
                "visits": len(appts),
                "open": sum(i["kind"] in ("unsigned", "followup") for i in items),
                "failed": sum(i["kind"] in ("failed_text", "queued") for i in items),
                "marker": "none" if day > today else marker(day, today, items, encs),
            }
        )
    return out


async def done_items(encounters: list[Encounter], names: Names) -> list[dict[str, Any]]:
    """Signed notes and booked rechecks from one day, for End of day's Done today."""
    out = []
    for e in encounters:
        if e.status != EncounterStatus.signed:
            continue
        pet = await names.pet(e)
        out.append({"text": f"Signed {pet}'s note", "encounter_id": e.id})
        for f in e.followups:
            if f.kind == FollowUpKind.recheck and f.booked_slot:
                out.append(
                    {
                        "text": f"Booked {pet}'s recheck for "
                        f"{f.booked_slot.start:%a %b %-d %-I:%M %p}",
                        "encounter_id": e.id,
                    }
                )
    return out


def _first_line(text: str) -> str:
    """The first line of a note section, without its bullet: "Back pain, mild."."""
    for line in (text or "").splitlines():
        if line := line.strip().removeprefix("- ").strip():
            return line
    return ""


async def unsigned_notes(
    store: Store,
    adapter: PracticeAdapter,
    provider_id: str = "",
    today: date | None = None,
) -> list[dict[str, Any]]:
    """Every note not signed yet, on any day, newest first, each in one bucket.

    Ready to sign: drafted, nothing to confirm and every follow up decided, so it can be
    signed as is (one by one, or several at once). Pending: something is left, the
    things to confirm, the follow ups to decide, or a visit recorded and not drafted
    yet; it opens the note. A visit still taking in audio is in the room, not here."""
    today = today or date.today()
    everything, names, now = store.list(), Names(adapter), datetime.now(UTC)
    out: list[dict[str, Any]] = []
    for e in everything:
        if e.status == EncounterStatus.signed or audio_live(e, now):
            continue
        if provider_id and e.provider_id != provider_id:
            continue
        if _superseded(e, everything):
            continue
        appt = await names.appt(e)
        confirm = to_confirm(e.note) if e.note else 0
        undecided = sum(f.status == FollowUpStatus.draft for f in e.followups)
        drafted = e.status == EncounterStatus.draft_ready and e.note is not None
        left = [
            f"{confirm} {'thing' if confirm == 1 else 'things'} to confirm"
            if confirm
            else "",
            f"{undecided} follow {'up' if undecided == 1 else 'ups'} to decide"
            if undecided
            else "",
            "" if drafted else "Not drafted yet",
        ]
        day = visit_day(e)
        start = appt.start if appt else local_naive(e.created_at)
        out.append(
            {
                "encounter_id": e.id,
                "appointment_id": e.appointment_id,
                "patient_id": e.patient_id,
                "patient_name": await names.pet(e),
                "owner_name": await names.owner(e),
                "client_id": e.client_id or (appt.client.id if appt else ""),
                "provider_id": e.provider_id,
                "provider_name": e.provider_name
                or (appt.provider_name if appt else ""),
                "date": day.isoformat(),
                "time": f"{start:%H:%M}",
                "visit_reason": appt.reason if appt else "",
                "assessment": _first_line(e.note.assessment) if e.note else "",
                "status": e.status.value,
                "bucket": "ready"
                if drafted and not left[0] and not left[1]
                else "pending",
                "to_confirm": confirm,
                "followups_undecided": undecided,
                "reason": ", ".join(x for x in left if x),
                "waiting_days": max(0, (today - day).days),
            }
        )
    return sorted(out, key=lambda n: (n["date"], n["time"]), reverse=True)
