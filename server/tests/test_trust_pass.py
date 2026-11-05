"""The trust pass: the prescription the front desk enters (a tracked task), one
reminder for a booking link nobody booked, one-tap speaker names and how much audio
a visit has."""

import io
import wave
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfoNotFoundError

import anyio
import pytest
from fastapi.testclient import TestClient
from test_permissions import drafted, gql, h, invite

from blinqscribe import booking_links, pims_sync
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.jobs import Activities, Services
from blinqscribe.schemas import Encounter, SoapNote
from blinqscribe.sms import Texter
from blinqscribe.store import Store


@pytest.fixture
def app(settings):
    return create_app(replace(settings, sms_mode="preview"))


@pytest.fixture
def client(app):
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000)) as c:
        yield c


@pytest.fixture
def team(client):
    admin = invite(client, "maya", "Maya Admin", role="admin")
    by = h(admin)
    return {
        "rivera": invite(client, "arivera", "Dr. Ana Rivera", "prov-1", headers=by),
        "okafor": invite(client, "sokafor", "Dr. Sam Okafor", "prov-2", headers=by),
        "front": invite(
            client, "desk", "Sam Front Desk", role="front_office", headers=by
        ),
    }


def _signed(client, token):
    enc = drafted(client, token)
    for f in enc["followups"]:
        client.post(
            f"/api/encounters/{enc['id']}/followups/{f['id']}",
            json={"action": "approve"},
            headers=h(token),
        )
    r = client.post(
        f"/api/encounters/{enc['id']}/sign", json={"send": True}, headers=h(token)
    )
    assert r.status_code == 200, r.text
    return r.json()["encounter"]


# ---------- the prescription: a front desk task ----------


def test_prescription_task_names_the_dosed_drugs():
    def task(*meds):
        enc = Encounter(
            id="e",
            appointment_id="a",
            patient_id="p",
            patient_name="Biscuit",
            consent_recorded=True,
            created_at=datetime.now(UTC),
            note=SoapNote(medications=list(meds)),
        )
        return pims_sync.prescription_task(enc)

    assert task() is None
    rx = task("Cefpodoxime 100 mg", "Ear drops, right ear")
    assert rx and rx.text == "Enter Cefpodoxime for Biscuit in the PIMS"
    assert rx.medications == ["Cefpodoxime 100 mg", "Ear drops, right ear"]
    rx = task("Amlodipine 0.625 mg PO SID", "Gabapentin 100 mg")
    assert rx and rx.text == "Enter Amlodipine and Gabapentin for Biscuit in the PIMS"
    rx = task("Ear drops, right ear")
    assert rx and rx.text == "Enter Ear drops for Biscuit in the PIMS"


def test_front_desk_marks_the_prescription_entered(client, team, settings):
    enc = _signed(client, team["rivera"])
    eid = enc["id"]
    task = enc["prescription_task"]
    assert task["text"] == "Enter Cefpodoxime for Biscuit in the PIMS"
    assert task["done_at"] is None
    # On To do at once (it can't wait for tomorrow), for the front desk and the vet.
    for who in ("front", "rivera"):
        todo = client.get("/api/brief", headers=h(team[who])).json()["from_yesterday"]
        rx = [i for i in todo if i["kind"] == "prescription"]
        assert [i["label"] for i in rx] == [task["text"]], who
        assert rx[0]["encounter_id"] == eid and "Cefpodoxime 100 mg" in rx[0]["detail"]
    # Another vet can't mark someone else's; the front desk can.
    r = client.post(
        f"/api/encounters/{eid}/prescription/entered", headers=h(team["okafor"])
    )
    assert r.status_code == 403
    r = client.post(
        f"/api/encounters/{eid}/prescription/entered", headers=h(team["front"])
    )
    assert r.status_code == 200, r.text
    done = r.json()["prescription_task"]
    assert done["done_by"] == "Sam Front Desk" and done["done_by_user"] == "desk"
    first_at = done["done_at"]
    assert first_at
    # Marking it again keeps the first, and it leaves To do.
    again = client.post(
        f"/api/encounters/{eid}/prescription/entered", headers=h(team["rivera"])
    ).json()["prescription_task"]
    assert again["done_at"] == first_at and again["done_by"] == "Sam Front Desk"
    todo = client.get("/api/brief", headers=h(team["front"])).json()["from_yesterday"]
    assert not [i for i in todo if i["kind"] == "prescription"]
    log = Store(settings.data_dir, settings.database_url).audit_log(eid)
    entered = [a for a in log if a["action"] == "prescription_entered"]
    assert len(entered) == 1 and entered[0]["detail"]["by"] == "Sam Front Desk"


def test_prescription_over_graphql(client, team):
    enc = _signed(client, team["rivera"])
    data = gql(
        client,
        team["front"],
        "mutation($id: String!) { mark_prescription_entered(encounter_id: $id) "
        "{ prescription_task { text done_by done_at } } }",
        id=enc["id"],
    )
    task = data["data"]["mark_prescription_entered"]["prescription_task"]
    assert task["done_by"] == "Sam Front Desk" and task["done_at"]


