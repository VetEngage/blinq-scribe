"""The patient record, read only: past visits, the profile, invoices, the household and
search.

Everything comes from the practice system through the adapter, plus notes
synced from it and notes signed in Blinq Scribe. A field the practice system
does not share stays empty: nothing here is made up for a live practice.
"""

from __future__ import annotations

import asyncio
import re
from datetime import date, datetime, timedelta
from typing import Any

from . import day as days
from . import remember
from .adapters.base import PracticeAdapter
from .note_sections import note_sections
from .notes import local_naive, note_text, previous_notes, split_sections
from .schemas import (
    Appointment,
    Client,
    EncounterStatus,
    FollowUpStatus,
    Patient,
    Reminder,
)
from .store import Store

MAX_HITS = 8

_WELLNESS = re.compile(
    r"\b(wellness|annual|vaccin|check "
    r"?up|physical|preventive|puppy|kitten|senior (exam|bloodwork))",
    re.I,
)
_SICK = re.compile(
    r"\b(sick|ill|recheck|injur|urgent|emergen|vomit|diarrh|stool|limp|itch|scratch|ear|eye|skin|cough|"
    r"sneez|lacerat|wound|lump|mass|pain|thirst|infection|not eating|letharg|seizure)",
    re.I,
)
# Words that point at the same problem. Each word maps to one group; visits that share a
# group are related.
_GROUPS = {
    "ear": "ear",
    "ears": "ear",
    "otic": "ear",
    "otitis": "ear",
    "head": "ear",
    "shaking": "ear",
    "itch": "skin",
    "itchy": "skin",
    "itching": "skin",
    "scratching": "skin",
    "skin": "skin",
    "allergy": "skin",
    "rash": "skin",
    "face": "skin",
    "pruritus": "skin",
    "paw": "limb",
    "leg": "limb",
    "legs": "limb",
    "limping": "limb",
    "limp": "limb",
    "back": "limb",
    "hip": "limb",
    "laceration": "wound",
    "suture": "wound",
    "sutures": "wound",
    "wound": "wound",
    "cut": "wound",
    "vomiting": "gut",
    "diarrhea": "gut",
    "stool": "gut",
    "appetite": "gut",
    "kidney": "kidney",
    "renal": "kidney",
    "creatinine": "kidney",
    "thirst": "kidney",
    "urination": "kidney",
    "bloodwork": "kidney",
    "dental": "teeth",
    "tooth": "teeth",
    "teeth": "teeth",
    "extraction": "teeth",
    "extractions": "teeth",
    "eye": "eye",
    "eyes": "eye",
    "sneezing": "nose",
    "nasal": "nose",
    "cough": "chest",
}


def kind_of(type_text: str, reason: str) -> str:
    """Sick, wellness or other, from the practice system's visit type (or the reason
    when there is none)."""
    text = type_text or reason
    if _WELLNESS.search(text):
        return "wellness"
    if _SICK.search(text):
        return "sick"
    return "other"


def _groups(text: str) -> set[str]:
    return {_GROUPS[w] for w in re.findall(r"[a-z]+", text.lower()) if w in _GROUPS}


def _meds_from(text: str) -> list[str]:
    """Drug lines a note itself lists ("Rx Apoquel 16 mg ..."), restated as written."""
    return [m.strip(" -") for m in re.findall(r"(?:^|\n)\s*-?\s*Rx\s+([^\n]+)", text)]


def _photo_url(encounter_id: str, photo_id: str) -> str:
    return f"/api/encounters/{encounter_id}/photos/{photo_id}"


