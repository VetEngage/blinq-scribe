"""Last-plan checkboxes: ticked in Before you walk in, kept with the visit, sent to the
scribe as asked to cover today, and back on the draft as reminders, quoted, for each
line the visit didn't talk about. Reminders never block signing."""

from blinqscribe.prompts import SCRIBE_SYSTEM
from blinqscribe.schemas import PlanReminder
from blinqscribe.scribe import covered, plan_keys, quoted


def _plan(client, appt="appt-1"):
    # The practice's notes, synced as at onboarding (the demo server does it at start).
    client.post("/api/admin/onboard", json={"days": 365})
    card = client.get(f"/api/appointments/{appt}/card").json()
    return next(e for e in card["walk_in"] if e["kind"] == "plan")


def _draft(client, appt="appt-1"):
    eid = client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
    ).json()["id"]
    text = client.get("/api/sample-transcript", params={"appointment_id": appt}).json()[
        "text"
    ]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    return client.post(f"/api/encounters/{eid}/draft").json()


def test_ticks_are_kept_with_the_visit_and_come_back_on_the_card(client):
    plan = _plan(client)
    lines = [i["text"] for i in plan["items"]]
    assert lines and not any(i["checked"] for i in plan["items"])
    kept = client.put(
        "/api/appointments/appt-1/plan-checks",
        json={"patient_id": "pat-1", "lines": [lines[0], lines[0], "  "]},
    )
    assert kept.status_code == 200
    assert kept.json() == [lines[0]]
    again = _plan(client)
    assert [i["checked"] for i in again["items"]] == [i == 0 for i in range(len(lines))]
    # Only a pet on this visit.
    other = client.put(
        "/api/appointments/appt-1/plan-checks",
        json={"patient_id": "pat-2", "lines": [lines[0]]},
    )
    assert other.status_code == 400


def test_a_ticked_line_the_visit_didnt_cover_is_a_reminder_on_the_draft(client):
    lines = [i["text"] for i in _plan(client)["items"]]
    apoquel = next(x for x in lines if "Apoquel" in x)
    recheck = next(x for x in lines if "Recheck" in x)
    client.put(
        "/api/appointments/appt-1/plan-checks",
        json={"patient_id": "pat-1", "lines": [apoquel, recheck]},
    )
    enc = _draft(client)
    # Biscuit's visit talks about a recheck, never about Apoquel: only Apoquel is left,
    # in the provider's own words, and Blinq adds nothing about it to the note.
    assert [(r["text"], r["status"]) for r in enc["plan_reminders"]] == [
        (apoquel, "open")
    ]
    assert "apoquel" not in enc["note"]["plan"].lower()
    rid = enc["plan_reminders"][0]["id"]
    done = client.post(
        f"/api/encounters/{enc['id']}/plan-reminders/{rid}",
        json={"action": "dismissed"},
    )
    assert done.json()["plan_reminders"][0]["status"] == "dismissed"
    # A redraft keeps what the provider did with it.
    again = client.post(f"/api/encounters/{enc['id']}/draft").json()
    assert again["plan_reminders"][0]["status"] == "dismissed"


def test_reminders_never_block_signing(client):
    lines = [i["text"] for i in _plan(client)["items"]]
    apoquel = next(x for x in lines if "Apoquel" in x)
    client.put(
        "/api/appointments/appt-1/plan-checks",
        json={"patient_id": "pat-1", "lines": [apoquel]},
    )
    enc = _draft(client)
    assert enc["plan_reminders"][0]["status"] == "open"
    signed = client.post(
        f"/api/encounters/{enc['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )
    assert signed.status_code == 200, signed.json()


def test_covered_reads_key_words_not_how_or_when():
    assert plan_keys("Apoquel 16 mg by mouth twice a day for 14 days") == {"apoquel"}
    said = "Let's recheck in two weeks. Ear drops twice a day."
    assert covered("Recheck in 4 weeks", said)
    assert not covered("Apoquel 16 mg by mouth twice a day", said)
    # A line with nothing to go by is never a reminder.
    assert covered("Twice a day for 14 days", said)


def test_the_model_only_quotes_the_providers_own_lines():
    asked = ["Apoquel 16 mg once a day", "Recheck in 4 weeks"]
    out = quoted(
        ["apoquel 16 mg once a day.", "Consider a food trial", "Recheck in 4 weeks"],
        asked,
    )
    assert out == ["Apoquel 16 mg once a day", "Recheck in 4 weeks"]
    assert "PROVIDER ASKED TO COVER TODAY" in SCRIBE_SYSTEM
    assert "not_covered" in SCRIBE_SYSTEM


def test_reminder_ids_are_stable_and_keep_status():
    from blinqscribe.plan_checks import reminders

    first = reminders(["Apoquel"], [])
    again = reminders(
        ["Apoquel"], [PlanReminder(id="x", text="Apoquel", status="added")]
    )
    assert first[0].id == again[0].id
    assert again[0].status == "added"
