"""The demo's heavy day (20 visits, 24 pets) and the household visit on it: several
pets booked as one appointment, one recording for the room split by pet, and a line
Blinq can't place left for the provider to confirm."""

from datetime import timedelta

import anyio
import pytest

from blinqscribe import sample
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.day import household_status
from blinqscribe.demo_seed import seed_busy_day
from blinqscribe.prompts import SCRIBE_SYSTEM
from blinqscribe.schemas import Patient, VisitPet
from blinqscribe.scribe import mock_draft, pet_lines, place_lines
from blinqscribe.store import Store

LEE = ["Hazel", "Kiwi", "Mochi"]


def _busy(client):
    day = MockAdapter().busy_day
    assert day
    return day, client.get("/api/schedule", params={"date": day.isoformat()}).json()


def _household(rows):
    return next(a for a in rows if a["id"].startswith("bz-12@"))


def test_the_busy_day_is_two_days_ahead_with_20_visits_and_24_pets(client):
    mock = MockAdapter()
    assert mock.busy_day == mock.today + timedelta(days=2)
    _, rows = _busy(client)
    assert len(rows) == 20
    assert sum(max(1, len(a["pets"])) for a in rows) == 24
    # It reads as it stands mid-afternoon; no other day has a clock of its own.
    assert {a["demo_clock"] for a in rows} == {"13:15"}
    today = client.get("/api/schedule").json()
    assert [a["patient"]["name"] for a in today] == [
        "Biscuit",
        "Miso",
        "Rocket",
        "Luna",
        "Pepper",
        "Waffles",
    ]
    assert {a["demo_clock"] for a in today} == {""}
    assert all(not a["pets"] for a in today)
    # Two households, each one row with its pets and their own reasons.
    lee = _household(rows)
    assert lee["client"]["last_name"] == "Lee"
    assert [(p["patient"]["name"], p["reason"]) for p in lee["pets"]] == [
        ("Hazel", "Stiff getting up"),
        ("Kiwi", "Wellness exam"),
        ("Mochi", "Eating less hay"),
    ]
    assert [p["visit_status"] for p in lee["pets"]] == ["not_started"] * 3


def test_the_busy_day_is_seen_up_to_its_clock_and_signed(client):
    with client:  # startup seeds the busy day
        _, rows = _busy(client)
        unsigned = client.get("/api/notes/unsigned").json()
    seen = [a for a in rows if a["visit_status"] == "signed"]
    assert len(seen) == 9 and all(a["start"][11:16] < "13:15" for a in seen)
    assert all(a["visit_status"] == "not_started" for a in rows if a not in seen)
    # Started when the record says, so the pace is a fact: the last one 15 min late.
    last = seen[-1]
    assert last["patient"]["name"] == "Peanut"
    assert last["started_at"][11:16] == "12:45" and last["start"][11:16] == "12:30"
    # Nothing on it is left to sign, so the main demo's notes and counts don't move.
    assert all(n["date"] != rows[0]["start"][:10] for n in unsigned)


def test_the_busy_day_is_seeded_once(settings):
    mock, store = MockAdapter(), Store(settings.data_dir)
    assert anyio.run(seed_busy_day, mock, store) == 9
    assert anyio.run(seed_busy_day, mock, store) == 0


def test_lines_are_placed_by_pet_and_a_line_after_two_pets_is_not_sure():
    said = [
        "Hi Jordan, we have Hazel, Kiwi and Mochi today.",
        "Hazel and Mochi have both been sneezing.",
        "One of them had a runny nose this morning.",
        "Okay.",
        "Now Kiwi.",
        "Her feathers look good.",
    ]
    placed = place_lines(said, LEE)
    assert placed[1] == (["Hazel", "Mochi"], True)
    assert placed[2] == (["Hazel", "Mochi"], False)  # can't tell: ask
    assert placed[3][1] is True  # too short to chart, never a question
    assert placed[5] == (["Kiwi"], True)
    lines = [("owner", s) for s in said]
    # The line Blinq can't place goes to the first pet it could be about, marked,
    # and to no other pet.
    hazel = [t for _, t in pet_lines(lines, "Hazel", LEE)]
    assert (
        "One of them had a runny nose this morning [confirm pet: Hazel or Mochi]."
        in hazel
    )
    assert not any("runny nose" in t for _, t in pet_lines(lines, "Mochi", LEE))


def test_the_rule_based_draft_marks_a_line_it_cant_place(client):
    appt = anyio.run(MockAdapter().get_appointment, "appt-1")
    assert appt
    text = (
        "Owner: Biscuit and Waffles have both been scratching their ears at night.\n"
        "Owner: One of them has been shaking his head a lot since Sunday.\n"
        "Dr. Rivera: Biscuit's right ear is red and swollen.\n"
    )
    got = mock_draft(text, appt, ["Biscuit", "Waffles"])
    assert "[confirm pet: Biscuit or Waffles]" in got.subjective