async def visits(
    adapter: PracticeAdapter,
    store: Store,
    patient_id: str,
    kind: str = "",
    q: str = "",
    related_to: str = "",
    pet: Patient | None = None,
) -> list[dict[str, Any]]:
    """Past visits newest first: the practice system's history, synced notes matched by
    date, and visits signed
    in Blinq Scribe. `pet`, when the caller has it already, saves reading it again."""
    pet = pet or await adapter.get_patient(patient_id)
    history = await adapter.get_visit_history(patient_id, pet.name if pet else "")
    notes = [
        n for n in previous_notes(store, patient_id, days=3650) if n.source == "pims"
    ]
    ours = [
        e
        for e in store.list(patient_id=patient_id)
        if e.patient_id == patient_id and e.status == EncounterStatus.signed and e.note
    ]
    rows: list[dict[str, Any]] = []
    used_notes: set[str] = set()
    for i, v in enumerate(history):
        note = next(
            (
                n
                for n in notes
                if n.id not in used_notes and n.date.date() == v.date.date()
            ),
            None,
        )
        if note:
            used_notes.add(note.id)
        rows.append(
            {
                "id": f"visit-{v.appointment_id or f'{v.date:%Y%m%d}-{i}'}",
                "date": v.date.isoformat(),
                "type": v.type,
                "reason": v.reason,
                "provider_name": v.provider_name
                or (note.provider_name if note else ""),
                "appointment_id": v.appointment_id,
                "summary": v.summary,
                "note": note.text if note else None,
                "medications": v.medications or (_meds_from(note.text) if note else []),
                "photos": [],
            }
        )
    for n in notes:  # a synced note with no matching visit is still a visit
        if n.id in used_notes:
            continue
        sections = split_sections(n.text)
        found = (sections.assessment if sections else "") or n.text.splitlines()[0]
        rows.append(
            {
                "id": f"note-{n.id}",
                "date": n.date.isoformat(),
                "type": "",
                # No visit in the practice system to name it: a plain label, and the
                # assessment as the summary, so a "Last visit" line never reads like
                # a diagnosis.
                "reason": "Visit note",
                "provider_name": n.provider_name,
                "appointment_id": "",
                "summary": found.strip()[:200],
                "note": n.text,
                "medications": _meds_from(n.text),
                "photos": [],
            }
        )
    for e in ours:
        assert e.note is not None  # signed with a note, see above
        photos = [
            {"id": p.id, "caption": p.caption, "url": _photo_url(e.id, p.id)}
            for p in e.photos
        ]
        row = next(
            (
                r
                for r in rows
                # The same appointment, day included: the demo clinic's ids repeat
                # daily ("appt-1", "appt-1@2026-10-30").
                if r["appointment_id"] and r["appointment_id"] == e.appointment_id
            ),
            None,
        )
        if (
            row
        ):  # the practice system has this visit: Blinq Scribe's signed note is the note
            row.update(
                note=note_text(e.note),
                medications=e.note.medications or row["medications"],
                photos=photos,
            )
            continue
        appt = await adapter.get_appointment(e.appointment_id)
        rows.append(
            {
                "id": f"blinq-{e.id}",
                "date": local_naive(e.signed_at or e.created_at).isoformat(),
                "type": appt.type if appt else "",
                "reason": appt.reason if appt else (e.note.assessment[:120]),
                "provider_name": e.signed_by or e.provider_name,
                "appointment_id": e.appointment_id,
                "summary": e.note.client_summary or e.note.assessment,
                "note": note_text(e.note),
                "medications": e.note.medications,
                "photos": photos,
            }
        )
    related = await adapter.get_appointment(related_to) if related_to else None
    target = _groups(related.reason) if related else set()
    for r in rows:
        r["sections"] = [s.model_dump() for s in note_sections(r["note"] or "")]
        r["kind"] = kind_of(r["type"], r["reason"])
        r["related"] = bool(target & _groups(f"{r['reason']} {r['summary']}"))
    if kind:
        rows = [r for r in rows if r["kind"] == kind]
    if q.strip():
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if any(
                needle in (r[k] or "").lower()
                for k in ("reason", "summary", "note", "provider_name", "type")
            )
            or any(needle in m.lower() for m in r["medications"])
        ]
    rows.sort(key=lambda r: r["date"], reverse=True)
    # One visit once: the same appointment written twice (a visit started again)
    # is one row, the newest.
    seen: set[str] = set()
    out = []
    for r in rows:
        if r["appointment_id"] and r["appointment_id"] in seen:
            continue
        seen.add(r["appointment_id"])
        out.append(r)
    return out


def _client_out(c: Client, messages: list[Any]) -> dict[str, Any]:
    return {
        "id": c.id,
        "name": c.full_name,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "phones": c.phones,
        "emails": c.emails,
        "prefers": c.prefers,
        "reminders": c.reminders,
        "client_since": c.client_since,
        "latest_message": {"at": messages[0].at.isoformat(), "text": messages[0].text}
        if messages
        else None,
    }


