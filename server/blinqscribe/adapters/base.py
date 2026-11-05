"""The one seam between Blinq Scribe and any practice system.

Blinq Scribe never talks to a database directly. Everything it knows about the
clinic comes through a PracticeAdapter. That keeps this repo fully open source
and runnable by judges (MockAdapter, the demo PIMS), and a clinic's own PIMS
connector plugs in by implementing the same interface.
"""

from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from datetime import date, datetime, timedelta
from typing import Any

from ..schemas import (
    Appointment,
    Client,
    Clinic,
    Encounter,
    FollowUp,
    Invoices,
    Message,
    PastNote,
    PastVisit,
    Patient,
    PatientProfile,
    Slot,
    WriteBackResult,
)

SCHEDULE_TTL = 60  # seconds the default record reads reuse today's schedule


class PracticeAdapter(ABC):
    name: str = "base"
    location_id: str = ""  # the practice system's id for this office, for booking links
    booking_url_template: str = ""

    @abstractmethod
    async def get_schedule(
        self, day: date, provider_id: str | None = None
    ) -> list[Appointment]:
        """Appointments for one day, earliest first."""

    @abstractmethod
    async def get_appointment(self, appointment_id: str) -> Appointment | None: ...

    @abstractmethod
    async def get_visit_history(
        self, patient_id: str, patient_name: str = ""
    ) -> list[PastVisit]:
        """Past visits for a patient, newest first."""

    async def get_patient_notes(self, patient_id: str) -> list[PastNote] | None:
        """Medical notes on file for a patient, from every vet. None when this system
        cannot share notes,
        which is different from a patient with no notes: a sync must not clear history
        on None."""
        return None

    async def list_providers(self) -> list[dict[str, Any]]:
        """Providers to link vet logins to: [{id, name}], from the schedule a week
        either side of today."""
        found: dict[str, str] = {}
        day = date.today() - timedelta(days=7)
        while day <= date.today() + timedelta(days=7):
            for a in await self.get_schedule(day):
                if a.provider_id:
                    found.setdefault(a.provider_id, a.provider_name)
            day += timedelta(days=1)
        return [
            {"id": pid, "name": name}
            for pid, name in sorted(found.items(), key=lambda p: p[1])
        ]

    async def patients_seen(self, start: date, end: date) -> list[str]:
        """Patient ids with an appointment between two dates (inclusive), one day at a
        time."""
        seen: dict[str, None] = {}
        day = start
        while day <= end:
            for a in await self.get_schedule(day):
                seen.setdefault(a.patient.id, None)
            day += timedelta(days=1)
        return list(seen)

    @abstractmethod
    async def find_slots(self, start: date, end: date, species: str = "") -> list[Slot]:
        """Open slots for a recheck between two dates (inclusive)."""

    @abstractmethod
    async def write_back(self, encounter: Encounter) -> WriteBackResult:
        """Send a signed note and its exam photos to the practice system. Must be
        idempotent."""

    async def book_appointment(
        self, encounter: Encounter, followup: FollowUp, slot: Slot, appt: Appointment
    ) -> WriteBackResult:
        """Book an approved recheck at the slot the vet picked. Must be idempotent per
        follow up."""
        return WriteBackResult(
            ok=True,
            status="queued_for_staff",
            detail="This PIMS does not take bookings from Blinq Scribe "
            "yet. Queued for staff.",
        )

    # ---------- the patient record (read only) ----------
    # Safe defaults from what every adapter already has: today's schedule. A practice
    # system that shares
    # more overrides these. Anything it does not share stays empty, never made up.

    async def get_clinic(self) -> Clinic:
        """The practice's name, address, phone and logo, for the owner summary."""
        return Clinic()

    async def _todays_schedule(self) -> list[Appointment]:
        """Today's schedule, read at most once a minute, for the defaults below."""
        today, now = date.today(), time.monotonic()
        cached: tuple[date, float, list[Appointment]] | None = self.__dict__.get(
            "_schedule_cache"
        )
        if cached and cached[0] == today and now - cached[1] < SCHEDULE_TTL:
            return cached[2]
        appts = await self.get_schedule(today)
        self._schedule_cache = (today, now, appts)
        return appts

    async def get_patient(self, patient_id: str) -> Patient | None:
        for a in await self._todays_schedule():
            if a.patient.id == patient_id:
                return a.patient.model_copy(
                    update={"client_id": a.patient.client_id or a.client.id}
                )
        return None

    async def get_client(self, client_id: str) -> Client | None:
        for a in await self._todays_schedule():
            if a.client.id == client_id:
                return a.client
        return None

    async def get_household(self, client_id: str) -> list[Patient]:
        """Every pet the owner has, as far as this system can tell."""
        pets: dict[str, Patient] = {}
        for a in await self._todays_schedule():
            if a.client.id == client_id:
                pets.setdefault(
                    a.patient.id, a.patient.model_copy(update={"client_id": client_id})
                )
        return list(pets.values())

    async def get_invoices(self, client_id: str) -> Invoices:
        return Invoices()

    async def get_patient_profile(self, patient_id: str) -> PatientProfile:
        """Weights and reminders due."""
        return PatientProfile()

    async def get_client_messages(self, client_id: str) -> list[Message]:
        """Recent texts with the owner, newest first."""
        return []

    async def search(self, q: str) -> list[tuple[Patient, Client]]:
        """Pets whose name, or whose owner's name, email or phone, matches. Default:
        today's schedule only."""
        hits: dict[str, tuple[Patient, Client]] = {}
        for a in await self._todays_schedule():
            if matches(q, a.patient, a.client):
                hits.setdefault(
                    a.patient.id,
                    (a.patient.model_copy(update={"client_id": a.client.id}), a.client),
                )
        return list(hits.values())

    async def get_updates(self, since: datetime) -> list[dict[str, Any]]:
        """Things that came in since a time, newest first: [{kind: result | reply |
        booked, text, at, patient_name}]."""
        return []


def matches(q: str, patient: Patient, client: Client) -> bool:
    """Search match on pet name, owner name, email or phone digits."""
    q = q.strip().lower()
    digits = re.sub(r"\D", "", q)
    if len(digits) >= 3 and re.fullmatch(r"[\d\s().+-]+", q):
        return any(digits in re.sub(r"\D", "", p) for p in client.phones)
    owner = client.full_name.lower()
    return (
        q in patient.name.lower()
        or q in owner
        or any(q in e.lower() for e in client.emails)
    )
