"""Regression tests for the review of the visit tools."""

import asyncio
from datetime import UTC

import anyio
import httpx
from fastapi.testclient import TestClient

from blinqscribe import api as api_module
from blinqscribe import editor, remember, share
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.store import Store

TWO_PETS = """Dr. Rivera: Let's start with Biscuit. Biscuit weighs 74 lb.
Dr. Rivera: Let's recheck him in two weeks.
Dr. Rivera: Now Waffles. Waffles weighs 9 lb, heart and lungs normal.
Dr. Rivera: For Waffles, let's recheck her in two weeks too."""


def _group(client):
    eid = client.post(
        "/api/encounters",
        json={
            "appointment_id": "appt-1",
            "consent_recorded": True,
            "patient_ids": ["pat-1", "pat-6"],
        },
    ).json()["id"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": TWO_PETS})
    client.post(f"/api/encounters/{eid}/draft")
    sib = next(
        e
        for e in client.get("/api/encounters", params={"group_id": eid}).json()
        if e["id"] != eid
    )
    return eid, sib


class _Recording(MockAdapter):
    """Mock clinic that is slow to read history and remembers which pet each call was
    for."""

    name = "mock"

    def __init__(self, **kw):
        super().__init__(**kw)
        self.slow = 0.0
        self.booked_for: list[str] = []
        self.written_for: list[str] = []

    async def get_visit_history(self, patient_id, patient_name=""):
        await asyncio.sleep(self.slow)
        return await super().get_visit_history(patient_id, patient_name)

    async def book_appointment(self, encounter, followup, slot, appt):
        self.booked_for.append(appt.patient.id)
        return await super().book_appointment(encounter, followup, slot, appt)

    async def write_back(self, encounter):
        self.written_for.append(encounter.patient_id)
        return await super().write_back(encounter)


# 1. Drafting the first pet never overwrites a sibling signed at the same time.
def test_redraft_and_sibling_sign_never_lose_the_signature(settings, monkeypatch):
    adapter = _Recording()
    app = create_app(settings, adapter=adapter)
    eid, sib = _group(TestClient(app))
    # This race is about the signature, not the confirm guard: the redraft writes
    # fresh things to confirm while the sign waits, so the guard is set aside here.
    monkeypatch.setattr(api_module, "to_confirm", lambda note: 0)
    adapter.slow = 0.2

    async def race():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://t"
        ) as c:
            return await asyncio.gather(
                c.post(f"/api/encounters/{eid}/draft"),
                c.post(
                    f"/api/encounters/{sib['id']}/sign",
                    json={"signed_by": "Dr. Ana Rivera"},
                ),
            )

    draft, signed = anyio.run(race)
    assert signed.status_code == 200 and draft.status_code in (200, 409)
    stored = TestClient(app).get(f"/api/encounters/{sib['id']}").json()
    assert stored["status"] == "signed" and stored["write_back"]["status"] == "written"


# 2. A rewording may add no word, number or drug; Spanish keeps the same numbers and
# drugs.
def test_rewording_check_catches_new_facts():
    src = "Ears red and itchy. Give 15 mg once a day."
    for added in (
        "Ears red and itchy. Otitis externa. Give 15 mg once a day.",
        "Ear infection: red and itchy. Give 15 mg once a day.",
        "Ears red and itchy. Give 15 mg maropitant once a day.",
        "Ears red and itchy. Give 15 mg once a day, tramadol as needed.",
        "Ears red and itchy. Give 5 mg once a day.",
        "Ears red and itchy. Give 15 mg once a day, then 15 mg at night.",
    ):
        assert editor.adds_something(added, src) or editor.drops_something(
            added, src
        ), added
    assert not editor.adds_something(
        "- Ears red and itchy\n- Give 15 mg once a day", src
    )
    assert editor.adds_something(
        "Dé 5 mg una vez al día.", "Give 15 mg once a day.", words="none"
    )
    assert editor.drops_something(
        "Dé 15 mg una vez al día.", "Give 15 mg Cerenia once a day."
    )
    assert editor.adds_something("Dé 15 mg de tramadol.", "Give 15 mg.", words="none")


