"""The visit page (step 3): the server never signs a note still marked to confirm,
and Before you walk in is dated facts in plain words, never advice."""

from datetime import date, timedelta

import pytest

from blinqscribe.day import to_confirm
from blinqscribe.plain import plain_markers, plain_words
from blinqscribe.schemas import SoapNote


def _drafted(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    return client.post(f"/api/encounters/{eid}/draft").json()


def _sign(client, eid):
    return client.post(
        f"/api/encounters/{eid}/sign",
        json={"signed_by": "Dr. Ana Rivera", "send": False},
    )


@pytest.mark.confirms_left
def test_a_note_with_something_to_confirm_is_never_signed(client):
    enc = _drafted(client)
    note = enc["note"]
    assert to_confirm(SoapNote(**note)) >= 1
    refused = _sign(client, enc["id"])
    assert refused.status_code == 409
    assert "confirm" in refused.json()["detail"]
    assert client.get(f"/api/encounters/{enc['id']}").json()["status"] != "signed"

    # Confirmed (the marker gone), it signs.
    clean = {
        k: (
            v.replace("- [confirm: ear drop product and duration]\n", "")
            if k == "plan"
            else v
        )
        for k, v in note.items()
    }
    clean["plan"] = "\n".join(
        ln for ln in clean["plan"].splitlines() if "[confirm" not in ln
    )
    client.put(f"/api/encounters/{enc['id']}/note", json=clean)
    signed = _sign(client, enc["id"])
    assert signed.status_code == 200, signed.text
    assert signed.json()["encounter"]["status"] == "signed"


def test_a_marker_anywhere_counts(client):
    assert to_confirm(SoapNote(client_summary="Give [confirm: dose] twice a day")) == 1
    assert to_confirm(SoapNote(medications=["Otic drops [Confirm: product]"])) == 1
    assert to_confirm(SoapNote(vitals={"weight": "[confirm: 74 lb]"})) == 1
    assert to_confirm(SoapNote(plan="Recheck in 2 weeks")) == 0


@pytest.mark.confirms_left
def test_signing_over_graphql_is_refused_too(client):
    enc = _drafted(client)
    out = client.post(
        "/graphql",
        json={
            "query": "mutation($id: String!) { sign_note(encounter_id: $id, "
            'signed_by: "Dr. Ana Rivera", send: false) { encounter { status } } }',
            "variables": {"id": enc["id"]},
        },
    ).json()
    assert out.get("errors"), out
    assert "confirm" in out["errors"][0]["message"]


def test_plan_shorthand_in_plain_words():
    assert (
        plain_words("Rx Apoquel 16 mg PO BID x14d, then SID")
        == "Apoquel 16 mg by mouth twice a day for 14 days, then once a day"
    )
    assert plain_words("Recheck 4 wk") == "Recheck in 4 weeks"


def test_before_you_walk_in_is_dated_facts(client):
    # The practice's notes, synced as at onboarding (the demo server does it at start).
    assert client.post("/api/admin/onboard", json={"days": 365}).status_code == 200
    card = client.get("/api/appointments/appt-1/card").json()
    entries = card["walk_in"]
    kinds = [e["kind"] for e in entries]
    assert kinds[0] == "message"
    assert "shaking his head again" in entries[0]["text"]
    plan = next(e for e in entries if e["kind"] == "plan")
    assert plan["mine"] is True
    lines = [i["text"] for i in plan["items"]]
    assert lines == [
        "Apoquel 16 mg by mouth twice a day for 14 days, then once a day",
        "Recheck in 4 weeks",
    ]
    apoquel, recheck = plan["items"]
    assert apoquel["note"] == (
        f"30 tablets dispensed {date.fromisoformat(plan['date']):%b %-d}, none since"
    )
    due = date.fromisoformat(plan["date"]) + timedelta(weeks=4)
    assert recheck["status"] == f"Was due {due:%b %-d}, not booked"
    # An older visit about the same problem (an ear), in plain words.
    older = [e for e in entries if e["kind"] == "visit"]
    assert older and older[0]["text"].startswith("Ear infection, left.")
    assert [e["date"] for e in entries] == sorted(
        (e["date"] for e in entries), reverse=True
    )
    # Care due within 30 days, as a fact.
    assert any(x.startswith("Rabies vaccine due ") for x in card["can_do_today"])
    # Never advice or a guess.
    said = " ".join(
        [e["text"] for e in entries]
        + [i["text"] + i["status"] + i["note"] for e in entries for i in e["items"]]
    ).lower()
    for word in ("likely", "relapse", "check for", "consider", "suggest"):
        assert word not in said
    for shorthand in (" po ", " bid", " sid", "x14d", " wk"):
        assert shorthand not in f" {said} "


def test_markers_say_plain_words():
    assert (
        plain_markers("Rx [confirm: name/dose] BID")
        == "Rx [confirm: name and dose] BID"
    )
    assert (
        plain_markers("[confirm: product/dose/duration]")
        == "[confirm: product, dose and duration]"
    )
    assert plain_markers("[confirm: volume]") == "[confirm: volume]"
