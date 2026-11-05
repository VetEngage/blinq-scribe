"""Speaker labels on the transcript (requirement 64): who said each line, Who is
this?, where the labels show, and where they never do."""

import re
import zlib
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from blinqscribe.accounts import Caller, User
from blinqscribe.api import create_app
from blinqscribe.permissions import visit_view
from blinqscribe.speakers import SpeakerError, Speakers

OPEN = Caller(via="open")


def _client(settings: Any, **changes: Any) -> TestClient:
    return TestClient(
        create_app(replace(settings, sms_mode="preview", **changes)),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


@pytest.fixture
def client(settings: Any) -> TestClient:
    return _client(settings)


def _visit(client: TestClient, appt: str = "appt-1") -> str:
    return str(
        client.post(
            "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
        ).json()["id"]
    )


def _load_sample(client: TestClient, eid: str, appt: str = "appt-1") -> Any:
    text = client.get("/api/sample-transcript", params={"appointment_id": appt}).json()[
        "text"
    ]
    r = client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    assert r.status_code == 200, r.text
    return r.json()


def _speakers(client: TestClient) -> Speakers:
    return client.app.state.speakers  # type: ignore[attr-defined]


def _person(role: str, provider_id: str = "") -> Caller:
    user = User(
        id=f"u-{role}-{provider_id}",
        username=f"{role}{provider_id}",
        name=role.title(),
        role=role,  # type: ignore[arg-type]
        provider_id=provider_id,
        created_at=datetime.now(UTC),
    )
    return Caller(via="session", user=user)


# ---------- who said each line ----------
def test_the_demo_visit_has_the_vet_the_owner_and_speaker_3(client):
    enc = _load_sample(client, _visit(client))
    segs = enc["segments"]
    lines = enc["transcript"].splitlines()
    assert len(segs) == len([ln for ln in lines if ln.strip()])
    for s in segs:  # each segment is its transcript line, label removed
        assert lines[s["line"] - 1].endswith(s["text"])
    first, second = segs[0], segs[1]
    assert (first["speaker_name"], first["role"]) == ("Dr. Ana Rivera", "vet")
    assert (second["speaker_name"], second["role"]) == ("Jordan Lee", "owner")
    third = next(s for s in segs if s["speaker_id"] == "speaker-3")
    assert third["speaker_name"] == "Speaker 3" and third["role"] == "unknown"
    assert "74 lb" in third["text"]
    offsets = [s["offset_seconds"] for s in segs]
    assert offsets == sorted(offsets) and offsets[-1] > 0


@pytest.mark.parametrize("appt", ["appt-2", "appt-3", "appt-4", "appt-5", "appt-6"])
def test_every_sample_visit_names_its_vet_and_owner(client, appt):
    enc = _load_sample(client, _visit(client, appt), appt)
    roles = {s["role"] for s in enc["segments"]}
    assert {"vet", "owner"} <= roles
    vet = next(s for s in enc["segments"] if s["role"] == "vet")
    assert vet["speaker_name"] == enc["provider_name"]  # Okafor's on appt-5


def test_an_unlabeled_line_has_no_name_without_a_model(client):
    eid = _visit(client)
    enc = client.post(
        f"/api/encounters/{eid}/transcript", json={"text": "Let's have a look."}
    ).json()
    [seg] = enc["segments"]
    assert seg["speaker_id"] == "" and seg["speaker_name"] == ""


def test_the_muse_speaker_pass_and_unsure_lines(client, monkeypatch):
    speakers = _speakers(client)
    asked: dict[str, str] = {}

    async def fake(system: str, user: str, schema: Any, **_: Any) -> Any:
        asked.update(system=system, user=user)
        return schema(
            lines=[
                {"line": 1, "speaker": "vet"},
                {"line": 2, "speaker": "owner"},
                {"line": 3, "speaker": "speaker_3"},
                {"line": 4, "speaker": "unsure"},
                {"line": 99, "speaker": "vet"},  # not asked about: ignored
            ]
        )

    monkeypatch.setattr(speakers.muse, "enabled", True)
    monkeypatch.setattr(speakers.muse, "structured", fake)
    eid = _visit(client)
    text = "How is he doing?\nHe's scratching.\nI'll hold him.\nOkay."
    enc = client.post(f"/api/encounters/{eid}/transcript", json={"text": text}).json()
    got = [(s["speaker_id"], s["speaker_name"], s["role"]) for s in enc["segments"]]
    assert got == [
        ("vet", "Dr. Ana Rivera", "vet"),
        ("owner", "Jordan Lee", "owner"),
        ("speaker-3", "Speaker 3", "unknown"),
        ("", "", "unknown"),  # unsure: no name rather than a guess
    ]
    assert "Dr. Ana Rivera" in asked["system"] and "Jordan Lee" in asked["system"]
    assert '"unsure" whenever' in asked["system"]
    # Lines already labeled aren't asked about again.
    asked.clear()
    client.post(f"/api/encounters/{eid}/transcript", json={"text": "Owner: Thanks!"})
    assert not asked


def test_a_line_put_in_above_keeps_the_speakers_below(client, monkeypatch):
    import anyio

    speakers = _speakers(client)
    asked: list[str] = []

    async def fake(system: str, user: str, schema: Any, **_: Any) -> Any:
        asked.append(user)
        numbers = [int(n) for n in re.findall(r"^(\d+)\.", user, re.M)]
        return schema(lines=[{"line": n, "speaker": "owner"} for n in numbers])

    monkeypatch.setattr(speakers.muse, "enabled", True)
    monkeypatch.setattr(speakers.muse, "structured", fake)
    eid = _visit(client)
    text = "How long has he been itchy?\nAbout a week."
    client.post(f"/api/encounters/{eid}/transcript", json={"text": text})
    enc = speakers.store.get(eid)
    assert enc
    enc.segments = [  # the vet named the first line's speaker
        s.model_copy(update={"speaker_id": "vet", "role": "vet"}) if s.line == 1 else s
        for s in enc.segments
    ]
    enc.transcript = "Vet: Let's have a look.\n" + enc.transcript
    asked.clear()
    enc = anyio.run(speakers.label, enc)
    got = [(s.line, s.id, s.role, s.text) for s in enc.segments]
    assert got == [
        (1, f"{eid}-1", "vet", "Let's have a look."),
        (2, f"{eid}-2", "vet", "How long has he been itchy?"),  # kept, moved down
        (3, f"{eid}-3", "owner", "About a week."),
    ]
    assert asked == []  # only the new line, and it was labeled as written


def test_audio_parts_are_counted(client):
    eid = _visit(client)
    for i in (0, 1, 2):
        enc = client.post(
            f"/api/encounters/{eid}/audio",
            files={"file": ("a.m4a", b"\0" * 10)},
            data={"chunk_index": str(i)},
        ).json()
    assert enc["parts_received"] == 3 and enc["last_part"] == 2
    assert enc["first_part_at"]
    assert enc["segments"] and enc["segments"][0]["role"] == "vet"


# ---------- Who is this? ----------
def test_naming_a_speaker_applies_to_every_line(client):
    eid = _visit(client)
    _load_sample(client, eid)
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": "Speaker 3: Ear cleaner is on the counter."},
    )
    r = client.post(
        f"/api/encounters/{eid}/speakers/speaker-3",
        json={"role": "tech", "name": "Maria"},
    )
    assert r.status_code == 200, r.text
    named = [s for s in r.json()["segments"] if s["speaker_id"] == "speaker-3"]
    assert len(named) == 2
    assert all((s["speaker_name"], s["role"]) == ("Maria", "tech") for s in named)
    # New lines from that voice keep the name.
    later = client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": "Speaker 3: All set."},
    ).json()["segments"][-1]
    assert (later["speaker_name"], later["role"]) == ("Maria", "tech")
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    assert any(a["action"] == "speaker_named" for a in audit)


