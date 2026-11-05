"""End to end in mock mode: schedule -> consent -> transcript -> note -> follow ups ->
sign."""

import asyncio
from datetime import date, datetime, timedelta

import anyio
import pytest
from conftest import _confirm_first
from fastapi.testclient import TestClient

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.schemas import WriteBackResult


def test_health(client):
    body = client.get("/health").json()
    assert body["ai"] == "mock" and body["practice"] == "mock"


def test_schedule(client):
    appts = client.get("/api/schedule").json()
    assert len(appts) == 6
    assert appts[0]["patient"]["name"] == "Biscuit"
    assert (
        len(client.get("/api/schedule", params={"provider_id": "prov-2"}).json()) == 1
    )


def test_consent_required_before_any_audio(client):
    # The visit opens before the owner is asked; no audio is kept until they agree.
    r = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": False}
    )
    assert r.status_code == 200 and r.json()["consent_recorded"] is False
    eid = r.json()["id"]
    wav = {"file": ("c.wav", b"RIFF0000WAVE", "audio/wav")}
    r = client.post(f"/api/encounters/{eid}/audio", files=wav)
    assert r.status_code == 409 and "agreed to recording" in r.json()["detail"]
    enc = client.post(f"/api/encounters/{eid}/consent").json()
    assert enc["consent_recorded"] is True
    # Saying yes twice saves it once.
    assert client.post(f"/api/encounters/{eid}/consent").json()["consent_recorded"]


def test_full_visit(client):
    enc = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()
    eid = enc["id"]

    assert (
        client.post(f"/api/encounters/{eid}/draft").status_code == 400
    )  # nothing to draft yet

    sample = client.get("/api/sample-transcript").json()["text"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": sample})

    enc = client.post(f"/api/encounters/{eid}/draft").json()
    note = enc["note"]
    assert enc["status"] == "draft_ready"
    assert note["vitals"]["weight"] == "74 lb"
    assert note["vitals"]["temperature"] == "101.8 F"
    assert "Cefpodoxime 100 mg" in note["medications"]
    assert "scratching" in note["subjective"]

    rechecks = [f for f in enc["followups"] if f["kind"] == "recheck"]
    assert len(rechecks) == 1 and rechecks[0]["due_in_days"] == 14
    slots = rechecks[0]["suggested_slots"]
    assert 1 <= len(slots) <= 3
    target = date.today() + timedelta(days=14)
    assert all(
        abs((date.fromisoformat(s["start"][:10]) - target).days) <= 2 for s in slots
    )
    assert "Biscuit" in rechecks[0]["message_draft"]

    fid = rechecks[0]["id"]
    enc = client.post(
        f"/api/encounters/{eid}/followups/{fid}", json={"action": "approve"}
    ).json()
    assert enc["followups"][0]["status"] == "approved"

    note["plan"] += " Owner agreed."
    client.put(f"/api/encounters/{eid}/note", json=note)

    signed = client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()
    assert signed["write_back"]["status"] == "written"
    assert (
        client.put(f"/api/encounters/{eid}/note", json=note).status_code == 409
    )  # locked after signing

    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    # The recheck is a booking link by default: it goes out with the signature, not at
    # approval.
    assert actions == [
        "encounter_started",
        "transcript_edited",
        "note_drafted",
        "followup_approved",
        "note_edited",
        "note_edited",  # the vet confirms the one thing to confirm, then signs
        "note_signed",
        "text_skipped",
    ]


def test_photo_upload(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-3", "consent_recorded": True}
    ).json()["id"]
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 200 + b"\xff\xd9"
    enc = client.post(
        f"/api/encounters/{eid}/photos",
        files={"file": ("paw.jpg", jpeg, "image/jpeg")},
        data={"hint": "sutures right front paw"},
    ).json()
    photo = enc["photos"][0]
    assert photo["caption"] == "sutures right front paw"
    assert len(photo["segments"]) == 1
    assert client.get(f"/api/encounters/{eid}/photos/{photo['id']}").status_code == 200


def test_audio_chunk_mock(client):
    eid = client.post(
        "/api/encounters",
        json={
            "appointment_id": "appt-1",
            "consent_recorded": True,
            "source": "glasses",
        },
    ).json()["id"]
    r = client.post(
        f"/api/encounters/{eid}/audio",
        files={"file": ("c0.m4a", b"fake-audio", "audio/mp4")},
        data={"chunk_index": "0"},
    )
    assert r.status_code == 200 and r.json()["source"] == "glasses"


def test_api_token(settings):
    from dataclasses import replace

    c = TestClient(create_app(replace(settings, api_token="s3cret")))
    assert c.get("/api/schedule").status_code == 401
    assert (
        c.get("/api/schedule", headers={"Authorization": "Bearer s3cret"}).status_code
        == 200
    )


def test_end_of_day_empty(client):
    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    assert eod["spoken"] == "You saw 0 of 5 visits today."
    assert eod["visits_seen"] == 0 and len(eod["not_started"]) == 5


def _drafted(client, appt="appt-1"):
    eid = client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    return eid, next(f for f in enc["followups"] if f["kind"] == "recheck")


def test_approve_recheck_with_time_books_it(client):
    eid, recheck = _drafted(client)
    start = recheck["suggested_slots"][1]["start"]
    enc = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={"action": "approve", "slot_start": start},
    ).json()
    f = next(x for x in enc["followups"] if x["id"] == recheck["id"])
    assert f["status"] == "approved"
    assert (
        f["booking"]["status"] == "written"
        and f["booking"]["pims_id"] == f"mock-appt-{f['id']}"
    )
    assert f["booked_slot"]["start"] == start
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-3:] == ["followup_approved", "recheck_booked", "text_skipped"]
    # already booked: a second booking is refused
    r = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={"action": "book", "slot_start": start},
    )
    assert r.status_code == 409


