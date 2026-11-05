"""Speech to text. Muse Voice Transcribe on the Meta Model API by default; pluggable so
an
open-weights model hosted on a partner GPU can stand in."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
from openai import AsyncOpenAI

from .config import Settings

SAMPLE_VISIT = Path(__file__).resolve().parents[1] / "data" / "sample_visit.txt"
MOCK_PARTS = 4  # the sample visit arrives over this many recorded chunks
META_MODEL = "muse-voice-transcribe-1.0"
META_MAX_BYTES = 32 * 1024 * 1024


class TranscriptionError(RuntimeError):
    """The speech model refused or failed. The message is safe to show."""


class Transcriber:
    def __init__(
        self,
        settings: Settings,
        demo: bool = False,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.provider = settings.stt_provider
        # the synthetic clinic: with no speech model, recording plays the sample visit
        self.demo = demo
        self.base_url = settings.stt_base_url.rstrip("/")
        self.api_key = settings.stt_api_key
        self.model = settings.stt_model or (
            META_MODEL if self.provider == "meta" else ""
        )
        self._transport = transport
        self._client = None
        if self.provider == "meta":
            if not self.api_key:
                raise ValueError(
                    "Set MODEL_API_KEY (or STT_API_KEY) for STT_PROVIDER=meta"
                )
        elif self.provider == "openai_compatible":
            if not self.model:
                raise ValueError("Set STT_MODEL when STT_PROVIDER=openai_compatible")
            self._client = AsyncOpenAI(
                base_url=self.base_url, api_key=self.api_key or "none"
            )
        elif self.provider != "mock":
            raise ValueError(
                f"STT_PROVIDER={self.provider!r} is not one of meta, "
                "openai_compatible, mock"
            )

    @property
    def hears(self) -> bool:
        """A real speech model is set up (not the mock)."""
        return self.provider == "meta" or self._client is not None

    @property
    def plays_sample(self) -> bool:
        """Demo mode with no speech model: recording plays the sample visit."""
        return self.demo and self.provider != "meta" and self._client is None

    async def transcribe(
        self,
        audio: bytes,
        filename: str,
        chunk_index: int,
        heard: str = "",
        sample: str = "",
    ) -> str:
        """Text for one recorded chunk. `heard` is the visit's transcript so far;
        `sample` is the demo's sample visit fitted to this visit's pet."""
        if self.provider == "meta":
            return await self._meta(audio, filename)
        if self._client is None:
            # A live practice never gets the scripted visit: without a speech model it
            # hears nothing.
            return mock_part(heard, sample) if self.demo else ""
        result = await self._client.audio.transcriptions.create(
            model=self.model, file=(filename, audio)
        )
        return (getattr(result, "text", "") or "").strip()

    async def _meta(self, audio: bytes, filename: str) -> str:
        """Muse Voice Transcribe file endpoint: one multipart POST per chunk. Takes mono
        16-bit WAV at
        16 or 24 kHz, which is what the glasses app and the console record."""
        if audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            raise TranscriptionError(
                "The speech model needs WAV audio (16 kHz mono). Reload the "
                "page and record again."
            )
        if len(audio) > META_MAX_BYTES:
            raise TranscriptionError("That audio chunk is over 32 MB.")
        request = {"mode": "PUSH_TO_TALK", "model": self.model, "audioEncoding": "WAV"}
        try:
            async with httpx.AsyncClient(
                timeout=120, transport=self._transport
            ) as http:
                r = await http.post(
                    f"{self.base_url}/asr/transcribe",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files={
                        "request": (None, json.dumps(request), "application/json"),
                        "audio": (
                            Path(filename).name or "chunk.wav",
                            audio,
                            "audio/wav",
                        ),
                    },
                )
        except httpx.HTTPError as exc:
            raise TranscriptionError(
                f"Could not reach the speech model ({exc.__class__.__name__})."
            ) from exc
        if r.status_code != 200:
            raise TranscriptionError(
                f"The speech model returned {r.status_code}: {r.text[:200]}"
            )
        try:
            body = r.json()
        except ValueError as exc:
            raise TranscriptionError(
                "The speech model sent an unreadable reply."
            ) from exc
        turns = body.get("turns") or []
        text = body.get("transcript") or " ".join(
            t.get("transcript", "") for t in turns
        )
        return text.strip()


def _parts(sample: str = "") -> list[str]:
    text = sample or SAMPLE_VISIT.read_text()
    lines = [ln for ln in text.splitlines() if ln.strip()]
    size = -(-len(lines) // MOCK_PARTS)
    return ["\n".join(lines[i : i + size]) for i in range(0, len(lines), size)]


def mock_part(heard: str, sample: str = "") -> str:
    """Demo mode, no speech model: each recorded chunk "hears" the next part of the
    sample visit that is
    not in the transcript yet, so a reload, a resumed recording or a second visit never
    repeats or skips a
    part. Once the whole visit is in, it hears nothing."""
    return next((part for part in _parts(sample) if part not in heard), "")
