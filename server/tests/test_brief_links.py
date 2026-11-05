"""The morning brief is actionable: every item carries what the screen needs to open
it, a short row title, and a vet's brief holds only their own items."""

from test_permissions import gql, h
from test_roles_view import client, team  # noqa: F401 - fixtures

from blinqscribe.day import first_name
from blinqscribe.schemas import FollowUpKind, followup_title


def test_every_update_links_to_where_it_opens(client):  # noqa: F811
    brief = client.get("/api/brief").json()
    by_kind = {u["kind"]: u for u in brief["new_since_yesterday"]}
    result, reply, booked = by_kind["result"], by_kind["reply"], by_kind["booked"]
    docs = client.get(f"/api/patients/{result['patient_id']}/documents").json()
    assert result["document_id"] in {d["id"] for d in docs}
    assert reply["client_id"] == "cli-1" and reply["patient_id"] == "pat-1"
    assert booked["appointment_id"] == "appt-5" and booked["patient_id"] == "pat-5"
    for u in brief["new_since_yesterday"]:
        assert u["patient_id"] and u["client_id"]


def test_rows_get_a_short_title_and_keep_the_spoken_text(client):  # noqa: F811
    brief = client.get("/api/brief").json()
    for item in brief["from_yesterday"]:
        assert item["patient_id"] and item["title"]
        assert item["patient_name"] not in item["title"]
        assert item["patient_name"] in item["text"]  # Read aloud keeps the sentence
    assert {i["title"] for i in brief["from_yesterday"]} >= {
        "Sign note",
        "Text didn't send",
    }
    # The To do row: short, with the pet or the owner's first name, never the reason.
    labels = {i["kind"]: i["label"] for i in brief["from_yesterday"]}
    for i in brief["from_yesterday"]:
        assert i["label"] and len(i["label"]) <= 40
        if i["kind"] == "followup":
            assert i["label"] == f"Approve {i['patient_name']}'s follow up"
            assert i["reason"] not in i["label"]
        if i["kind"] == "unsigned" and i.get("status") == "draft_ready":
            assert i["label"] == f"Sign {i['patient_name']}'s note"
    assert labels["failed_text"].startswith("Text to ")
    assert labels["failed_text"].endswith(" didn't send")
    assert " Lee" not in labels["failed_text"]  # first name only
    assert all(hu["patient_id"] for hu in brief["heads_up"])
    assert first_name("Jordan Lee") == "Jordan"
    assert first_name("the owner") == "the owner"
    assert first_name("") == "the owner"


def test_a_vet_s_brief_holds_their_own_items(client, team):  # noqa: F811
    def brief(role):
        return client.get("/api/brief", headers=h(team[role])).json()

    okafor, rivera, front = brief("okafor"), brief("rivera"), brief("front")
    assert {u["patient_name"] for u in okafor["new_since_yesterday"]} == {"Pepper"}
    assert "Pepper" not in {u["patient_name"] for u in rivera["new_since_yesterday"]}
    assert okafor["from_yesterday"] == []  # the seeded history is Rivera's
    assert {hu["patient_name"] for hu in okafor["heads_up"]} <= {"Pepper"}
    assert len(front["new_since_yesterday"]) == 3  # the front desk sees the clinic's
    assert {i["patient_id"] for i in front["from_yesterday"]} >= {
        i["patient_id"] for i in rivera["from_yesterday"]
    }


def test_the_graphql_brief_has_the_links(client):  # noqa: F811
    data = gql(
        client,
        "",
        "{ brief { from_yesterday { title patient_id encounter_id } "
        "heads_up { patient_id appointment_id } "
        "new_since_yesterday { kind patient_id appointment_id client_id "
        "document_id } } }",
    )["data"]["brief"]
    assert data["from_yesterday"][0]["title"]
    kinds = {u["kind"]: u for u in data["new_since_yesterday"]}
    assert kinds["result"]["document_id"] and kinds["reply"]["client_id"]


def test_every_brief_item_has_a_short_line_to_show(client):  # noqa: F811
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    brief = client.get("/api/brief").json()
    details = {u["kind"]: u["detail"] for u in brief["new_since_yesterday"]}
    assert details == {
        "result": "Kidney panel",
        "reply": "Jordan Lee: Biscuit is shaking his head again",
        "booked": "11:30 AM today",
    }
    rows = {i["kind"]: i for i in brief["from_yesterday"]}
    # The demo's failed text is on the weekday before last; its pet and owner depend
    # on the day of the week.
    failed = rows["failed_text"]
    owner = failed["detail"].removeprefix("To ")
    assert failed["detail"] == f"To {owner}" and owner
    assert rows["unsigned"]["detail"] == "Draft ready"
    pending = brief["pending_followups"]
    # The row's title is the server's short follow up title, never the raw reason.
    assert pending and all(
        p["title"]
        == f"Approve follow up: {followup_title(FollowUpKind(p['kind']), p['reason'])}"
        for p in pending
    )
    assert {
        (p["patient_id"], p["patient_name"], p["appointment_id"]) for p in pending
    } >= {("pat-1", "Biscuit", "appt-1")}
    # The spoken sentences stay whole for Read aloud.
    assert (
        failed["text"] == f"Text to {owner} about {failed['patient_name']} did not send"
    )
    gql_brief = gql(
        client,
        "",
        "{ brief { new_since_yesterday { detail } from_yesterday { detail } "
        "pending_followups { title } } }",
    )["data"]["brief"]
    assert {u["detail"] for u in gql_brief["new_since_yesterday"]} == set(
        details.values()
    )
