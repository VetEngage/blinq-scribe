"""Signing saves the note to the practice system in SOAP form, past notes come back
by their headings, and "Send to PIMS" tries again when saving didn't work."""

from dataclasses import replace

import anyio
from fastapi.testclient import TestClient

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.note_sections import note_sections
from blinqscribe.schemas import PastNote
from blinqscribe.store import Store


def _sections(text):
    return [(s.label, s.text) for s in note_sections(text)]


# ---------- past notes by their headings ----------


def test_short_and_long_headings_both_read_as_soap():
    short = (
        "S: Itchy face x1 wk.\nO:\n- T 101.6 F, HR 96\n- P: 120\nA: Allergy.\n"
        "P:\n- Apoquel"
    )
    assert _sections(short) == [
        ("Subjective", "Itchy face x1 wk."),
        ("Objective", "- T 101.6 F, HR 96\n- P: 120"),
        ("Assessment", "Allergy."),
        ("Plan", "- Apoquel"),
    ]
    long = (
        "Subjective: Sneezing.\nObjective: Lungs clear.\nAssessment: URI.\nPlan: Rest."
    )
    assert [label for label, _ in _sections(long)] == [
        "Subjective",
        "Objective",
        "Assessment",
        "Plan",
    ]


def test_note_type_headings_vitals_and_plain_text():
    wellness = "History: Doing well.\nExam: BCS 5/9.\nPlan and vaccines: DHPP today.\n"
    wellness += "Vitals: T 101.5, HR 90\nMedications: Heartgard monthly"
    assert [label for label, _ in _sections(wellness)] == [
        "History",
        "Exam",
        "Plan and vaccines",
        "Vitals",
        "Medications",
    ]
    assert _sections("Called owner, doing fine.") == []  # shown as text instead
    note = PastNote(id="n", patient_id="p", date="2026-10-30T10:00:00", text=wellness)
    assert note.sections[0].label == "History"


# ---------- signing files the note in the mock practice system ----------


def _drafted(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    return eid


def _sign(client, eid):
    return client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )


def test_signing_files_the_note_and_visit_in_soap_form(client, settings):
    eid = _drafted(client)
    assert _sign(client, eid).json()["write_back"]["status"] == "written"

    notes = client.get("/api/patients/pat-1/notes").json()
    ours = next(n for n in notes if n["id"] == f"blinq-{eid}")
    assert [s["label"] for s in ours["sections"]][:2] == ["Subjective", "Objective"]

    visits = client.get("/api/patients/pat-1/visits").json()
    today = [v for v in visits if v["appointment_id"] == "appt-1"]
    assert len(today) == 1  # the practice system's visit and Blinq's note, as one
    assert today[0]["sections"] and today[0]["sections"][0]["label"] == "Subjective"


def test_the_mock_practice_system_keeps_written_notes(settings, tmp_path):
    state = tmp_path / "mock_practice_system.json"
    app = create_app(settings, adapter=MockAdapter(state_file=state))
    client = TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000))
    eid = _drafted(client)
    _sign(client, eid)

    again = MockAdapter(state_file=state)  # a restart
    notes = anyio.run(again.get_patient_notes, "pat-1")
    filed = [n for n in notes if n.id == f"mock-note-{eid}"]
    assert len(filed) == 1 and filed[0].provider_name == "Dr. Ana Rivera"
    assert filed[0].text.startswith("Subjective: ")
    assert {"Subjective", "Objective", "Assessment", "Plan"} <= {
        s.label for s in filed[0].sections
    }
    visits = anyio.run(again.get_visit_history, "pat-1")
    assert [v.appointment_id for v in visits].count("appt-1") == 1

    # Writing the same note again replaces it, never doubles it.
    enc = Store(settings.data_dir).get(eid)
    anyio.run(again.write_back, enc)
    notes = anyio.run(again.get_patient_notes, "pat-1")
    assert [n.id for n in notes].count(f"mock-note-{eid}") == 1


