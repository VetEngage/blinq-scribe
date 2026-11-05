"""The vet's days: visit status on the schedule, the week strip, the brief and end of
day, and the demo history."""

from datetime import UTC, date, datetime, time, timedelta

import anyio
from fastapi.testclient import TestClient

from blinqscribe import remember
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.demo_seed import NOTES, _weekdays_before, seed_history
from blinqscribe.schemas import Encounter, EncounterStatus
from blinqscribe.store import Store

TODAY = date.today()
WEEKDAYS = _weekdays_before(TODAY, 5)


def _rivera(day):
    """Dr. Rivera's visits that day in the demo clinic."""
    return anyio.run(MockAdapter().get_schedule, day, "prov-1")


def _noted(day):
    """The seeded ones: those with a demo note, in time order."""
    return [a for a in _rivera(day) if a.id.partition("@")[0] in NOTES]


def _save(settings, eid, appt, status, when=None, **extra):
    Store(settings.data_dir).save(
        Encounter(
            id=eid,
            appointment_id=appt,
            patient_id="pat-1",
            provider_id="prov-1",
            consent_recorded=True,
            status=status,
            created_at=when or datetime.now(UTC),
            **extra,
        )
    )


def test_schedule_by_date_with_visit_status(client, settings):
    _save(settings, "e1", "appt-1", EncounterStatus.signed)
    # Yesterday's visit for the same appointment id is another visit.
    _save(
        settings,
        "e0",
        "appt-2",
        EncounterStatus.draft_ready,
        # noon yesterday: "24 hours ago" can still be today on a clock-change day
        datetime.combine(TODAY - timedelta(days=1), time(12, 0)).astimezone(UTC),
    )
    today = client.get("/api/schedule").json()
    assert [a["id"] for a in today][:2] == ["appt-1", "appt-2"]
    assert (today[0]["visit_status"], today[0]["encounter_id"]) == ("signed", "e1")
    assert (today[1]["visit_status"], today[1]["encounter_id"]) == ("not_started", "")

    assert [a["note_type"] for a in today][:4] == [
        "sick",
        "recheck",
        "recheck",
        "wellness",
    ]
    # Another day has its own visits, with ids that carry the day.
    day = WEEKDAYS[0]
    other = client.get("/api/schedule", params={"date": day.isoformat()}).json()
    first = other[0]["id"].partition("@")[0]
    assert other[0]["id"] == f"{first}@{day}" and other[0]["start"].startswith(
        day.isoformat()
    )
    assert first != "appt-1"
    _save(settings, "e9", first, EncounterStatus.draft_ready, other[0]["start"])
    other = client.get("/api/schedule", params={"date": day.isoformat()}).json()
    assert other[0]["visit_status"] == "draft_ready"  # a plain id from that day
    appt = anyio.run(MockAdapter().get_appointment, f"{first}@{day}")
    assert appt.id == f"{first}@{day}" and appt.start.date() == day
    assert anyio.run(MockAdapter().get_appointment, "appt-3@not-a-date") is None


def test_each_weekday_has_its_own_visits():
    a = MockAdapter()
    monday = TODAY + timedelta(days=(7 - TODAY.weekday()) % 7 or 7)
    week = [anyio.run(a.get_schedule, monday + timedelta(days=n)) for n in range(7)]
    weekdays = [[(x.patient.name, f"{x.start:%H:%M}") for x in d] for d in week[:5]]
    assert all(weekdays) and len({tuple(d) for d in weekdays}) == 5
    today = [
        (x.patient.name, f"{x.start:%H:%M}") for x in anyio.run(a.get_schedule, TODAY)
    ]
    assert today[0] == ("Biscuit", "09:00") and len(today) == 6  # today as it was
    assert all(d != today for d in weekdays)
    assert len(week[5]) <= 2 and week[6] == []  # Saturday light, Sunday closed
    # Every demo pet is on the week somewhere, for the notes sync.
    assert len(anyio.run(a.patients_seen, TODAY - timedelta(days=90), TODAY)) == 9


