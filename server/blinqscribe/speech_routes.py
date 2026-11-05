"""Read aloud and press to talk over REST: both carry binary audio, so neither is a
GraphQL field."""

from __future__ import annotations

import itertools
import time
from collections import defaultdict
from types import SimpleNamespace
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from .accounts import Caller
from .speech import Speech, SpeechError
from .stt import Transcriber, TranscriptionError

# Press to talk sends one short question: about a minute of 16 kHz mono WAV at most.
LISTEN_MAX_BYTES = 2 * 1024 * 1024
LISTEN_PER_MINUTE = 20
# The demo clinic with no speech model "hears" these in turn: questions about its day
# that mock Ask Blinq answers.
DEMO_QUESTIONS = (
    "What's first?",
    "Miso's kidney results",
    "What did Jordan say about Biscuit last night?",
    "What needs me?",
)


class SpeechIn(BaseModel):
    text: str
    voice: str = ""  # blank = the server's default voice


def register(app: FastAPI, ctx: SimpleNamespace) -> None:
    speech: Speech = ctx.speech
    stt: Transcriber = ctx.stt
    demo_questions = itertools.cycle(DEMO_QUESTIONS)
    recent: defaultdict[str, list[float]] = defaultdict(list)

    def person(who: Caller, request: Request) -> str:
        return (
            who.user.id
            if who.user
            else f"{who.via}:{request.client.host if request.client else ''}"
        )

    @app.post(
        "/api/speech",
        response_class=Response,
        responses={200: {"content": {"audio/wav": {}}}},
    )
    async def speak(
        body: SpeechIn, request: Request, who: Caller = Depends(ctx.auth)
    ) -> Response:
        """The text read aloud as WAV. 503 when the natural voice isn't installed:
        the web app then reads it with the browser's voice."""
        try:
            audio = await speech.say(body.text, body.voice, person(who, request))
        except SpeechError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
        return Response(
            audio, media_type="audio/wav", headers={"Cache-Control": "no-store"}
        )

    @app.get("/api/speech/voices", dependencies=[Depends(ctx.auth)])
    def voices() -> dict[str, Any]:
        """The voices, the default one, and whether the natural voice is on."""
        return speech.options()

    @app.post("/api/speech/listen")
    async def listen(
        request: Request,
        file: UploadFile = File(...),
        who: Caller = Depends(ctx.auth),
    ) -> dict[str, str]:
        """Press to talk: one short clip of the vet's question (16 kHz mono WAV), as
        text. `via` says who heard it: "model" (the speech model) or "mock" (the demo
        clinic with no speech model, which hears a plausible question about its day).
        A live practice with no speech model answers 503, and the web listens with
        the browser's own recognition instead."""
        key, now = person(who, request), time.monotonic()
        recent[key] = [t for t in recent[key] if now - t < 60]
        if len(recent[key]) >= LISTEN_PER_MINUTE:
            raise HTTPException(429, "Too many questions at once. Try again shortly.")
        recent[key].append(now)
        data = await file.read()
        if len(data) > LISTEN_MAX_BYTES:
            raise HTTPException(413, "That's too long for one question.")
        if not stt.hears:
            if stt.demo:
                return {"text": next(demo_questions), "via": "mock"}
            raise HTTPException(503, "No speech model on this server. Type instead.")
        try:
            text = await stt.transcribe(data, file.filename or "question.wav", 0)
        except TranscriptionError as exc:
            raise HTTPException(502, str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                502, f"Couldn't hear that ({exc.__class__.__name__})."
            ) from exc
        return {"text": text.strip(), "via": "model"}
