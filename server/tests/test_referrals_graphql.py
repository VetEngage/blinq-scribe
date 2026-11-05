"""Letters through /graphql: the whole flow the console runs."""

from dataclasses import replace
from typing import Any

from fastapi.testclient import TestClient

from blinqscribe.api import create_app

LETTER = (
    "{ id kind status drafted body reason owner_consent pdf_url sent_to "
    "recipient { name email } attachments { note_encounter_ids invoice_ids } "
    "sent { channel status to_masked } }"
)


def _gql(client: TestClient, query: str, **variables: Any) -> Any:
    r = client.post("/graphql", json={"query": query, "variables": variables})
    assert r.status_code == 200, r.text
    return r.json()


def _ok(client: TestClient, query: str, **variables: Any) -> Any:
    body = _gql(client, query, **variables)
    assert not body.get("errors"), body
    return body["data"]


def test_create_edit_sign_and_send_over_graphql(settings):
    client = TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})

    created = _ok(
        client,
        "mutation($e: String!, $in: LetterInput) "
        "{ create_letter(encounter_id: $e, input: $in) " + LETTER + " }",
        e=eid,
        **{
            "in": {
                "kind": "referral",
                "recipient": {"name": "Dr. Priya Shah", "email": "priya@lake.test"},
                "reason": "Please assess for an allergy.",
                "urgency": "soon",
            }
        },
    )["create_letter"]
    lid = created["id"]
    assert created["drafted"] == "mock" and created["status"] == "draft"
    assert created["attachments"] == {"note_encounter_ids": [eid], "invoice_ids": []}
    send = (
        "mutation($id: String!, $c: [String!]!) "
        "{ send_letter(id: $id, channels: $c, owner_copy: true) "
        "{ letter { status sent_to } results { channel status to subject url } } }"
    )
    no_consent = _gql(client, send, id=lid, c=["email"])
    assert "Record that the owner agreed" in no_consent["errors"][0]["message"]
    body = created["body"].replace("[confirm:", "(checked:")
    _ok(
        client,
        "mutation($id: String!, $in: LetterInput!) "
        "{ update_letter(id: $id, input: $in) { owner_consent } }",
        id=lid,
        **{"in": {"body": body, "owner_consent": True}},
    )
    out = _ok(client, send, id=lid, c=["email"])["send_letter"]
    assert out["letter"]["status"] == "sent"
    assert [r["channel"] for r in out["results"]] == ["email", "owner_text"]
    assert out["results"][0]["status"] == "preview"
    assert out["results"][0]["to"] == "priya@lake.test"
    locked = _gql(
        client,
        "mutation($id: String!, $in: LetterInput!) "
        "{ update_letter(id: $id, input: $in) { id } }",
        id=lid,
        **{"in": {"reason": "other"}},
    )
    assert locked["errors"][0]["message"] == "A signed letter can't be changed."
    head = _ok(client, "{ letterhead { name phone logo_url } }")["letterhead"]
    assert head["name"] == "Maple Street Animal Hospital (demo)" and head["phone"]
    signer = _ok(client, '{ letter(id: "' + lid + '") { signer_title } }')["letter"]
    assert signer["signer_title"]  # the visit's vet in the open demo
    contacts = _ok(client, '{ contacts(q: "shah") { name email } }')["contacts"]
    assert contacts == [{"name": "Dr. Priya Shah", "email": "priya@lake.test"}]
    listed = _ok(client, 'query { letters(patient_id: "pat-1") ' + LETTER + " }")
    assert [x["id"] for x in listed["letters"]] == [lid]
    bad = _gql(client, send, id=lid, c=["fax"])
    assert "channels" in bad["errors"][0]["message"]
    gone = _gql(client, "mutation($id: String!) { delete_letter(id: $id) }", id=lid)
    assert "can't be deleted" in gone["errors"][0]["message"]
