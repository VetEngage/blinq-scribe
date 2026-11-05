"""Onboarding: sync 24 months of notes, voice profiles ready on day one, history from
every vet."""

from datetime import datetime, timedelta
from types import SimpleNamespace

import anyio
from fastapi.testclient import TestClient

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.assistant import DayAssistant
from blinqscribe.notes import previous_notes, split_sections
from blinqscribe.onboard import sync_notes
from blinqscribe.schemas import (
    Encounter,
    EncounterStatus,
    PastNote,
    SoapNote,
    WriteBackResult,
)
from blinqscribe.scribe import draft_note
from blinqscribe.store import Store
from blinqscribe.voice import build_profile, profile_for


def _synced(tmp_path, adapter=None):
    store = Store(tmp_path)
    report = anyio.run(sync_notes, adapter or MockAdapter(), store)
    return store, report


def test_sync_pulls_90_days_and_readies_profiles(tmp_path):
    store, report = _synced(tmp_path)
    assert (
        report["patients"] == 9
        and report["notes"] == 6
        and report["failed_patients"] == []
    )
    assert report["profiles_ready"] == ["Dr. Ana Rivera", "Dr. Sam Okafor"]
    rivera, okafor = profile_for(store, "prov-1"), profile_for(store, "prov-2")
    assert (
        rivera.notes_used == 3 and okafor.notes_used == 3
    )  # Okafor's note on Rivera's patient stays his
    assert (
        rivera.sections["plan"].format == "bullets"
        and okafor.sections["plan"].format == "prose"
    )
    assert "BID" in rivera.abbreviations and "PO" in rivera.abbreviations
    # Re-running does not duplicate anything
    assert (
        anyio.run(sync_notes, MockAdapter(), store)["notes"] == 6
        and len(store.notes()) == 6
    )


def test_sync_drops_notes_older_than_the_window_and_survives_a_bad_patient(tmp_path):
    store = Store(tmp_path)
    store.upsert_notes(
        [
            PastNote(
                id="old",
                patient_id="pat-1",
                provider_id="prov-1",
                text="S: old",
                date=datetime.now() - timedelta(days=800),
            )
        ]
    )

    class Flaky(MockAdapter):
        async def get_patient_notes(self, patient_id):
            if patient_id in ("pat-5", "pat-7"):
                raise ConnectionError("timeout")
            return await super().get_patient_notes(patient_id)

    report = anyio.run(sync_notes, Flaky(), store)
    assert report["purged"] == 1 and sorted(report["failed_patients"]) == [
        "pat-5",
        "pat-7",
    ]
    assert {n.id for n in store.notes()} == {
        "note-101",
        "note-102",
        "note-103",
        "note-202",
    }
    assert report["profiles_waiting"] == [
        "Dr. Sam Okafor"
    ]  # only 1 note of his made it


def test_every_vets_notes_are_there_for_continuity(tmp_path):
    store, _ = _synced(tmp_path)
    miso = previous_notes(store, "pat-2")
    assert [n.provider_name for n in miso] == ["Dr. Sam Okafor"]
    card = anyio.run(
        DayAssistant(
            SimpleNamespace(enabled=False), MockAdapter(), store
        ).pre_room_card,
        "appt-2",
    )
    assert (
        "Dr. Sam Okafor saw Miso 9 days ago: Started amlodipine 0.625 mg"
        in card["spoken"]
    )
    assert card["last_note"]["other_vet"] is True and card["previous_notes"] == 1
    biscuit = anyio.run(
        DayAssistant(
            SimpleNamespace(enabled=False), MockAdapter(), store
        ).pre_room_card,
        "appt-1",
    )
    assert (
        "Your last note, 62 days ago: Rx Apoquel 16 mg PO BID x14d" in biscuit["spoken"]
    )


def test_a_note_written_back_is_not_listed_twice(tmp_path):
    store, _ = _synced(tmp_path)
    now = datetime.now()
    store.save(
        Encounter(
            id="e1",
            appointment_id="appt-2",
            patient_id="pat-2",
            provider_id="prov-1",
            provider_name="Dr. Ana Rivera",
            consent_recorded=True,
            status=EncounterStatus.signed,
            note=SoapNote(plan="- Recheck BP"),
            signed_by="Dr. Ana Rivera",
            signed_at=now,
            created_at=now,
            write_back=WriteBackResult(ok=True, status="written", pims_id="pims-9"),
        )
    )
    store.upsert_notes(
        [
            PastNote(
                id="pims-9",
                patient_id="pat-2",
                provider_id="prov-1",
                date=now,
                text="P: - Recheck BP",
            )
        ]
    )
    notes = previous_notes(store, "pat-2")
    assert [n.source for n in notes] == ["blinq", "pims"] and notes[
        1
    ].provider_name == "Dr. Sam Okafor"
    assert (
        profile_for(store, "prov-1").notes_used == 4
    )  # 3 synced + the signed one, counted once


def test_draft_gets_history_from_other_vets_as_history_only(tmp_path):
    store, _ = _synced(tmp_path)

    class FakeMuse:
        enabled = True

        async def structured(self, system, user, schema, images=None, **_):
            self.system, self.user = system, user
            return schema(subjective="Seen today.")  # a note, not empty

    muse, adapter = FakeMuse(), MockAdapter()
    appt = anyio.run(adapter.get_appointment, "appt-2")
    enc = SimpleNamespace(transcript="Vet: recheck blood pressure today.", photos=[])
    anyio.run(
        draft_note,
        muse,
        appt,
        [],
        enc,
        profile_for(store, "prov-1"),
        previous_notes(store, "pat-2"),
    )
    assert "Previous notes (earlier visits, any vet; history only" in muse.user
    assert "by Dr. Sam Okafor" in muse.user and "amlodipine" in muse.user
    assert "never chart an earlier vital, finding or dose as today's" in muse.system