def test_the_model_is_asked_to_mark_a_line_it_cant_place_in_plain_words():
    assert "[confirm pet: Hazel or Mochi]" in SCRIBE_SYSTEM
    assert "never guess and never chart it for several pets" in SCRIBE_SYSTEM


def test_a_household_appointment_has_its_own_sample():
    text = sample.for_appointment("pat-7", "cli-1")
    assert all(name in text for name in LEE)
    assert sample.for_appointment("pat-7") == sample.for_patient("pat-7")


def test_household_status_reads_the_visit_as_one_row():
    pet = Patient(id="p", name="P")

    def pets(*states):
        return [VisitPet(patient=pet, visit_status=s) for s in states]

    assert household_status(pets("not_started", "not_started")) == "not_started"
    assert household_status(pets("recording", "recording")) == "recording"
    assert (
        household_status(pets("signed", "draft_ready", "draft_ready")) == "draft_ready"
    )
    # A pet left out of the visit doesn't hold it open.
    assert household_status(pets("signed", "signed", "not_started")) == "signed"


def _draft_household(client):
    day, rows = _busy(client)
    appt_id = _household(rows)["id"]
    eid = client.post(
        "/api/encounters",
        json={
            "appointment_id": appt_id,
            "consent_recorded": True,
            "patient_ids": ["pat-7", "pat-8", "pat-9"],
        },
    ).json()["id"]
    text = client.get(
        "/api/sample-transcript", params={"appointment_id": appt_id}
    ).json()["text"]
    assert text == sample.for_appointment("pat-7", "cli-1")
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    assert client.post(f"/api/encounters/{eid}/draft").status_code == 200
    group = client.get("/api/encounters", params={"group_id": eid}).json()
    return day, {e["patient_name"]: e for e in group}


@pytest.mark.confirms_left
def test_a_household_visit_drafts_one_note_per_pet_and_never_signs_an_unplaced_line(
    client,
):
    _, notes = _draft_household(client)
    assert list(notes) == LEE
    hazel = notes["Hazel"]
    assert "[confirm pet: Hazel or Mochi]" in hazel["note"]["subjective"]
    assert "runny nose" not in notes["Mochi"]["note"]["subjective"].lower()
    assert "confirm" not in str(notes["Kiwi"]["note"]).lower()
    # Each transcript line knows its pet; the one Blinq couldn't place says so.
    unsure = [s for s in hazel["segments"] if not s["pet_sure"]]
    assert [(s["line"], s["pets"]) for s in unsure] == [(8, ["Hazel", "Mochi"])]
    kiwi_lines = [s["line"] for s in hazel["segments"] if s["pets"] == ["Kiwi"]]
    assert kiwi_lines == [9, 10, 11]
    # The rail reads the household as one row with each pet's note.
    lee = _household(_busy(client)[1])
    assert lee["visit_status"] == "draft_ready"
    assert [p["visit_status"] for p in lee["pets"]] == ["draft_ready"] * 3
    assert {p["encounter_id"] for p in lee["pets"]} == {e["id"] for e in notes.values()}
    # The pet question is a thing to confirm like any other: never signed with it left.
    refused = client.post(
        f"/api/encounters/{hazel['id']}/sign",
        json={"signed_by": "Dr. Ana Rivera", "send": False},
    )
    assert refused.status_code == 409
    assert "confirm" in refused.json()["detail"]
    # Moved to Mochi: off Hazel's note, onto Mochi's. Then all three sign.
    line = "Runny nose this morning."
    note = dict(hazel["note"])
    note["subjective"] = "\n".join(
        x for x in note["subjective"].splitlines() if "runny nose" not in x.lower()
    )
    client.put(f"/api/encounters/{hazel['id']}/note", json=note)
    mochi = dict(notes["Mochi"]["note"])
    mochi["subjective"] += "\n" + line
    client.put(f"/api/encounters/{notes['Mochi']['id']}/note", json=mochi)
    for e in notes.values():
        signed = client.post(
            f"/api/encounters/{e['id']}/sign",
            json={"signed_by": "Dr. Ana Rivera", "send": True},
        )
        assert signed.status_code == 200, signed.json()
    lee = _household(_busy(client)[1])
    assert lee["visit_status"] == "signed"
    assert [p["visit_status"] for p in lee["pets"]] == ["signed"] * 3


def test_owner_text_lists_pets_naturally() -> None:
    from blinqscribe.share import text_message

    en = text_message("Jordan", ["Hazel", "Kiwi", "Mochi"], "Clinic", "u", "en")
    assert "Hazel, Kiwi and Mochi's visit summary" in en
    assert "Biscuit's visit" in text_message("Jordan", ["Biscuit"], "C", "u", "en")
    assert "Hazel y Kiwi" in text_message("Jordan", ["Hazel", "Kiwi"], "C", "u", "es")
