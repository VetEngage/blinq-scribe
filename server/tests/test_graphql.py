"""The GraphQL API at /graphql: every operation resolves through the REST handlers,
with the same auth, errors and results. Subscriptions over graphql-transport-ws."""

import json
import uuid
from dataclasses import replace
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from blinqscribe.api import create_app
from blinqscribe.gql.sdl import SDL_PATH, sdl
from blinqscribe.store import Store


@pytest.fixture
def gql_client(settings):
    # sms preview so booking links go out; localhost so the open demo is an admin
    with TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    ) as c:
        yield c


def run(client, query, token="", **variables):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    body = client.post(
        "/graphql", json={"query": query, "variables": variables}, headers=headers
    ).json()
    return body


def ok(client, query, token="", **variables):
    body = run(client, query, token, **variables)
    assert not body.get("errors"), body["errors"]
    return body["data"]


START = """mutation ($appt: String!) {
  start_encounter(input: {appointment_id: $appt, consent_recorded: true}) {
    id status patient_name note_type group_id
  }
}"""

ENCOUNTER = """
  id status note_type transcript
  note { subjective objective assessment plan vitals medications client_summary }
  followups {
    id kind status booking_mode reason
    booking_link { url from to status }
    suggested_slots { start end }
    sms { status text }
  }
  photos { id caption segments }
"""


def drafted(client, appt="appt-1"):
    eid = ok(client, START, appt=appt)["start_encounter"]["id"]
    text = ok(client, "{ sample_transcript }")["sample_transcript"]
    ok(
        client,
        "mutation ($id: String!, $t: String!) "
        "{ add_transcript(encounter_id: $id, text: $t) { id } }",
        id=eid,
        t=text,
    )
    enc = ok(
        client,
        "mutation ($id: String!) { draft_note(encounter_id: $id) {" + ENCOUNTER + "} }",
        id=eid,
    )["draft_note"]
    return eid, enc


def test_sdl_is_committed_and_current():
    assert SDL_PATH.read_text() == sdl(), (
        "web/schema.graphql is stale: run `uv run python -m blinqscribe.gql.sdl`"
    )
    for name in ("display_name", "start_time", "room_name", "appointment_date"):
        assert name not in SDL_PATH.read_text()


def test_meta_and_day(gql_client):
    data = ok(
        gql_client,
        """{
          health { ok ai practice sms }
          note_types { id name sections { key label } from_types }
          schedule { id start reason visit_status encounter_id note_type
                     patient { id name alerts } client { id full_name } }
          days { date visits open failed marker }
          brief { spoken date appointments from_yesterday { kind text }
                  heads_up { text } new_since_yesterday { kind text mock } mock }
          end_of_day { spoken visits_seen appointments left_to_do { kind }
                       done_today { text } waiting_on_owners { url }
                       tomorrow { date visits first last prepare { text } } }
          pre_room_card(appointment_id: "appt-1") {
            spoken patient owner alerts last_note { by gist } remember_items { id }
            medications
          }
          voice_profile(provider_id: "prov-1") {
            provider_id notes_used source sections { section style { format length } }
          }
        }""",
    )
    assert data["health"]["ok"] and data["health"]["practice"] == "mock"
    assert {t["id"] for t in data["note_types"]} >= {"sick", "wellness", "surgery"}
    rest = gql_client.get("/api/schedule").json()
    assert [a["id"] for a in data["schedule"]] == [a["id"] for a in rest]
    assert data["schedule"][0]["client"]["full_name"]
    assert len(data["days"]) == 7
    assert data["brief"]["spoken"] == gql_client.get("/api/brief").json()["spoken"]
    assert data["end_of_day"]["tomorrow"]["date"] == str(
        date.today() + timedelta(days=1)
    )
    assert data["pre_room_card"]["patient"] == "Biscuit"
    card = gql_client.get("/api/appointments/appt-1/card").json()
    assert data["pre_room_card"]["medications"] == card["medications"]
    assert card["medications"] and "Apoquel" in card["medications"][0]
    assert data["voice_profile"]["sections"]
    week = ok(
        gql_client,
        "query ($f: Date!) { days(from: $f, to: $f) { date } }",
        f=str(date.today()),
    )
    assert week["days"] == [{"date": str(date.today())}]


