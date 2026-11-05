from types import SimpleNamespace

import anyio

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.schemas import SoapNote
from blinqscribe.scribe import draft_note
from blinqscribe.voice import apply_format, build_profile

BULLETY = SoapNote(
    subjective="Owner reports itching x2 wk.",
    objective="- T 103.1 F, HR 120\n- Ears: AU erythema, brown d/c\n- MM pink, CRT <2s",
    assessment="Otitis externa AU, r/o yeast.",
    plan="- Cytology done\n- Rx Otomax AU BID x10d\n- Recheck 14d",
)
BULLETY_2 = SoapNote(
    subjective="Hx of vomiting since Sunday.",
    objective="- BAR, BCS 5/9\n- Abdomen soft, NSF\n- MM pink",
    assessment="Dietary indiscretion likely.",
    plan="- Bland diet\n- Rx cerenia PO SID x3d",
)


def test_same_person_ignores_title_and_degree():
    from blinqscribe.notes import same_person as _same_person

    assert _same_person("Ana Rivera", "Dr. Ana Rivera")
    assert _same_person("dr ana rivera", "Ana Rivera, DVM")
    assert not _same_person("Dr. Sam Okafor", "Dr. Ana Rivera")
    assert not _same_person("Dr. Ana Rivera", "")


def test_needs_two_signed_notes():
    assert build_profile("prov-1", [BULLETY]) is None


def test_profile_is_style_only():
    profile = build_profile("prov-1", [BULLETY, BULLETY_2])
    assert profile.notes_used == 2
    assert profile.sections["objective"].format == "bullets"
    assert profile.sections["plan"].format == "bullets"
    assert profile.sections["subjective"].format == "prose"
    assert profile.sections["assessment"].length == "brief"
    assert profile.abbreviations == ["MM", "Rx"]  # only shorthand used in both notes
    assert (
        "BAR" not in profile.prompt_text() and "NSF" not in profile.prompt_text()
    )  # findings, not style
    # Nothing from the notes themselves: no temperatures, drugs, diagnoses or patient
    # details.
    text = profile.model_dump_json() + profile.prompt_text()
    for fact in ("103.1", "Otomax", "cerenia", "Otitis", "vomiting", "Sunday", "5/9"):
        assert fact not in text


def test_mock_draft_follows_bullets_without_changing_words():
    note = SoapNote(
        objective="Ears are red. Temp is 101.8. Lungs clear.", plan="[confirm: plan]"
    )
    apply_format(note, build_profile("prov-1", [BULLETY, BULLETY_2]))
    assert note.objective == "- Ears are red.\n- Temp is 101.8.\n- Lungs clear."
    assert note.plan == "[confirm: plan]"  # placeholders are left alone
    note = SoapNote(plan="Call Dr. Smith if worse. Recheck soon.")
    apply_format(note, build_profile("prov-1", [BULLETY, BULLETY_2]))
    assert note.plan == "- Call Dr. Smith if worse.\n- Recheck soon."


def test_muse_gets_the_style_not_the_notes():
    class FakeMuse:
        enabled = True

        async def structured(self, system, user, schema, images=None, **_):
            self.user = user
            return schema(subjective="Seen today.")  # a note, not empty

    muse = FakeMuse()
    appt = anyio.run(MockAdapter().get_appointment, "appt-1")
    enc = SimpleNamespace(transcript="Vet: ears look red.", photos=[])
    anyio.run(
        draft_note, muse, appt, [], enc, build_profile("prov-1", [BULLETY, BULLETY_2])
    )
    assert "WRITING STYLE" in muse.user and "- Plan: bullets" in muse.user
    assert "Otomax" not in muse.user and "103.1" not in muse.user


def _sign(client, appt, plan, signer="Dr. Ana Rivera"):
    eid = client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    note = client.post(f"/api/encounters/{eid}/draft").json()["note"]
    client.put(f"/api/encounters/{eid}/note", json={**note, "plan": plan})
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": signer})
    return eid


def test_drafts_learn_the_vets_style_from_signed_notes(client):
    assert (
        client.get("/api/providers/prov-1/voice").json()["source"] == "default"
    )  # demo clinic, nothing synced
    _sign(
        client, "appt-4", "Relief vet's prose plan.", signer="Dr. Sam Okafor"
    )  # covering vet: not counted
    _sign(client, "appt-1", "- Start ear meds\n- Recheck 14d")
    _sign(client, "appt-2", "- Recheck bloodwork\n- Renal diet")
    learned = client.get("/api/providers/prov-1/voice").json()
    assert (
        learned["source"] == "synced"
        and learned["sections"]["plan"]["format"] == "bullets"
    )

    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-3", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    note = client.post(f"/api/encounters/{eid}/draft").json()["note"]
    assert note["plan"].startswith("- ")
    assert (
        client.get(f"/api/encounters/{eid}/audit").json()[-1]["detail"]["voice_notes"]
        == 2
    )
    # Another vet's signed notes do not shape this vet's drafts
    assert client.get("/api/providers/prov-2/voice").json()["source"] == "default"