def test_demo_texts_and_updates_are_at_clock_times_on_earlier_days():
    a = MockAdapter()
    msgs = anyio.run(a.get_client_messages, "cli-1")
    yesterday = TODAY - timedelta(days=1)
    asked = next(m for m in msgs if "come in tomorrow" in m.text)
    assert asked.at.date() == yesterday and f"{asked.at:%-I:%M %p}" == "4:12 PM"
    booked = next(m for m in msgs if "booked for 9:00 AM tomorrow" in m.text)
    assert booked.at.date() == yesterday and booked.at > asked.at
    since = datetime.combine(yesterday, datetime.min.time())
    updates = anyio.run(a.get_updates, since)
    assert {u["kind"] for u in updates} == {"result", "booked", "reply"}
    assert all(u["at"].startswith(yesterday.isoformat()) for u in updates)


def test_week_strip_with_demo_history(client):
    with client:  # startup seeds the demo clinic's earlier days
        start = TODAY - timedelta(days=10)
        strip = {
            d["date"]: d
            for d in client.get(
                "/api/days",
                params={
                    "from": start.isoformat(),
                    "to": (TODAY + timedelta(days=2)).isoformat(),
                },
            ).json()
        }
        default = client.get("/api/days").json()
        notes = client.get("/api/notes/unsigned").json()
        assert (
            client.get(
                "/api/days", params={"from": "2026-01-02", "to": "2026-01-01"}
            ).status_code
            == 400
        )
    assert list(strip) == sorted(strip) and len(strip) == 13
    assert set(strip[TODAY.isoformat()]) == {
        "date",
        "visits",
        "open",
        "failed",
        "marker",
    }
    assert (
        strip[WEEKDAYS[0].isoformat()]["marker"] == "open"
        and strip[WEEKDAYS[0].isoformat()]["open"] == 1
    )
    assert (
        strip[WEEKDAYS[1].isoformat()]["marker"] == "failed"
        and strip[WEEKDAYS[1].isoformat()]["failed"] == 1
    )
    # The earlier days are done, except a day with a draft ready to sign, which is open.
    ready_days = {n["date"] for n in notes if n["bucket"] == "ready"}
    assert ready_days and ready_days <= {d.isoformat() for d in WEEKDAYS[2:]}
    for d in WEEKDAYS[2:]:
        want = "open" if d.isoformat() in ready_days else "done"
        assert strip[d.isoformat()]["marker"] == want
    tomorrow = TODAY + timedelta(days=1)
    assert strip[tomorrow.isoformat()] == {
        "date": tomorrow.isoformat(),
        "visits": len(anyio.run(MockAdapter().get_schedule, tomorrow)),
        "open": 0,
        "failed": 0,
        "marker": "none",
    }
    assert (
        strip[TODAY.isoformat()]["marker"] == "none"
    )  # nothing worked in Blinq Scribe yet today
    assert len(default) == 7 and date.fromisoformat(default[0]["date"]).weekday() == 0


