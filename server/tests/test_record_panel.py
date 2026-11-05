"""The Record side panel (requirement 66): one read-only query with everything the
panel shows, the same for every role, no notes in it, and it never gets in the way
of a visit that is recording or drafting."""

from test_permissions import drafted, gql, h
from test_roles_view import client, team  # noqa: F401 - fixtures

PANEL = """query ($p: String!) {
  record_panel(patient_id: $p) {
    patient { id name species breed age sex alerts }
    pims_patient_id pims_client_id
    weight { latest { date value unit } }
    reminders_due { text due }
    recent_visits { id date kind reason provider_name }
    client { id name phones emails prefers }
    other_pets { id name }
    mock
  }
}"""


def test_one_read_has_everything_the_panel_shows(client):  # noqa: F811
    panel = client.get("/api/patients/pat-1/panel").json()
    assert panel["patient"]["name"] == "Biscuit"
    assert (panel["pims_patient_id"], panel["pims_client_id"]) == ("pat-1", "cli-1")
    assert panel["weight"]["latest"]["unit"] == "lb"
    assert panel["client"]["phones"] and panel["client"]["name"] == "Jordan Lee"
    assert [p["name"] for p in panel["other_pets"]] == [
        "Waffles",
        "Hazel",
        "Kiwi",
        "Mochi",
    ]
    assert 0 < len(panel["recent_visits"]) <= 3  # as many as the panel shows
    assert all("note" not in v for v in panel["recent_visits"])  # lines, not notes
    assert not any("last_visit" in p or "due" in p for p in panel["other_pets"])
    assert client.get("/api/patients/nope/panel").status_code == 404

    data = gql(client, "", PANEL, p="pat-6")["data"]["record_panel"]
    assert data["patient"]["alerts"] == ["Back problems, lift with support"]
    assert data["other_pets"] == [
        {"id": "pat-1", "name": "Biscuit"},
        {"id": "pat-7", "name": "Hazel"},
        {"id": "pat-8", "name": "Kiwi"},
        {"id": "pat-9", "name": "Mochi"},
    ]
    assert data["mock"] is True


def test_every_role_reads_the_same_panel_and_no_notes_are_opened(
    client,  # noqa: F811
    team,  # noqa: F811
    settings,
):
    from blinqscribe.store import Store

    rivera = team["rivera"]
    enc = drafted(client, rivera)
    client.post(f"/api/encounters/{enc['id']}/sign", json={}, headers=h(rivera))
    seen = {
        role: client.get("/api/patients/pat-1/panel", headers=h(team[role])).json()
        for role in ("rivera", "okafor", "front", "admin")
    }
    assert seen["okafor"] == seen["front"] == seen["admin"] == seen["rivera"]
    opened = Store(settings.data_dir, settings.database_url).run(
        "SELECT actor FROM audit WHERE action = 'notes_opened'", ()
    )
    assert opened == []
    assert client.get("/api/patients/pat-1/panel").status_code == 401  # signed in


def test_the_panel_never_holds_up_a_visit_in_progress(client, team):  # noqa: F811
    rivera = team["rivera"]
    eid = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=h(rivera),
    ).json()["id"]
    sample = client.get("/api/sample-transcript", headers=h(rivera)).json()["text"]
    client.post(
        f"/api/encounters/{eid}/transcript", json={"text": sample}, headers=h(rivera)
    )
    with client.websocket_connect(
        "/graphql", subprotocols=["graphql-transport-ws"]
    ) as ws:
        ws.send_json(
            {
                "type": "connection_init",
                "payload": {"authorization": f"Bearer {rivera}"},
            }
        )
        ws.receive_json()
        ws.send_json(
            {
                "id": "1",
                "type": "subscribe",
                "payload": {
                    "query": "subscription ($id: String!) "
                    "{ draft_progress(encounter_id: $id) { step } }",
                    "variables": {"id": eid},
                },
            }
        )
        # The panel opens while the visit page follows the draft.
        panel = gql(client, rivera, PANEL, p="pat-1")
        assert panel["data"]["record_panel"]["patient"]["name"] == "Biscuit"
        client.post(f"/api/encounters/{eid}/draft", headers=h(rivera))
        steps = []
        while (msg := ws.receive_json())["type"] == "next":
            steps.append(msg["payload"]["data"]["draft_progress"]["step"])
    assert steps[0] == "transcript" and steps[-1] == "done"


def test_the_panel_reads_only_what_it_shows(tmp_path):
    """No messages, no other pets' visits or reminders, and the pet read once."""
    import anyio

    from blinqscribe import record
    from blinqscribe.adapters.mock import MockAdapter
    from blinqscribe.store import Store

    calls: list[str] = []

    class Counting(MockAdapter):
        def __getattribute__(self, name):
            if name.startswith("get_"):
                calls.append(name)
            return super().__getattribute__(name)

    found = anyio.run(record.panel, Counting(), Store(tmp_path), "pat-1")
    assert found and found["other_pets"]
    assert calls.count("get_patient") == 1
    assert calls.count("get_household") == 1
    assert "get_client_messages" not in calls
    assert calls.count("get_visit_history") == 1  # this pet's only
    assert calls.count("get_patient_profile") == 1  # this pet's reminders only