def test_a_note_with_no_medications_has_no_task(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-3", "consent_recorded": True}
    ).json()["id"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": "Vet: All healed."})
    client.post(f"/api/encounters/{eid}/draft")
    enc = client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. R"}).json()
    assert enc["encounter"]["prescription_task"] is None
    r = client.post(f"/api/encounters/{eid}/prescription/entered")
    assert r.status_code == 404


# ---------- one reminder for a booking link nobody booked ----------


def _linked(client, remind=None):
    """Biscuit's recheck approved as a booking link, then signed so it goes out."""
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    f = next(f for f in enc["followups"] if f["kind"] == "recheck")
    body = {"action": "approve", "booking_mode": "link"}
    if remind is not None:
        body["remind_unbooked"] = remind
    client.post(f"/api/encounters/{eid}/followups/{f['id']}", json=body)
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    return eid, f["id"]


def _age_link(store, eid, days):
    def older(e):
        for f in e.followups:
            if f.booking_link and f.booking_link.sent_at:
                f.booking_link.sent_at -= timedelta(days=days)

    store.update(eid, older)


def _check(app, settings):
    store = Store(settings.data_dir, settings.database_url)
    services = Services(
        store, MockAdapter(), Texter(replace(settings, sms_mode="preview"))
    )
    return store, anyio.run(Activities(services).send_reminders)


def test_one_reminder_goes_three_days_after_an_unbooked_link(client, app, settings):
    eid, fid = _linked(client)
    store = Store(settings.data_dir, settings.database_url)
    f = next(x for x in store.get(eid).followups if x.id == fid)
    assert f.remind_unbooked is True and f.booking_link.status == "sent"
    # Not yet: two days in.
    _age_link(store, eid, 2)
    assert _check(app, settings)[1] == 0
    _age_link(store, eid, 1)
    store, sent = _check(app, settings)
    assert sent == 1
    f = next(x for x in store.get(eid).followups if x.id == fid)
    assert f.reminder and f.reminder.status == "preview" and f.reminder.at
    assert f.reminder.text.startswith(
        "Hi Jordan, a reminder to book Biscuit's recheck."
    )
    # Never twice.
    assert _check(app, settings)[1] == 0
    log = [a for a in store.audit_log(eid) if a["action"] == "booking_link_reminder"]
    assert len(log) == 1 and log[0]["detail"]["status"] == "preview"
    shown = client.get(f"/api/encounters/{eid}").json()
    assert next(x for x in shown["followups"] if x["id"] == fid)["reminder"]["text"]


def test_no_reminder_when_booked_or_turned_off(client, app, settings):
    off, _ = _linked(client, remind=False)
    booked, fid = _linked(client)
    store = Store(settings.data_dir, settings.database_url)

    def book(e):
        for f in e.followups:
            if f.id == fid and f.booking_link:
                f.booking_link.status = "booked"

    store.update(booked, book)
    for eid in (off, booked):
        _age_link(store, eid, 4)
    assert _check(app, settings)[1] == 0
    for eid in (off, booked):
        assert all(f.reminder is None for f in store.get(eid).followups)


def test_reminder_due_needs_a_sent_link():
    from blinqscribe.schemas import BookingLink, FollowUp, FollowUpKind, FollowUpStatus

    now = datetime.now(UTC)
    f = FollowUp(
        id="f1",
        kind=FollowUpKind.recheck,
        reason="Recheck",
        status=FollowUpStatus.approved,
        booking_mode="link",
        remind_unbooked=True,
        booking_link=BookingLink(status="queued"),
    )
    assert not booking_links.reminder_due(f, now)  # not sent yet
    f.booking_link = BookingLink(
        status="sent", sent_at=now - timedelta(days=15), expires_at=now - timedelta(1)
    )
    assert not booking_links.reminder_due(f, now)  # expired: no reminder
    f.booking_link = BookingLink(status="sent", sent_at=now - timedelta(days=3))
    assert booking_links.reminder_due(f, now)


# ---------- one tap: Tech, Owner, Other ----------


def test_one_tap_owner_and_other(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": "Speaker 3: He ate grass.\nSpeaker 4: I'll get the leash."},
    )
    r = client.post(f"/api/encounters/{eid}/speakers/speaker-3", json={"role": "owner"})
    seg = next(s for s in r.json()["segments"] if s["speaker_id"] == "speaker-3")
    assert (seg["speaker_name"], seg["role"]) == ("Jordan Lee", "owner")
    r = client.post(f"/api/encounters/{eid}/speakers/speaker-4", json={"role": "other"})
    seg = next(s for s in r.json()["segments"] if s["speaker_id"] == "speaker-4")
    assert (seg["speaker_name"], seg["role"]) == ("Other", "other")


# ---------- how much audio the visit has ----------


def _wav(seconds: float, rate: int = 16000) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\0\0" * int(seconds * rate))
    return out.getvalue()


def test_audio_seconds_add_up_from_each_part(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    assert client.get(f"/api/encounters/{eid}").json()["audio_seconds"] == 0
    for i in range(2):
        r = client.post(
            f"/api/encounters/{eid}/audio",
            files={"file": (f"c{i}.wav", _wav(10.5))},
            data={"chunk_index": str(i)},
        )
        assert r.status_code == 200, r.text
    assert r.json()["audio_seconds"] == pytest.approx(21)


# ---------- trust bugs: a follow up said twice, runaway text, the clinic's day


def test_a_recheck_said_twice_is_one_and_runaway_text_is_replaced():
    from blinqscribe.adapters.mock import MockAdapter as Mock
    from blinqscribe.llm import runaway
    from blinqscribe.scribe import NoteDraft, plan_followups

    appt = anyio.run(Mock().get_appointment, "appt-1")
    junk = "ear ear recheck the the ear " * 20
    draft = NoteDraft.model_validate(
        {
            "followups": [
                {
                    "kind": "recheck",
                    "reason": "Recheck right ear in 2 weeks",
                    "due_in_days": 14,
                    "message_draft": junk,
                },
                {
                    "kind": "recheck",
                    "reason": "Ear recheck",
                    "due_in_days": 15,
                    "message_draft": "Hi Jordan, see you in two weeks.",
                },
                {
                    "kind": "client_update",
                    "reason": "Send the ear cleaning steps",
                    "message_draft": "Hi Jordan, here's how to clean his ear.",
                },
            ]
        }
    )
    out = anyio.run(plan_followups, draft, appt, Mock())
    assert [f.kind.value for f in out] == ["recheck", "client_update"]
    recheck = out[0]
    assert recheck.reason == "Recheck right ear in 2 weeks"
    # The runaway text became the clinic's own template.
    assert recheck.message_draft.startswith("Hi Jordan, Dr. Rivera would like to see")
    assert out[1].message_draft == "Hi Jordan, here's how to clean his ear."
    assert runaway(junk) and runaway("x" * 400) and runaway("@@## !! ?? ...")
    assert not runaway("Hi Jordan, Biscuit is booked for 9:00 AM tomorrow.")


def test_the_clinic_time_zone_decides_the_day(monkeypatch):
    import time as clock

    from blinqscribe.day import visit_day
    from blinqscribe.notes import local_naive, use_clinic_timezone

    monkeypatch.setenv("TZ", "UTC")
    clock.tzset()
    try:
        late = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)  # 6:30 PM Nov 1 in California
        assert local_naive(late).date().isoformat() == "2026-11-02"  # a UTC host
        use_clinic_timezone("America/Los_Angeles")
        assert local_naive(late).date().isoformat() == "2026-11-01"
        enc = Encounter(
            id="e",
            appointment_id="appt-1",
            patient_id="p",
            consent_recorded=True,
            created_at=late,
        )
        assert visit_day(enc).isoformat() == "2026-11-01"
        with pytest.raises(ZoneInfoNotFoundError):
            use_clinic_timezone("Not/AZone")
    finally:
        monkeypatch.undo()
        clock.tzset()


def test_a_weight_written_in_the_visit_is_the_latest_with_the_change(client):
    from datetime import date

    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    before = client.get("/api/patients/pat-1/panel").json()["weight"]
    assert before["latest"]["value"] == 72 and before["previous"] is None
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    today = date.today().isoformat()
    for path in ("/api/patients/pat-1/panel", "/api/patients/pat-1/profile"):
        w = client.get(path).json()["weight"]
        assert w["latest"] == {"date": today, "value": 74, "unit": "lb"}, path
        assert w["previous"] == {**before["latest"]}, path
        assert w["history"][0]["note"] == "This visit"


def test_recent_visits_list_each_visit_once_and_never_today_as_last(client):
    for _ in range(2):  # the same visit started and signed twice
        eid = client.post(
            "/api/encounters",
            json={"appointment_id": "appt-6", "consent_recorded": True},
        ).json()["id"]
        client.post(f"/api/encounters/{eid}/transcript", json={"text": "Vet: Sore."})
        client.post(f"/api/encounters/{eid}/draft")
        client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. R"})
    rows = client.get("/api/patients/pat-6/panel").json()["recent_visits"]
    days = [r["date"][:10] for r in rows]
    assert len(days) == len(set(days))
    # Biscuit's record: Waffles' last visit is the one before today.
    biscuit = client.get("/api/patients/pat-1/profile").json()
    waffles = next(p for p in biscuit["other_pets"] if p["name"] == "Waffles")
    assert waffles["last_visit"]["date"] < datetime.now().date().isoformat()