async def _last_visit(adapter: PracticeAdapter, p: Patient) -> dict[str, Any] | None:
    """The last visit before today: today's, done or not, is never the last one."""
    today = date.today()
    history = [
        v
        for v in await adapter.get_visit_history(p.id, p.name)
        if local_naive(v.date).date() < today
    ]
    return (
        {
            "date": history[0].date.date().isoformat(),
            "reason": history[0].reason,
            "type": history[0].type,
        }
        if history
        else None
    )


async def _due(adapter: PracticeAdapter, patient_id: str) -> list[str]:
    profile = await adapter.get_patient_profile(patient_id)
    return [f"{r.text}{f' due {r.due}' if r.due else ''}" for r in profile.reminders]


SOON_DAYS = 60  # a reminder this close counts as due soon


def _next_due(reminders: list[Reminder], today: date) -> dict[str, Any] | None:
    """The reminder that comes first, with whether it is overdue, due soon or later."""
    dated = sorted((r for r in reminders if r.due), key=lambda r: r.due)
    if not dated:
        return None
    first = dated[0]
    soon = (today + timedelta(days=SOON_DAYS)).isoformat()
    state = (
        "overdue"
        if first.due < today.isoformat()
        else "soon"
        if first.due <= soon
        else "later"
    )
    return {"text": first.text, "due": first.due, "state": state}


def _book_url(adapter: PracticeAdapter, today: date) -> str:
    """The clinic's online booking link for a new visit, from the same template the
    recheck links use. Empty when the clinic has none."""
    template = getattr(adapter, "booking_url_template", "")
    if not template:
        return ""
    try:
        return template.format(
            location_id=getattr(adapter, "location_id", ""),
            service_id="",
            start=datetime.combine(
                today + timedelta(days=1), datetime.min.time()
            ).isoformat(),
        )
    except KeyError, IndexError, ValueError:
        return ""


def _pet_out(p: Patient) -> dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "species": p.species,
        "breed": p.breed,
        "age": p.age,
        "sex": p.sex,
        "alerts": p.alerts,
    }


async def _nothing() -> Any:
    return None


async def profile(
    adapter: PracticeAdapter, patient_id: str, store: Store | None = None
) -> dict[str, Any] | None:
    pet = await adapter.get_patient(patient_id)
    return await _profile_of(adapter, pet, store=store) if pet else None


_WEIGHT = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(lb|kg|g)s?\b", re.I)


def _visit_weight(store: Store, patient_id: str) -> dict[str, Any] | None:
    """The newest weight written in a visit's note in Blinq (a confirmed one: a
    "[confirm ...]" value isn't a reading yet)."""
    for e in sorted(
        store.list(patient_id=patient_id), key=lambda e: e.created_at, reverse=True
    ):
        found = e.note and _WEIGHT.match(str(e.note.vitals.get("weight", "")))
        if e.patient_id == patient_id and found:
            return {
                "date": days.visit_day(e).isoformat(),
                "value": float(found.group(1)),
                "unit": found.group(2).lower(),
                "note": "This visit",
            }
    return None


def _weights(
    readings: list[dict[str, Any]], visit: dict[str, Any] | None
) -> dict[str, Any]:
    """Latest first. A weight from a visit in Blinq that is newer than the PIMS's
    comes first, with the reading before it (`previous`), so every screen can say
    "74 lb, up 2 lb since Jul 4"."""
    if visit and (not readings or visit["date"] >= readings[0]["date"]):
        readings = [visit, *readings]
    latest = readings[0] if readings else None
    before = readings[1] if visit and latest is visit and len(readings) > 1 else None

    def short(w: dict[str, Any] | None) -> dict[str, Any] | None:
        return {k: w[k] for k in ("date", "value", "unit")} if w else None

    return {"latest": short(latest), "previous": short(before), "history": readings}


