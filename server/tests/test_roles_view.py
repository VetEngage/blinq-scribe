"""What each role sees (the PRD's Roles and permissions): another vet's visit is
view only and never a draft or transcript, front office sees status and the owner
summary, the API token never writes or signs a note, opened notes are logged, and
Ask Blinq answers only from what the caller can see. Plus the roles review fixes."""

import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from test_permissions import JPEG, drafted, gql, h, invite

from blinqscribe import permissions
from blinqscribe.accounts import Caller
from blinqscribe.api import create_app
from blinqscribe.store import Store


@pytest.fixture
def client(settings):
    with TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    ) as c:
        yield c


@pytest.fixture
def team(client):
    admin = invite(client, "maya", "Maya Admin", role="admin")
    by = h(admin)
    return {
        "admin": admin,
        "rivera": invite(client, "arivera", "Dr. Ana Rivera", "prov-1", headers=by),
        "okafor": invite(client, "sokafor", "Dr. Sam Okafor", "prov-2", headers=by),
        "front": invite(client, "desk", "Pat Desk", role="front_office", headers=by),
    }


def audit(settings, encounter_id):
    return Store(settings.data_dir, settings.database_url).audit_log(encounter_id)


# ---------- another vet's visit: view only, never a draft or transcript ----------


def test_another_vet_sees_status_on_a_draft_and_a_signed_note_view_only(
    client, team, settings
):
    rivera, okafor, front = team["rivera"], team["okafor"], team["front"]
    enc = drafted(client, rivera)
    eid, pid = enc["id"], enc["photos"][0]["id"]
    for role in (okafor, front):
        seen = client.get(f"/api/encounters/{eid}", headers=h(role)).json()
        assert seen["view"] == "status" and seen["hidden"] == "Draft in progress"
        assert seen["transcript"] == "" and seen["note"] is None
        assert seen["followups"] == [] and seen["photos"] == []
        assert seen["status"] == "draft_ready"  # the status is everyone's
        listed = client.get("/api/encounters", headers=h(role)).json()
        assert all(e["transcript"] == "" for e in listed)
        photo = client.get(f"/api/encounters/{eid}/photos/{pid}", headers=h(role))
        assert photo.status_code == 404
        remember = client.get(f"/api/encounters/{eid}/remember", headers=h(role))
        assert remember.json()["suggestions"] == []
    mine = client.get(f"/api/encounters/{eid}", headers=h(rivera)).json()
    assert mine["view"] == "full" and mine["transcript"] and mine["note"]

    client.post(f"/api/encounters/{eid}/sign", json={}, headers=h(rivera))
    viewed = client.get(f"/api/encounters/{eid}", headers=h(okafor)).json()
    assert viewed["view"] == "view_only" and viewed["note"]["subjective"]
    assert viewed["transcript"] == ""  # never a transcript, even signed
    assert (
        client.get(f"/api/encounters/{eid}/photos/{pid}", headers=h(okafor)).status_code
        == 200
    )
    desk = client.get(f"/api/encounters/{eid}", headers=h(front)).json()
    assert desk["view"] == "status" and desk["note"] is None  # status and summary
    assert (
        client.get(f"/api/encounters/{eid}/summary", headers=h(front)).status_code
        == 200
    )
    opened = [a for a in audit(settings, eid) if a["action"] == "note_opened"]
    assert [(a["actor"], a["detail"]) for a in opened] == [
        ("sokafor", {"by": "sokafor"})
    ]


def test_graphql_and_the_progress_feed_follow_the_same_view(client, team):
    enc = drafted(client, team["rivera"])
    q = (
        "query ($id: String!) { encounter(encounter_id: $id) "
        "{ view hidden transcript note { plan } } }"
    )
    seen = gql(client, team["okafor"], q, id=enc["id"])["data"]["encounter"]
    assert seen == {
        "view": "status",
        "hidden": "Draft in progress",
        "transcript": "",
        "note": None,
    }
    with client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        ws.send_json(
            {
                "type": "connection_init",
                "payload": {"authorization": f"Bearer {team['okafor']}"},
            }
        )
        assert ws.receive_json()["type"] == "connection_ack"
        ws.send_json(
            {
                "id": "1",
                "type": "subscribe",
                "payload": {
                    "query": "subscription ($id: String!) "
                    "{ draft_progress(encounter_id: $id) { step } }",
                    "variables": {"id": enc["id"]},
                },
            }
        )
        msg = ws.receive_json()
        assert "Draft in progress" in str(msg) and msg["type"] in ("next", "error")
    refused = [
        (a["actor"], a["detail"])
        for a in client.get(
            f"/api/encounters/{enc['id']}/audit", headers=h(team["rivera"])
        ).json()
        if a["action"] == "refused"
    ]
    assert (
        "sokafor",
        {"action": "draft.follow", "reason": "Draft in progress"},
    ) in refused


