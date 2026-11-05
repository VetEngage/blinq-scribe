"""Read aloud in a natural voice: Kokoro-82M (Apache-2.0) on the server's CPU.

The model and voice files are not in the repo. Fetch them once (about 95 MB):

    uv run python -m blinqscribe.speech download

They go to MODELS_DIR (default ./var/models), each checked against its SHA-256.
With them there, TTS_PROVIDER blank means Kokoro; without them, or with
TTS_PROVIDER=browser, the web app uses the browser's own voice.

Clips are cached in memory only, never on disk: the text holds patient names.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import io
import json
import re
import sys
import threading
import time
import wave
from collections import OrderedDict, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx
import numpy as np
import numpy.typing as npt

from .config import Settings
from .speech_g2p import Accent, phonemize

MAX_CHARS = 2000
SAMPLE_RATE = 24_000
RATE_LIMIT = 30  # clips per person per minute
CACHE_BYTES = 48 * 1024 * 1024
CONCURRENCY = 1  # one synthesis at a time: it uses every CPU core already

# onnx-community/Kokoro-82M-v1.0-ONNX (Apache-2.0), pinned to one commit.
REVISION = "1939ad2a8e416c0acfeecc08a694d14ef25f2231"
SOURCE = (
    "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/" + REVISION
)
MODEL = "model_quantized.onnx"  # int8: small and quick on a CPU


@dataclass(frozen=True)
class Voice:
    id: str
    name: str
    language: str
    gender: str


VOICES = [
    Voice("af_heart", "Heart", "en-US", "female"),
    Voice("af_bella", "Bella", "en-US", "female"),
    Voice("am_michael", "Michael", "en-US", "male"),
    Voice("am_fenrir", "Fenrir", "en-US", "male"),
    Voice("bf_emma", "Emma", "en-GB", "female"),
    Voice("bm_george", "George", "en-GB", "male"),
]
VOICE_IDS = {v.id for v in VOICES}

# Local file: (path in the model repo, SHA-256, bytes).
FILES = {
    MODEL: (
        "onnx/model_quantized.onnx",
        "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478",
        92_361_116,
    ),
    "tokenizer.json": (
        "tokenizer.json",
        "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34",
        3_497,
    ),
    "voices/af_heart.bin": (
        "voices/af_heart.bin",
        "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b",
        522_240,
    ),
    "voices/af_bella.bin": (
        "voices/af_bella.bin",
        "f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b",
        522_240,
    ),
    "voices/am_michael.bin": (
        "voices/am_michael.bin",
        "1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1",
        522_240,
    ),
    "voices/am_fenrir.bin": (
        "voices/am_fenrir.bin",
        "c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43",
        522_240,
    ),
    "voices/bf_emma.bin": (
        "voices/bf_emma.bin",
        "669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73",
        522_240,
    ),
    "voices/bm_george.bin": (
        "voices/bm_george.bin",
        "c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc",
        522_240,
    ),
}

Audio = npt.NDArray[np.float32]


class SpeechError(ValueError):
    """A refused request. The message is safe to show."""

    status = 400


class SpeechUnavailable(SpeechError):
    status = 503


class TooMuchSpeech(SpeechError):
    status = 429


def installed(models_dir: Path) -> bool:
    return all((models_dir / name).is_file() for name in FILES)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def download(models_dir: Path, transport: httpx.BaseTransport | None = None) -> None:
    """Fetch each file that is missing or wrong, check it, then move it into place
    (so a half-downloaded file is never used)."""
    with httpx.Client(transport=transport, follow_redirects=True, timeout=60) as client:
        for name, (remote, sha256, size) in FILES.items():
            path = models_dir / name
            if path.is_file() and _sha256(path) == sha256:
                print(f"ok        {name}")
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            part = path.with_name(path.name + ".part")
            print(f"download  {name} ({size / 1e6:.1f} MB)", flush=True)
            with client.stream("GET", f"{SOURCE}/{remote}") as reply:
                reply.raise_for_status()
                with part.open("wb") as f:
                    for chunk in reply.iter_bytes(1 << 20):
                        f.write(chunk)
            if _sha256(part) != sha256:
                part.unlink()
                raise SystemExit(f"{name} doesn't match its SHA-256. Try again.")
            part.replace(path)


class Engine(Protocol):
    def speak(self, text: str, voice: str) -> Audio: ...


class KokoroEngine:
    """Kokoro-82M through ONNX Runtime. Loads on first use, then stays loaded."""

    MAX_TOKENS = 500  # the model takes 510 at most, with its two pad tokens

    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self._lock = threading.Lock()
        self._session: Any = None
        self._vocab: dict[str, int] = {}
        self._voices: dict[str, Audio] = {}

    def _load(self) -> None:
        with self._lock:
            if self._session is not None:
                return
            import onnxruntime

            tokenizer = json.loads((self.models_dir / "tokenizer.json").read_text())
            self._vocab = tokenizer["model"]["vocab"]
            self._session = onnxruntime.InferenceSession(
                str(self.models_dir / MODEL), providers=["CPUExecutionProvider"]
            )

    def _voice(self, voice: str) -> Audio:
        if voice not in self._voices:
            raw = np.fromfile(self.models_dir / "voices" / f"{voice}.bin", np.float32)
            self._voices[voice] = raw.reshape(-1, 1, 256)
        return self._voices[voice]

    def _chunks(self, text: str, accent: Accent) -> list[list[int]]:
        """Token ids, cut between sentences (or words) to fit the model."""
        out: list[list[int]] = [[]]
        for sentence in re.split(r"(?<=[.!?;:])\s+", text.strip()):
            for part in _fit(sentence, accent, self.MAX_TOKENS):
                ids = [
                    self._vocab[c] for c in phonemize(part, accent) if c in self._vocab
                ]
                if out[-1] and len(out[-1]) + len(ids) + 1 > self.MAX_TOKENS:
                    out.append([])
                if out[-1]:
                    out[-1].append(self._vocab[" "])
                out[-1] += ids
        return [ids for ids in out if ids]

    def speak(self, text: str, voice: str) -> Audio:
        self._load()
        styles = self._voice(voice)
        accent: Accent = "gb" if voice.startswith("b") else "us"
        pause = np.zeros(int(SAMPLE_RATE * 0.15), np.float32)
        clips: list[Audio] = []
        for ids in self._chunks(text, accent):
            wav = self._session.run(
                None,
                {
                    "input_ids": np.array([[0, *ids, 0]], np.int64),
                    "style": styles[len(ids) - 1],
                    "speed": np.array([1.0], np.float32),
                },
            )[0][0]
            clips += [np.asarray(wav, np.float32), pause]
        return np.concatenate(clips) if clips else pause


def _fit(sentence: str, accent: Accent, limit: int) -> list[str]:
    """A sentence, or its halves when its phonemes are too long for one go."""
    if len(phonemize(sentence, accent)) <= limit:
        return [sentence]
    words = sentence.split()
    if len(words) < 2:
        return [sentence[: limit // 2]]
    half = len(words) // 2
    return _fit(" ".join(words[:half]), accent, limit) + _fit(
        " ".join(words[half:]), accent, limit
    )


def wav_bytes(samples: Audio) -> bytes:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return out.getvalue()


class Speech:
    """The read-aloud service: which voice is on, and clips of text."""

    def __init__(self, settings: Settings, engine: Engine | None = None):
        self.provider = settings.tts_provider
        self.models_dir = settings.models_dir
        self.default_voice = (
            settings.tts_voice if settings.tts_voice in VOICE_IDS else VOICES[0].id
        )
        self._engine = engine
        self._gate = asyncio.Semaphore(CONCURRENCY)
        self._cache: OrderedDict[str, bytes] = OrderedDict()
        self._cached_bytes = 0
        self._recent: defaultdict[str, list[float]] = defaultdict(list)

    @property
    def available(self) -> bool:
        if self.provider == "browser":
            return False
        return self._engine is not None or installed(self.models_dir)

    @property
    def label(self) -> str:
        return "kokoro" if self.available else "browser"

    def options(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "default_voice": self.default_voice,
            "voices": [asdict(v) for v in VOICES],
        }

    def _allow(self, who: str) -> bool:
        now = time.monotonic()
        recent = [t for t in self._recent[who] if now - t < 60]
        self._recent[who] = recent
        if len(recent) >= RATE_LIMIT:
            return False
        recent.append(now)
        return True

    async def say(self, text: str, voice: str, who: str) -> bytes:
        """A WAV clip of `text`. Raises SpeechError with a message to show."""
        text, voice = text.strip(), voice or self.default_voice
        if not self.available:
            raise SpeechUnavailable(
                "The natural voice isn't installed on this server. Using the "
                "browser voice."
            )
        if not text:
            raise SpeechError("Add some text to read.")
        if len(text) > MAX_CHARS:
            raise SpeechError(f"Read up to {MAX_CHARS:,} characters at a time.")
        if voice not in VOICE_IDS:
            raise SpeechError("Pick one of the listed voices.")
        key = hashlib.sha256(f"{voice}\n{text}".encode()).hexdigest()
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        if not self._allow(who):
            raise TooMuchSpeech("That's a lot of reading aloud. Wait a minute.")
        if self._engine is None:
            self._engine = KokoroEngine(self.models_dir)
        engine = self._engine
        async with self._gate:
            audio = await asyncio.to_thread(
                lambda: wav_bytes(engine.speak(text, voice))
            )
        self._remember(key, audio)
        return audio

    def _remember(self, key: str, audio: bytes) -> None:
        self._cache[key] = audio
        self._cached_bytes += len(audio)
        while self._cached_bytes > CACHE_BYTES and len(self._cache) > 1:
            _, dropped = self._cache.popitem(last=False)
            self._cached_bytes -= len(dropped)


def main() -> None:
    from .config import get_settings, load_dotenv

    parser = argparse.ArgumentParser(description="Kokoro read-aloud voice files.")
    parser.add_argument("command", choices=["download", "check"])
    args = parser.parse_args()
    load_dotenv()
    models_dir = get_settings().models_dir
    if args.command == "download":
        download(models_dir)
        print(f"Kokoro is ready in {models_dir}.")
    elif installed(models_dir):
        print(f"Kokoro is installed in {models_dir}.")
    else:
        print(f"Kokoro isn't installed in {models_dir}. Run the download command.")
        sys.exit(1)


if __name__ == "__main__":
    main()
