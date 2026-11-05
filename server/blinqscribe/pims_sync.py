"""Sending a signed note to the practice system (PIMS), and where each part stands.

Sign and send writes the note (with the photos the vet kept in it) at once; Sign
only locks the note and leaves it "not_sent" until the vet sends it. A save that
fails is tried again every 5 minutes; after an hour it goes to the front desk
(queued_for_staff). The prescription isn't written to any PIMS yet, so it always
says so, and signing makes a front desk task to enter it (prescription_task),
tracked until someone marks it entered. One encounter is changed at a time
(Store.update), so a retry and the vet's own Send never overwrite each other.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta

from .adapters import PracticeAdapter
from .notes import as_utc
from .schemas import (
    Encounter,
    EncounterStatus,
    PimsItem,
    PimsStatus,
    PrescriptionTask,
    WriteBackResult,
)
from .scribe import in_note
from .store import Store

RETRY_EVERY = timedelta(minutes=5)
FRONT_DESK_AFTER = timedelta(hours=1)
RETRY_AT_ONCE = 4  # saves tried together, so a backlog doesn't flood the PIMS
NOT_YET = "Prescriptions aren't sent to the PIMS yet. The front desk enters them."
# "100 mg once a day": the dose and what follows it, after a drug's name.
_DOSE = re.compile(r"\s*\d[\d.,/]*\s?(mg|mcg|g|ml|iu|units?|%)\b.*$", re.I)


async def pims_name(adapter: PracticeAdapter, fallback: str = "") -> str:
    """The practice system's real name, from the location (the adapter keeps it),
    else the PIMS_NAME setting, else "". Data only: every label the vet or staff
    reads says "the PIMS", never the vendor's name."""
    try:
        name = (await adapter.get_clinic()).pims_name
    except Exception:
        name = ""
    return name or fallback


def _photo_label(caption: str) -> str:
    words = re.sub(r"\s+", " ", caption).strip()
    return f"Photo: {words[:60]}" if words else "Photo"


def items(
    enc: Encounter,
    status: PimsStatus,
    detail: str = "",
    pims_id: str = "",
    at: datetime | None = None,
) -> list[PimsItem]:
    """The note, each photo going with it, and the prescription when there is one,
    all at `status` (the prescription is never sent yet)."""
    out = [
        PimsItem(
            kind="note",
            id="note",
            label="Note",
            status=status,
            detail=detail,
            pims_id=pims_id,
            synced_at=at if status == "synced" else None,
        )
    ]
    out += [
        PimsItem(
            kind="photo",
            id=p.id,
            label=_photo_label(p.label or p.caption),
            status=status,
            detail="With the note" if status == "synced" else detail,
            synced_at=at if status == "synced" else None,
        )
        for p in in_note(enc)
    ]
    if enc.note and enc.note.medications:
        out.append(
            PimsItem(
                kind="prescription",
                id="prescription",
                label="Prescription",
                status="not_sent",
                detail=NOT_YET,
            )
        )
    return out


def prescription_task(enc: Encounter) -> PrescriptionTask | None:
    """The front desk's task for a note with medications: "Enter Cefpodoxime for
    Biscuit in the PIMS". It names the drugs with a dose (else every medication);
    the task keeps the whole list as the note has it."""
    meds = [m.strip() for m in (enc.note.medications if enc.note else []) if m.strip()]
    if not meds:
        return None
    dosed = [m for m in meds if _DOSE.search(m)] or meds
    names = list(
        dict.fromkeys(_DOSE.sub("", m.split(",")[0]).strip() or m for m in dosed)
    )
    drugs = names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"
    pet = enc.patient_name or "this pet"
    return PrescriptionTask(
        text=f"Enter {drugs} for {pet} in the PIMS", medications=meds
    )