def test_front_office_sees_visits_not_notes(client, team, settings):
    rivera, front = team["rivera"], team["front"]
    enc = drafted(client, rivera)
    client.post(f"/api/encounters/{enc['id']}/sign", json={}, headers=h(rivera))
    assert client.get("/api/patients/pat-1/notes", headers=h(front)).json() == []
    visits = client.get("/api/patients/pat-1/visits", headers=h(front)).json()
    assert visits and all(v["note"] is None and v["photos"] == [] for v in visits)
    card = client.get("/api/appointments/appt-1/card", headers=h(front)).json()
    assert card["last_note"] is None and card["promised"] == []
    # A vet opening a colleague's notes is logged; their own aren't.
    client.get("/api/patients/pat-1/notes", headers=h(team["okafor"]))
    client.get("/api/patients/pat-1/visits", headers=h(team["okafor"]))
    client.get("/api/patients/pat-1/notes", headers=h(rivera))
    rows = Store(settings.data_dir, settings.database_url).run(
        "SELECT actor, action FROM audit WHERE action = 'notes_opened'", ()
    )
    assert [tuple(r) for r in rows] == [
        ("sokafor", "notes_opened"),
        ("sokafor", "notes_opened"),
    ]


def test_ask_blinq_answers_only_from_what_the_caller_sees(client, team):
    drafted(client, team["rivera"])  # a draft with follow ups waiting on Rivera

    def pending(role):
        reply = client.post(
            "/api/assistant",
            json={"message": "any follow ups?"},
            headers=h(team[role]),
        ).json()
        return reply["reply"]

    assert pending("rivera") != "Nothing waiting."
    assert pending("okafor") == pending("front") == "Nothing waiting."
    record = client.post(
        "/api/assistant",
        json={"message": "how is she doing", "patient_id": "pat-1"},
        headers=h(team["front"]),
    ).json()
    assert record["tools_used"] == ["get_patient_record"]
    assert "- " not in record["reply"]  # no visits listed: they carry notes


def test_waiting_links_are_a_vet_s_own(client, team):
    rivera = team["rivera"]
    enc = drafted(client, rivera)
    recheck = next(f for f in enc["followups"] if f["kind"] == "recheck")
    client.post(
        f"/api/encounters/{enc['id']}/followups/{recheck['id']}",
        json={"action": "approve"},
        headers=h(rivera),
    )
    client.post(f"/api/encounters/{enc['id']}/sign", json={}, headers=h(rivera))

    def waiting(role):
        rows = client.get("/api/followups/waiting", headers=h(team[role])).json()
        return {r["followup_id"] for r in rows}

    # The demo's own waiting links are Rivera's too; none are Okafor's.
    assert recheck["id"] in waiting("rivera") and waiting("okafor") == set()
    assert waiting("front") == waiting("admin") == waiting("rivera")
    refused = client.post(
        f"/api/followups/{recheck['id']}/resend", headers=h(team["okafor"])
    )
    assert refused.status_code == 403


def test_the_api_token_never_writes_or_signs_a_note(settings):
    c = TestClient(create_app(replace(settings, api_token="s3cret")))
    token = h("s3cret")
    eid = c.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=token,
    ).json()["id"]
    sample = c.get("/api/sample-transcript", headers=token).json()["text"]
    assert (
        c.post(
            f"/api/encounters/{eid}/transcript", json={"text": sample}, headers=token
        ).status_code
        == 200
    )  # scripts and setup may feed a visit
    for method, path, body in (
        ("post", f"/api/encounters/{eid}/draft", None),
        ("put", f"/api/encounters/{eid}/note", {"plan": "x"}),
        ("post", f"/api/encounters/{eid}/sign", {"signed_by": "Dr. Ana Rivera"}),
    ):
        r = getattr(c, method)(path, json=body, headers=token)
        assert r.status_code == 403, path
        assert r.json()["detail"].startswith("The API token is for scripts and setup")
    me = c.get("/api/me", headers=token).json()
    assert "note.sign" not in me["permissions"] and "visit.start" in me["permissions"]


# ---------- whose visit: the column's vet ----------


def test_a_column_vet_owns_the_appointments_in_their_column(client, team, monkeypatch):
    from blinqscribe.adapters.mock import MockAdapter

    get_appt = MockAdapter.get_appointment

    async def by_column(self, appointment_id):
        found = await get_appt(self, appointment_id)
        if found and found.id == "appt-3":
            return found.model_copy(
                update={
                    "provider_id": "",
                    "provider_name": "",
                    "room": "Dr. Okafor",
                    "column_vet_id": "prov-2",
                    "column_vet_name": "Dr. Sam Okafor",
                }
            )
        return found

    monkeypatch.setattr(MockAdapter, "get_appointment", by_column)
    start = {"appointment_id": "appt-3", "consent_recorded": True}
    refused = client.post("/api/encounters", json=start, headers=h(team["rivera"]))
    assert refused.status_code == 403
    assert refused.json()["detail"].startswith("This is Dr. Sam Okafor's visit")
    enc = client.post("/api/encounters", json=start, headers=h(team["okafor"])).json()
    assert (enc["provider_id"], enc["provider_name"]) == ("prov-2", "Dr. Sam Okafor")


