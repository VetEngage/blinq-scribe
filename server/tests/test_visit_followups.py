"""Booking link follow ups and Remember."""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from blinqscribe import booking_links, remember
from blinqscribe.api import create_app
from blinqscribe.store import Store


@pytest.fixture
def preview(settings):
    return TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _drafted(client, transcript=None):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={
            "text": transcript or client.get("/api/sample-transcript").json()["text"]
        },
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    return eid, next((f for f in enc["followups"] if f["kind"] == "recheck"), None)


def _recheck(client, eid, fid):
    return next(
        f
        for f in client.get(f"/api/encounters/{eid}").json()["followups"]
        if f["id"] == fid
    )


def _sign(client, eid):
    return client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )


def test_recheck_link_is_queued_then_sent_at_signing(preview):
    eid, recheck = _drafted(preview)
    assert recheck["booking_mode"] == "link" and recheck["booking_link"] is None
    preview.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}", json={"action": "approve"}
    )
    f = _recheck(preview, eid, recheck["id"])
    link = f["booking_link"]
    assert (
        link["status"] == "queued" and f["sms"] is None
    )  # nothing goes out before the signature
    due = date.today() + timedelta(days=14)
    assert (
        link["from"] == (due - timedelta(days=2)).isoformat()
        and link["to"] == (due + timedelta(days=2)).isoformat()
    )
    assert "mock-loc-1" in link["url"] and link["from"] in link["url"]

    _sign(preview, eid)
    f = _recheck(preview, eid, recheck["id"])
    assert f["booking_link"]["status"] == "sent" and f["sms"]["status"] == "preview"
    assert (
        f"Pick a time that works for you: {link['url']}" in f["sms"]["text"]
        and "Open times" not in f["sms"]["text"]
    )
    sent = datetime.fromisoformat(f["booking_link"]["sent_at"])
    assert datetime.fromisoformat(f["booking_link"]["expires_at"]) - sent == timedelta(
        days=14
    )
    assert (
        f["booked_slot"] is None and f["booking"] is None
    )  # not a booking until the owner books
    actions = [a["action"] for a in preview.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-2:] == ["note_signed", "text_preview"]


def test_approving_after_signing_sends_at_once(preview):
    eid, recheck = _drafted(preview)
    _sign(preview, eid)
    preview.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}", json={"action": "approve"}
    )
    assert _recheck(preview, eid, recheck["id"])["booking_link"]["status"] == "sent"


def test_book_it_now_keeps_the_old_flow_and_drops_a_queued_link(preview):
    eid, recheck = _drafted(preview)
    url = f"/api/encounters/{eid}/followups/{recheck['id']}"
    preview.post(url, json={"action": "approve"})
    preview.post(
        url,
        json={"action": "book", "slot_start": recheck["suggested_slots"][0]["start"]},
    )
    f = _recheck(preview, eid, recheck["id"])
    assert (
        f["booking_mode"] == "book"
        and f["booking_link"] is None
        and f["booking"]["status"] == "written"
    )
    assert "Booked:" in f["sms"]["text"]
    _sign(preview, eid)
    assert preview.get("/api/followups/waiting").json() == []


def test_waiting_list_and_resend(preview, settings):
    eid, recheck = _drafted(preview)
    preview.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}", json={"action": "approve"}
    )
    _sign(preview, eid)
    [item] = preview.get("/api/followups/waiting").json()
    assert item["patient_name"] == "Biscuit" and item["owner_name"] == "Jordan Lee"
    assert (
        item["status"] == "sent"
        and item["days_waiting"] == 0
        and item["url"].startswith("https://")
    )

    # End of day lists links not used after 3 days.
    store = Store(settings.data_dir)
    assert booking_links.waiting_links(store, older_than_days=3) == []
    enc = store.get(eid)
    f = next(x for x in enc.followups if x.id == recheck["id"])
    f.booking_link.sent_at = datetime.now(UTC) - timedelta(days=5)
    store.save(enc)
    assert booking_links.waiting_links(store, older_than_days=3)[0]["days_waiting"] == 5

    again = preview.post(f"/api/followups/{recheck['id']}/resend").json()
    assert again["days_waiting"] == 0 and again["status"] == "sent"
    assert (
        preview.get(f"/api/encounters/{eid}/audit").json()[-1]["action"]
        == "booking_link_resent"
    )

    f.booking_link.expires_at = datetime.now(UTC) - timedelta(days=1)
    store.save(enc)
    assert preview.get("/api/followups/waiting").json()[0]["status"] == "expired"
    assert preview.post("/api/followups/nope/resend").status_code == 404


