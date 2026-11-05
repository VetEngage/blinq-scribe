"""Demo text a judge reads: the sample visit is about the pet on the appointment,
the pre-room card speaks to whoever is reading, mock notes match each pet's sex,
and filler like "Okay." never becomes part of the note."""

import json
import re
from dataclasses import replace
from pathlib import Path

from test_permissions import h
from test_roles_view import client, team  # noqa: F401 - fixtures

from blinqscribe import sample
from blinqscribe.scribe import mock_draft

DATA = Path(__file__).resolve().parents[1] / "data" / "mock_practice.json"


VISITS = {  # appointment: (pet, female?, a word from the visit's reason)
    "appt-1": ("Biscuit", False, "ear"),
    "appt-2": ("Miso", True, "kidney"),
    "appt-3": ("Rocket", False, "sutures"),
    "appt-4": ("Luna", True, "wellness"),
    "appt-5": ("Pepper", False, "threw up"),
    "appt-6": ("Waffles", True, "back legs"),
}


# What each visit's assessment must be about: its own reason, not Biscuit's ear.
REASON = {
    "appt-1": "ear infection",
    "appt-2": "kidney",
    "appt-3": "healed",
    "appt-4": "healthy",
    "appt-5": "stomach",
    "appt-6": "back",
}


def wrong_pronouns(text, female):
    return re.findall(
        r"\b(he|him|his)\b" if female else r"\b(she|her|hers)\b", text, re.I
    )


def test_each_demo_visit_has_its_own_sample(client):  # noqa: F811
    for appt, (pet, female, reason) in VISITS.items():
        text = client.get(
            "/api/sample-transcript", params={"appointment_id": appt}
        ).json()["text"]
        assert pet in text and reason in text.lower(), appt
        others = {p for p, _, _ in VISITS.values()} - {pet}
        assert not any(o in text for o in others), appt
        assert not wrong_pronouns(text, female), appt
    assert client.get("/api/sample-transcript").json()["text"] == sample.text()
    missing = client.get("/api/sample-transcript", params={"appointment_id": "nope"})
    assert missing.status_code == 404


def test_each_demo_visit_s_mock_draft_is_about_its_own_pet(client):  # noqa: F811
    from blinqscribe.schemas import Appointment

    schedule = {a["id"]: a for a in client.get("/api/schedule").json()}
    for appt, (pet, female, _) in VISITS.items():
        text = client.get(
            "/api/sample-transcript", params={"appointment_id": appt}
        ).json()["text"]
        draft = mock_draft(text, Appointment.model_validate(schedule[appt]))
        note = " ".join(
            [draft.subjective, draft.objective, draft.assessment, draft.plan]
        )
        assert pet in note + draft.client_summary, appt
        assert REASON[appt] in draft.assessment.lower(), (appt, draft.assessment)
        assert not wrong_pronouns(note + " " + draft.client_summary, female), appt


def test_demo_recording_hears_the_visit_s_own_pet(client):  # noqa: F811
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-4", "consent_recorded": True}
    ).json()["id"]
    for i in range(6):
        enc = client.post(
            f"/api/encounters/{eid}/audio",
            files={"file": ("c.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
            data={"chunk_index": str(i)},
        ).json()
    assert enc["transcript"].strip() == sample.for_patient("pat-4").strip()


def test_the_sample_needs_a_sign_in_and_stays_generic_outside_the_demo(
    client,  # noqa: F811
    team,  # noqa: F811
    settings,
):
    # Invites exist, so the open demo is closed: no session, no sample.
    assert client.get("/api/sample-transcript").status_code == 401
    body = client.post(
        "/graphql",
        json={"query": '{ sample_transcript(appointment_id: "appt-4") }'},
    ).json()
    assert body["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"
    signed_in = client.get(
        "/api/sample-transcript",
        params={"appointment_id": "appt-4"},
        headers=h(team["front"]),
    )
    assert "Luna" in signed_in.json()["text"]

    from fastapi.testclient import TestClient

    from blinqscribe.adapters.mock import MockAdapter
    from blinqscribe.api import create_app

    class LiveLike(MockAdapter):
        name = "clinic_pims"

    # A fresh practice (nobody invited yet) on a live practice system.
    fresh = replace(settings, data_dir=settings.data_dir / "live")
    live = TestClient(create_app(fresh, adapter=LiveLike()))
    text = live.get(
        "/api/sample-transcript", params={"appointment_id": "appt-4"}
    ).json()["text"]
    assert text == sample.text() and "Luna" not in text


def test_the_pre_room_card_speaks_to_whoever_reads_it(client, team):  # noqa: F811
    def card(role):
        return client.get(
            "/api/appointments/appt-5/card", headers=h(team[role])
        ).json()["spoken"]

    assert "Your last note, 40 days ago" in card("okafor")  # Pepper is Okafor's
    seen = card("rivera")
    assert "Dr. Sam Okafor saw Pepper 40 days ago" in seen
    assert "Your last note" not in seen


def test_mock_notes_match_each_pet_s_sex():
    data = json.loads(DATA.read_text())
    pets = {p["id"]: p for p in data["patients"]}
    for note in data["notes"]:
        sex = pets[note["patient_id"]]["sex"].lower()
        wrong = r"\b(she|her|hers)\b" if sex.startswith("male") else r"\b(he|him|his)\b"
        assert not re.search(wrong, note["text"], re.I), note["id"]


def test_filler_never_becomes_part_of_the_note(client):  # noqa: F811
    appt = next(a for a in client.get("/api/schedule").json() if a["id"] == "appt-1")
    from blinqscribe.schemas import Appointment

    draft = mock_draft(sample.text(), Appointment.model_validate(appt))
    for section in (draft.subjective, draft.objective, draft.assessment, draft.plan):
        assert not re.search(r"(^|\n|- )(Okay|Sorry)\b", section), section
    assert "74 lb" in draft.objective  # the finding after "Okay." is kept


def test_seeded_demo_history_matches_each_pet_s_sex(client):  # noqa: F811
    for appt, (_, female, _) in VISITS.items():
        for enc in client.get("/api/encounters").json():
            if not enc["appointment_id"].startswith(appt + "@") or not enc["note"]:
                continue
            words = " ".join(str(v) for v in enc["note"].values())
            words += " ".join(f["message_draft"] for f in enc["followups"])
            assert not wrong_pronouns(words, female), (appt, enc["id"])
