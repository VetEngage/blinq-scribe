"""Demo mode: with no keys, every feature works on the synthetic clinic, and what is
simulated says so."""

from dataclasses import replace

from fastapi.testclient import TestClient

from blinqscribe.api import create_app
from blinqscribe.main import parse_env_value
from blinqscribe.store import Store
from blinqscribe.stt import MOCK_PARTS, mock_part
from blinqscribe.voice import profile_for


def _visit(client, appt="appt-1"):
    return client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
    ).json()["id"]


def _record(client, eid, index):
    return client.post(
        f"/api/encounters/{eid}/audio",
        files={"file": ("a.m4a", b"\0" * 10)},
        data={"chunk_index": str(index)},
    ).json()["transcript"]


def test_recording_plays_the_sample_visit_in_parts(client):
    sample = [
        ln
        for ln in client.get("/api/sample-transcript").json()["text"].splitlines()
        if ln.strip()
    ]
    eid = _visit(client)
    for i in range(MOCK_PARTS + 1):
        transcript = _record(client, eid, i)
    assert transcript.splitlines() == sample
    assert mock_part(transcript) == ""  # after the last part it hears nothing

    # A second visit in the same page, and a page reload that restarts the counter,
    # start from part one
    # and never repeat a part.
    second = _visit(client, "appt-2")
    # It hears the sample visit told about that appointment's pet (Miso).
    miso = (
        client.get("/api/sample-transcript", params={"appointment_id": "appt-2"})
        .json()["text"]
        .splitlines()
    )
    first_part = _record(client, second, 7)
    assert first_part and miso[0] in first_part and "Miso" in miso[0]
    assert _record(client, second, 0).count(miso[0]) == 1


def test_a_live_practice_never_hears_the_sample_visit(settings):
    from blinqscribe.adapters.mock import MockAdapter

    class LiveLike(MockAdapter):
        name = "clinic_pims"

    client = TestClient(
        create_app(settings, adapter=LiveLike()),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    assert _record(client, _visit(client), 0) == ""


def test_texts_are_previewed_not_sent(settings):
    client = TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    assert client.get("/health").json()["sms"] == "preview"
    eid = _visit(client)
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    f = client.post(f"/api/encounters/{eid}/draft").json()["followups"][0]
    f = next(
        x
        for x in client.post(
            f"/api/encounters/{eid}/followups/{f['id']}",
            json={"action": "approve", "booking_mode": "book"},
        ).json()["followups"]
        if x["id"] == f["id"]
    )
    assert f["sms"]["status"] == "preview" and f["sms"]["text"].startswith(
        f["message_draft"].strip()[:20]
    )
    assert "not sent" in f["sms"]["detail"] and not f["sms"]["to_masked"]
    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-1] == "text_preview"


def test_demo_vet_without_notes_gets_a_flagged_default_profile(client, settings):
    with client:  # startup syncs the demo clinic's notes
        assert client.get("/api/providers/prov-1/voice").json()["source"] == "synced"
        Store(settings.data_dir).run(
            "DELETE FROM pims_notes WHERE provider_id = 'prov-2'"
        )
        default = client.get("/api/providers/prov-2/voice").json()
    assert default["source"] == "default" and default["notes_used"] == 0
    assert (
        profile_for(Store(settings.data_dir), "prov-2") is None
    )  # the real rule is unchanged


def test_live_practice_never_gets_the_default(settings):
    from blinqscribe.adapters.mock import MockAdapter

    class LiveLike(MockAdapter):
        name = "clinic_pims"

    client = TestClient(
        create_app(settings, adapter=LiveLike()),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    assert client.get("/api/providers/prov-9/voice").json() is None


def test_env_values_drop_inline_comments_and_quotes():
    assert parse_env_value("   # the one phone that receives demo texts") == ""
    assert parse_env_value("+15551234567   # your number") == "+15551234567"
    assert parse_env_value("'tok&en$' # note") == "tok&en$"
    assert parse_env_value('"a # b"') == "a # b"
    assert (
        parse_env_value("https://x.test/book?a=1&b=2") == "https://x.test/book?a=1&b=2"
    )
    assert parse_env_value("abc#def") == "abc#def"