def test_headerless_notes_count_for_abbreviations_not_format():
    profile = build_profile(
        "prov-9", [], ["Rx carprofen PO BID", "Rx gabapentin PO SID"]
    )
    assert (
        profile.notes_used == 2
        and profile.sections == {}
        and profile.abbreviations == ["PO", "Rx"]
    )
    assert split_sections("Just a sentence.") is None
    assert split_sections("Subjective: itchy\nO:\n- red\nP: meds").objective == "- red"


def test_onboard_endpoints_and_mock_self_onboards(settings):
    app = create_app(settings)
    with TestClient(
        app, base_url="http://localhost", client=("127.0.0.1", 50000)
    ) as client:  # startup onboards the mock clinic
        assert len(client.get("/api/patients/pat-2/notes").json()) == 1
        assert client.get("/api/providers/prov-1/voice").json()["notes_used"] == 3
        report = client.post("/api/admin/onboard", json={"days": 90}).json()
        assert report["notes"] == 6 and report["profiles_ready"] == [
            "Dr. Ana Rivera",
            "Dr. Sam Okafor",
        ]


def _relief_signed(store, write_back_id=None):
    now = datetime.now().astimezone()  # aware, like the API stores it
    store.save(
        Encounter(
            id="r1",
            appointment_id="appt-2",
            patient_id="pat-2",
            provider_id="prov-1",
            provider_name="Dr. Ana Rivera",
            consent_recorded=True,
            status=EncounterStatus.signed,
            note=SoapNote(
                subjective="Relief visit, all prose here.",
                plan="Started a diet change.",
            ),
            signed_by="Dr. Sam Okafor",
            signed_at=now,
            created_at=now,
            write_back=WriteBackResult(
                ok=True, status="written", pims_id=write_back_id or ""
            ),
        )
    )


def test_relief_vets_note_is_theirs_everywhere(tmp_path):
    store, _ = _synced(tmp_path)
    before = profile_for(store, "prov-1").notes_used
    _relief_signed(store, write_back_id="pims-77")
    # The practice system filed the written-back note under the booked vet: still not
    # Rivera's style.
    store.upsert_notes(
        [
            PastNote(
                id="pims-77",
                patient_id="pat-2",
                provider_id="prov-1",
                date=datetime.now(),
                provider_name="Dr. Ana Rivera",
                text="S: Relief visit, all prose here.",
            )
        ]
    )
    assert profile_for(store, "prov-1").notes_used == before
    card = anyio.run(
        DayAssistant(
            SimpleNamespace(enabled=False), MockAdapter(), store
        ).pre_room_card,
        "appt-2",
    )
    assert "Dr. Sam Okafor saw Miso today: Started a diet change." in card["spoken"]
    assert (
        card["last_note"]["other_vet"] is True
        and "Your last note" not in card["spoken"]
    )
    assert (
        next(n.id for n in previous_notes(store, "pat-2")) == "blinq-r1"
    )  # local time, not tomorrow


def test_a_note_voided_in_the_practice_system_leaves_on_resync(tmp_path):
    store, _ = _synced(tmp_path)

    class Voided(MockAdapter):
        async def get_patient_notes(self, patient_id):
            return [
                n
                for n in await super().get_patient_notes(patient_id)
                if n.id != "note-202"
            ]

    report = anyio.run(sync_notes, Voided(), store)
    assert report["removed"] == 1 and previous_notes(store, "pat-2") == []


def test_vitals_and_comment_lines_are_not_section_headers():
    note = split_sections(
        "O: exam\nT: 101.5\nP: 120\nR: 24\nA: fine\nP: recheck\nComments: owner called"
    )
    assert note.objective == "exam\nT: 101.5\nP: 120\nR: 24" and note.plan == "recheck"


def test_vitals_not_said_today_are_flagged():
    from blinqscribe.scribe import guard_vitals

    note = SoapNote(
        vitals={"temperature": "101.6 F", "weight": "74 lb", "heart_rate": "96"}
    )
    guard_vitals(note, "Vet: she weighs 74 lb today, heart rate 96.")
    assert note.vitals == {
        "temperature": "[confirm: 101.6 F]",
        "weight": "74 lb",
        "heart_rate": "96",
    }


def test_a_system_that_shares_no_notes_never_clears_history(tmp_path):
    from blinqscribe.adapters.base import PracticeAdapter

    store, _ = _synced(tmp_path)

    class NoNotes(MockAdapter):
        get_patient_notes = (
            PracticeAdapter.get_patient_notes
        )  # the default: cannot share notes

    report = anyio.run(sync_notes, NoNotes(), store)
    assert (
        report["notes_supported"] is False
        and report["removed"] == 0
        and len(store.notes()) == 6
    )


def test_numbers_copied_from_an_earlier_note_are_flagged():
    from blinqscribe.scribe import guard_vitals

    note = SoapNote(
        objective="T 101.6 F, 3 cm mass", assessment="Weight 8.9 lb, stable"
    )
    guard_vitals(note, "Vet: there's a 3 cm mass.", earlier="T 101.6 F. Weight 8.9 lb.")
    assert note.objective == "T [confirm: 101.6] F, 3 cm mass"
    assert note.assessment == "Weight [confirm: 8.9] lb, stable"