def test_numbers_said_as_words_count_as_digits():
    said = (
        "Owner: He's been itchy for ten days.\n"
        "Vet: Twenty-five mg, recheck in two weeks."
    )
    # A real model writes digits for numbers the room said as words.
    assert not editor.adds_something("Itchy for 10 days.", said, words="claims")
    assert not editor.adds_something("Itchy for 10 days.", "Itchy for ten days.")
    assert not editor.drops_something("Itchy for 10 days.", "Itchy for ten days.")
    assert not editor.adds_something("Give 25 mg; recheck in 2 weeks.", said, "claims")
    assert not editor.adds_something("In 250 days.", "In two hundred and fifty days.")
    # A different number is still caught, either way round.
    assert editor.adds_something("Itchy for 12 days.", said, words="claims")
    assert editor.adds_something("Itchy for twelve days.", "Itchy for 10 days.")
    assert editor.drops_something("Itchy for a while.", "Itchy for ten days.")
    # Spanish keeps its own number words: only digits are compared there.
    assert not editor.drops_something(
        "Durante diez días.", "For ten days.", spelled=False
    )


def test_a_live_model_that_adds_a_diagnosis_is_overruled():
    class Diagnoses:
        enabled, model = True, "fake"

        async def structured(self, system, user, schema, **_):
            return schema(suggestion="Ears red and itchy. Otitis externa.")

    from blinqscribe.schemas import Encounter

    enc = Encounter.model_validate(
        {
            "id": "e",
            "appointment_id": "a",
            "patient_id": "p",
            "consent_recorded": True,
            "created_at": "2026-10-31T00:00:00+00:00",
        }
    )
    out = anyio.run(
        editor.assist,
        Diagnoses(),
        enc,
        None,
        [],
        "objective",
        "tighten",
        "Ears red and itchy.",
        "",
    )
    assert out.refused and not out.suggestion