def test_patient_record(gql_client):
    data = ok(
        gql_client,
        """{
          search(q: "bisc") { pets { id name owner_name last_visit { date reason }
                                     next_visit { appointment_id } }
                              owners { id name pets } }
          patient_notes(patient_id: "pat-1") { id date provider_name text source }
          patient_visits(patient_id: "pat-1", type: "sick") {
            id date kind reason note medications photos { url } related
          }
          patient_profile(patient_id: "pat-1") {
            patient { name sex color } weight { latest { value unit } history { date } }
            reminders_due { text due } client { name prefers latest_message { text } }
            other_pets { name last_visit { date } due } mock
          }
          client_invoices(client_id: "cli-1") {
            balance last_12_months last_payment counts
            invoices { id total status items { name qty price } paid_by } mock
          }
          client_household(client_id: "cli-1") {
            client { name } pets { name today { appointment_id } spend_12m }
            coming_up { text } messages { direction text } remember { id } mock
          }
          patient_documents(patient_id: "pat-2") {
            id name pages key_points { text page }
          }
        }""",
    )
    assert data["search"]["pets"][0]["name"] == "Biscuit"
    assert all(v["kind"] == "sick" for v in data["patient_visits"])
    assert data["patient_profile"]["patient"]["name"] == "Biscuit"
    assert data["client_invoices"]["invoices"] and data["client_invoices"]["mock"]
    assert data["client_household"]["client"]["name"] == "Jordan Lee"
    assert data["patient_documents"]


def test_a_visit_end_to_end(gql_client):
    eid, enc = drafted(gql_client)
    assert enc["status"] == "draft_ready" and enc["note"]["subjective"]
    recheck = next(f for f in enc["followups"] if f["kind"] == "recheck")
    many = ok(
        gql_client,
        f"""query ($id: String!, $g: String!) {{
          encounter(encounter_id: $id) {{ {ENCOUNTER} }}
          encounters(group_id: $g) {{ id }}
          encounter_audit(encounter_id: $id) {{ ts actor action detail }}
          remember_suggestions(encounter_id: $id) {{
            suggestions {{ id text kind kept }} left_out mock
          }}
        }}""",
        id=eid,
        g=eid,
    )
    assert many["encounters"] == [{"id": eid}]
    assert "note_drafted" in [a["action"] for a in many["encounter_audit"]]

    note = {**enc["note"], "plan": "Recheck in 2 weeks."}
    out = ok(
        gql_client,
        """mutation ($id: String!, $note: SoapNoteInput!, $f: String!) {
          save_note(encounter_id: $id, note: $note) { note { plan } }
          set_note_type(encounter_id: $id, note_type: "recheck") { note_type }
          assist(encounter_id: $id, input: {section: "plan", action: "tighten"}) {
            suggestion refused mock sources { sentence lines }
          }
          act_on_followup(encounter_id: $id, followup_id: $f,
                          input: {action: "approve"}) {
            followups { id status booking_link { status } }
          }
        }""",
        id=eid,
        note=note,
        f=recheck["id"],
    )
    assert out["save_note"]["note"]["plan"] == "Recheck in 2 weeks."
    assert out["set_note_type"]["note_type"] == "recheck"
    assert out["assist"]["mock"] and out["assist"]["suggestion"]
    approved = next(
        f for f in out["act_on_followup"]["followups"] if f["id"] == recheck["id"]
    )
    assert approved["booking_link"]["status"] == "queued"

    signed = ok(
        gql_client,
        """mutation ($id: String!) {
          sign_note(encounter_id: $id, signed_by: "Dr. Ana Rivera") {
            encounter { status signed_by } write_back { ok status detail }
          }
        }""",
        id=eid,
    )["sign_note"]
    assert signed["encounter"]["status"] == "signed"
    assert signed["write_back"]["status"] == "written"

    after = ok(
        gql_client,
        """mutation ($id: String!, $f: String!) {
          share_summary(encounter_id: $id, channel: "text") {
            status text url pdf_url expires_at
          }
          resend_booking_link(followup_id: $f) { followup_id status days_waiting }
        }""",
        id=eid,
        f=recheck["id"],
    )
    assert after["share_summary"]["status"] == "preview"
    assert after["share_summary"]["url"].startswith("http://localhost/s/")
    assert after["resend_booking_link"]["status"] == "sent"
    reads = ok(
        gql_client,
        """query ($id: String!) {
          owner_summary(encounter_id: $id, lang: "en") {
            clinic { name } language pets { name for_owner next_visit { kind } }
            visit { date start when provider_name } owner_name
            pets { species breed sex age age_text }
          }
          waiting_followups { followup_id patient_name status }
        }""",
        id=eid,
    )
    assert reads["owner_summary"]["pets"][0]["name"] == "Biscuit"
    summary = reads["owner_summary"]
    rest = gql_client.get(f"/api/encounters/{eid}/summary").json()
    assert summary["visit"] == rest["visit"] and summary["owner_name"] == "Jordan Lee"
    assert summary["pets"][0]["age_text"] == "6 years"
    assert reads["waiting_followups"][0]["followup_id"] == recheck["id"]


