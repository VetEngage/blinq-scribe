"""Muse Voice Transcribe client. No network: the Meta endpoint is an httpx mock
transport."""

import json
import struct
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from blinqscribe import api as api_module
from blinqscribe.api import create_app
from blinqscribe.config import Settings
from blinqscribe.stt import META_MODEL, Transcriber, TranscriptionError


def wav(seconds=0.1, rate=16000) -> bytes:
    pcm = b"\0\0" * int(rate * seconds)
    return (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
        + b"data"
        + struct.pack("<I", len(pcm))
        + pcm
    )


class FakeMeta:
    def __init__(self, status=200, body=None):
        self.status, self.body, self.requests = (
            status,
            body or {"transcript": "Ears look red."},
            [],
        )

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return (
            httpx.Response(self.status, json=self.body)
            if self.status == 200
            else httpx.Response(self.status, text="nope")
        )


def meta(settings, fake):
    return Transcriber(
        replace(settings, stt_provider="meta", stt_api_key="KEY", stt_model=""),
        transport=httpx.MockTransport(fake),
    )


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_a_model_key_turns_on_muse_voice_transcribe(monkeypatch):
    monkeypatch.delenv("STT_PROVIDER", raising=False)
    monkeypatch.delenv("STT_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_API_KEY", "KEY")
    assert Settings().stt_provider == "meta"
    monkeypatch.setenv("MODEL_API_KEY", "")
    assert Settings().stt_provider == "mock"
    monkeypatch.setenv("STT_PROVIDER", "mock")
    monkeypatch.setenv("MODEL_API_KEY", "KEY")
    assert Settings().stt_provider == "mock"  # an explicit choice wins


@pytest.mark.anyio
async def test_sends_the_wav_the_way_the_file_endpoint_expects(settings):
    fake = FakeMeta()
    assert (
        await meta(settings, fake).transcribe(wav(), "chunk0.wav", 0)
        == "Ears look red."
    )
    (req,) = fake.requests
    assert (
        str(req.url) == "https://api.meta.ai/v1/asr/transcribe"
        and req.headers["Authorization"] == "Bearer KEY"
    )
    body = req.read()
    assert b'name="audio"; filename="chunk0.wav"' in body and b"RIFF" in body
    request = json.loads(
        body.split(b'name="request"')[1].split(b"\r\n\r\n", 1)[1].split(b"\r\n--", 1)[0]
    )
    assert request == {
        "mode": "PUSH_TO_TALK",
        "model": META_MODEL,
        "audioEncoding": "WAV",
    }


@pytest.mark.anyio
async def test_turns_are_joined_when_there_is_no_transcript(settings):
    fake = FakeMeta(
        body={"turns": [{"transcript": "Hi."}, {"transcript": "He is itchy."}]}
    )
    assert (
        await meta(settings, fake).transcribe(wav(), "c.wav", 0) == "Hi. He is itchy."
    )


@pytest.mark.anyio
async def test_refuses_non_wav_and_reports_errors(settings):
    fake = FakeMeta()
    with pytest.raises(TranscriptionError, match="WAV"):
        await meta(settings, fake).transcribe(b"\x1aE\xdf\xa3webm", "c.webm", 0)
    assert not fake.requests  # never sent
    with pytest.raises(TranscriptionError, match="401"):
        await meta(settings, FakeMeta(status=401)).transcribe(wav(), "c.wav", 0)


def test_a_failed_chunk_says_why_and_keeps_the_visit(settings, monkeypatch):
    fake = FakeMeta(status=500)
    real_init = Transcriber.__init__

    def init(self, s, demo=False, transport=None):
        real_init(
            self,
            replace(s, stt_provider="meta", stt_api_key="KEY"),
            demo,
            httpx.MockTransport(fake),
        )

    monkeypatch.setattr(api_module.Transcriber, "__init__", init)
    client = TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 50000)
    )
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    r = client.post(
        f"/api/encounters/{eid}/audio",
        files={"file": ("c.wav", wav())},
        data={"chunk_index": "0"},
    )
    assert r.status_code == 502 and "500" in r.json()["detail"]
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    assert audit[-1]["action"] == "audio_chunk_failed"
    assert client.get(f"/api/encounters/{eid}").json()["transcript"] == ""


def test_a_signed_visit_takes_no_more_audio(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Demo"})
    r = client.post(
        f"/api/encounters/{eid}/audio",
        files={"file": ("c.wav", wav())},
        data={"chunk_index": "9"},
    )
    assert r.status_code == 409


@pytest.mark.anyio
async def test_an_unreadable_reply_is_reported_plainly(settings):
    def garbled(request):
        return httpx.Response(200, text="<html>gateway</html>")

    t = Transcriber(
        replace(settings, stt_provider="meta", stt_api_key="KEY"),
        transport=httpx.MockTransport(garbled),
    )
    with pytest.raises(TranscriptionError, match="unreadable"):
        await t.transcribe(wav(), "c.wav", 0)