def test_booking_rules(client):
    eid, recheck = _drafted(client)
    url = f"/api/encounters/{eid}/followups/{recheck['id']}"
    # a time the vet was not offered is refused, and nothing changes
    assert (
        client.post(
            url, json={"action": "approve", "slot_start": "2030-01-01T09:00:00"}
        ).status_code
        == 400
    )
    assert (
        client.get(f"/api/encounters/{eid}/audit").json()[-1]["action"]
        == "note_drafted"
    )
    # approve with the link only, then book later
    enc = client.post(url, json={"action": "approve"}).json()
    assert (
        next(x for x in enc["followups"] if x["id"] == recheck["id"])["booking"] is None
    )
    assert client.post(url, json={"action": "book"}).status_code == 400  # needs a time
    enc = client.post(
        url,
        json={"action": "book", "slot_start": recheck["suggested_slots"][0]["start"]},
    ).json()
    assert (
        next(x for x in enc["followups"] if x["id"] == recheck["id"])["booking"][
            "status"
        ]
        == "written"
    )


def test_sign_writes_back_once(client):
    eid, _ = _drafted(client)
    signed = client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()
    assert signed["encounter"]["write_back"]["pims_id"] == f"mock-note-{eid}"
    assert (
        client.post(
            f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
        ).status_code
        == 409
    )


class _FlakyAdapter(MockAdapter):
    """Mock clinic whose practice system misbehaves in the ways a live one can."""

    def __init__(self, **kw):
        super().__init__(**kw)
        self.lost_appointment = False

    async def write_back(self, encounter):
        raise ConnectionError("PIMS unreachable")

    async def get_appointment(self, appointment_id):
        return (
            None
            if self.lost_appointment
            else await super().get_appointment(appointment_id)
        )

    async def book_appointment(self, encounter, followup, slot, appt):
        # The practice system already held a different time for this follow up.
        moved = slot.start + timedelta(hours=1)
        return WriteBackResult(
            ok=True, status="written", pims_id="X1", start=moved, detail="Booked"
        )


