"""Synthetic clinic so anyone can run Blinq Scribe with zero credentials.

All names and data in data/mock_practice.json are made up.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from .. import note_types
from ..notes import local_naive
from ..schemas import (
    Appointment,
    Client,
    Clinic,
    Encounter,
    FollowUp,
    Invoice,
    InvoiceItem,
    Invoices,
    LastVisit,
    Message,
    PastNote,
    PastVisit,
    Patient,
    PatientProfile,
    Reminder,
    Slot,
    SoapNote,
    VisitPet,
    Weight,
    WriteBackResult,
)
from .base import PracticeAdapter, matches

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "mock_practice.json"
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class MockAdapter(PracticeAdapter):
    name = "mock"

    def __init__(
        self,
        data_file: Path = DATA_FILE,
        booking_url_template: str = "",
        today: date | None = None,
        state_file: Path | None = None,
    ):
        self.data = json.loads(Path(data_file).read_text())
        # What signing wrote to the mock practice system: notes and visits by encounter
        # id. Kept in this file (DATA_DIR) when given, so it lasts across restarts.
        self.state_file = state_file
        self.state: dict[str, dict[str, Any]] = {"notes": {}, "visits": {}}
        if state_file and state_file.is_file():
            self.state = json.loads(state_file.read_text())
        self.location_id = self.data["location"]["id"]
        self.booking_url_template = booking_url_template
        self._today = today  # pinned (tests), else it follows the clock
        self.written: list[str] = []
        self.bookings: dict[str, Slot] = {}  # followup id -> booked slot
        self._providers = {p["id"]: p for p in self.data["providers"]}
        self._patients = {p["id"]: p for p in self.data["patients"]}
        self._clients = {c["id"]: c for c in self.data["clients"]}

    @property
    def today(self) -> date:
        """The demo's today: a server left running overnight moves to the new day
        rather than showing yesterday's visits as today's."""
        return self._today or date.today()

    # --- helpers ---
    def _patient(self, pat: dict[str, Any]) -> Patient:
        return Patient(
            **{
                k: pat[k]
                for k in ("id", "name", "species", "breed", "age", "client_id")
            },
            alerts=pat.get("alerts", []),
            alert_shorts=pat.get("alert_shorts", {}),
            tags=pat.get("tags", []),
            pims_notes=pat.get("pims_notes", []),
            last_visit=self._last_visit(pat["id"]),
            weight=self._weights(pat)[0] if pat.get("weights") else None,
            **{k: pat.get(k, "") for k in ("sex", "color", "microchip")},
        )

    def _weights(self, pat: dict[str, Any]) -> list[Weight]:
        """A pet's weights, newest first."""
        return [
            Weight(
                date=(self.today - timedelta(days=w["days_ago"])).isoformat(),
                value=w["value"],
                unit=w.get("unit", "lb"),
                note=w.get("note", ""),
            )
            for w in sorted(pat.get("weights", []), key=lambda w: w["days_ago"])
        ]

    def _history(self, patient_id: str) -> list[PastVisit]:
        """Past visits newest first: the demo's history and the notes signed here."""
        pat = self._patients.get(patient_id, {})
        visits = [
            PastVisit(
                date=self._ago(v["days_ago"]),
                reason=v["reason"],
                summary=v.get("summary", ""),
                type=v.get("type", ""),
                provider_id=v.get("provider_id", ""),
                provider_name=self._providers.get(v.get("provider_id", ""), {}).get(
                    "name", ""
                ),
                medications=v.get("medications", []),
            )
            for v in pat.get("history", [])
        ]
        visits += [
            PastVisit.model_validate(v)
            for v in self.state["visits"].values()
            if v["patient_id"] == patient_id
        ]
        return sorted(visits, key=lambda v: v.date, reverse=True)

    def _last_visit(self, patient_id: str) -> LastVisit | None:
        """The last visit before today: today's, done or not, is never the last one."""
        for v in self._history(patient_id):
            if local_naive(v.date).date() < self.today:
                return LastVisit(
                    date=local_naive(v.date).date().isoformat(),
                    reason=v.reason,
                    type=v.type,
                )
        return None

    def _ago(self, days: int) -> datetime:
        return datetime.combine(self.today - timedelta(days=days), time(10, 0))

    def _clock(self, raw: dict[str, Any]) -> datetime:
        """A text or an update at a clock time on an earlier day ("days_ago": 1,
        "time": "16:12" is yesterday 4:12 PM), so it reads right at any hour."""
        hh, mm = (int(x) for x in raw["time"].split(":"))
        return datetime.combine(
            self.today - timedelta(days=raw["days_ago"]), time(hh, mm)
        )

    @property
    def busy_day(self) -> date | None:
        """The demo's heavy day (20 visits, 24 pets), a set number of days after
        today; None when the data has none."""
        busy = self.data.get("busy_day")
        return self.today + timedelta(days=busy["days_ahead"]) if busy else None

    def _day(self, day: date) -> list[dict[str, Any]]:
        """That day's visits: today's schedule, the busy day's, else its day of the
        week's. Days after today come from `week_ahead`, which has none of today's
        pets, so tomorrow never repeats today and no recheck lands before it is
        due."""
        if day == self.today:
            return list(self.data["schedule"])
        if day == self.busy_day:
            return list(self.data["busy_day"]["visits"])
        week = (
            "week_ahead" if day > self.today and "week_ahead" in self.data else "week"
        )
        return list(self.data.get(week, {}).get(WEEKDAYS[day.weekday()], []))

    def _appt(self, raw: dict[str, Any], day: date) -> Appointment:
        hh, mm = (int(x) for x in raw["time"].split(":"))
        pat = self._patients[raw["patient_id"]]
        cli = self._clients[pat["client_id"]]
        prov = self._providers[raw["provider_id"]]
        # A household appointment books several of the owner's pets as one visit.
        pets = [
            VisitPet(
                patient=self._patient(self._patients[p["patient_id"]]),
                reason=p.get("reason", ""),
            )
            for p in raw.get("pets", [])
        ]
        return Appointment(
            # Today's ids stay plain; other days carry their date.
            id=raw["id"] if day == self.today else f"{raw['id']}@{day.isoformat()}",
            start=datetime.combine(day, time(hh, mm)),
            duration_min=raw.get("duration", 30),
            reason=raw["reason"],
            type=raw.get("type", ""),
            status=raw.get("status", "Scheduled"),
            provider_id=prov["id"],
            provider_name=prov["name"],
            room=raw.get("room", ""),
            patient=self._patient(pat),
            client=Client(**cli),
            pets=pets,
            demo_clock=self.data["busy_day"]["clock"] if day == self.busy_day else "",
            checked_in_at=datetime.combine(day, time.fromisoformat(raw["checked_in"]))
            if raw.get("checked_in")
            else None,
        )

    # --- adapter API ---
    async def get_schedule(
        self, day: date, provider_id: str | None = None
    ) -> list[Appointment]:
        # Today is the demo's schedule; every other day has its day of the week's
        # (earlier days from `week`, later ones from `week_ahead`).
        appts = [self._appt(a, day) for a in self._day(day)]
        if provider_id:
            appts = [a for a in appts if a.provider_id == provider_id]
        return sorted(appts, key=lambda a: a.start)

    async def get_appointment(self, appointment_id: str) -> Appointment | None:
        raw_id, _, on = appointment_id.partition("@")
        try:
            day = date.fromisoformat(on) if on else self.today
        except ValueError:
            return None
        for a in self._day(day):
            if a["id"] == raw_id:
                return self._appt(a, day)
        return None

    async def get_visit_history(
        self, patient_id: str, patient_name: str = ""
    ) -> list[PastVisit]:
        return self._history(patient_id)

    async def get_patient_notes(self, patient_id: str) -> list[PastNote]:
        written = [
            PastNote.model_validate(n)
            for n in self.state["notes"].values()
            if n["patient_id"] == patient_id
        ]
        return written + [
            PastNote(
                id=n["id"],
                patient_id=n["patient_id"],
                provider_id=n["provider_id"],
                provider_name=self._providers[n["provider_id"]]["name"],
                text=n["text"],
                date=datetime.combine(
                    self.today - timedelta(days=n["days_ago"]), time(10, 0)
                ),
            )
            for n in self.data.get("notes", [])
            if n["patient_id"] == patient_id
        ]

    async def list_providers(self) -> list[dict[str, Any]]:
        return [{"id": p["id"], "name": p["name"]} for p in self.data["providers"]]

    async def patients_seen(self, start: date, end: date) -> list[str]:
        days = [start + timedelta(days=n) for n in range((end - start).days + 1)]
        # One week holds every visit of the synthetic schedule.
        seen = [a["patient_id"] for d in days[:7] for a in self._day(d)]
        if start <= self.today <= end:
            seen += [a["patient_id"] for a in self._day(self.today)]
        return list(dict.fromkeys(seen))

    async def find_slots(self, start: date, end: date, species: str = "") -> list[Slot]:
        slots: list[Slot] = []
        day = start
        while day <= end:
            if day.weekday() < 5:
                for hour in range(9, 17):
                    for minute in (0, 30):
                        # deterministic "booked" pattern so results look real
                        if (hour + minute // 30 + day.toordinal()) % 3 == 0:
                            continue
                        s = datetime.combine(day, time(hour, minute))
                        slots.append(
                            Slot(
                                start=s,
                                end=s + timedelta(minutes=30),
                                provider_id="prov-1",
                                service_id="svc-recheck",
                                booking_url=self.booking_url_template.format(
                                    location_id=self.location_id,
                                    service_id="svc-recheck",
                                    start=s.isoformat(),
                                ),
                            )
                        )
            day += timedelta(days=1)
        return slots

    async def write_back(self, encounter: Encounter) -> WriteBackResult:
        if encounter.id not in self.written:
            self.written.append(encounter.id)
        if encounter.note:  # writing the same note again replaces it, never doubles
            await self._file_note(encounter, encounter.note)
        photos = len(encounter.photos)
        return WriteBackResult(
            ok=True,
            status="written",
            pims_id=f"mock-note-{encounter.id}",
            detail=f"Saved the note{f' and {photos} photo(s)' if photos else ''} to "
            "the PIMS.",
        )

    async def _file_note(self, enc: Encounter, note: SoapNote) -> None:
        """The signed note as the practice system keeps it: a medical note in the
        note type's headings, and the visit on the patient's history."""
        sections = {
            s["key"]: s["label"]
            for s in note_types.NOTE_TYPES.get(
                enc.note_type, note_types.NOTE_TYPES["sick"]
            )["sections"]
        }
        lines = [
            f"{sections[key]}: {getattr(note, key).strip()}"
            for key in ("subjective", "objective", "assessment", "plan")
            if getattr(note, key).strip()
        ]
        if note.vitals:
            lines.append(
                "Vitals: " + ", ".join(f"{k} {v}" for k, v in note.vitals.items())
            )
        if note.medications:
            lines.append("Medications: " + "; ".join(note.medications))
        when = local_naive(enc.signed_at or enc.created_at)
        provider_id = enc.signed_by_provider_id or enc.provider_id
        provider_name = enc.signed_by or enc.provider_name
        appt = await self.get_appointment(enc.appointment_id)
        first = re.split(r"(?<=[.!?])\s", note.assessment.strip(), maxsplit=1)[0]
        self.state["notes"][enc.id] = PastNote(
            id=f"mock-note-{enc.id}",
            patient_id=enc.patient_id,
            date=when,
            provider_id=provider_id,
            provider_name=provider_name,
            text="\n".join(lines),
        ).model_dump(mode="json", exclude={"sections"})
        self.state["visits"][enc.id] = {
            "patient_id": enc.patient_id,
            **PastVisit(
                date=when,
                reason=appt.reason if appt else first[:120],
                summary=first[:200],
                type=appt.type if appt else "",
                provider_id=provider_id,
                provider_name=provider_name,
                appointment_id=enc.appointment_id,
                medications=note.medications,
            ).model_dump(mode="json"),
        }
        if self.state_file:
            self.state_file.write_text(json.dumps(self.state, indent=1))

    async def book_appointment(
        self, encounter: Encounter, followup: FollowUp, slot: Slot, appt: Appointment
    ) -> WriteBackResult:
        booked = self.bookings.setdefault(
            followup.id, slot
        )  # a repeat returns the first booking
        return WriteBackResult(
            ok=True,
            status="written",
            pims_id=f"mock-appt-{followup.id}",
            start=booked.start,
            detail=f"Booked {booked.start:%a %b %-d %-I:%M %p} in the mock practice "
            "system.",
        )

    # --- the patient record ---
    async def get_clinic(self) -> Clinic:
        loc = self.data["location"]
        return Clinic(
            name=loc["name"],
            address=loc.get("address", ""),
            phone=loc.get("phone", ""),
            logo_url=loc.get("logo_url", ""),
            pims_name=loc.get("pims_name", ""),
        )

    async def get_patient(self, patient_id: str) -> Patient | None:
        pat = self._patients.get(patient_id)
        return self._patient(pat) if pat else None

    async def get_client(self, client_id: str) -> Client | None:
        cli = self._clients.get(client_id)
        return Client(**cli) if cli else None

    async def get_household(self, client_id: str) -> list[Patient]:
        return [
            self._patient(p)
            for p in self.data["patients"]
            if p["client_id"] == client_id
        ]

    async def get_invoices(self, client_id: str) -> Invoices:
        cli = self._clients.get(client_id)
        if not cli:
            return Invoices()
        invoices = [
            Invoice(
                id=i["id"],
                date=self._ago(i["days_ago"]),
                client_id=client_id,
                patient_id=i["patient_id"],
                visit=i.get("visit", ""),
                provider_name=self._providers.get(i.get("provider_id", ""), {}).get(
                    "name", ""
                ),
                total=round(sum(x["qty"] * x["price"] for x in i["items"]), 2),
                status=i["status"],
                items=[InvoiceItem(**x) for x in i["items"]],
                paid_by=i.get("paid_by"),
            )
            for i in self.data.get("invoices", [])
            if i["client_id"] == client_id
        ]
        invoices.sort(key=lambda i: i.date, reverse=True)
        paid = cli.get("last_payment")
        last = (
            {
                "date": (self.today - timedelta(days=paid["days_ago"])).isoformat(),
                "amount": paid["amount"],
                "paid_by": paid.get("paid_by"),
            }
            if paid
            else None
        )
        return Invoices(
            invoices=invoices,
            balance=round(sum(i.total for i in invoices if i.status == "open"), 2),
            last_payment=last,
        )

    async def get_patient_profile(self, patient_id: str) -> PatientProfile:
        pat = self._patients.get(patient_id, {})
        return PatientProfile(
            weights=self._weights(pat),
            reminders=[
                Reminder(
                    text=r["text"],
                    due=(self.today + timedelta(days=r["due_in_days"])).isoformat(),
                )
                for r in sorted(
                    pat.get("reminders", []), key=lambda r: r["due_in_days"]
                )
            ],
        )

    async def get_client_messages(self, client_id: str) -> list[Message]:
        msgs = [
            Message(
                at=self._clock(m),
                direction=m["direction"],
                text=m["text"],
            )
            for m in self.data.get("messages", [])
            if m["client_id"] == client_id
        ]
        return sorted(msgs, key=lambda m: m.at, reverse=True)

    async def search(self, q: str) -> list[tuple[Patient, Client]]:
        hits = []
        for pat in self.data["patients"]:
            patient, client = (
                self._patient(pat),
                Client(**self._clients[pat["client_id"]]),
            )
            if matches(q, patient, client):
                hits.append((patient, client))
        return hits

    async def get_updates(self, since: datetime) -> list[dict[str, Any]]:
        out = [
            {
                "kind": u["kind"],
                "text": u["text"],
                "detail": u.get("detail", ""),
                "at": self._clock(u).isoformat(),
                "patient_name": self._patients.get(u.get("patient_id", ""), {}).get(
                    "name", ""
                ),
                "patient_id": u.get("patient_id", ""),
                "mock": True,
            }
            for u in self.data.get("updates", [])
            if self._clock(u) >= since
        ]
        return sorted(out, key=lambda u: u["at"], reverse=True)