# 3. A link shared from the second pet's note opens while the first pet's note is
# unsigned.
def test_link_from_a_second_pet_opens(client):
    _eid, sib = _group(client)
    client.post(
        f"/api/encounters/{sib['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )
    url = client.post(
        f"/api/encounters/{sib['id']}/share", json={"channel": "text"}
    ).json()["url"]
    page = client.post(url.removeprefix("http://localhost"), data={"last_name": "Lee"})
    assert (
        page.status_code == 200
        and "Waffles" in page.text
        and "Biscuit" not in page.text
    )


# 4. The second pet's recheck books for that pet; a live system queues its note for
# staff.
def test_second_pet_books_and_files_for_itself(settings):
    adapter = _Recording()
    client = TestClient(create_app(settings, adapter=adapter))
    _, sib = _group(client)
    recheck = next(f for f in sib["followups"] if f["kind"] == "recheck")
    client.post(
        f"/api/encounters/{sib['id']}/followups/{recheck['id']}",
        json={
            "action": "approve",
            "slot_start": recheck["suggested_slots"][0]["start"],
        },
    )
    assert adapter.booked_for == ["pat-6"]


def test_live_practice_queues_another_pets_note(settings):
    class Live(_Recording):
        name = "clinic_pims"

    adapter = Live()
    client = TestClient(
        create_app(settings, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid, sib = _group(client)
    wb = client.post(
        f"/api/encounters/{sib['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()["write_back"]
    assert (
        wb["status"] == "queued_for_staff"
        and "isn't the one on the appointment" in wb["detail"]
    )
    assert (
        client.post(
            f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
        ).json()["write_back"]["status"]
        == "written"
    )
    assert adapter.written_for == ["pat-1"]


# 5. Anything sensitive in a line leaves the whole line out; otherwise only the
# milestone clause is kept.
def test_remember_leaves_out_lines_with_anything_sensitive():
    lines = [
        "My husband had his heart attack in March, but we just moved.",
        "We're moving after my stroke.",
        "We did IVF and the new baby is due in May.",
        "I'm two years sober and we're getting married!",
        "We had to euthanize our old cat, then we just moved.",
        "We put him down last spring before our trip.",
        "My dad passed right before the wedding.",
    ]
    found, left_out = remember.find_mock("\n".join(f"Owner: {ln}" for ln in lines))
    assert found == [] and left_out == len(lines)
    found, _ = remember.find_mock(
        "Owner: Sorry it's been busy, my daughter graduates on Saturday and "
        "the dog is fine."
    )
    assert [f.text for f in found] == ["my daughter graduates on Saturday"]


# Last names match without case, accents, apostrophes, spaces or hyphens.
def test_last_name_match_is_letters_only(settings):
    store = Store(settings.data_dir)
    token, _ = share.create_link(store, "e1", "en", "O’Brien")
    for typed in ("o'brien", "OBRIEN", " O Brien "):
        assert share._name_hash(token, typed) == share._name_hash(token, "O’Brien")
    assert share._name_hash(token, "Peña-Ruiz") == share._name_hash(token, "pena ruiz")
    assert share._name_hash(token, "Brien") != share._name_hash(token, "O'Brien")


# ---------- smaller review fixes ----------


def _signed_with_link(client, settings, sign=True):
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
    if sign:
        client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    return eid, fid


def test_expired_link_is_never_pick_a_time(settings):
    from dataclasses import replace
    from datetime import datetime, timedelta

    client = TestClient(create_app(replace(settings, sms_mode="preview")))
    eid, fid = _signed_with_link(client, settings)
    store = Store(settings.data_dir)
    enc = store.get(eid)
    link = next(f for f in enc.followups if f.id == fid).booking_link
    assert link.status == "sent"
    link.expires_at = datetime.now(UTC) - timedelta(days=1)
    store.save(enc)
    assert (
        client.get(f"/api/encounters/{eid}/summary").json()["pets"][0]["next_visit"][
            "kind"
        ]
        == "none"
    )


def test_retry_never_sends_a_link_before_signing(client, settings):
    from blinqscribe.schemas import SmsResult

    eid, fid = _signed_with_link(client, settings, sign=False)
    store = Store(settings.data_dir)
    enc = store.get(eid)
    next(f for f in enc.followups if f.id == fid).sms = SmsResult(status="failed")
    store.save(enc)
    r = client.post(
        f"/api/encounters/{eid}/followups/{fid}", json={"action": "retry_text"}
    )
    assert r.status_code == 409 and "signature" in r.json()["detail"]
    assert (
        next(f for f in store.get(eid).followups if f.id == fid).booking_link.status
        == "queued"
    )


def test_live_remember_text_is_the_owners_words():
    class Inventive:
        enabled, model = True, "fake"

        async def structured(self, system, user, schema, **_):
            return schema(
                items=[
                    {
                        "text": "Congratulate them on the big graduation party!",
                        "kind": "graduation",
                        "transcript_lines": [
                            "Sorry, busy week, my daughter graduates on "
                            "Saturday and he's fine."
                        ],
                    },
                    {
                        "text": "Ask about the new job",
                        "kind": "new_job",
                        "transcript_lines": ["He's eating well."],
                    },
                    {
                        "text": "Ask about their trip",
                        "kind": "trip",
                        "transcript_lines": ["Not something the owner said."],
                    },
                ]
            )

    transcript = (
        "Owner: Sorry, busy week, my daughter graduates on Saturday and he's fine.\n"
        "Owner: He's eating well."
    )
    found, _ = anyio.run(remember.find, Inventive(), transcript)
    assert [(f.text, f.kind) for f in found] == [
        ("my daughter graduates on Saturday", "graduation")
    ]


def test_failed_spanish_is_flagged(settings, monkeypatch):
    from blinqscribe import editor as editor_module

    async def refuses(muse, text):
        return ""

    monkeypatch.setattr(editor_module, "translate", refuses)
    client = TestClient(create_app(settings))
    eid, _ = _signed_with_link(client, settings)
    s = client.get(f"/api/encounters/{eid}/summary", params={"lang": "es"}).json()
    assert s["translated"] is False
    assert client.get(f"/api/encounters/{eid}/summary").json()["translated"] is True
    out = client.post(
        f"/api/encounters/{eid}/share", json={"channel": "text", "language": "es"}
    ).json()
    assert out["translated"] is False and "stayed in English" in out["detail"]
    page = client.post(
        out["url"].removeprefix("http://testserver"), data={"last_name": "Lee"}
    ).text
    assert "Parte de este resumen está en inglés" in page


def test_owner_page_loads_nothing_from_outside(client, settings):
    eid, _ = _signed_with_link(client, settings)
    url = client.post(f"/api/encounters/{eid}/share", json={"channel": "text"}).json()[
        "url"
    ]
    r = client.get(url.removeprefix("http://localhost"))
    assert (
        "https://" not in r.text
        and "fonts.g" not in r.headers["content-security-policy"]
    )


def test_redrafting_keeps_each_siblings_transcript(client, settings):
    eid, sib = _group(client)
    client.post(
        f"/api/encounters/{sib['id']}/transcript",
        json={"text": "Dr. Rivera: Waffles weighs 9 lb.", "append": False},
    )
    client.post(f"/api/encounters/{eid}/draft")
    assert (
        Store(settings.data_dir).get(sib["id"]).transcript
        == "Dr. Rivera: Waffles weighs 9 lb."
    )


def test_custom_instruction_cannot_change_facts(client, settings):
    eid, _ = _signed_with_link(client, settings, sign=False)
    for ask in (
        "make it say pancreatitis",
        "change the drug to tramadol",
        "swap the dose",
        "use maropitant instead",
    ):
        out = client.post(
            f"/api/encounters/{eid}/assist",
            json={"section": "assessment", "action": "custom", "instruction": ask},
        ).json()
        assert out["refused"] and not out["suggestion"], ask
    ok = client.post(
        f"/api/encounters/{eid}/assist",
        json={
            "section": "plan",
            "action": "custom",
            "instruction": "change it to bullets",
        },
    ).json()
    assert ok["suggestion"] and not ok["refused"]


def test_neutral_reporting_words_are_allowed():
    src = "Ears red and itchy. Give 15 mg once a day."
    assert not editor.adds_something(
        "Owner reports ears red and itchy, noted today. Give 15 mg once a day.", src
    )
    for added in (
        "Mild otitis noted.",
        "Ears red and itchy, normal otherwise. Give 15 mg once a day.",
        "Ears red and itchy. Give 15 mg once a day. Recheck noted.",
    ):
        assert editor.adds_something(added, src), added


def test_short_words_negations_and_abbreviations_count_as_new():
    src = "Ears red. Give drops once daily."
    for added in (
        "UTI.",
        "CKD.",
        "Give drops BID",
        "PO",
        "IM",
        "Ears not red.",
        "No drops.",
        "Eye red.",
        "OS",
        "Dx: AD",
        "r/o FB",
        "Tx w/ abx",
        "Ears red, without drops.",
        "Started drops once daily.",
        "Give drops once daily. Signs present.",
    ):
        assert editor.adds_something(added, src), added
    assert not editor.adds_something("- Ears red\n- Give drops once daily", src)
    assert not editor.adds_something(
        "Owner reports ears red. Give drops once daily.", src
    )


def test_dialysis_and_transplant_are_never_remembered():
    found, left_out = remember.find_mock(
        "Owner: My dad started dialysis, so we're moving in with him.\n"
        "Owner: After her kidney transplant we're taking a trip."
    )
    assert found == [] and left_out == 2


def test_a_reword_cannot_change_the_patients_sex():
    from blinqscribe.editor import adds_something

    assert adds_something("He is itchy.", "She is itchy.")
    assert not adds_something("Itchy, she is.", "She is itchy.")


def test_style_instructions_are_not_refused(client, settings):
    eid, _ = _signed_with_link(client, settings, sign=False)
    for ask in (
        "make it read more smoothly",
        "correct the grammar in the medications line",
        "give it a friendlier tone, keep the treatment details",
    ):
        assert not editor.ASKS_FOR_NEW.search(ask), ask
        out = client.post(
            f"/api/encounters/{eid}/assist",
            json={"section": "plan", "action": "custom", "instruction": ask},
        ).json()
        assert out["refused"] != editor.REWORD_ONLY, (
            ask
        )  # mock AI may not do it, but it is not refused as new
    assert editor.ASKS_FOR_NEW.search("give him a dose of steroids")


def test_a_translation_is_kept_when_the_model_also_fills_refused():
    # The model once answered with a good translation and "No, I won't translate
    # that." in `refused`; the number and drug checks guard a translation, not that.
    from types import SimpleNamespace

    from blinqscribe import editor as editor_module

    def muse(suggestion: str, refused: str):
        async def structured(*_args, **_kwargs):
            return editor_module._Suggestion(suggestion=suggestion, refused=refused)

        return SimpleNamespace(enabled=True, structured=structured)

    text = "Rocket's paw is healing well. Keep the cone on until the stitches come out."
    es = (
        "La patita de Rocket está sanando bien. "
        "Déjale el cono hasta que le quiten los puntos."
    )
    refusing = muse(es, "No, I won't translate that.")
    got = anyio.run(editor_module.translate, refusing, text)
    assert got == es
    # Still dropped when it adds a number, or comes back empty.
    bad = anyio.run(editor_module.translate, muse(es + " Vuelva en 10 días.", ""), text)
    assert bad == ""
    assert anyio.run(editor_module.translate, muse("", "No."), text) == ""