# ---------- Remember ----------

SENSITIVE = """Dr. Rivera: How is Biscuit doing?
Owner: My mom passed away last month, so Biscuit has been with my sister.
Owner: We're getting married in June but money is really tight right now.
Owner: Our son graduates from college on May 30, we're so proud.
Owner: Our church group walks him on Sundays.
Owner: He's been scratching his ear for a week."""


def test_remember_suggestions_from_the_sample_visit(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    assert (
        client.get(f"/api/encounters/{eid}/remember").json()["suggestions"] == []
    )  # only after the draft
    eid, _ = _drafted(client)
    out = client.get(f"/api/encounters/{eid}/remember").json()
    kinds = {s["kind"]: s for s in out["suggestions"]}
    assert set(kinds) == {"graduation", "move"} and out["left_out"] == 0 and out["mock"]
    grad = kinds["graduation"]
    assert "graduates from high school on Saturday" in grad["text"] and not grad["kept"]
    assert (
        date.fromisoformat(grad["date"]).weekday() == 5 and kinds["move"]["date"] == ""
    )  # "next month": no guess
    assert (
        grad["transcript_lines"]
        and grad["transcript_lines"][0]
        in client.get("/api/sample-transcript").json()["text"]
    )
    assert (
        client.get(f"/api/encounters/{eid}/remember").json()["suggestions"]
        == out["suggestions"]
    )  # stable ids


def test_remember_never_suggests_sensitive_topics(client):
    eid, _ = _drafted(client, SENSITIVE)
    out = client.get(f"/api/encounters/{eid}/remember").json()
    assert [s["kind"] for s in out["suggestions"]] == ["graduation"]
    assert "May 30" in out["suggestions"][0]["text"] and out["suggestions"][0][
        "date"
    ].endswith("-05-30")
    assert (
        out["left_out"] == 3
    )  # the loss, the wedding with money talk, the church; never what they were
    assert all(w not in str(out).lower() for w in ("passed away", "church", "money"))


def test_keep_list_and_delete(client, settings):
    eid, _ = _drafted(client)
    ids = [
        s["id"]
        for s in client.get(f"/api/encounters/{eid}/remember").json()["suggestions"]
    ]
    kept = client.post(f"/api/encounters/{eid}/remember", json={"keep": ids[:1]}).json()
    assert (
        len(kept) == 1
        and kept[0]["client_id"] == "cli-1"
        and kept[0]["patient_name"] == "Biscuit"
    )
    assert kept[0]["kept_by"] == "vet" and kept[0]["encounter_id"] == eid
    expires = datetime.fromisoformat(kept[0]["expires_at"])
    assert timedelta(days=364) < expires - datetime.now(UTC) <= timedelta(days=365)
    assert client.get("/api/clients/cli-1/remember").json() == kept
    assert remember.kept_for_patient(Store(settings.data_dir), "pat-1") == kept
    assert client.get("/api/clients/cli-2/remember").json() == []

    # Kept items stay out of the note: a fresh draft does not mention them.
    note = client.get(f"/api/encounters/{eid}").json()["note"]
    assert "graduat" not in str(note).lower()

    assert (
        client.delete(f"/api/clients/cli-2/remember/{kept[0]['id']}").status_code == 404
    )  # another household
    assert client.delete(f"/api/clients/cli-1/remember/{kept[0]['id']}").json() == {
        "ok": True
    }
    assert client.get("/api/clients/cli-1/remember").json() == []
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert "remember_kept" in actions and actions[-1] == "remember_deleted"


def test_expired_items_are_dropped(client, settings):
    eid, _ = _drafted(client)
    ids = [
        s["id"]
        for s in client.get(f"/api/encounters/{eid}/remember").json()["suggestions"]
    ]
    client.post(f"/api/encounters/{eid}/remember", json={"keep": ids})
    Store(settings.data_dir).run(
        "UPDATE remember SET expires_at = '2000-01-01T00:00:00+00:00'"
    )
    assert client.get("/api/clients/cli-1/remember").json() == []