def test_naming_rules(client):
    eid = _visit(client)
    _load_sample(client, eid)
    for speaker, body, status in (
        ("speaker-3", {"role": "boss"}, 400),
        ("vet", {"role": "tech"}, 400),
        ("speaker-9", {"role": "tech"}, 400),
    ):
        r = client.post(f"/api/encounters/{eid}/speakers/{speaker}", json=body)
        assert r.status_code == status, (speaker, r.text)
    family = client.post(
        f"/api/encounters/{eid}/speakers/speaker-3", json={"role": "family"}
    ).json()
    seg = next(s for s in family["segments"] if s["speaker_id"] == "speaker-3")
    assert seg["speaker_name"] == "Family member"


def test_only_the_visits_vet_names_speakers(client):
    speakers = _speakers(client)
    eid = _visit(client)
    _load_sample(client, eid)
    store = speakers.store
    for who in (
        _person("vet", "prov-2"),
        _person("front_office"),
        _person("admin"),
        Caller(via="token"),
    ):
        with pytest.raises(HTTPException) as refused:
            speakers.name(who, store.get(eid), "speaker-3", "tech")
        assert refused.value.status_code == 403
    speakers.name(_person("vet", "prov-1"), store.get(eid), "speaker-3", "tech")
    speakers.name(OPEN, store.get(eid), "speaker-3", "tech")