# ---------- the roles review fixes ----------


def test_a_session_without_a_user_is_refused():
    nobody = Caller(via="session", user=None)
    assert not permissions.unrestricted(nobody)
    assert not permissions.can(nobody, "visit.start", "prov-1", ownerless_ok=True)
    assert permissions.allowed(nobody) == []
    with pytest.raises(Exception, match="Please sign in"):
        permissions.check(nobody, "summary.share")


def test_forgetting_needs_a_live_item_on_your_own_visit(client, team, settings):
    rivera = team["rivera"]
    enc = drafted(client, rivera)
    found = client.get(
        f"/api/encounters/{enc['id']}/remember", headers=h(rivera)
    ).json()["suggestions"]
    kept = client.post(
        f"/api/encounters/{enc['id']}/remember",
        json={"keep": [found[0]["id"]]},
        headers=h(rivera),
    ).json()[0]
    path = f"/api/clients/cli-1/remember/{kept['id']}"
    assert client.delete(path, headers=h(team["okafor"])).status_code == 403
    assert client.delete(path, headers=h(team["front"])).status_code == 403

    store = Store(settings.data_dir, settings.database_url)
    body = {**kept, "encounter_id": "gone", "id": "orphan"}
    store.add_remember("v-gone", "cli-1", "pat-1", [body])
    future = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    store.set_remember_kept("orphan", True, future, body)
    # Its visit is gone, so no vet owns it: nobody signed in may forget it.
    orphan = client.delete("/api/clients/cli-1/remember/orphan", headers=h(rivera))
    assert orphan.status_code == 403
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    store.set_remember_kept(kept["id"], True, past, kept)
    assert client.delete(path, headers=h(rivera)).status_code == 404  # expired
    assert store.kept_remember(item_id=kept["id"])  # and left for the cleanup


def test_nobody_changes_their_own_role_and_one_admin_always_stays(client, team):
    admin = h(team["admin"])
    me = client.get("/api/me", headers=admin).json()["user"]["id"]
    for change in ({"role": "front_office"}, {"role": "vet"}, {"active": False}):
        r = client.patch(f"/api/admin/users/{me}", json=change, headers=admin)
        assert r.status_code == 400, change
    second = invite(client, "lee", "Lee Admin", role="admin", headers=admin)
    lee = client.get("/api/me", headers=h(second)).json()["user"]["id"]
    assert (
        client.patch(
            f"/api/admin/users/{lee}", json={"role": "front_office"}, headers=admin
        ).status_code
        == 200
    )


def test_the_last_admin_can_t_be_demoted_by_the_api_token(settings):
    c = TestClient(
        create_app(replace(settings, api_token="s3cret")), base_url="http://localhost"
    )
    only = invite(c, "maya", "Maya Admin", role="admin", headers=h("s3cret"))
    uid = c.get("/api/me", headers=h(only)).json()["user"]["id"]
    for change in ({"role": "vet"}, {"active": False}):
        r = c.patch(f"/api/admin/users/{uid}", json=change, headers=h("s3cret"))
        assert (r.status_code, r.json()["detail"]) == (
            400,
            "Keep at least one active admin.",
        ), change


def test_a_refused_draft_never_touches_the_owner_s_progress_feed(client, team):
    enc = drafted(client, team["rivera"])
    r = client.post(f"/api/encounters/{enc['id']}/draft", headers=h(team["okafor"]))
    assert r.status_code == 403
    with client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        ws.send_json(
            {
                "type": "connection_init",
                "payload": {"authorization": f"Bearer {team['rivera']}"},
            }
        )
        ws.receive_json()
        ws.send_json(
            {
                "id": "1",
                "type": "subscribe",
                "payload": {
                    "query": "subscription ($id: String!) "
                    "{ draft_progress(encounter_id: $id) { step state } }",
                    "variables": {"id": enc["id"]},
                },
            }
        )
        # The owner's own draft run is what replays: it ends in done, not failed.
        steps = []
        while (msg := ws.receive_json())["type"] == "next":
            steps.append(msg["payload"]["data"]["draft_progress"])
        assert steps[-1] == {"step": "done", "state": "done"}
        assert {"step": "error", "state": "failed"} not in steps