def test_brief_carries_yesterday_and_flags_mock_updates(client):
    with client:
        brief = client.get("/api/brief", params={"provider_id": "prov-1"}).json()
    assert brief["spoken"].startswith("You have 5 appointments today.")
    unsigned = [i for i in brief["from_yesterday"] if i["kind"] == "unsigned"]
    assert (
        f"From earlier days: {len(unsigned)} notes to sign, 1 text that did not send."
        in brief["spoken"]
    )
    assert (
        brief["date"] == TODAY.isoformat()
        and brief["appointments"]
        and "pending_followups" in brief
    )
    kinds = {i["kind"]: i for i in brief["from_yesterday"]}
    assert set(kinds) == {"unsigned", "failed_text"}
    draft, before = _noted(WEEKDAYS[0])[0], _noted(WEEKDAYS[1])[0]
    assert {
        "text": f"Sign {draft.patient.name}'s note",
        "date": WEEKDAYS[0].isoformat(),
    }.items() <= unsigned[0].items()
    assert (
        kinds["failed_text"]["text"]
        == f"Text to {before.client.full_name} about {before.patient.name} did not send"
    )
    assert {
        "text": "Miso: Fractious, use towel wrap",
        "appointment_id": "appt-2",
        "patient_id": "pat-2",
        "patient_name": "Miso",
        "time": "09:30",
    } in brief["heads_up"]
    assert brief["new_since_yesterday"] and all(
        u["mock"] for u in brief["new_since_yesterday"]
    )
    # Dr. Rivera's brief: Pepper's online booking is Dr. Okafor's, so it isn't here.
    assert {u["kind"] for u in brief["new_since_yesterday"]} == {"result", "reply"}


def test_end_of_day_left_to_do_done_and_tomorrow(client):
    with client:
        eod = client.get(
            "/api/end-of-day",
            params={"date": WEEKDAYS[0].isoformat(), "provider_id": "prov-1"},
        ).json()
        today = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    seen = _rivera(WEEKDAYS[0])
    assert eod["spoken"].startswith(
        f"You saw 2 of {len(seen)} visits today."
    )  # existing fields kept
    # That day's draft, then what was still open from the days before it (the text
    # that didn't send), as To do lists them.
    kinds = [i["kind"] for i in eod["left_to_do"]]
    assert kinds[:2] == ["unsigned", "failed_text"]
    # Then the drafts ready to sign from the days before it.
    assert set(kinds[2:]) <= {"unsigned"}
    assert "1 text did not send." in eod["spoken"]
    signed = _noted(WEEKDAYS[0])[1]
    key = signed.id.partition("@")[0]
    assert eod["done_today"] == [
        {
            "text": f"Signed {signed.patient.name}'s note",
            "encounter_id": f"demo-{key}-{WEEKDAYS[0]:%m%d}",
        }
    ]
    assert isinstance(eod["waiting_on_owners"], list)
    tomorrow = eod["tomorrow"]
    next_day = WEEKDAYS[0] + timedelta(days=1)
    visits = _rivera(next_day)
    assert tomorrow["date"] == next_day.isoformat()
    assert (tomorrow["visits"], tomorrow["first"], tomorrow["last"]) == (
        len(visits),
        f"{visits[0].start:%H:%M}" if visits else "",
        f"{visits[-1].start:%H:%M}" if visits else "",
    )
    assert {p["patient_name"] for p in tomorrow["prepare"]} <= {
        a.patient.name for a in visits
    }
    # Nothing from today yet; what's left is To do's earlier items, said the same way.
    assert {i["kind"] for i in today["left_to_do"]} == {"unsigned", "failed_text"}
    assert today["done_today"] == []
    unsigned = [
        i["patient_name"] for i in today["left_to_do"] if i["kind"] == "unsigned"
    ]
    assert unsigned[0] == _noted(WEEKDAYS[0])[0].patient.name
    assert (
        f"{len(unsigned)} notes still to sign: {', '.join(unsigned)}."
        in today["spoken"]
    )


def test_seed_is_idempotent_and_demo_only(settings):
    store = Store(settings.data_dir)
    added = anyio.run(seed_history, MockAdapter(), store)
    assert 6 <= added <= 8
    assert anyio.run(seed_history, MockAdapter(), store) == 0
    seeded = store.list()
    assert len(seeded) == added and {e.provider_id for e in seeded} == {"prov-1"}
    assert all("@" in e.appointment_id for e in seeded)
    link = next(f for e in seeded for f in e.followups if f.kind.value == "recheck")
    assert link.booking_mode == "link" and link.booking_link.status == "sent"
    assert (datetime.now(UTC) - link.booking_link.sent_at).days >= 3

    class LiveLike(MockAdapter):
        name = "clinic_pims"

    # Another practice's own SQLite store, even when the suite runs on PostgreSQL.
    other = Store(settings.data_dir / "live", database_url="")
    assert anyio.run(seed_history, LiveLike(), other) == 0 and other.list() == []