async def _profile_of(
    adapter: PracticeAdapter,
    pet: Patient,
    details: bool = True,
    store: Store | None = None,
) -> dict[str, Any]:
    """The Client and patient tab. Without `details` (the Record panel): no latest
    message, and other pets without their last visit and what's due. With `store`,
    a weight written in a visit counts as the latest."""
    cid = pet.client_id
    extra, client, messages, household = await asyncio.gather(
        adapter.get_patient_profile(pet.id),
        adapter.get_client(cid) if cid else _nothing(),
        adapter.get_client_messages(cid) if cid and details else _nothing(),
        adapter.get_household(cid) if cid else _nothing(),
    )
    others = [p for p in household or [] if p.id != pet.id] if client else []
    weights = [w.model_dump() for w in extra.weights]
    pets = [_pet_out(p) for p in others]
    out: dict[str, Any] = {
        "patient": {**_pet_out(pet), "color": pet.color, "microchip": pet.microchip},
        "weight": _weights(weights, _visit_weight(store, pet.id) if store else None),
        "reminders_due": [
            {
                "patient_id": pet.id,
                "patient_name": pet.name,
                "text": r.text,
                "due": r.due,
            }
            for r in extra.reminders
        ],
        "client": _client_out(client, messages or []) if client else None,
        "other_pets": pets,
        "mock": adapter.name == "mock",
    }
    if details:
        lasts, dues = await asyncio.gather(
            asyncio.gather(*(_last_visit(adapter, p) for p in others)),
            asyncio.gather(*(_due(adapter, p.id) for p in others)),
        )
        for row, last, due in zip(pets, lasts, dues, strict=True):
            row.update(last_visit=last, due=due)
    return out


PANEL_VISITS = 3  # recent visits in the Record side panel


async def panel(
    adapter: PracticeAdapter, store: Store, patient_id: str
) -> dict[str, Any] | None:
    """The Record side panel on a visit page, in one read: the pet and its alerts,
    weight, what's due, recent visits, owner contact, other pets and the practice
    system's ids. Recent visits are lines, never notes."""
    pet = await adapter.get_patient(patient_id)
    if not pet:
        return None
    found, rows = await asyncio.gather(
        _profile_of(adapter, pet, details=False, store=store),
        visits(adapter, store, patient_id, pet=pet),
    )
    client = found["client"]
    return {
        **found,
        "pims_patient_id": patient_id,
        "pims_client_id": client["id"] if client else "",
        "recent_visits": [
            {k: r[k] for k in ("id", "date", "kind", "type", "reason", "provider_name")}
            for r in rows[:PANEL_VISITS]
        ],
    }


async def invoices(
    adapter: PracticeAdapter, client_id: str, patient_id: str = ""
) -> dict[str, Any] | None:
    if not await adapter.get_client(client_id):
        return None
    found = await adapter.get_invoices(client_id)
    names = {p.id: p.name for p in await adapter.get_household(client_id)}
    year_ago = datetime.now() - timedelta(days=365)
    counts: dict[str, int] = {"all": len(found.invoices)}
    for i in found.invoices:
        counts[i.patient_id] = counts.get(i.patient_id, 0) + 1
    rows = [
        {
            "id": i.id,
            "date": i.date.date().isoformat(),
            "patient_id": i.patient_id,
            "patient_name": names.get(i.patient_id, ""),
            "visit": i.visit,
            "provider_name": i.provider_name,
            "total": i.total,
            "status": i.status,
            "items": [x.model_dump() for x in i.items],
            "paid_by": i.paid_by,
        }
        for i in found.invoices
        if not patient_id or i.patient_id == patient_id
    ]
    return {
        "balance": found.balance,
        "last_12_months": round(
            sum(i.total for i in found.invoices if local_naive(i.date) >= year_ago), 2
        ),
        "last_payment": found.last_payment,
        "invoices": rows,
        "counts": counts,
        "mock": adapter.name == "mock",
    }


