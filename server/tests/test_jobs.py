"""Storage on Peewee and Alembic, and the background jobs: in the server without
Temporal, and as Temporal workflows when the Temporal CLI is installed."""

import shutil
import sqlite3
import uuid
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import anyio
import pytest
from fastapi.testclient import TestClient

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.jobs import Activities, Jobs, Services, send_text
from blinqscribe.schemas import EncounterStatus, WriteBackResult
from blinqscribe.sms import Texter
from blinqscribe.store import Store
from blinqscribe.workflows import (
    TASK_QUEUE,
    WORKFLOWS,
    BookingLinkCheck,
    TextsAfterSigning,
)


@pytest.fixture
def preview(settings):
    return TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _approved_link(client):
    """A drafted visit whose recheck link is approved and queued for the signature."""
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    fid = next(f["id"] for f in enc["followups"] if f["kind"] == "recheck")
    client.post(f"/api/encounters/{eid}/followups/{fid}", json={"action": "approve"})
    return eid, fid


def _services(settings):
    return Services(
        Store(settings.data_dir),
        MockAdapter(),
        Texter(replace(settings, sms_mode="preview")),
    )


# ---------- storage ----------


def test_lookup_columns_filter_the_list(preview, settings):
    eid, _ = _approved_link(preview)
    store = Store(settings.data_dir)
    enc = store.get(eid)
    assert [e.id for e in store.list(group_id=eid)] == [eid]
    assert [e.id for e in store.list(patient_id=enc.patient_id)] == [eid]
    assert [e.id for e in store.list(appointment_id="appt-1")] == [eid]
    assert [e.id for e in store.list(visit_day=date.today())] == [eid]
    assert store.list(patient_id="nobody") == []
    assert store.list(visit_day=date.today() - timedelta(days=400)) == []


def test_a_database_from_before_migrations_is_adopted(tmp_path):
    # The tables as the server made them before Alembic, with a visit in them.
    old = sqlite3.connect(tmp_path / "blinqscribe.db")
    old.executescript(
        """
        CREATE TABLE encounters (id TEXT PRIMARY KEY, body TEXT NOT NULL);
        CREATE TABLE audit (ts TEXT NOT NULL, actor TEXT NOT NULL,
            action TEXT NOT NULL, encounter_id TEXT, detail TEXT);
        CREATE TABLE remember (id TEXT PRIMARY KEY, visit_key TEXT NOT NULL,
            client_id TEXT NOT NULL, patient_id TEXT NOT NULL,
            kept INTEGER NOT NULL DEFAULT 0, expires_at TEXT, body TEXT NOT NULL);
        """
    )
    body = (
        '{"id": "e1", "appointment_id": "appt-1@2026-10-20", "patient_id": "pat-1",'
        ' "consent_recorded": true, "created_at": "2026-10-20T15:00:00+00:00"}'
    )
    old.execute("INSERT INTO encounters VALUES ('e1', ?)", (body,))
    for action in ("encounter_started", "note_signed"):
        old.execute(
            "INSERT INTO audit VALUES ('2026-10-20T15:00:00+00:00', 'vet', ?, 'e1',"
            " '{}')",
            (action,),
        )
    for item in ("r2", "r1"):  # said in this order
        old.execute(
            "INSERT INTO remember (id, visit_key, client_id, patient_id, body) "
            "VALUES (?, 'e1', 'cli-1', 'pat-1', ?)",
            (item, f'{{"id": "{item}"}}'),
        )
    old.commit()
    old.close()

    store = Store(tmp_path, database_url="")
    assert store.run("SELECT version_num FROM alembic_version")
    [enc] = store.list(visit_day=date(2026, 10, 20))
    assert enc.id == "e1" and store.list(group_id="e1")[0].id == "e1"
    assert [a["action"] for a in store.audit_log("e1")] == [
        "encounter_started",
        "note_signed",
    ]
    store.audit("vet", "note_edited", "e1")
    assert store.audit_log("e1")[-1]["action"] == "note_edited"
    assert [i for i, _, _ in store.remember_for_visit("e1")] == ["r2", "r1"]


# ---------- background work without Temporal ----------


def test_signing_sends_queued_links_in_the_server(preview):
    eid, fid = _approved_link(preview)
    out = preview.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. A"})
    f = next(x for x in out.json()["encounter"]["followups"] if x["id"] == fid)
    assert f["booking_link"]["status"] == "sent" and f["sms"]["status"] == "preview"


