"""Several pets in one visit, note types, and the edit tools."""

from dataclasses import replace

import anyio
from fastapi.testclient import TestClient

from blinqscribe import editor
from blinqscribe.accounts import Accounts
from blinqscribe.api import create_app
from blinqscribe.store import Store


def _start(client, appt="appt-1", **kw):
    return client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True, **kw}
    )


def _drafted(client, transcript=None, **kw):
    eid = _start(client, **kw).json()["id"]
    text = transcript or client.get("/api/sample-transcript").json()["text"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    return client.post(f"/api/encounters/{eid}/draft").json()


TWO_PETS = """Dr. Rivera: Hi Jordan, let's start with Biscuit.
Owner: Biscuit has been scratching his right ear for four days.
Dr. Rivera: Biscuit weighs 74 lb. The right ear canal is red with brown discharge.
Dr. Rivera: Now Waffles. She is here for her yearly checkup.
Dr. Rivera: Waffles weighs 9 lb, heart and lungs sound normal.
Owner: She has been eating well."""


def test_note_types_and_the_guess(client):
    types = {t["id"]: t for t in client.get("/api/note-types").json()}
    assert set(types) == {
        "sick",
        "wellness",
        "recheck",
        "surgery",
        "dental",
        "radiology",
        "phone",
        "progress",
    }
    assert [s["label"] for s in types["surgery"]["sections"]] == [
        "Pre-op",
        "Procedure",
        "Findings",
        "Recovery and plan",
        "For the owner",
    ]
    assert _start(client, "appt-1").json()["note_type"] == "sick"
    assert _start(client, "appt-2").json()["note_type"] == "recheck"
    assert _start(client, "appt-4").json()["note_type"] == "wellness"
    assert _start(client, "appt-1", note_type="dental").json()["note_type"] == "dental"
    assert _start(client, "appt-1", note_type="karaoke").status_code == 400


def test_change_note_type_until_signed(client):
    enc = _drafted(client)
    url = f"/api/encounters/{enc['id']}/note-type"
    assert (
        client.put(url, json={"note_type": "recheck"}).json()["note_type"] == "recheck"
    )
    assert client.put(url, json={"note_type": "nope"}).status_code == 400
    client.post(
        f"/api/encounters/{enc['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )
    assert client.put(url, json={"note_type": "sick"}).status_code == 409


def test_pets_must_share_the_owner(client):
    assert (
        _start(client, patient_ids=["pat-1", "pat-2"]).status_code == 400
    )  # Miso is another owner's cat
    enc = _start(client, patient_ids=["pat-1", "pat-6"]).json()
    assert enc["patient_ids"] == ["pat-1", "pat-6"] and enc["group_id"] == enc["id"]
    assert (
        enc["patient_name"] == "Biscuit"
        and enc["client_id"] == "cli-1"
        and enc["owner_name"] == "Jordan Lee"
    )


def test_multi_pet_draft_makes_one_note_per_pet(client):
    first = _drafted(client, TWO_PETS, patient_ids=["pat-1", "pat-6"])
    group = client.get("/api/encounters", params={"group_id": first["id"]}).json()
    assert [e["patient_name"] for e in group] == ["Biscuit", "Waffles"]
    biscuit, waffles = group
    assert waffles["group_id"] == first["id"] and waffles["appointment_id"] == "appt-1"
    assert (
        waffles["patient_id"] == "pat-6"
        and waffles["transcript"] == biscuit["transcript"]
    )
    assert (
        biscuit["note"]["vitals"]["weight"] == "74 lb"
        and waffles["note"]["vitals"]["weight"] == "9 lb"
    )
    assert (
        "discharge" not in waffles["note"]["objective"]
    )  # Biscuit's finding stays on Biscuit
    assert "Waffles" in waffles["note"]["client_summary"]

    # Redrafting the first pet updates the sibling in place, never a second copy.
    client.post(f"/api/encounters/{first['id']}/draft")
    assert (
        len(client.get("/api/encounters", params={"group_id": first["id"]}).json()) == 2
    )

    # Each pet is signed and written back on its own.
    signed = client.post(
        f"/api/encounters/{waffles['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()
    assert signed["write_back"]["pims_id"] == f"mock-note-{waffles['id']}"
    assert (
        client.get(f"/api/encounters/{first['id']}").json()["status"] == "draft_ready"
    )
    assert (
        client.post(f"/api/encounters/{first['id']}/draft").status_code == 409
    )  # a sibling is signed


def test_personal_small_talk_stays_out_of_the_note(client):
    note = _drafted(client)["note"]
    text = " ".join(str(v) for v in note.values()).lower()
    assert "graduat" not in text and "moving" not in text and "scratching" in text


def _assist(client, eid, **body):
    return client.post(f"/api/encounters/{eid}/assist", json=body)


def test_assist_rewords_and_saves_nothing(client):
    enc = _drafted(client)
    eid, plan = enc["id"], enc["note"]["plan"]
    for action in ("tighten", "bullets", "prose"):
        out = _assist(client, eid, section="plan", action=action).json()
        assert out["mock"] and not out["refused"] and out["suggestion"]
        assert "Cefpodoxime 100 mg" in out["suggestion"]  # every drug and dose stays
        assert not editor.adds_something(out["suggestion"], plan)
    bullets = _assist(client, eid, section="plan", action="bullets").json()[
        "suggestion"
    ]
    assert all(line.startswith("- ") for line in bullets.splitlines())
    custom = _assist(
        client,
        eid,
        section="plan",
        action="custom",
        instruction="put the recheck first",
    ).json()
    assert custom["suggestion"].removeprefix("- ").startswith("Recheck in two weeks")
    assert (
        client.get(f"/api/encounters/{eid}").json()["note"]["plan"] == plan
    )  # nothing saved


def test_assist_refuses_new_facts(client):
    eid = _drafted(client)["id"]
    for ask in (
        "add a diagnosis",
        "Add a drug for the itching",
        "what's wrong with him?",
        "give him a dose of steroids",
    ):
        out = _assist(
            client, eid, section="assessment", action="custom", instruction=ask
        ).json()
        assert out["refused"] and out["suggestion"] == "", ask
    assert _assist(client, eid, section="plan", action="translate_es").json()[
        "refused"
    ]  # owner summary only


def test_a_model_that_adds_a_drug_is_overruled(client, settings):
    class AddsADrug:
        enabled, model = True, "fake"

        async def structured(self, system, user, schema, **_):
            return schema(
                suggestion="Start Prednisone 10 mg once a day. Recheck in two weeks."
            )

    enc = Store(settings.data_dir).get(_drafted(client)["id"])
    for action in ("tighten", "custom", "translate_es"):
        section = "client_summary" if action == "translate_es" else "plan"
        out = anyio.run(
            editor.assist,
            AddsADrug(),
            enc,
            None,
            ["Biscuit"],
            section,
            action,
            getattr(enc.note, section),
            "make it friendlier",
        )
        assert out.refused and not out.suggestion, action


def test_sources_and_repull(client):
    enc = _drafted(client)
    out = _assist(
        client,
        enc["id"],
        section="objective",
        action="sources",
        text="Right ear canal is red and swollen. Mild dental tartar.",
    ).json()
    assert out["sources"][0]["lines"] == [6] and "swollen" in out["sources"][0]["text"]
    assert out["unsourced"] == ["Mild dental tartar."]
    repull = _assist(client, enc["id"], section="plan", action="repull").json()
    assert "Cefpodoxime 100 mg" in repull["suggestion"] and not repull["refused"]


def test_spanish_keeps_doses(client):
    eid = _drafted(client)["id"]
    out = _assist(
        client,
        eid,
        section="client_summary",
        action="translate_es",
        text="Thanks for bringing Biscuit in today. Give 1 tablet twice a day for "
        "ten days.",
    ).json()
    assert out["suggestion"].startswith("Gracias por traer a Biscuit hoy.")
    assert "1 tablet" in out["suggestion"] and "dos veces al día" in out["suggestion"]


def test_templates(client):
    clinic = client.get("/api/templates").json()
    assert len(clinic) == 3 and {t["owner"] for t in clinic} == {"clinic"}
    assert [
        t["shortcut"]
        for t in client.get("/api/templates", params={"note_type": "dental"}).json()
    ] == ["dentalhome", "earnormal"]
    mine = client.post(
        "/api/templates",
        json={
            "name": "Ear meds",
            "shortcut": "earmeds",
            "text": "Clean ears, then drops.",
        },
    ).json()
    assert mine["owner"] == "me"
    assert (
        client.post(
            "/api/templates", json={"name": "x", "shortcut": "earmeds", "text": "y"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/templates",
            json={"name": "x", "shortcut": "Bad Shortcut", "text": "y"},
        ).status_code
        == 400
    )
    updated = client.put(
        f"/api/templates/{mine['id']}",
        json={"name": "Ear meds", "shortcut": "earmeds", "text": "Clean ears daily."},
    ).json()
    assert updated["text"] == "Clean ears daily."
    assert client.delete(f"/api/templates/{mine['id']}").json() == {"ok": True}
    assert len(client.get("/api/templates").json()) == 3


def test_only_admins_change_clinic_templates(settings):
    c = TestClient(
        create_app(replace(settings, api_token="s3cret")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    admin = {"Authorization": "Bearer s3cret"}
    c.post(
        "/api/admin/users",
        headers=admin,
        json={"username": "vet1", "name": "Dr. One", "provider_id": "prov-1"},
    )
    accounts = Accounts(Store(settings.data_dir))
    user = next(u for u in accounts.list() if u.username == "vet1")
    token = c.post(
        "/api/auth/invite/accept",
        json={"token": accounts.reinvite(user.id), "password": "a long password 1"},
    ).json()["token"]
    vet = {"Authorization": f"Bearer {token}"}
    tid = c.get("/api/templates", headers=vet).json()[0]["id"]
    assert c.delete(f"/api/templates/{tid}", headers=vet).status_code == 403
    assert (
        c.post(
            "/api/templates",
            headers=vet,
            json={"name": "x", "shortcut": "x1", "text": "y", "owner": "clinic"},
        ).status_code
        == 403
    )
    assert c.delete(f"/api/templates/{tid}", headers=admin).status_code == 200