INVITE_ADMIN = (
    'mutation { invite_user(input: {username: "eve", name: "Eve", role: "admin"}) '
    "{ invite_url } }"
)


def test_graphql_takes_json_only_so_other_sites_cant_post_forms(gql_client):
    foreign = {"Origin": "https://evil.example"}
    operations = json.dumps({"query": INVITE_ADMIN, "variables": {}})
    attempts = [
        gql_client.post(  # multipart, the GraphQL upload format
            "/graphql",
            data={"operations": operations, "map": "{}"},
            files={"0": ("x.txt", b"x", "text/plain")},
            headers=foreign,
        ),
        gql_client.post(  # a plain form
            "/graphql", data={"query": INVITE_ADMIN}, headers=foreign
        ),
        gql_client.post(  # text/plain, a "simple" cross-site request
            "/graphql",
            content=operations,
            headers={**foreign, "Content-Type": "text/plain"},
        ),
        gql_client.post(  # no content type at all
            "/graphql/", content=operations, headers=foreign
        ),
    ]
    assert [r.status_code for r in attempts] == [415, 415, 415, 415]
    assert gql_client.get("/api/admin/users").json() == []  # nobody was invited
    # Uploads go to REST; GraphQL has no Upload fields.
    assert "scalar Upload" not in SDL_PATH.read_text()
    # A JSON request still works, and GET still serves GraphiQL.
    assert ok(gql_client, "{ health { ok } }") == {"health": {"ok": True}}
    page = gql_client.get("/graphql", headers={"Accept": "text/html"})
    assert page.status_code == 200


def test_alias_limit(gql_client):
    many = "{ " + " ".join(f"b{i}: brief {{ spoken }}" for i in range(16)) + " }"
    body = run(gql_client, many)
    assert body["errors"] and not body.get("data")
    assert ok(
        gql_client, "{ " + " ".join(f"b{i}: health {{ ok }}" for i in range(15)) + " }"
    )


def test_one_model_call_per_request(gql_client):
    eid, _ = drafted(gql_client)
    draft = f'draft_note(encounter_id: "{eid}") {{ id }}'
    ask = 'ask_assistant(input: {message: "hi"}) { reply }'
    assist = (
        f'assist(encounter_id: "{eid}", input: {{section: "plan", action: "tighten"}})'
        " { suggestion }"
    )
    for query in (
        f"mutation {{ {draft} {ask} }}",
        f"mutation {{ a: {draft} b: {draft} }}",
        f"mutation {{ {assist} ...More }} fragment More on Mutation {{ x: {assist} }}",
        f"mutation {{ ... on Mutation {{ {ask} }} {draft} }}",
        f'mutation {{ {ask} draft_letter(id: "x") {{ id }} }}',
    ):
        body = run(gql_client, query)
        assert body["errors"][0]["message"].startswith("Ask for one AI step at a time")
        assert not body.get("data")
    audit = ok(
        gql_client,
        "query ($id: String!) { encounter_audit(encounter_id: $id) { action } }",
        id=eid,
    )["encounter_audit"]
    assert [a["action"] for a in audit].count("note_drafted") == 1  # nothing ran
    assert ok(gql_client, f"mutation {{ {ask} }}")["ask_assistant"]["reply"]