async def household(
    adapter: PracticeAdapter, store: Store, client_id: str
) -> dict[str, Any] | None:
    client = await adapter.get_client(client_id)
    if not client:
        return None
    pets = await adapter.get_household(client_id)
    today = date.today()
    todays = {
        a.patient.id: a
        for a in days.with_status(await adapter.get_schedule(today), today, store)
    }
    bills = await adapter.get_invoices(client_id)
    year_ago = datetime.now() - timedelta(days=365)
    spend = {
        p.id: round(
            sum(
                i.total
                for i in bills.invoices
                if i.patient_id == p.id and local_naive(i.date) >= year_ago
            ),
            2,
        )
        for p in pets
    }
    messages = await adapter.get_client_messages(client_id)
    reminders = {
        p.id: (await adapter.get_patient_profile(p.id)).reminders for p in pets
    }
    coming_up = []
    for p in pets:
        for r in reminders[p.id]:
            if (
                r.due
                and today.isoformat()
                <= r.due
                <= (today + timedelta(days=60)).isoformat()
            ):
                coming_up.append(
                    {"date": r.due, "text": f"{r.text} due", "patient_name": p.name}
                )
    for e in store.list():  # rechecks booked from Blinq Scribe
        if e.patient_id in spend:
            name = next(p.name for p in pets if p.id == e.patient_id)
            for f in e.followups:
                if (
                    f.status == FollowUpStatus.approved
                    and f.booked_slot
                    and f.booked_slot.start.date() >= today
                ):
                    coming_up.append(
                        {
                            "date": f.booked_slot.start.date().isoformat(),
                            "text": f"Recheck booked, {f.reason}",
                            "patient_name": name,
                        }
                    )
    return {
        "client": _client_out(client, messages),
        "pets": [
            {
                **_pet_out(p),
                "last_visit": await _last_visit(adapter, p),
                "due": [
                    f"{r.text}{f' due {r.due}' if r.due else ''}"
                    for r in reminders[p.id]
                ],
                "next_due": _next_due(reminders[p.id], today),
                "tags": p.tags,
                "alert_tags": [c["short"] for c in p.alert_chips],
                "today": _today(todays.get(p.id)),
                "spend_12m": spend[p.id],
            }
            for p in pets
        ],
        "balance": bills.balance,
        "book_url": _book_url(adapter, today),
        "spend_12m": round(sum(spend.values()), 2),
        "coming_up": sorted(coming_up, key=lambda c: c["date"]),
        "messages": [
            {"at": m.at.isoformat(), "direction": m.direction, "text": m.text}
            for m in messages
        ],
        "remember": remember.kept_for_client(store, client_id),
        "mock": adapter.name == "mock",
    }


def _today(a: Appointment | None) -> dict[str, Any] | None:
    if not a:
        return None
    return {
        "appointment_id": a.id,
        "time": f"{a.start:%H:%M}",
        "reason": a.reason,
        "visit_status": a.visit_status,
        "encounter_id": a.encounter_id,
    }


async def search(adapter: PracticeAdapter, q: str) -> dict[str, Any]:
    """Pets first, then owners, at most 8 of each. Needs 2 or more characters."""
    q = q.strip()
    if len(q) < 2:
        return {"pets": [], "owners": []}
    hits = (await adapter.search(q))[:MAX_HITS]
    now = datetime.now()
    clients = list({c.id: c for _, c in hits}.values())
    today, tomorrow, last_visits, households = await asyncio.gather(
        adapter.get_schedule(now.date()),
        adapter.get_schedule(now.date() + timedelta(days=1)),
        asyncio.gather(*(_last_visit(adapter, p) for p, _ in hits)),
        asyncio.gather(*(adapter.get_household(c.id) for c in clients)),
    )
    # Any visit today counts, even one whose start time has passed: the vet may be
    # running late.
    upcoming = today + [a for a in tomorrow if local_naive(a.start) >= now]
    pets = []
    for (p, c), last in zip(hits, last_visits, strict=False):
        nxt = next((a for a in upcoming if a.patient.id == p.id), None)
        pets.append(
            {
                "id": p.id,
                "name": p.name,
                "species": p.species,
                "breed": p.breed,
                "age": p.age,
                "client_id": c.id,
                "owner_name": c.full_name,
                "last_visit": last,
                "next_visit": {
                    "date": nxt.start.date().isoformat(),
                    "time": f"{nxt.start:%H:%M}",
                    "appointment_id": nxt.id,
                }
                if nxt
                else None,
            }
        )
    owners = [
        {
            "id": c.id,
            "name": c.full_name,
            "phone": c.phones[0] if c.phones else "",
            "email": c.emails[0] if c.emails else "",
            "pets": [x.name for x in household]
            or [p.name for p, o in hits if o.id == c.id],
        }
        for c, household in zip(clients, households, strict=False)
    ]
    return {"pets": pets, "owners": owners[:MAX_HITS]}