def test_live_practice_has_no_demo_history(settings):
    from blinqscribe.adapters.mock import MockAdapter

    class LiveLike(MockAdapter):
        name = "clinic_pims"

        async def get_updates(self, since):
            return []

    with TestClient(
        create_app(settings, adapter=LiveLike()),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    ) as client:
        assert {d["marker"] for d in client.get("/api/days").json()} == {"none"}
        brief = client.get("/api/brief").json()
    assert (
        brief["from_yesterday"] == []
        and brief["new_since_yesterday"] == []
        and brief["mock"] is False
    )


def test_remember_in_heads_up_and_on_the_card(client, monkeypatch):
    soon = (TODAY + timedelta(days=5)).isoformat()
    item = {
        "id": "r1",
        "client_id": "cli-1",
        "patient_id": "pat-1",
        "patient_name": "Biscuit",
        "text": "Biscuit's 7th birthday",
        "kind": "birthday",
        "date": soon.replace(soon[:4], "2019"),
        "said_at": "2026-06-24T10:00:00",
        "encounter_id": "e1",
        "expires_at": "",
        "kept_by": "vet",
    }
    far = {
        **item,
        "id": "r2",
        "text": "Moving to Denver",
        "kind": "move",
        "date": "2027-08-01",
    }
    monkeypatch.setattr(
        remember,
        "kept_for_patient",
        lambda store, pid: [item, far] if pid == "pat-1" else [],
    )
    brief = client.get("/api/brief").json()
    hits = [h for h in brief["heads_up"] if "birthday" in h["text"]]
    assert (
        len(hits) == 1
        and hits[0]["patient_name"] == "Biscuit"
        and hits[0]["appointment_id"] == "appt-1"
    )
    assert not any("Denver" in h["text"] for h in brief["heads_up"])
    card = client.get("/api/appointments/appt-1/card").json()
    assert card["remember"] == [
        "Biscuit's 7th birthday (said Jun 24)",
        "Moving to Denver (said Jun 24)",
    ]
    assert card["remember_items"] == [item, far]
    assert "Remember: Biscuit's 7th birthday (said Jun 24)." in card["spoken"]


def test_seed_rerun_after_a_crash_adds_no_second_document(settings):
    store = Store(settings.data_dir)
    added = anyio.run(seed_history, MockAdapter(), store)
    store.run(
        "DELETE FROM meta WHERE key = 'demo_history_seeded'"
    )  # as if startup died before the flag
    anyio.run(seed_history, MockAdapter(), store)
    assert len(store.run("SELECT id FROM documents WHERE patient_id = 'pat-2'")) == 1
    assert len(store.list()) == added


def test_the_demo_history_seeds_on_every_day_of_the_week(tmp_path):
    for n in range(7):
        day = TODAY + timedelta(days=n)
        store = Store(tmp_path / str(n), database_url="")
        assert anyio.run(seed_history, MockAdapter(today=day), store, day) >= 6
        kinds = sorted(f.kind.value for e in store.list() for f in e.followups)
        assert kinds == ["client_update", "client_update", "recheck"]
        # Ready to sign is never empty, and never holds a pet on today's schedule.
        on_today = {
            a.patient.id for a in anyio.run(MockAdapter(today=day).get_schedule, day)
        }
        ready = [
            e
            for e in store.list()
            if e.status == EncounterStatus.draft_ready and not e.followups
        ]
        assert ready and not {e.patient_id for e in ready} & on_today
        # Seeded visits are on their day's schedule, so each day shows them.
        for e in store.list():
            appts = anyio.run(
                MockAdapter(today=day).get_schedule,
                date.fromisoformat(e.appointment_id.partition("@")[2]),
            )
            assert e.appointment_id in {a.id for a in appts}


