"""Muse Spark sometimes runs on until the token cap (it padded an open `vitals` map
with spaces). Asked again once; if it runs on again, the vet gets a clear "Try
again" and the visit or letter is left as it was, never an empty draft."""

import json
from dataclasses import replace
from types import SimpleNamespace

import anyio
import pytest
from fastapi.testclient import TestClient

from blinqscribe import llm
from blinqscribe.api import create_app
from blinqscribe.llm import CutOff, MuseClient
from blinqscribe.scribe import _DraftOut

RUNAWAY = '{"subjective": "Head shaking", "vitals": {"heart_rate_bpm": ' + " " * 300

DRAFT = json.dumps(
    {
        "subjective": "Head shaking for four days.",
        "objective": "Right ear canal red, brown discharge.",
        "assessment": "Otitis externa, right.",
        "plan": "Recheck in two weeks.",
        "vitals": {
            "weight": "74 lb",
            "temperature": "101.8 F",
            "heart_rate": "96",
            "respiratory_rate": "",
            "body_condition_score": "",
        },
        "medications": ["Cefpodoxime 100 mg once a day"],
        "client_summary": "Biscuit has an ear infection.",
        "followups": [
            {
                "kind": "recheck",
                "reason": "Recheck right ear in 2 weeks",
                "due_in_days": 14,
                "message_draft": "",
            }
        ],
    }
)


class FakeOpenAI:
    """Answers each call with the next (content, finish_reason)."""

    def __init__(self, replies, **_):
        self.replies, self.calls = list(replies), []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        content, finish = self.replies.pop(0)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=content), finish_reason=finish
                )
            ]
        )


def _muse(settings, fake):
    muse = MuseClient(replace(settings, model_api_key="test-key"))
    muse._client = fake
    return muse


def test_two_runaways_raise_instead_of_an_empty_answer(settings):
    fake = FakeOpenAI([(RUNAWAY, "length"), (RUNAWAY, "length")])
    with pytest.raises(CutOff):
        anyio.run(
            lambda: _muse(settings, fake).structured(
                "system", "user", _DraftOut, max_tokens=8192, must_finish=True
            )
        )
    ask = fake.calls[1]["messages"]
    assert "cut off" in ask[-1]["content"]
    assert all(m["role"] != "assistant" for m in ask)  # the padding isn't sent back


def test_a_runaway_then_a_good_reply_is_used(settings):
    fake = FakeOpenAI([(RUNAWAY, "length"), (DRAFT, "stop")])
    out = anyio.run(
        lambda: _muse(settings, fake).structured(
            "system", "user", _DraftOut, must_finish=True
        )
    )
    assert out.vitals.weight == "74 lb" and out.followups[0].due_in_days == 14


def test_the_draft_schema_has_no_open_maps():
    """Every object Muse Spark fills has fixed fields: an open map is where it ran
    on."""
    schema = llm.strict_schema(_DraftOut.model_json_schema())

    def objects(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                yield node
            for v in node.values():
                yield from objects(v)
        elif isinstance(node, list):
            for v in node:
                yield from objects(v)

    assert all(o.get("additionalProperties") is False for o in objects(schema))


@pytest.fixture
def live(settings, monkeypatch):
    """The app with a model key, talking to a fake Meta API."""
    fake = FakeOpenAI([])
    monkeypatch.setattr(llm, "AsyncOpenAI", lambda **_: fake)
    client = TestClient(
        create_app(replace(settings, model_api_key="test-key")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    return client, fake


def _visit(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": "Dr. Rivera: Right ear is red. Recheck in two weeks."},
    )
    return eid


def test_a_note_that_runs_on_twice_says_try_again(live):
    client, fake = live
    eid = _visit(client)
    fake.replies = [(RUNAWAY, "length"), (RUNAWAY, "length")]
    r = client.post(f"/api/encounters/{eid}/draft")
    assert r.status_code == 502
    assert r.json()["detail"] == "Muse Spark couldn't write the note. Try again."
    enc = client.get(f"/api/encounters/{eid}").json()
    assert enc["note"] is None and enc["status"] == "recording"  # left as it was
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    assert audit[-1]["action"] == "note_draft_failed"

    fake.replies = [(RUNAWAY, "length"), (RUNAWAY, "length")]
    out = client.post(
        "/graphql",
        json={
            "query": "mutation($id: String!) { draft_note(encounter_id: $id) { id } }",
            "variables": {"id": eid},
        },
    ).json()
    assert out["errors"][0]["message"] == (
        "Muse Spark couldn't write the note. Try again."
    )


def test_a_letter_that_runs_on_twice_says_try_again(live):
    client, fake = live
    eid = _visit(client)
    fake.replies = [(DRAFT, "stop")]
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    fake.replies = [(RUNAWAY, "length"), (RUNAWAY, "length")]
    r = client.post(
        "/api/patients/pat-1/letters",
        json={
            "encounter_id": eid,
            "kind": "referral",
            "recipient": {"name": "Dr. Priya Shah"},
            "reason": "Second ear infection this year",
        },
    )
    assert r.status_code == 502
    assert r.json()["detail"] == "Muse Spark couldn't write the letter. Try again."


# ---------- vitals beyond the named ones ----------


def test_blood_pressure_and_other_vitals_land_in_the_note(live):
    """Miso's visit: "Blood pressure is 165", plus vitals with no fixed field."""
    client, fake = live
    reply = json.loads(DRAFT)
    reply["vitals"]["blood_pressure"] = "165"
    reply["vitals"]["other"] = [
        {"name": "CRT", "value": "<2 s"},
        {"name": "Mucous membranes", "value": "pink, tacky"},
        *({"name": f"Extra {n}", "value": str(n)} for n in range(8)),
    ]
    fake.replies = [(json.dumps(reply), "stop")]
    eid = _visit(client)
    said = "Dr. Rivera: Blood pressure is 165. CRT under 2 s. 74 lb, 101.8, HR 96."
    client.post(f"/api/encounters/{eid}/transcript", json={"text": said})
    vitals = client.post(f"/api/encounters/{eid}/draft").json()["note"]["vitals"]
    assert vitals["blood_pressure"] == "165"
    assert vitals["CRT"] == "<2 s" and vitals["Mucous membranes"] == "pink, tacky"
    others = set(vitals) - {"weight", "temperature", "heart_rate", "blood_pressure"}
    assert len(others) == 6  # at most 6 others


def test_mock_draft_reads_miso_s_blood_pressure(client):
    """Demo mode, no model: Miso's sample visit still charts her blood pressure."""
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-2", "consent_recorded": True}
    ).json()["id"]
    text = client.get(
        "/api/sample-transcript", params={"appointment_id": "appt-2"}
    ).json()["text"]
    assert "Blood pressure is 165" in text
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    vitals = client.post(f"/api/encounters/{eid}/draft").json()["note"]["vitals"]
    assert vitals["blood_pressure"] == "165"
