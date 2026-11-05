"""Read aloud: the Kokoro voice behind POST /api/speech, with the browser's voice as
the fallback. A fake engine stands in for the model; one test uses the real one
when its files are downloaded."""

import hashlib
import json
import os
import re
import time
from dataclasses import replace
from pathlib import Path

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from blinqscribe import speech
from blinqscribe.api import create_app
from blinqscribe.speech import SAMPLE_RATE, KokoroEngine, Speech, installed
from blinqscribe.speech_g2p import (
    _OWN_LOWER,
    _TOKEN,
    _known,
    _with_suffix,
    normalize,
    phonemize,
    spelled,
)


class FakeEngine:
    def __init__(self):
        self.calls = []

    def speak(self, text, voice):
        self.calls.append((text, voice))
        return np.zeros(SAMPLE_RATE // 10, np.float32)


def _client(settings, engine=None):
    app = create_app(settings)
    if engine:
        app.state.speech._engine = engine
    return TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000))


# ---------- the API ----------


def test_without_the_model_the_web_uses_the_browser_voice(client):
    assert client.get("/health").json()["tts"] == "browser"
    options = client.get("/api/speech/voices").json()
    assert options["available"] is False and options["default_voice"] == "af_heart"
    assert {v["id"] for v in options["voices"]} >= {"af_heart", "bm_george"}
    r = client.post("/api/speech", json={"text": "Good morning."})
    assert r.status_code == 503 and "browser voice" in r.json()["detail"]


def test_speech_is_a_wav_clip_and_cached(settings):
    engine = FakeEngine()
    client = _client(settings, engine)
    assert client.get("/health").json()["tts"] == "kokoro"
    first = client.post("/api/speech", json={"text": "Miso is first."})
    assert first.status_code == 200 and first.headers["content-type"] == "audio/wav"
    assert first.content[:4] == b"RIFF" and first.content[8:12] == b"WAVE"
    assert first.headers["cache-control"] == "no-store"
    again = client.post("/api/speech", json={"text": "Miso is first."})
    assert again.content == first.content
    assert engine.calls == [("Miso is first.", "af_heart")]  # the second was cached
    client.post("/api/speech", json={"text": "Miso is first.", "voice": "bm_george"})
    assert engine.calls[-1] == ("Miso is first.", "bm_george")


def test_speech_refuses_what_it_cannot_read(settings):
    client = _client(settings, FakeEngine())
    cases = [
        ({"text": "   "}, "Add some text"),
        ({"text": "x" * 2001}, "2,000 characters"),
        ({"text": "Hello.", "voice": "zz_nobody"}, "listed voices"),
    ]
    for body, message in cases:
        r = client.post("/api/speech", json=body)
        assert r.status_code == 400 and message in r.json()["detail"]


def test_speech_needs_a_signed_in_caller(settings):
    client = _client(replace(settings, api_token="secret"), FakeEngine())
    assert client.post("/api/speech", json={"text": "Hi."}).status_code == 401
    assert client.get("/api/speech/voices").status_code == 401
    ok = client.post(
        "/api/speech", json={"text": "Hi."}, headers={"Authorization": "Bearer secret"}
    )
    assert ok.status_code == 200


def test_speech_is_rate_limited_per_person(settings, monkeypatch):
    monkeypatch.setattr(speech, "RATE_LIMIT", 2)
    client = _client(settings, FakeEngine())
    codes = [
        client.post("/api/speech", json={"text": f"Line {n}."}).status_code
        for n in range(3)
    ]
    assert codes == [200, 200, 429]
    # A clip already made doesn't count again.
    assert client.post("/api/speech", json={"text": "Line 0."}).status_code == 200


def test_browser_setting_turns_the_natural_voice_off(settings):
    client = _client(replace(settings, tts_provider="browser"), FakeEngine())
    assert client.get("/health").json()["tts"] == "browser"
    assert client.post("/api/speech", json={"text": "Hi."}).status_code == 503


def test_the_cache_keeps_to_its_size(settings, monkeypatch):
    monkeypatch.setattr(speech, "CACHE_BYTES", 10_000)
    service = Speech(settings, FakeEngine())
    import anyio

    for n in range(5):  # each clip is about 4.8 KB
        anyio.run(service.say, f"Clip {n}.", "", "vet")
    assert service._cached_bytes <= 10_000 and len(service._cache) == 2


# ---------- the download ----------


def test_download_checks_every_file(tmp_path, monkeypatch):
    good, bad = b"model bytes", b"tampered"
    monkeypatch.setattr(
        speech,
        "FILES",
        {
            "model.onnx": ("onnx/model.onnx", hashlib.sha256(good).hexdigest(), 11),
            "voices/x.bin": ("voices/x.bin", hashlib.sha256(good).hexdigest(), 11),
        },
    )
    served = {"/onnx/model.onnx": good, "/voices/x.bin": bad}

    def handler(request):
        return httpx.Response(
            200, content=served[request.url.path.split(speech.REVISION)[1]]
        )

    with pytest.raises(SystemExit, match="SHA-256"):
        speech.download(tmp_path, httpx.MockTransport(handler))
    assert (tmp_path / "model.onnx").read_bytes() == good
    assert not (tmp_path / "voices" / "x.bin").exists()  # never left half done
    assert not installed(tmp_path)
    served["/voices/x.bin"] = good
    speech.download(tmp_path, httpx.MockTransport(handler))
    assert installed(tmp_path)