def test_unsigned_notes_in_their_buckets(client):
    """Every note not signed yet, any day, newest first: Ready to sign when drafted
    with nothing to confirm and every follow up decided; otherwise Pending, saying
    what is left."""
    with client:
        notes = client.get("/api/notes/unsigned").json()
        today_pets = {
            a["patient"]["id"]
            for a in client.get(
                "/api/schedule", params={"provider_id": "prov-1"}
            ).json()
        }
    assert [n["date"] for n in notes] == sorted(
        (n["date"] for n in notes), reverse=True
    )
    ready = [n for n in notes if n["bucket"] == "ready"]
    pending = [n for n in notes if n["bucket"] == "pending"]
    assert len(ready) == 2 and not {n["patient_id"] for n in ready} & today_pets
    assert all(n["reason"] == "" and n["assessment"] for n in ready)
    # Last weekday's draft has its owner update still to approve.
    (luna,) = pending
    assert luna["date"] == WEEKDAYS[0].isoformat()
    assert luna["followups_undecided"] == 1
    assert luna["reason"] == "1 follow up to decide"
    assert {n["waiting_days"] for n in notes} == {
        (TODAY - date.fromisoformat(n["date"])).days for n in notes
    }


def test_a_note_to_confirm_or_not_drafted_is_pending(settings, client):
    from blinqscribe.schemas import SoapNote

    _save(
        settings,
        "e-confirm",
        "appt-1",
        EncounterStatus.draft_ready,
        note=SoapNote(
            subjective="Head shaking.",
            objective="",
            assessment="Otitis externa, right.",
            plan="Ear drops [confirm: product and dose]",
            client_summary="",
        ),
    )
    _save(settings, "e-recorded", "appt-3", EncounterStatus.recording)
    rows = {
        n["encounter_id"]: n
        for n in client.get(
            "/api/notes/unsigned", params={"provider_id": "prov-1"}
        ).json()
    }
    assert rows["e-confirm"]["bucket"] == "pending"
    assert rows["e-confirm"]["reason"] == "1 thing to confirm"
    assert rows["e-confirm"]["assessment"] == "Otitis externa, right."
    assert rows["e-recorded"]["bucket"] == "pending"
    assert rows["e-recorded"]["reason"] == "Not drafted yet"


def test_days_after_today_never_repeat_todays_pets():
    """Tomorrow and the rest of the week ahead have their own visits: no pet seen
    today comes back, so no recheck lands before it is due (Biscuit's is in 14
    days)."""
    adapter = MockAdapter()
    today = {a.patient.id for a in anyio.run(adapter.get_schedule, TODAY)}
    for n in range(1, 15):
        day = TODAY + timedelta(days=n)
        pets = {a.patient.id for a in anyio.run(adapter.get_schedule, day)}
        assert not pets & today, day
    # Earlier days keep their own visits (the demo history is on them).
    assert anyio.run(adapter.get_schedule, WEEKDAYS[0])


def test_a_recheck_that_was_due_and_not_booked_is_said_plainly(settings, client):
    from blinqscribe.schemas import FollowUp, FollowUpKind, FollowUpStatus

    signed = datetime.now(UTC) - timedelta(days=40)
    _save(
        settings,
        "e-old",
        "wed-2@2026-09-23",
        EncounterStatus.signed,
        when=signed,
        signed_at=signed,
        followups=[
            FollowUp(
                id="f1",
                kind=FollowUpKind.recheck,
                reason="Recheck the ears",
                due_in_days=14,
                status=FollowUpStatus.approved,
            )
        ],
    )
    card = client.get("/api/appointments/appt-1/card").json()
    due = (signed + timedelta(days=14)).date()
    assert f"Recheck was due {due:%b %-d}, not booked." in card["why"]
    assert card["prep"][0] == "Recheck overdue"