def test_booking_link_check_saves_expired(preview, settings):
    eid, fid = _approved_link(preview)
    preview.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. A"})
    services = _services(settings)
    activities = Activities(services)
    assert anyio.run(activities.check_booking_links) == 0

    enc = services.store.get(eid)
    f = next(x for x in enc.followups if x.id == fid)
    f.booking_link.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    services.store.save(enc)
    assert anyio.run(activities.check_booking_links) == 1
    assert anyio.run(activities.check_booking_links) == 0
    f = next(x for x in services.store.get(eid).followups if x.id == fid)
    assert f.booking_link.status == "expired"
    assert services.store.audit_log(eid)[-1]["action"] == "booking_link_expired"


def test_remember_expiry_and_note_sync_run_in_the_server(client, settings):
    with client:  # startup syncs the demo clinic's notes, without Temporal
        pass
    services = _services(settings)
    jobs = Jobs(replace(settings, temporal_address=""), services)
    report = anyio.run(jobs.sync_notes, 30)
    assert report["days"] == 30 and services.store.notes()
    services.store.add_remember(
        "v1", "cli-1", "pat-1", [{"id": "old", "said_at": "2025-01-01"}]
    )
    services.store.set_remember_kept("old", True, "2000-01-01T00:00:00+00:00", {})
    assert anyio.run(jobs.activities.expire_remember) == 1
    assert services.store.kept_remember(client_id="cli-1") == []


# ---------- no lost updates, nothing stranded ----------


def _followup(store, eid, fid):
    return next(x for x in store.get(eid).followups if x.id == fid)


def test_a_text_sent_late_keeps_a_booking_saved_meanwhile(preview, settings):
    eid, fid = _approved_link(preview)
    services = _services(settings)
    stale = services.store.get(eid)  # the worker read it before the booking

    def booked(now):
        f = next(x for x in now.followups if x.id == fid)
        f.booking = WriteBackResult(ok=True, status="written", pims_id="appt-9")

    services.store.update(eid, booked)
    f = next(x for x in stale.followups if x.id == fid)
    anyio.run(send_text, services, stale, f, None)
    saved = _followup(services.store, eid, fid)
    assert saved.booking.pims_id == "appt-9"  # not wiped by the stale copy
    assert saved.sms.status == "preview" and saved.booking_link.status == "sent"
    assert f.sms.status == "preview"  # the caller's copy has what was saved