def test_remember_and_templates(gql_client):
    eid, _ = drafted(gql_client)
    found = ok(
        gql_client,
        "query ($id: String!) { remember_suggestions(encounter_id: $id) "
        "{ suggestions { id } } }",
        id=eid,
    )["remember_suggestions"]["suggestions"]
    assert found
    kept = ok(
        gql_client,
        "mutation ($id: String!, $keep: [String!]!) "
        "{ keep_remember(encounter_id: $id, keep: $keep) { id client_id text } }",
        id=eid,
        keep=[found[0]["id"]],
    )["keep_remember"]
    assert [k["id"] for k in kept] == [found[0]["id"]]
    assert ok(
        gql_client,
        "mutation ($c: String!, $i: String!) "
        "{ forget_remember(client_id: $c, item_id: $i) }",
        c=kept[0]["client_id"],
        i=kept[0]["id"],
    ) == {"forget_remember": True}
    assert ok(gql_client, '{ client_remember(client_id: "cli-1") { id } }') == {
        "client_remember": []
    }

    added = ok(
        gql_client,
        """mutation { add_template(input: {name: "Ears clean", shortcut: "earsok",
                                           text: "Ears clean."}) { id owner } }""",
    )["add_template"]
    assert added["owner"] == "me"
    changed = ok(
        gql_client,
        """mutation ($t: String!) { update_template(template_id: $t,
             input: {name: "Ears clean", shortcut: "earsok", text: "Both ears clean."})
             { text } }""",
        t=added["id"],
    )
    assert changed["update_template"]["text"] == "Both ears clean."
    shortcuts = [
        t["shortcut"] for t in ok(gql_client, "{ templates { shortcut } }")["templates"]
    ]
    assert "earsok" in shortcuts and "earnormal" in shortcuts
    assert ok(
        gql_client,
        "mutation ($t: String!) { delete_template(template_id: $t) }",
        t=added["id"],
    ) == {"delete_template": True}


def test_team_admin(settings):
    # The first invite closes the open demo, so this uses the API token (an admin).
    c = TestClient(create_app(replace(settings, api_token="s3cret")))
    data = ok(
        c,
        """mutation { invite_user(input: {username: "ana", name: "Ana Rivera",
                                           provider_id: "prov-1"}) {
                        user { id username role } invite_url } }""",
        token="s3cret",
    )["invite_user"]
    assert "#invite=" in data["invite_url"]
    uid = data["user"]["id"]
    out = ok(
        c,
        """mutation ($u: String!) {
          reinvite_user(user_id: $u) { invite_url }
          update_user(user_id: $u, input: {name: "Dr. Ana Rivera"}) { name }
          onboard(days: 30) { days notes notes_supported }
        }""",
        token="s3cret",
        u=uid,
    )
    assert out["update_user"]["name"] == "Dr. Ana Rivera"
    assert out["onboard"]["days"] == 30
    reads = ok(
        c, "{ users { username } providers { id name linked_to } }", token="s3cret"
    )
    assert reads["users"] == [{"username": "ana"}]
    assert any(p["linked_to"] == "Dr. Ana Rivera" for p in reads["providers"])


def test_errors_are_the_rest_messages(gql_client):
    body = run(gql_client, '{ encounter(encounter_id: "nope") { id } }')
    [err] = body["errors"]
    assert err["message"] == "Encounter not found"
    assert err["extensions"] == {"code": "NOT_FOUND", "status": 404}
    # A visit opens before the owner is asked; Start recording asks (REST /consent).
    no_consent = run(
        gql_client,
        'mutation { start_encounter(input: {appointment_id: "appt-1", '
        "consent_recorded: false}) { id consent_recorded } }",
    )
    assert no_consent["data"]["start_encounter"]["consent_recorded"] is False
    bad = run(
        gql_client,
        'mutation { start_encounter(input: {appointment_id: "appt-1", '
        'consent_recorded: true, source: "fax"}) { id } }',
    )
    assert bad["errors"][0]["message"] == "Check these fields: source."