async def _write(adapter: PracticeAdapter, enc: Encounter) -> WriteBackResult | None:
    """The practice system's answer, or None when it couldn't be reached."""
    try:
        appt = await adapter.get_appointment(enc.appointment_id)
        if adapter.name != "mock" and appt and appt.patient.id != enc.patient_id:
            # The practice system files a note under the appointment's pet, so
            # another pet's note waits for staff.
            return WriteBackResult(
                ok=False,
                status="queued_for_staff",
                detail="This pet isn't the one on the appointment, so the front desk "
                "will file the note.",
            )
        # Photos the vet left out of the note stay in Blinq Scribe.
        return await adapter.write_back(enc.model_copy(update={"photos": in_note(enc)}))
    except Exception:
        return None


def _settle(now_enc: Encounter, answer: WriteBackResult | None, now: datetime) -> None:
    """Record a send's outcome on the encounter as it is saved now."""
    if now_enc.write_back and now_enc.write_back.status == "written":
        return  # another send got there first: keep it
    if answer is None:  # couldn't reach the practice system
        since = now_enc.pims_failing_since or now
        late = now - since >= FRONT_DESK_AFTER
        result = WriteBackResult(
            ok=False,
            status="queued_for_staff" if late else "failed",
            detail="Couldn't reach the PIMS for an hour, so the front desk will add "
            "the note."
            if late
            else "Couldn't reach the PIMS. Trying again every 5 minutes.",
            at=now,
        )
        now_enc.pims_items = items(now_enc, "failed", result.detail)
        now_enc.pims_next_try_at = None if late else now + RETRY_EVERY
        now_enc.pims_failing_since = since
        now_enc.pims_tries += 1
        now_enc.write_back = result
        return
    answer = answer.model_copy(update={"at": answer.at or now})
    now_enc.write_back = answer
    now_enc.pims_failing_since = now_enc.pims_next_try_at = None
    now_enc.pims_tries += 1
    if answer.status == "written":
        where = "Saved to the PIMS" + (
            f" as {answer.pims_id}" if answer.pims_id else ""
        )
        now_enc.pims_items = items(now_enc, "synced", where, answer.pims_id, now)
    else:  # the practice system can't take it: the front desk files it
        now_enc.pims_items = items(now_enc, "not_sent", answer.detail)


def not_sent(enc: Encounter, now: datetime) -> WriteBackResult:
    """Sign only: locked, nothing written, waiting for the vet to send it."""
    result = WriteBackResult(
        ok=False,
        status="not_sent",
        detail="Signed only. Not sent to the PIMS yet.",
        at=now,
    )
    enc.write_back = result
    enc.pims_items = items(enc, "not_sent", result.detail)
    enc.pims_failing_since = enc.pims_next_try_at = None
    return result


async def send(
    store: Store, adapter: PracticeAdapter, encounter_id: str, now: datetime
) -> WriteBackResult:
    """Send a signed note to the practice system and record what happened. Safe to
    repeat: a note already written comes back as it is."""
    enc = store.get(encounter_id)
    if not enc or enc.status != EncounterStatus.signed:
        raise ValueError("Only a signed note can be sent.")
    if enc.write_back and enc.write_back.status == "written":
        return enc.write_back

    def sending(now_enc: Encounter) -> None:
        now_enc.pims_items = items(now_enc, "sending", "Sending to the PIMS")

    store.update(encounter_id, sending)
    answer = await _write(adapter, enc)
    saved = store.update(encounter_id, lambda e: _settle(e, answer, now))
    assert saved and saved.write_back
    return saved.write_back


async def retry_due(
    store: Store, adapter: PracticeAdapter, now: datetime
) -> list[tuple[str, WriteBackResult]]:
    """Try again each failed save whose 5 minutes are up (after an hour it goes to
    the front desk), a few at a time. Returns (encounter id, result) for each one
    tried."""
    due = [
        enc.id
        for enc in await asyncio.to_thread(store.pims_retries)
        if enc.status == EncounterStatus.signed
        and enc.write_back
        and enc.write_back.status == "failed"
        and enc.pims_next_try_at
        and as_utc(enc.pims_next_try_at) <= now
    ]
    at_once = asyncio.Semaphore(RETRY_AT_ONCE)

    async def one(encounter_id: str) -> tuple[str, WriteBackResult]:
        async with at_once:
            return encounter_id, await send(store, adapter, encounter_id, now)

    return list(await asyncio.gather(*(one(i) for i in due)))