def test_every_refusal_is_audited(client, team, settings):
    front = h(team["front"])
    client.post(
        "/api/templates",
        json={"name": "x", "shortcut": "xx", "text": "x"},
        headers=front,
    )
    client.get("/api/admin/users", headers=front)
    client.post(
        "/api/patients/pat-1/documents", files={"file": ("a.jpg", JPEG)}, headers=front
    )  # allowed: not refused
    rows = Store(settings.data_dir, settings.database_url).run(
        "SELECT actor, detail FROM audit WHERE action = 'refused'", ()
    )
    actions = [(r[0], json.loads(r[1])["action"]) for r in rows]
    assert actions == [("desk", "template.manage"), ("desk", "team.manage")]


def test_a_pet_booked_with_another_vet_joins_that_visit_instead(
    client, team, monkeypatch
):
    from blinqscribe.adapters.mock import MockAdapter

    day = MockAdapter.get_schedule

    async def waffles_with_okafor(self, on, provider_id=None):
        return [
            a.model_copy(
                update={"provider_id": "prov-2", "provider_name": "Dr. Sam Okafor"}
            )
            if a.patient.id == "pat-6"
            else a
            for a in await day(self, on, provider_id)
        ]

    monkeypatch.setattr(MockAdapter, "get_schedule", waffles_with_okafor)
    r = client.post(
        "/api/encounters",
        json={
            "appointment_id": "appt-1",
            "consent_recorded": True,
            "patient_ids": ["pat-1", "pat-6"],
        },
        headers=h(team["rivera"]),
    )
    assert (r.status_code, r.json()["detail"]) == (
        400,
        "Waffles has a visit with Dr. Sam Okafor today, so add them to that visit "
        "instead.",
    )


def test_the_first_admin_needs_this_machine_not_a_proxy(client):
    proxied = client.post(
        "/api/admin/users",
        json={"username": "maya", "name": "Maya", "role": "admin"},
        headers={"X-Forwarded-For": "203.0.113.9"},
    )
    assert proxied.status_code == 403
    assert "BLINQ_SCRIBE_API_TOKEN" in proxied.json()["detail"]
    assert invite(client, "maya", "Maya Admin", role="admin")  # directly: fine


def test_the_open_demo_runs_the_whole_visit_for_judges(client):
    """Nobody invited, no token: every step works, as a judge would do it."""
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    steps = [
        client.post(
            f"/api/encounters/{eid}/audio",
            files={"file": ("chunk.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
            data={"chunk_index": "0"},
        ),
        client.post(
            f"/api/encounters/{eid}/transcript",
            json={"text": client.get("/api/sample-transcript").json()["text"]},
        ),
        client.post(f"/api/encounters/{eid}/photos", files={"file": ("a.jpg", JPEG)}),
        client.post(f"/api/encounters/{eid}/draft"),
    ]
    assert [r.status_code for r in steps] == [200, 200, 200, 200]
    enc = steps[-1].json()
    assert enc["view"] == "full" and enc["note"]
    recheck = next(f for f in enc["followups"] if f["kind"] == "recheck")
    more = [
        client.put(
            f"/api/encounters/{eid}/note", json={**enc["note"], "plan": "Recheck."}
        ),
        client.put(f"/api/encounters/{eid}/note-type", json={"note_type": "sick"}),
        client.post(
            f"/api/encounters/{eid}/assist",
            json={"section": "plan", "action": "tighten"},
        ),
        client.post(
            f"/api/encounters/{eid}/followups/{recheck['id']}",
            json={"action": "approve"},
        ),
        client.patch(
            f"/api/encounters/{eid}/photos/{enc['photos'][0]['id']}",
            json={"show_owner": True},
        ),
        client.post(f"/api/encounters/{eid}/remember", json={"keep": []}),
        client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Demo"}),
        client.post(f"/api/encounters/{eid}/share", json={"channel": "print"}),
    ]
    assert [r.status_code for r in more] == [200] * len(more)
    signed = client.get(f"/api/encounters/{eid}").json()
    assert signed["status"] == "signed" and signed["signed_by"] == "Dr. Demo"
    assert signed["transcript"]  # the open demo sees everything
    me = client.get("/api/me").json()
    assert me["via"] == "open" and "note.sign" in me["permissions"]


def test_every_role_can_list_the_practice_s_vets(client, team):
    expected = [
        {"id": "prov-1", "name": "Dr. Ana Rivera"},
        {"id": "prov-2", "name": "Dr. Sam Okafor"},
    ]
    for role in ("rivera", "okafor", "front", "admin"):
        assert client.get("/api/doctors", headers=h(team[role])).json() == expected
        listed = gql(client, team[role], "{ doctors { id name } }")["data"]
        assert listed["doctors"] == expected, role
    assert (
        client.get("/api/admin/providers", headers=h(team["rivera"])).status_code == 403
    )