def test_naming_is_refused_once_signed(client):
    eid = _visit(client)
    _load_sample(client, eid)
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    r = client.post(f"/api/encounters/{eid}/speakers/speaker-3", json={"role": "tech"})
    assert r.status_code == 409


def test_bad_input_is_refused_by_the_service():
    with pytest.raises(SpeakerError):
        from blinqscribe.schemas import Encounter
        from blinqscribe.speakers import name_speaker

        name_speaker(
            Encounter(
                id="e",
                appointment_id="a",
                patient_id="p",
                consent_recorded=True,
                created_at=datetime.now(UTC),
            ),
            "speaker-3",
            "tech",
        )


# ---------- where labels show, and where they never do ----------
def test_another_vet_never_sees_the_labels(client):
    eid = _visit(client)
    _load_sample(client, eid)
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    enc = _speakers(client).store.get(eid)
    assert enc.segments
    for who in (_person("vet", "prov-2"), _person("front_office")):
        shown = visit_view(who, enc)
        assert shown.segments == [] and shown.transcript == ""


def test_remember_says_who_said_it(client):
    eid = _visit(client)
    _load_sample(client, eid)
    client.post(f"/api/encounters/{eid}/draft")
    items = client.get(f"/api/encounters/{eid}/remember").json()["suggestions"]
    assert items and all(i["said_by"] == "Jordan Lee · Owner" for i in items)


def test_remember_reads_owner_lines_from_labels(client):
    """A real transcript has no "Owner:" prefix: the labels say whose line it is."""
    from blinqscribe import remember
    from blinqscribe.schemas import Segment

    text = "My daughter graduates on Saturday.\nHe weighs 74 lb."
    segs = [
        Segment(
            id="1", line=1, speaker_id="owner", role="owner", text=text.split("\n")[0]
        ),
        Segment(id="2", line=2, speaker_id="vet", role="vet", text="He weighs 74 lb."),
    ]
    found, _ = remember.find_mock(text, segs)
    assert [f.kind for f in found] == ["graduation"]


def _pdf_text(data: bytes) -> bytes:
    out = b""
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", data, re.S):
        try:
            out += zlib.decompress(m.group(1))
        except zlib.error:
            out += m.group(1)
    return out


def test_the_owner_summary_never_shows_labels(client):
    eid = _visit(client)
    _load_sample(client, eid)
    client.post(
        f"/api/encounters/{eid}/speakers/speaker-3",
        json={"role": "tech", "name": "Maria"},
    )
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    summary = client.get(f"/api/encounters/{eid}/summary").json()
    pdf = _pdf_text(client.get(f"/api/encounters/{eid}/summary.pdf").content)
    for leak in ("Speaker 3", "Maria", "· Owner", "· Vet", "segments", "speaker"):
        assert leak not in str(summary)
        assert leak.encode() not in pdf


def test_who_is_this_over_graphql(client):
    eid = _visit(client)
    _load_sample(client, eid)
    r = client.post(
        "/graphql",
        json={
            "query": "mutation($e: String!) { name_speaker(encounter_id: $e, "
            'speaker_id: "speaker-3", role: "other_vet", name: "Dr. Kim") '
            "{ parts_received segments { speaker_id speaker_name role "
            "offset_seconds line } } }",
            "variables": {"e": eid},
        },
    )
    body = r.json()
    assert not body.get("errors"), body
    named = [
        s
        for s in body["data"]["name_speaker"]["segments"]
        if s["speaker_id"] == "speaker-3"
    ]
    assert named and all(s["role"] == "other_vet" for s in named)
    assert named[0]["speaker_name"] == "Dr. Kim"