def test_same_auth_as_rest(settings):
    c = TestClient(create_app(replace(settings, api_token="s3cret")))
    body = run(c, "{ schedule { id } }")
    assert body["errors"][0]["message"] == "Please sign in"
    assert body["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"
    assert run(c, "{ schedule { id } }", token="s3cret")["data"]["schedule"]
    assert run(c, "{ health { ok } }")["data"] == {"health": {"ok": True}}
    with c.websocket_connect("/graphql", subprotocols=["graphql-transport-ws"]) as ws:
        ws.send_json({"type": "connection_init", "payload": {}})
        assert ws.receive_json()["type"] == "connection_ack"
        ws.send_json(
            {
                "id": "1",
                "type": "subscribe",
                "payload": {
                    "query": 'subscription { draft_progress(encounter_id: "x") '
                    "{ step } }"
                },
            }
        )
        msg = ws.receive_json()
        assert msg["type"] == "error" or msg["payload"]["errors"]
        assert "Please sign in" in json.dumps(msg)


def subscribe(ws, query, **variables):
    ws.send_json({"type": "connection_init", "payload": {}})
    assert ws.receive_json()["type"] == "connection_ack"
    ws.send_json(
        {
            "id": "1",
            "type": "subscribe",
            "payload": {"query": query, "variables": variables},
        }
    )


def events_until_complete(ws):
    out = []
    while (msg := ws.receive_json())["type"] != "complete":
        assert msg["type"] == "next", msg
        out.append(msg["payload"]["data"])
    return out


DRAFT_PROGRESS = """subscription ($id: String!) {
  draft_progress(encounter_id: $id) {
    encounter_id run_id step state detail patient_name at
  }
}"""


def test_draft_progress_streams_each_step(gql_client):
    eid = ok(gql_client, START, appt="appt-1")["start_encounter"]["id"]
    text = ok(gql_client, "{ sample_transcript }")["sample_transcript"]
    ok(
        gql_client,
        "mutation ($id: String!, $t: String!) "
        "{ add_transcript(encounter_id: $id, text: $t) { id } }",
        id=eid,
        t=text,
    )
    with gql_client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        subscribe(ws, DRAFT_PROGRESS, id=eid)
        ok(
            gql_client,
            "mutation ($id: String!) { draft_note(encounter_id: $id) { id } }",
            id=eid,
        )
        events = [e["draft_progress"] for e in events_until_complete(ws)]
    steps = [(e["step"], e["state"]) for e in events]
    assert steps == [
        ("transcript", "started"),
        ("transcript", "done"),
        ("photos", "started"),
        ("photos", "done"),
        ("soap", "started"),
        ("soap", "done"),
        ("followups", "started"),
        ("followups", "done"),
        ("confirm", "started"),
        ("confirm", "done"),
        ("done", "done"),
    ]
    assert len({e["run_id"] for e in events}) == 1
    assert events[4]["patient_name"] == "Biscuit"
    assert events[7]["detail"].endswith("planned")


def test_draft_progress_replays_to_a_late_subscriber_and_reports_errors(gql_client):
    eid = ok(gql_client, START, appt="appt-2")["start_encounter"]["id"]
    # No transcript: the draft stops, and the subscriber hears why.
    body = run(
        gql_client,
        "mutation ($id: String!) { draft_note(encounter_id: $id) { id } }",
        id=eid,
    )
    assert body["errors"][0]["message"] == "No transcript yet"
    with gql_client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        subscribe(ws, DRAFT_PROGRESS, id=eid)
        events = [e["draft_progress"] for e in events_until_complete(ws)]
    assert [(e["step"], e["state"]) for e in events][-1] == ("error", "failed")
    assert events[-1]["detail"] == "No transcript yet"


def test_assistant_turn_streams_checks_then_the_reply(gql_client):
    turn = uuid.uuid4().hex
    with gql_client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        subscribe(
            ws,
            "subscription ($t: String!) "
            "{ assistant_turn(turn_id: $t) { turn_id kind text tools_used } }",
            t=turn,
        )
        reply = ok(
            gql_client,
            """mutation ($t: String!) {
              ask_assistant(input: {message: "How is she doing?",
                                    appointment_id: "appt-1", turn_id: $t}) {
                reply tools_used
              }
            }""",
            t=turn,
        )["ask_assistant"]
        events = [e["assistant_turn"] for e in events_until_complete(ws)]
    assert events[0] == {
        "turn_id": turn,
        "kind": "checking",
        "text": "Reading Biscuit's record",
        "tools_used": [],
    }
    assert events[-1]["kind"] == "reply" and events[-1]["text"] == reply["reply"]
    assert events[-1]["tools_used"] == reply["tools_used"] == ["get_patient_record"]


def test_rest_still_answers_without_a_turn_id(gql_client):
    out = gql_client.post("/api/assistant", json={"message": "pull up Biscuit"}).json()
    assert "Biscuit" in out["reply"]


def test_token_limit(gql_client):
    padded = "{ health { " + " ".join(["ok"] * 2000) + " } }"
    body = run(gql_client, padded)
    assert body["errors"] and not body.get("data")


INTROSPECT = "{ __schema { queryType { name } } }"


def test_graphiql_and_introspection_only_in_the_open_demo(gql_client, settings):
    html = {"Accept": "text/html"}
    assert gql_client.get("/graphql", headers=html).status_code == 200
    assert ok(gql_client, INTROSPECT)["__schema"]["queryType"]["name"] == "Query"

    live = TestClient(create_app(replace(settings, api_token="s3cret")))
    assert live.get("/graphql", headers=html).status_code == 404
    body = run(live, INTROSPECT, token="s3cret")
    assert body["errors"] and not body.get("data")
    assert run(live, "{ health { ok } }", token="s3cret")["data"]["health"]["ok"]


def test_caller_mistakes_log_one_line_server_errors_keep_the_traceback(
    gql_client, caplog, monkeypatch
):
    caplog.set_level("INFO")
    run(gql_client, '{ encounter(encounter_id: "nope") { id } }')
    run(gql_client, "{ nope }")
    mistakes = [r for r in caplog.records if r.name == "blinqscribe.gql.schema"]
    assert [r.levelname for r in mistakes] == ["INFO", "INFO"]
    assert "Encounter not found" in mistakes[0].getMessage()
    assert not any(r.exc_info for r in caplog.records)

    caplog.clear()

    def broken(self, encounter_id):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(Store, "get", broken)
    body = run(gql_client, '{ encounter(encounter_id: "x") { id } }')
    assert body["errors"]
    errors = [r for r in caplog.records if r.levelname == "ERROR"]
    assert errors and errors[0].exc_info


PHOTO_FIELDS = """
  photos { id label caption outline { label box polygon } crop { x y w h }
           rotation in_note show_owner edited_at source_orientation }
"""


def test_update_and_delete_photo(gql_client):
    eid, _ = drafted(gql_client)
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 200 + b"\xff\xd9"
    for hint in ("Left ear", "Left ear, retake"):
        gql_client.post(
            f"/api/encounters/{eid}/photos",
            files={"file": ("ear.jpg", jpeg, "image/jpeg")},
            data={"hint": hint},
        )
    first, second = ok(
        gql_client,
        "query ($id: String!) { encounter(encounter_id: $id) {" + PHOTO_FIELDS + "} }",
        id=eid,
    )["encounter"]["photos"]
    edit = (
        "mutation ($e: String!, $p: String!, $in: PhotoEditInput!) {"
        " update_photo(encounter_id: $e, photo_id: $p, input: $in) {"
        + PHOTO_FIELDS
        + "} }"
    )
    out = ok(
        gql_client,
        edit,
        e=eid,
        p=second["id"],
        **{
            "in": {
                "caption": "Pink, moist canal",
                "crop": {"x": 0.25, "y": 0, "w": 0.5, "h": 1},
                "rotation": 270,
                "show_owner": True,
                "outline": [{"label": "Canal", "box": [0.2, 0.2, 0.6, 0.6]}],
            }
        },
    )["update_photo"]["photos"][1]
    assert out["label"] == "Left ear, retake"  # not sent, not changed
    assert out["caption"] == "Pink, moist canal" and out["rotation"] == 270
    assert out["crop"] == {"x": 0.25, "y": 0.0, "w": 0.5, "h": 1.0}
    assert out["outline"] == [
        {"label": "Canal", "box": [0.2, 0.2, 0.6, 0.6], "polygon": []}
    ]
    assert out["show_owner"] and out["in_note"] and out["edited_at"]
    uncropped = ok(gql_client, edit, e=eid, p=second["id"], **{"in": {"crop": None}})
    assert uncropped["update_photo"]["photos"][1]["crop"] is None

    bad = run(gql_client, edit, e=eid, p=second["id"], **{"in": {"rotation": 45}})
    assert bad["errors"][0]["message"] == "Check these fields: rotation."
    assert bad["errors"][0]["extensions"]["code"] == "BAD_INPUT"

    gone = ok(
        gql_client,
        "mutation ($e: String!, $p: String!) {"
        " delete_photo(encounter_id: $e, photo_id: $p) { photos { id } } }",
        e=eid,
        p=first["id"],
    )
    assert gone["delete_photo"]["photos"] == [{"id": second["id"]}]
    undo = (
        "mutation ($e: String!, $p: String!) {"
        " restore_photo(encounter_id: $e, photo_id: $p) { photos { id } } }"
    )
    back = ok(gql_client, undo, e=eid, p=first["id"])["restore_photo"]["photos"]
    assert back == [{"id": first["id"]}, {"id": second["id"]}]
    ok(
        gql_client,
        "mutation ($e: String!, $p: String!) {"
        " delete_photo(encounter_id: $e, photo_id: $p) { id } }",
        e=eid,
        p=first["id"],
    )

    gql_client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    locked = run(gql_client, edit, e=eid, p=second["id"], **{"in": {"label": "x"}})
    assert locked["errors"][0]["extensions"]["code"] == "CONFLICT"
    summary = ok(
        gql_client,
        'query ($e: String!) { owner_summary(encounter_id: $e, lang: "es") {'
        " pets { photos { id label caption url rotation crop { w } } } } }",
        e=eid,
    )["owner_summary"]["pets"][0]["photos"]
    assert [p["id"] for p in summary] == [second["id"]]
    assert summary[0]["url"] == f"/api/encounters/{eid}/photos/{second['id']}"


def test_referral_follow_ups_suggest_a_letter(gql_client):
    from blinqscribe.schemas import Encounter, FollowUp, FollowUpKind

    def letter(kind, reason):
        return FollowUp(kind=kind, reason=reason).suggest_letter

    assert letter(FollowUpKind.task, "Refer to a dermatologist")
    assert letter(FollowUpKind.callback, "Call the owner about the referral")
    assert letter(FollowUpKind.task, "Referred to the specialty hospital")
    assert not letter(FollowUpKind.recheck, "Refer back if no better")
    assert not letter(FollowUpKind.task, "Preferred food list for the owner")
    # Stored encounters with the computed key in their JSON still load.
    eid, _ = drafted(gql_client)
    raw = gql_client.get(f"/api/encounters/{eid}").json()
    assert all("suggest_letter" in f for f in raw["followups"])
    assert Encounter.model_validate(raw).id == eid
    data = ok(
        gql_client,
        "query ($id: String!) { encounter(encounter_id: $id) "
        "{ followups { kind suggest_letter } } }",
        id=eid,
    )["encounter"]["followups"]
    assert [f["suggest_letter"] for f in data] == [
        f["suggest_letter"] for f in raw["followups"]
    ]
