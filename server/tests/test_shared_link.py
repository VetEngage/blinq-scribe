"""One booking link for several pets: a household visit (or the same owner's visits
that day) with more than one recheck gets one owner text with one link for all."""

from dataclasses import replace
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from blinqscribe import booking_links, sample
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.schemas import BookingLink, Encounter


@pytest.fixture
def preview(settings):
    return TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _draft_household(client):
    """The heavy day's Lee household (Hazel, Kiwi, Mochi), started and drafted from
    its one sample recording."""
    day = MockAdapter().busy_day
    assert day
    rows = client.get("/api/schedule", params={"date": day.isoformat()}).json()
    appt_id = next(a for a in rows if a["id"].startswith("bz-12@"))["id"]
    eid = client.post(
        "/api/encounters",
        json={
            "appointment_id": appt_id,
            "consent_recorded": True,
            "patient_ids": ["pat-7", "pat-8", "pat-9"],
        },
    ).json()["id"]
    text = sample.for_appointment("pat-7", "cli-1")
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    assert client.post(f"/api/encounters/{eid}/draft").status_code == 200
    group = client.get("/api/encounters", params={"group_id": eid}).json()
    return day, {e["patient_name"]: e for e in group}


def _signed_household(client):
    _, notes = _draft_household(client)
    hazel = notes["Hazel"]
    note = dict(hazel["note"])
    note["subjective"] = "\n".join(
        x for x in note["subjective"].splitlines() if "confirm pet" not in x
    )
    client.put(f"/api/encounters/{hazel['id']}/note", json=note)
    for e in notes.values():
        r = client.post(
            f"/api/encounters/{e['id']}/sign",
            json={"signed_by": "Dr. Ana Rivera", "send": False},
        )
        assert r.status_code == 200, r.json()
    return {
        k: client.get(f"/api/encounters/{v['id']}").json() for k, v in notes.items()
    }


def _recheck(e):
    return next(f for f in e["followups"] if f["kind"] == "recheck")


def test_the_demo_household_has_two_rechecks(preview):
    notes = _signed_household(preview)
    assert _recheck(notes["Hazel"]) and _recheck(notes["Mochi"])
    assert not any(f["kind"] == "recheck" for f in notes["Kiwi"]["followups"])


def test_two_pets_rechecks_go_as_one_text_with_one_link(preview):
    notes = _signed_household(preview)
    hazel, mochi = notes["Hazel"], notes["Mochi"]
    url = "/api/encounters/{}/followups/{}"
    # Hazel's approved first: it waits for Mochi's, so Jordan gets one text.
    first = preview.post(
        url.format(hazel["id"], _recheck(hazel)["id"]), json={"action": "approve"}
    ).json()
    waiting = _recheck(first)
    assert waiting["booking_link"]["status"] == "queued" and not waiting["sms"]
    done = preview.post(
        url.format(mochi["id"], _recheck(mochi)["id"]), json={"action": "approve"}
    ).json()
    m = _recheck(done)
    h = _recheck(preview.get(f"/api/encounters/{hazel['id']}").json())
    for f in (h, m):
        assert f["booking_link"]["status"] == "sent"
        assert f["booking_link"]["pets"] == ["Hazel", "Mochi"]
    assert h["booking_link"]["url"] == m["booking_link"]["url"]
    assert h["booking_link"]["url"].startswith("https://example.com/book?")
    text = m["sms"]["text"]
    assert text == h["sms"]["text"]
    assert text.count("https://") == 1
    assert text.startswith("Hi Jordan, Dr. Rivera would like to see Hazel and Mochi")
    assert "both rechecks" in text
    # No medical detail in the text.
    for word in ("hip", "arthritis", "carprofen", "hay", "appetite", "teeth"):
        assert word not in text.lower()
    # One row on the waiting list for the one link.
    rows = [w for w in preview.get("/api/followups/waiting").json() if w["pets"]]
    assert [w["pets"] for w in rows] == [["Hazel", "Mochi"]]


def test_dismissing_the_other_pets_recheck_sends_the_one_waiting(preview):
    notes = _signed_household(preview)
    hazel, mochi = notes["Hazel"], notes["Mochi"]
    url = "/api/encounters/{}/followups/{}"
    preview.post(
        url.format(hazel["id"], _recheck(hazel)["id"]), json={"action": "approve"}
    )
    preview.post(
        url.format(mochi["id"], _recheck(mochi)["id"]), json={"action": "dismiss"}
    )
    h = _recheck(preview.get(f"/api/encounters/{hazel['id']}").json())
    assert h["booking_link"]["status"] == "sent"
    assert h["booking_link"]["pets"] == []
    assert "Hazel" in h["sms"]["text"]


def test_without_a_template_the_text_says_to_call(settings):
    client = TestClient(
        create_app(replace(settings, sms_mode="preview", booking_url_template="")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    notes = _signed_household(client)
    url = "/api/encounters/{}/followups/{}"
    for pet in ("Hazel", "Mochi"):
        e = notes[pet]
        client.post(url.format(e["id"], _recheck(e)["id"]), json={"action": "approve"})
    m = _recheck(client.get(f"/api/encounters/{notes['Mochi']['id']}").json())
    assert m["sms"]["text"].endswith("Call us to pick a time for both rechecks.")


def test_the_shared_link_spans_every_pets_window():
    a = BookingLink(url="https://x/a", from_="2026-11-15", to="2026-11-19")
    b = BookingLink(url="https://x/b", from_="2026-11-13", to="2026-11-17")
    link = booking_links.shared([("Hazel", "f1", a), ("Mochi", "f2", b)])
    assert (link.url, link.from_, link.to) == (
        "https://x/b",
        "2026-11-13",
        "2026-11-19",
    )
    assert link.pets == ["Hazel", "Mochi"] and link.followup_ids == ["f1", "f2"]
    enc = Encounter(
        id="e",
        appointment_id="a",
        patient_id="p",
        consent_recorded=True,
        created_at=datetime.now(UTC),
        owner_name="Ana Garcia",
        provider_name="Dr. Ana Rivera",
    )
    three = link.model_copy(update={"pets": ["Coco", "Pancho", "Lola"]})
    assert booking_links.shared_text(enc, three) == (
        "Hi Ana, Dr. Rivera would like to see Coco, Pancho and Lola again. Pick a "
        "time for all 3 rechecks with one link: https://x/b"
    )