# ---------- words to sounds ----------


def test_numbers_times_and_units_are_spelled_out():
    assert normalize("6 visits at 9:05 am") == "six visits at nine oh five ay em"
    assert normalize("2.5 mg") == "two point five milligrams"
    assert (
        normalize("the 21st, 1,250 kg")
        == "the twenty first, one thousand two hundred fifty kilograms"
    )
    assert normalize("Dr. Rivera at 10:00") == "doctor Rivera at ten o'clock"


def test_known_words_come_from_the_dictionary():
    assert phonemize("Biscuit's ear.") == "bˈɪskəts ˈɪɹ."
    assert phonemize("a recheck of the ear") == "ɐ ɹiʧˈɛk əv ði ˈɪɹ"
    assert phonemize("ICU").count("ˈ") == 3  # said letter by letter


def test_an_unknown_word_still_gets_a_reading():
    assert spelled("Rivera") == "ɹˈɪvəɹə"
    assert phonemize("Zorbleck") and "ˈ" in phonemize("Zorbleck")


def _spoken(value: object) -> list[str]:
    """The text in the demo clinic's data that can be read aloud: not ids, dates,
    emails or phone numbers."""
    if isinstance(value, dict):
        return [s for v in value.values() for s in _spoken(v)]
    if isinstance(value, list):
        return [s for v in value for s in _spoken(v)]
    if isinstance(value, str) and not re.fullmatch(
        r"[a-z]+-[\w-]+|\d{4}-\d\d-\d\d.*|[\w.+-]+@[\w.]+|\+?[\d -]+", value
    ):
        return [value]
    return []


def test_the_demo_clinic_is_read_from_known_words():
    """Every name, drug and word in the demo clinic and the sample visit has a
    reading of its own, so none falls back to spelling rules."""
    data = Path(__file__).parents[1] / "data"
    lines = [
        *_spoken(json.loads((data / "mock_practice.json").read_text())),
        (data / "sample_visit.txt").read_text(),
    ]
    words = {w for line in lines for w in _TOKEN.findall(normalize(line))}
    guessed = sorted(
        w
        for w in words
        if w[0].isalpha()
        and not (w.isupper() or _known(w, "us") or _with_suffix(w, "us"))
    )
    assert guessed == []


def test_vet_shorthand_is_said_in_full():
    said = normalize("Apoquel 16 mg PO BID, 2 mg/kg q12h. BCS 5, HR 120, Hx, Rx.")
    assert said == (
        "Apoquel sixteen milligrams by mouth twice a day, two milligrams per "
        "kilogram every twelve hours. body condition score five, heart rate one "
        "hundred twenty, history, prescription."
    )
    assert phonemize("Okafor, Rivera, Nguyen") == "Okˈɑfɔɹ, ɹəvˈɛɹə, wˈɪn"


OUR_WORDS = [
    "Rivera",
    "Okafor",
    "Ana",
    "Priya",
    "Shah",
    "Marcus",
    "Elena",
    "Cruz",
    "Nguyen",
    "Jordan",
    "Biscuit",
    "Miso",
    "Waffles",
    "Luna",
    "Pepper",
    "Rocket",
    "Cefpodoxime",
    "amlodipine",
    "Apoquel",
    "Mometamox",
    "cytology",
    "tympanic",
    "brachycephalic",
    "DHPP",
    "BID",
    "SID",
    "mg",
    "mL",
]


def test_our_table_reads_the_demo_names_and_vet_terms():
    for word in OUR_WORDS:
        assert word.lower() in _OWN_LOWER, word
        assert phonemize(word) == _OWN_LOWER[word.lower()] or word in ("BID", "SID")
    assert normalize("Dr. Rivera at 2:15 PM, then 9 am") == (
        "doctor Rivera at two fifteen pee em, then nine ay em"
    )


# ---------- the real model, when it is downloaded ----------

MODELS = Path(os.environ.get("MODELS_DIR") or Path(__file__).parents[1] / "var/models")


@pytest.mark.skipif(not installed(MODELS), reason="Kokoro files not downloaded")
def test_kokoro_reads_a_brief_aloud():
    engine = KokoroEngine(MODELS)
    brief = (
        "Good morning, Dr. Rivera. You have six visits today. Miso is first at "
        "9:30, and needs a towel wrap."
    )
    start = time.monotonic()
    audio = engine.speak(brief, "af_heart")
    seconds = len(audio) / SAMPLE_RATE
    assert 4 < seconds < 15 and np.abs(audio).max() > 0.05
    assert time.monotonic() - start < 30


@pytest.mark.skipif(not installed(MODELS), reason="Kokoro files not downloaded")
def test_kokoro_says_every_word_in_our_table():
    engine = KokoroEngine(MODELS)
    for word in OUR_WORDS:
        audio = engine.speak(f"{word}.", "af_heart")
        assert len(audio) / SAMPLE_RATE > 0.3 and np.abs(audio).max() > 0.05, word