def test_booking_keeps_a_link_texted_while_it_was_being_made(settings):
    class SlowPims(MockAdapter):
        async def book_appointment(self, enc, f, slot, appt):
            # The worker texts the link while the practice system is booking.
            services = _services(settings)
            now = services.store.get(enc.id)
            link = next(x for x in now.followups if x.id == f.id)
            await send_text(services, now, link, None)
            return await super().book_appointment(enc, f, slot, appt)

    client = TestClient(
        create_app(replace(settings, sms_mode="preview"), adapter=SlowPims()),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid, fid = _approved_link(client)
    slot = _followup(Store(settings.data_dir), eid, fid).suggested_slots[0]
    out = client.post(
        f"/api/encounters/{eid}/followups/{fid}",
        json={"action": "book", "slot_start": slot.start.isoformat()},
    ).json()
    f = next(x for x in out["followups"] if x["id"] == fid)
    # The text the owner already got is kept, and its link shows booked.
    assert f["booking"]["status"] == "written" and f["sms"]["status"] == "preview"
    assert f["booking_link"]["status"] == "booked"


def test_signing_when_temporal_is_down_still_sends_the_texts(settings):
    down = TestClient(
        create_app(
            replace(settings, sms_mode="preview", temporal_address="127.0.0.1:1")
        ),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    with down:  # startup can't reach Temporal either: the demo sync runs here
        eid, fid = _approved_link(down)
        out = down.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. A"})
        assert out.status_code == 200
        f = next(x for x in out.json()["encounter"]["followups"] if x["id"] == fid)
        assert f["booking_link"]["status"] == "sent"
        actions = [a["action"] for a in down.get(f"/api/encounters/{eid}/audit").json()]
        assert actions[-3:] == ["note_signed", "texts_not_started", "text_preview"]
    assert Store(settings.data_dir).get_meta("notes_synced_at")


def test_the_hourly_check_sends_links_left_queued(preview, settings):
    eid, fid = _approved_link(preview)
    store = Store(settings.data_dir)

    def signed_long_ago(now):  # as if signed while the texts never started
        now.status = EncounterStatus.signed
        now.signed_at = datetime.now(UTC) - timedelta(hours=1)

    store.update(eid, signed_long_ago)
    activities = Activities(_services(settings))
    assert anyio.run(activities.check_booking_links) == 1
    assert _followup(store, eid, fid).booking_link.status == "sent"
    assert anyio.run(activities.check_booking_links) == 0


def test_a_signed_note_takes_no_more_transcript_or_photos(preview):
    eid, _ = _approved_link(preview)
    preview.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. A"})
    before = preview.get(f"/api/encounters/{eid}").json()
    text = preview.post(f"/api/encounters/{eid}/transcript", json={"text": "late"})
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 200 + b"\xff\xd9"
    photo = preview.post(
        f"/api/encounters/{eid}/photos",
        files={"file": ("paw.jpg", jpeg, "image/jpeg")},
    )
    assert text.status_code == 409 and "signed" in text.json()["detail"]
    assert photo.status_code == 409 and "signed" in photo.json()["detail"]
    assert preview.get(f"/api/encounters/{eid}").json() == before


def test_two_senders_never_both_send_a_link(preview, settings):
    eid, fid = _approved_link(preview)
    store = Store(settings.data_dir)

    def signed_long_ago(now):
        now.status = EncounterStatus.signed
        now.signed_at = datetime.now(UTC) - timedelta(hours=1)

    store.update(eid, signed_long_ago)
    texts = []

    class Counting(Texter):
        async def send_followup(self, followup, appt):
            texts.append(followup.id)
            # Taken, yet still "queued" to everyone reading it.
            link = _followup(store, eid, fid).booking_link
            assert link.status == "queued" and link.claimed_at
            await anyio.sleep(0.05)  # on its way while the other sender looks
            return await super().send_followup(followup, appt)

    services = _services(settings)
    services.texter = Counting(replace(settings, sms_mode="preview"))
    a, b = Activities(services), Activities(services)

    async def both():
        async with anyio.create_task_group() as tg:
            tg.start_soon(a.send_signing_texts, eid)  # the signature's sender
            tg.start_soon(b.check_booking_links)  # the hourly check

    anyio.run(both)
    assert texts == [fid]
    link = _followup(store, eid, fid).booking_link
    assert link.status == "sent" and link.claimed_at is None


def test_nothing_sent_gives_the_link_back(preview, settings):
    eid, fid = _approved_link(preview)
    store = Store(settings.data_dir)

    def no_text(now):  # a recheck with no message: the texter sends nothing
        next(x for x in now.followups if x.id == fid).message_draft = ""

    store.update(eid, no_text)
    assert anyio.run(Activities(_services(settings)).send_signing_texts, eid) == 0
    f = _followup(store, eid, fid)
    assert f.sms is None and f.booking_link.status == "queued"
    assert f.booking_link.claimed_at is None


def test_temporal_is_skipped_for_a_minute_after_a_failure(settings, monkeypatch):
    services = _services(settings)
    jobs = Jobs(replace(settings, temporal_address="127.0.0.1:1"), services)
    tries = []
    connect = jobs._temporal

    async def counted():
        tries.append(1)
        return await connect()

    monkeypatch.setattr(jobs, "_temporal", counted)
    first = anyio.run(jobs._start, TextsAfterSigning.run, "e1", "w1")
    second = anyio.run(jobs._start, TextsAfterSigning.run, "e2", "w2")
    assert first.startswith("Temporal:") and "moments ago" in second
    assert tries == [1]


# ---------- the same work on Temporal ----------

TEMPORAL = shutil.which("temporal")


@pytest.mark.skipif(not TEMPORAL, reason="needs the Temporal CLI (temporal)")
def test_workflows_on_a_local_temporal_server(preview, settings):
    from temporalio.testing import WorkflowEnvironment
    from temporalio.worker import Worker

    eid, fid = _approved_link(preview)
    services = _services(settings)

    async def run():
        env = await WorkflowEnvironment.start_local(
            dev_server_existing_path=TEMPORAL, ui=False
        )
        async with (
            env,
            Worker(
                env.client,
                task_queue=TASK_QUEUE,
                workflows=WORKFLOWS,
                activities=Activities(services).all(),
            ),
        ):
            sent = await env.client.execute_workflow(
                TextsAfterSigning.run,
                eid,
                id=f"texts-{uuid.uuid4().hex}",
                task_queue=TASK_QUEUE,
            )
            expired = await env.client.execute_workflow(
                BookingLinkCheck.run,
                id=f"links-{uuid.uuid4().hex}",
                task_queue=TASK_QUEUE,
            )
        return sent, expired

    assert anyio.run(run) == (1, 0)
    f = next(x for x in services.store.get(eid).followups if x.id == fid)
    assert f.booking_link.status == "sent" and f.sms.status == "preview"