@pytest.fixture
def flaky(settings):
    adapter = _FlakyAdapter()
    return TestClient(create_app(settings, adapter=adapter)), adapter


def test_sign_never_loses_a_note_when_the_pims_errors(flaky):
    client, _ = flaky
    eid, _ = _drafted(client)
    r = client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    assert r.status_code == 200
    enc = r.json()["encounter"]
    # Signed and kept: the save is tried again every 5 minutes, then goes to the
    # front desk after an hour (tests/test_sign_and_send.py).
    assert enc["status"] == "signed" and enc["write_back"]["status"] == "failed"
    last = client.get(f"/api/encounters/{eid}/audit").json()[-1]
    assert last["action"] == "note_signed" and last["detail"]["write_back"] == "failed"
    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    assert "couldn't be saved to the PIMS yet" in eod["spoken"]


def test_booked_time_comes_from_the_pims(flaky):
    client, _ = flaky
    eid, recheck = _drafted(client)
    slot = recheck["suggested_slots"][0]
    enc = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={"action": "approve", "slot_start": slot["start"]},
    ).json()
    f = next(x for x in enc["followups"] if x["id"] == recheck["id"])
    assert f["booked_slot"]["start"] != slot["start"]
    assert (
        f["booked_slot"]["start"]
        == (datetime.fromisoformat(slot["start"]) + timedelta(hours=1)).isoformat()
    )


def test_lost_appointment_queues_the_booking_and_keeps_the_approval(flaky):
    client, adapter = flaky
    eid, recheck = _drafted(client)
    adapter.lost_appointment = True
    r = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={
            "action": "approve",
            "slot_start": recheck["suggested_slots"][0]["start"],
        },
    )
    assert r.status_code == 200
    stored = client.get(f"/api/encounters/{eid}").json()
    f = next(x for x in stored["followups"] if x["id"] == recheck["id"])
    assert f["status"] == "approved" and f["booking"]["status"] == "queued_for_staff"
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-3:] == [
        "followup_approved",
        "recheck_booking_queued",
        "text_skipped",
    ]


def test_redo_draft_is_locked_once_a_follow_up_is_approved(client):
    eid, recheck = _drafted(client)
    client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}", json={"action": "approve"}
    )
    assert client.post(f"/api/encounters/{eid}/draft").status_code == 409


def test_booking_later_texts_the_confirmed_time(client):
    eid, recheck = _drafted(client)
    url = f"/api/encounters/{eid}/followups/{recheck['id']}"
    client.post(url, json={"action": "approve"})
    client.post(
        url,
        json={"action": "book", "slot_start": recheck["suggested_slots"][0]["start"]},
    )
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-2:] == ["recheck_booked", "text_skipped"]  # texting is off in tests


class _SlowBookingAdapter(MockAdapter):
    async def book_appointment(self, encounter, followup, slot, appt):
        await asyncio.sleep(0.2)  # a slow practice system
        return await super().book_appointment(encounter, followup, slot, appt)


def test_sign_during_a_slow_booking_keeps_both(settings):
    import httpx

    app = create_app(settings, adapter=_SlowBookingAdapter())
    eid, recheck = _drafted(TestClient(app))
    _confirm_first(TestClient(app), eid, None)

    async def race():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://t"
        ) as c:
            approve = c.post(
                f"/api/encounters/{eid}/followups/{recheck['id']}",
                json={
                    "action": "approve",
                    "slot_start": recheck["suggested_slots"][0]["start"],
                },
            )
            sign = c.post(
                f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
            )
            return await asyncio.gather(approve, sign)

    a, s = anyio.run(race)
    assert a.status_code == 200 and s.status_code == 200
    enc = TestClient(app).get(f"/api/encounters/{eid}").json()
    f = next(x for x in enc["followups"] if x["id"] == recheck["id"])
    assert enc["status"] == "signed" and enc["write_back"]["status"] == "written"
    assert f["booking"]["status"] == "written" and f["booked_slot"] is not None
