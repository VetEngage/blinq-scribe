"""The rail's quick card reads only what the schedule already carries: the PIMS's
notes on the pet, its last visit and newest weight, and when the schedule was read."""

from datetime import date, datetime, timedelta

from blinqscribe.schemas import Patient


def test_a_patient_from_a_system_without_these_fields_has_none():
    pet = Patient(id="p", name="Rex")
    assert pet.pims_notes == []
    assert pet.last_visit is None
    assert pet.weight is None


def test_the_schedule_carries_the_quick_cards_facts(client):
    before = datetime.now().replace(microsecond=0)
    rows = client.get("/api/schedule").json()
    pets = {a["patient"]["name"]: a["patient"] for a in rows}
    miso = pets["Miso"]
    assert "Gabapentin 100 mg given at home 2 hours before visits" in miso["pims_notes"]
    # The last visit before today, and the newest weight.
    assert miso["last_visit"] == {
        "date": (date.today() - timedelta(days=9)).isoformat(),
        "reason": "Increased thirst and urination",
        "type": "Sick",
    }
    assert (miso["weight"]["value"], miso["weight"]["unit"]) == (8.9, "lb")
    # Nothing on file stays empty, never made up.
    assert pets["Rocket"]["pims_notes"] == []
    assert pets["Luna"]["last_visit"] is None
    assert pets["Luna"]["weight"] is None
    # Every row says when the schedule was read from the practice system.
    synced = {datetime.fromisoformat(a["synced_at"]) for a in rows}
    assert len(synced) == 1
    assert before <= synced.pop() <= datetime.now()


def test_notes_are_short_and_in_plain_words(client):
    rows = client.get("/api/schedule").json()
    notes = [n for a in rows for n in a["patient"]["pims_notes"]]
    assert notes
    for n in notes:
        assert len(n) <= 80, n
        assert not any(w in n.split() for w in ("hrs", "hr", "BID", "SID", "PO", "yrs"))


def test_graphql_reads_the_same_fields(client):
    data = client.post(
        "/graphql",
        json={
            "query": "{ schedule { synced_at patient { name pims_notes "
            "last_visit { date reason } weight { value unit } } "
            "pets { patient { name pims_notes } } } }"
        },
    ).json()["data"]["schedule"]
    miso = next(a for a in data if a["patient"]["name"] == "Miso")
    assert miso["synced_at"]
    assert miso["patient"]["last_visit"]["reason"] == "Increased thirst and urination"
    assert miso["patient"]["weight"] == {"value": 8.9, "unit": "lb"}
    assert miso["patient"]["pims_notes"][0].startswith("Fear Free:")