# ---------- Send to PIMS ----------


class Flaky(MockAdapter):
    """A practice system that is down until told otherwise."""

    down = True

    async def write_back(self, encounter):
        if self.down:
            raise ConnectionError("practice system unreachable")
        return await super().write_back(encounter)


def test_send_to_pims_tries_again_and_only_once(settings):
    adapter = Flaky()
    client = TestClient(
        create_app(settings, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid = _drafted(client)
    assert (
        client.post(f"/api/encounters/{eid}/write-back").status_code == 409
    )  # not signed yet
    signed = _sign(client, eid).json()
    assert signed["write_back"]["status"] == "failed"
    assert (
        signed["write_back"]["detail"]
        == "Couldn't reach the PIMS. Trying again every 5 minutes."
    )

    still_down = client.post(f"/api/encounters/{eid}/write-back").json()
    assert still_down["status"] == "failed"

    adapter.down = False
    sent = client.post(f"/api/encounters/{eid}/write-back").json()
    assert sent["status"] == "written" and sent["pims_id"] == f"mock-note-{eid}"
    assert (
        client.get(f"/api/encounters/{eid}").json()["write_back"]["status"] == "written"
    )

    adapter.down = True  # a note already written comes back as it is
    assert client.post(f"/api/encounters/{eid}/write-back").json() == sent
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions.count("note_sent_to_pims") == 2


def test_send_to_pims_over_graphql(settings):
    adapter = Flaky()
    client = TestClient(
        create_app(settings, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid = _drafted(client)
    _sign(client, eid)
    adapter.down = False
    out = client.post(
        "/graphql",
        json={
            "query": "mutation($id: String!) { send_to_pims(encounter_id: $id) "
            "{ ok status pims_id } }",
            "variables": {"id": eid},
        },
    ).json()
    assert out["data"]["send_to_pims"] == {
        "ok": True,
        "status": "written",
        "pims_id": f"mock-note-{eid}",
    }


def test_the_api_token_cannot_send_a_note(settings):
    token = replace(settings, api_token="secret")
    adapter = Flaky()
    client = TestClient(
        create_app(token, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    auth = {"Authorization": "Bearer secret"}
    eid = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=auth,
    ).json()["id"]
    assert (
        client.post(f"/api/encounters/{eid}/write-back", headers=auth).status_code
        == 403
    )


def test_only_the_signer_may_send_and_a_refusal_is_audited(settings):
    from blinqscribe.accounts import Accounts

    adapter = Flaky()
    app = create_app(settings, adapter=adapter)
    client = TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000))
    accounts = Accounts(Store(settings.data_dir))
    _, invite = accounts.create("arivera", "Dr. Ana Rivera", "prov-1", "admin")
    pw = "correct horse battery"
    accounts.accept_invite(invite, pw)

    def login(name):
        token = client.post(
            "/api/auth/login", json={"username": name, "password": pw}
        ).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    signer = login("arivera")
    eid = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=signer,
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={
            "text": client.get("/api/sample-transcript", headers=signer).json()["text"]
        },
        headers=signer,
    )
    client.post(f"/api/encounters/{eid}/draft", headers=signer)
    client.post(f"/api/encounters/{eid}/sign", json={}, headers=signer)
    # As if another login had signed it (one provider has one login, so a second
    # person on this visit can't be set up for real).
    Store(settings.data_dir).update(eid, lambda e: setattr(e, "signed_by_user", "x"))

    refused = client.post(f"/api/encounters/{eid}/write-back", headers=signer)
    assert (
        refused.status_code == 403 and "Only Dr. Ana Rivera" in refused.json()["detail"]
    )
    audit = client.get(f"/api/encounters/{eid}/audit", headers=signer).json()
    assert audit[-1]["action"] == "refused"
    assert audit[-1]["detail"]["action"] == "note.sign"
