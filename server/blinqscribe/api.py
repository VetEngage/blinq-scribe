"""HTTP API used by the glasses companion app and the web console."""

from __future__ import annotations

import asyncio
import contextlib
import io
import logging
import secrets
import time
import uuid
import wave
from collections import defaultdict
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Literal

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import (
    auth_routes,
    booking_links,
    images,
    letters_routes,
    note_types,
    oidc,
    permissions,
    photos,
    pims_sync,
    plan_checks,
    record_routes,
    speaker_routes,
    speech_routes,
    visit_routes,
)
from . import day as days
from . import jobs as jobs_module
from . import sample as sample_visit
from .accounts import AccountError, Accounts, Caller, User
from .adapters import PracticeAdapter, build_adapter
from .assistant import DayAssistant, viewing
from .auth_routes import http_error, signed_in
from .config import Settings, get_settings
from .demo_seed import seed_busy_day, seed_history
from .events import Events, Run, draft_topic, turn_topic
from .jobs import Jobs, Services
from .llm import CutOff, MuseClient
from .mailer import Mailer
from .notes import HISTORY_DAYS, as_utc, previous_notes, use_clinic_timezone
from .oidc import OidcClient
from .plain import plain_markers
from .referrals import Letters
from .schemas import (
    Appointment,
    AssistantReply,
    AssistantRequest,
    Encounter,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
    PastNote,
    Patient,
    Photo,
    PhotoEdit,
    SoapNote,
    WriteBackResult,
)
from .scribe import (
    PREVIOUS_IN_PROMPT,
    draft_note,
    in_note,
    place_segments,
    plan_followups,
)
from .signin import SignInError, SignInService
from .sms import Texter
from .speakers import Speakers
from .speech import Speech
from .store import Store
from .stt import Transcriber, TranscriptionError
from .vision import Vision
from .voice import VoiceProfile, default_profile, profile_for

ROOT = Path(__file__).resolve().parents[2]
WEB_DIST = ROOT / "web" / "dist"
NO_BUILD_PAGE = """<!doctype html><html lang="en"><meta charset="utf-8">
<title>Blinq Scribe</title>
<body style="font-family:system-ui;margin:48px;max-width:640px">
<h1>Blinq Scribe server is running</h1>
<p>The web app isn't built yet. From the repo root run <code>pnpm install</code> and
<code>pnpm build</code>, then reload this page. The API is at <code>/graphql</code>
and <code>/health</code>.</p></body></html>"""
# Unknown paths under these are a 404, never the web app's page.
SERVER_PATHS = {"api", "graphql", "health", "s", "docs", "openapi.json", "redoc"}
MAX_UPLOAD = 25 * 1024 * 1024


log = logging.getLogger("blinqscribe.api")


class NewEncounter(BaseModel):
    appointment_id: str
    consent_recorded: bool
    source: Literal["glasses", "web", "upload"] = "web"
    patient_ids: list[
        str
    ] = []  # several pets of the same owner; default the appointment's pet
    note_type: str = ""  # default guessed from the appointment type


class AddPetIn(BaseModel):
    patient_id: str


class TranscriptIn(BaseModel):
    text: str
    append: bool = True


class FollowUpAction(BaseModel):
    action: Literal["approve", "dismiss", "retry_text", "book"]
    message_draft: str | None = None
    # A recheck approved with a chosen time is booked in the practice system.
    # "book" retries on an approved recheck whose booking did not go through.
    slot_start: datetime | None = None
    # A recheck goes out as a booking link with the texts at signing (default), or is
    # booked now.
    booking_mode: Literal["link", "book"] | None = None
    # With a booking link: one reminder text if it isn't booked 3 days after it was
    # sent. On unless false.
    remind_unbooked: bool | None = None


class SignIn(BaseModel):
    # only used without a signed-in vet (demo mode or the API token)
    signed_by: str = ""
    # True: Sign and send to the PIMS (the default). False: Sign only, sent later.
    send: bool = True


class OnboardIn(BaseModel):
    days: int = HISTORY_DAYS


class LoginIn(BaseModel):
    username: str  # or email
    password: str
    # The iPhone app stays signed in; the web sign in page sends its checkbox.
    remember: bool = True


class InviteAcceptIn(BaseModel):
    token: str
    password: str


class InviteInfoIn(BaseModel):
    token: str


class NewUserIn(BaseModel):
    username: str
    name: str
    email: str = ""
    provider_id: str = ""
    role: Literal["vet", "front_office", "admin"] = "vet"


class UserUpdateIn(BaseModel):
    name: str | None = None
    email: str | None = None
    provider_id: str | None = None
    role: Literal["vet", "front_office", "admin"] | None = None
    active: bool | None = None


DOCTORS_TTL = 300.0  # seconds the doctor list is reused


to_confirm = days.to_confirm
SOAP_TEXT = ("subjective", "objective", "assessment", "plan", "client_summary")


def create_app(
    settings: Settings | None = None, adapter: PracticeAdapter | None = None
) -> FastAPI:
    settings = settings or get_settings()
    use_clinic_timezone(settings.clinic_tz)  # before anything reads today's date
    adapter = adapter or build_adapter(settings)
    store = Store(settings.data_dir, settings.database_url)
    accounts = Accounts(store, demo=adapter.name == "mock")
    signin = SignInService(
        store,
        accounts,
        Mailer(settings),
        adapter,
        {name: OidcClient(p) for name, p in oidc.configured(settings).items()},
        demo=adapter.name == "mock",
        public_url=settings.public_url,
    )
    muse = MuseClient(settings)
    stt = Transcriber(settings, demo=adapter.name == "mock")
    vision = Vision(settings, muse)
    assistant = DayAssistant(muse, adapter, store)
    texter = Texter(settings)  # refuses unsafe SMS settings at startup
    speakers = Speakers(muse, store)  # who said each transcript line (row 64)
    letters = Letters(
        store,
        adapter,
        muse,
        signin.mailer,
        texter,
        demo=adapter.name == "mock",
        public_url=settings.public_url,
        demo_email_to=settings.demo_email_to,
    )
    # Texts after signing, the note sync and the expiry checks: on Temporal when
    # TEMPORAL_ADDRESS is set, else here.
    jobs = Jobs(settings, Services(store, adapter, texter))
    speech = Speech(settings)  # read aloud: Kokoro when installed, else the browser
    events = Events()  # progress for the GraphQL subscriptions

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # The synthetic clinic onboards itself, so judges see voice profiles and history
        # on the first visit.
        if adapter.name == "mock" and not store.get_meta("notes_synced_at"):
            await jobs.start_note_sync(HISTORY_DAYS)
        await seed_history(
            adapter, store
        )  # demo clinic only, once: earlier days for the brief and week strip
        await seed_busy_day(adapter, store)  # demo clinic only: the heavy day
        await jobs.on_startup()  # Remember expiry, link checks, PIMS retries
        yield
        await jobs.on_shutdown()

    app = FastAPI(title="Blinq Scribe", version="0.1.0", lifespan=lifespan)

    def voice_for(provider_id: str, exclude_encounter: str = "") -> VoiceProfile | None:
        # The demo clinic falls back to a default style, flagged as such, so every vet's
        # drafts read like a note.
        # A live practice has no fallback: a vet's profile comes only from their own
        # synced or signed notes.
        profile = profile_for(store, provider_id, exclude_encounter)
        if not profile and provider_id and adapter.name == "mock":
            return default_profile(provider_id)
        return profile

    def login_required() -> bool:
        # Open only for the demo: no API token and nobody invited yet. The first account
        # closes it.
        return bool(settings.api_token) or accounts.any_users()

    def auth(authorization: str = Header(default="")) -> Caller:
        # Credentials only in the Authorization header, never a URL: URLs end up in
        # logs, history and Referer.
        raw = authorization.removeprefix("Bearer ").strip()
        if (
            settings.api_token
            and raw
            and secrets.compare_digest(raw.encode(), settings.api_token.encode())
        ):
            return Caller(via="token")
        if user := accounts.session_user(raw):
            return Caller(via="session", user=user)
        if not login_required():
            return Caller(via="open")
        raise HTTPException(401, "Please sign in")

    def admin(request: Request, who: Caller = Depends(auth)) -> Caller:
        if not who.admin:
            reason = "Only an admin can manage the team"
            store.audit(
                who.actor, "refused", None, {"action": "team.manage", "reason": reason}
            )
            raise HTTPException(403, reason)
        if who.via == "open" and not from_this_machine(request):
            # Before anyone has an account, only someone at the server itself may create
            # the first one,
            # so a stranger on the network (or a rebinding web page) can't claim the
            # practice.
            raise HTTPException(
                403,
                "Create the first account from the computer running Blinq Scribe, "
                "or set BLINQ_SCRIBE_API_TOKEN.",
            )
        return who

    def from_this_machine(request: Request) -> bool:
        host = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
        client = request.client.host if request.client else ""
        # Behind a reverse proxy every request comes from 127.0.0.1, so a proxied
        # request never counts as this machine.
        proxied = any(
            request.headers.get(h)
            for h in ("x-forwarded-for", "forwarded", "x-real-ip")
        )
        return (
            not proxied
            and client in ("127.0.0.1", "::1")
            and host in ("localhost", "127.0.0.1", "::1")
        )

    # Failed sign ins per (address, username): 5 in 15 minutes, then a pause.
    # In-process, like the locks below.
    failures: defaultdict[tuple[str, str], list[float]] = defaultdict(list)
    MAX_FAILURES, FAILURE_WINDOW = 5, 15 * 60

    def throttle(request: Request, key: str) -> tuple[str, str]:
        slot = (request.client.host if request.client else "", key.strip().lower())
        now = time.monotonic()
        failures[slot] = [t for t in failures[slot] if now - t < FAILURE_WINDOW]
        if len(failures[slot]) >= MAX_FAILURES:
            raise HTTPException(429, "Too many tries. Wait 15 minutes and try again.")
        return slot

    # Handlers that change an encounter load it, await a slow PIMS or SMS call, then
    # save the whole thing.
    # Running them one at a time per encounter keeps one request from overwriting
    # another's result
    # (a booking lost under a signature, or a signed note flipped back to editable).
    # In-process only: run one uvicorn worker, or move this to a database lock before
    # scaling out.
    locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def one_at_a_time(encounter_id: str) -> AsyncIterator[None]:
        # A visit with several pets shares one lock, so drafting the first pet's note
        # never overwrites a
        # sibling that is being signed or approved at the same time.
        enc = store.get(encounter_id)
        async with locks[(enc.group_id or enc.id) if enc else encounter_id]:
            yield

    def allow(who: Caller, action: str, enc: Encounter) -> None:
        """Refuse (403) unless the caller may do this on this visit (permissions)."""
        permissions.check(
            who, action, enc.provider_id, enc.provider_name, store, enc.id
        )

    def load(encounter_id: str) -> Encounter:
        enc = store.get(encounter_id)
        if not enc:
            raise HTTPException(404, "Encounter not found")
        return enc

    def audio_seconds(enc: Encounter, data: bytes) -> float:
        """How much audio the visit has with this part: a WAV part's own length
        (the console's), else the time since the first part arrived (the glasses')."""
        with (
            contextlib.suppress(wave.Error, EOFError),
            wave.open(io.BytesIO(data)) as w,
        ):
            return enc.audio_seconds + float(w.getnframes() / (w.getframerate() or 1))
        assert enc.first_part_at is not None
        since = (datetime.now(UTC) - as_utc(enc.first_part_at)).total_seconds()
        return max(enc.audio_seconds, since)

    async def read_upload(f: UploadFile) -> bytes:
        data = await f.read()
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, "File too large")
        return data

    # ---------- meta ----------
    if not (WEB_DIST / "index.html").is_file():
        # No build of the web app yet: say how to make one instead of a blank 404.
        @app.get("/", response_class=HTMLResponse)
        def build_the_web_app() -> str:
            return NO_BUILD_PAGE

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            "ai": "mock" if not muse.enabled else muse.model,
            "practice": adapter.name,
            "stt": settings.stt_provider,
            "sam": "mock" if not settings.sam_endpoint else "live",
            "sms": texter.label,
            "tts": speech.label,
            # The demo clinic's busy day (20 visits, 24 pets), so the console can
            # point to it; "" for a live practice.
            "busy_day": busy.isoformat()
            if isinstance(busy := getattr(adapter, "busy_day", None), date)
            else "",
        }

    # ---------- day ----------
    @app.get("/api/schedule", response_model=list[Appointment])
    async def schedule(
        on: date | None = Query(None, alias="date"),
        provider_id: str = "",
        who: Caller = Depends(auth),
    ) -> list[Appointment]:
        """One day's appointments, each with its visit status and note type in Blinq
        Scribe. With no provider_id: a vet's own, everyone's for front office and
        admins."""
        on = on or date.today()
        provider_id = permissions.default_provider(who, provider_id)
        appts = await adapter.get_schedule(on, provider_id or None)
        # Read from the practice system just now: the quick card's "Synced 8:02 AM".
        read = datetime.now().replace(microsecond=0)
        return [
            a.model_copy(update={"synced_at": read})
            for a in days.with_status(appts, on, store)
        ]

    @app.get("/api/brief", response_model=None)
    async def brief(
        provider_id: str = "", who: Caller = Depends(auth)
    ) -> dict[str, Any]:
        with viewing(who):
            return await assistant.morning_brief(
                permissions.default_provider(who, provider_id)
            )

    @app.get("/api/notes/unsigned", response_model=None)
    async def unsigned_notes(
        provider_id: str = "", who: Caller = Depends(auth)
    ) -> list[dict[str, Any]]:
        """Every note not signed yet, any day, newest first, in its bucket: "ready"
        (drafted, nothing to confirm, every follow up decided) or "pending" (with
        why). A vet's own by default, like the schedule."""
        return await days.unsigned_notes(
            store, adapter, permissions.default_provider(who, provider_id)
        )

    @app.get("/api/end-of-day", response_model=None)
    async def end_of_day(
        on: date | None = Query(None, alias="date"),
        provider_id: str = "",
        who: Caller = Depends(auth),
    ) -> dict[str, Any]:
        with viewing(who):
            return await assistant.end_of_day(
                permissions.default_provider(who, provider_id),
                on.isoformat() if on else None,
            )

    @app.get("/api/appointments/{appointment_id}/card", response_model=None)
    async def pre_room_card(
        appointment_id: str, who: Caller = Depends(auth)
    ) -> dict[str, Any]:
        with viewing(who):
            card = await assistant.pre_room_card(appointment_id)
        if "error" in card:
            raise HTTPException(404, card["error"])
        return card

    @app.get(
        "/api/providers/{provider_id}/voice",
        response_model=VoiceProfile | None,
        dependencies=[Depends(auth)],
    )
    def voice_profile(provider_id: str) -> VoiceProfile | None:
        """The style rules drafts follow for this vet, or null until they have enough
        notes (demo: a default)."""
        return voice_for(provider_id)

    @app.get("/api/patients/{patient_id}/notes", response_model=None)
    def patient_notes(patient_id: str, who: Caller = Depends(auth)) -> list[PastNote]:
        """Earlier notes for this patient from every vet, newest first, for
        continuity. Vets only; opening another vet's notes is logged."""
        if not permissions.sees_notes(who):
            return []
        notes = previous_notes(store, patient_id)
        log_opened(who, patient_id, [n.provider_id for n in notes])
        return notes

    def log_opened(who: Caller, patient_id: str, authors: list[str]) -> None:
        """Audit a signed-in person opening notes another vet wrote: who and when."""
        mine = who.user.provider_id if who.user else ""
        others = sorted({a for a in authors if a and a != mine})
        if who.via == "session" and others:
            store.audit(
                who.actor,
                "notes_opened",
                None,
                {"patient_id": patient_id, "providers": others},
            )

    @app.post("/api/admin/onboard", dependencies=[Depends(admin)], response_model=None)
    async def onboard(body: OnboardIn) -> dict[str, Any]:
        """Sync the practice's last N days of notes. Run at onboarding, then nightly."""
        report = await jobs.sync_notes(max(1, min(body.days, 365)))
        return report

    # ---------- sign in ----------
    @app.get("/api/auth/status")
    def auth_status() -> dict[str, Any]:
        return {"login_required": login_required()}

    @app.get("/api/auth/options")
    def auth_options() -> dict[str, bool]:
        """Which ways to sign in are on: Google, Microsoft and Try the demo clinic
        show only when they are."""
        return signin.options()

    @app.get("/api/me")
    def me(who: Caller = Depends(auth)) -> dict[str, Any]:
        return {
            "via": who.via,
            "user": who.user,
            "admin": who.admin,
            "role": who.user.role if who.user else "",
            "provider_id": who.user.provider_id if who.user else "",
            "permissions": permissions.allowed(who),
        }

    @app.post("/api/auth/login")
    async def login(body: LoginIn, request: Request) -> dict[str, Any]:
        address = request.client.host if request.client else ""
        try:
            result = await signin.with_password(
                body.username, body.password, body.remember, address
            )
        except SignInError as exc:
            raise http_error(exc) from exc
        return signed_in(result)

    # Invite tokens travel in the request body and in the link's #fragment, which
    # browsers never send to
    # the server, so they stay out of access logs.
    @app.post("/api/auth/invite/info")
    def invite_info(body: InviteInfoIn, request: Request) -> dict[str, Any]:
        slot = throttle(request, "invite")
        user = accounts.invite_user(body.token)
        if not user:
            failures[slot].append(time.monotonic())
            raise HTTPException(
                404,
                "This invite link has expired or was already used. Ask for a new one.",
            )
        return {"name": user.name, "username": user.username}

    @app.post("/api/auth/invite/accept")
    async def accept_invite(body: InviteAcceptIn, request: Request) -> dict[str, Any]:
        slot = throttle(request, "invite")
        try:
            user, session = accounts.accept_invite(body.token, body.password)
        except AccountError as exc:
            failures[slot].append(time.monotonic())
            raise HTTPException(400, str(exc)) from exc
        store.audit(user.username, "invite_accepted")
        if not session:  # 2FA is on: the code comes first
            return signed_in(await signin.finish(user, True, "invite"))
        return {"token": session, "user": user}

    @app.post("/api/auth/logout")
    def logout(authorization: str = Header(default="")) -> dict[str, Any]:
        accounts.logout(authorization.removeprefix("Bearer ").strip())
        return {"ok": True}

    # ---------- team: who is who in the practice system ----------
    def invite_link(request: Request, invite_token: str) -> str:
        base = (
            settings.public_url.rstrip("/") + "/"
            if settings.public_url
            else str(request.base_url)
        )
        return base + "#invite=" + invite_token

    # The practice's vets for the doctor picker, read every few minutes at most: the
    # list comes from two weeks of schedule.
    doctor_cache: dict[str, Any] = {}

    @app.get("/api/doctors", dependencies=[Depends(auth)])
    async def doctors() -> list[dict[str, str]]:
        """Every vet in the practice, for any signed-in role: provider id and name
        only. From the schedule a week either side of today, plus vets with a login."""
        now = time.monotonic()
        if now - doctor_cache.get("at", -DOCTORS_TTL) >= DOCTORS_TTL:
            found = {p["id"]: p["name"] for p in await adapter.list_providers()}
            doctor_cache.update(at=now, found=found)
        found = dict(doctor_cache["found"])
        for u in accounts.list():
            if u.provider_id and u.active and u.role == "vet":
                found.setdefault(u.provider_id, u.name)
        return [
            {"id": pid, "name": name}
            for pid, name in sorted(found.items(), key=lambda d: d[1].lower())
        ]

    @app.get("/api/admin/providers", dependencies=[Depends(admin)])
    async def providers() -> list[dict[str, Any]]:
        linked = {
            u.provider_id: u.name for u in accounts.list() if u.provider_id and u.active
        }
        return [
            {**p, "linked_to": linked.get(p["id"], "")}
            for p in await adapter.list_providers()
        ]

    @app.get(
        "/api/admin/users", response_model=list[User], dependencies=[Depends(admin)]
    )
    def users() -> list[User]:
        return accounts.list()

    @app.post("/api/admin/users")
    def add_user(
        body: NewUserIn, request: Request, who: Caller = Depends(admin)
    ) -> dict[str, Any]:
        try:
            user, invite = accounts.create(
                body.username, body.name, body.provider_id, body.role, body.email
            )
        except AccountError as exc:
            raise HTTPException(400, str(exc)) from exc
        store.audit(
            who.actor,
            "user_invited",
            None,
            {"user": user.username, "provider_id": user.provider_id, "role": user.role},
        )
        return {"user": user, "invite_url": invite_link(request, invite)}

    @app.post("/api/admin/users/{user_id}/invite")
    def reinvite(
        user_id: str, request: Request, who: Caller = Depends(admin)
    ) -> dict[str, Any]:
        user = accounts.get(user_id)
        if not user or not user.active:
            raise HTTPException(404, "No active person with that id")
        store.audit(who.actor, "user_reinvited", None, {"user": user.username})
        return {
            "user": user,
            "invite_url": invite_link(request, accounts.reinvite(user_id)),
        }

    @app.patch("/api/admin/users/{user_id}", response_model=User)
    def update_user(
        user_id: str, body: UserUpdateIn, who: Caller = Depends(admin)
    ) -> User:
        me = who.user
        if (
            me
            and me.id == user_id
            and (body.active is False or body.role not in (None, me.role))
        ):
            raise HTTPException(
                400, "You can't change your own role or turn yourself off."
            )
        target = accounts.get(user_id)
        demoting = body.active is False or body.role not in (None, "admin")
        if target and target.role == "admin" and target.active and demoting:
            others = [
                u
                for u in accounts.list()
                if u.role == "admin" and u.active and u.id != user_id
            ]
            if not others:
                raise HTTPException(400, "Keep at least one active admin.")
        try:
            user = accounts.update(
                user_id, body.name, body.provider_id, body.role, body.email
            )
            if body.active is not None:
                user = accounts.set_active(user_id, body.active)
        except AccountError as exc:
            raise HTTPException(400, str(exc)) from exc
        store.audit(
            who.actor,
            "user_updated",
            None,
            {"user": user.username, **body.model_dump(exclude_none=True)},
        )
        return user

    @app.post("/api/assistant", response_model=AssistantReply)
    async def ask(req: AssistantRequest, who: Caller = Depends(auth)) -> AssistantReply:
        # What it checks, then the reply, go to assistant_turn subscribers (req 58).
        turn = (
            events.run(turn_topic(req.turn_id), turn_id=req.turn_id, tools_used=[])
            if req.turn_id
            else Run(None, "", {})
        )
        try:
            with viewing(who):  # Ask Blinq answers only from what they may see
                reply = await assistant.chat(
                    req, on_check=lambda text: turn.emit(kind="checking", text=text)
                )
        except Exception:
            turn.emit(
                kind="error", text="Ask Blinq couldn't answer. Try again.", last=True
            )
            raise
        turn.emit(
            kind="reply", text=reply.reply, tools_used=reply.tools_used, last=True
        )
        return reply

    @app.get("/api/sample-transcript")
    async def sample(
        appointment_id: str = "", who: Caller = Depends(auth)
    ) -> dict[str, Any]:
        """The demo's sample visit for this appointment's pet (demo clinic only;
        anywhere else the generic one). Signed in, and only for an appointment the
        caller can see on the schedule: an unknown one is 404."""
        if not appointment_id:
            return {"text": sample_visit.text()}
        appt = await adapter.get_appointment(appointment_id)
        if not appt:
            raise HTTPException(404, "Appointment not found")
        return {"text": sample_for(appt)}

    def sample_for(appt: Appointment | None, patient_id: str = "") -> str:
        """A demo visit's own sample: its household's for a household appointment,
        else its pet's. A live practice never gets one built from its appointments:
        always the generic sample."""
        if adapter.name != "mock":
            return sample_visit.text()
        if not appt:
            return sample_visit.for_patient(patient_id)
        household = appt.client.id if len(appt.pets) > 1 else ""
        return sample_visit.for_appointment(appt.patient.id, household)

    # ---------- encounters ----------
    @app.post("/api/encounters", response_model=Encounter)
    async def start(body: NewEncounter, who: Caller = Depends(auth)) -> Encounter:
        # A visit can open before the owner is asked: nothing records until they agree
        # (Start recording asks, see record_consent); the audio refuses until then.
        appt = await adapter.get_appointment(body.appointment_id)
        if not appt:
            raise HTTPException(404, "Appointment not found")
        permissions.check(
            who,
            "visit.start",
            appt.vet_id,
            appt.vet_name,
            store,
            ownerless_ok=True,
        )
        # A visit is its vet's: the provider, else the column's vet on practices that
        # schedule by column. With neither, it becomes the starting vet's, so it is
        # never everyone's.
        owner_id, owner_name = appt.vet_id, appt.vet_name
        if not owner_id and who.user:
            owner_id, owner_name = who.user.provider_id, who.user.name
        if body.note_type and body.note_type not in note_types.NOTE_TYPES:
            raise HTTPException(400, "Unknown note type")
        pets = await visit_routes.visit_pets(
            adapter, appt, list(dict.fromkeys(body.patient_ids))
        )
        eid = uuid.uuid4().hex[:12]
        enc = Encounter(
            id=eid,
            appointment_id=appt.id,
            patient_id=pets[0].id,
            provider_id=owner_id,
            provider_name=owner_name,
            consent_recorded=body.consent_recorded,
            started_by=who.user.username if who.user else "",
            source=body.source,
            created_at=datetime.now(UTC),
            patient_ids=[p.id for p in pets],
            patient_name=pets[0].name,
            client_id=appt.client.id,
            owner_name=appt.client.full_name,
            note_type=body.note_type or note_types.guess(appt),
            group_id=eid,
        )
        store.save(enc)
        store.audit(
            who.actor,
            "encounter_started",
            enc.id,
            {
                "source": body.source,
                "consent": body.consent_recorded,
                "pets": len(pets),
                "note_type": enc.note_type,
            },
        )
        return enc

    @app.post(
        "/api/encounters/{encounter_id}/pets",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def add_pet(
        encounter_id: str, body: AddPetIn, who: Caller = Depends(auth)
    ) -> Encounter:
        """Another of the owner's pets joins a visit already started (the pet tabs'
        Add a pet). Its note comes from the room's one recording: with a draft
        already written, it waits as Not started until the draft is redone."""
        first = load(encounter_id)
        if first.group_id and first.group_id != first.id:
            first = load(first.group_id)
        allow(who, "visit.record", first)
        if first.status == EncounterStatus.signed:
            raise HTTPException(409, "The visit is signed")
        appt = await adapter.get_appointment(first.appointment_id)
        if not appt:
            raise HTTPException(404, "Appointment not found")
        ids = list(dict.fromkeys([*(first.patient_ids or [first.patient_id])]))
        if body.patient_id in ids:
            return first
        pets = await visit_routes.visit_pets(adapter, appt, [*ids, body.patient_id])
        first.patient_ids = [p.id for p in pets]
        store.save(first)
        if first.note:  # drafted already: the new pet's tab, its note still to write
            sibling(first, pets[-1])
        store.audit(who.actor, "pet_added", first.id, {"pets": len(first.patient_ids)})
        return first

    @app.get("/api/encounters", response_model=list[Encounter])
    def list_encounters(
        group_id: str = "", who: Caller = Depends(auth)
    ) -> list[Encounter]:
        """Visits as this reader may see them (another vet's drafts never show)."""
        if not group_id:
            return [permissions.visit_view(who, e) for e in store.list()]
        # One visit with several pets: the first pet's encounter, then the others in the
        # order they were added.
        group = [e for e in store.list(group_id=group_id) if e.group_id == group_id]
        ordered = sorted(group, key=lambda e: (e.id != group_id, e.created_at))
        return [permissions.visit_view(who, e) for e in ordered]

    @app.get("/api/encounters/{encounter_id}", response_model=Encounter)
    def get_encounter(encounter_id: str, who: Caller = Depends(auth)) -> Encounter:
        shown = permissions.visit_view(who, load(encounter_id))
        if shown.view == "view_only":  # another vet's signed note, opened
            store.audit(who.actor, "note_opened", shown.id, {"by": who.actor})
        return shown

    @app.post(
        "/api/encounters/{encounter_id}/consent",
        response_model=Encounter,
        dependencies=[Depends(auth)],
    )
    async def record_consent(
        encounter_id: str, who: Caller = Depends(auth)
    ) -> Encounter:
        """The owner agreed to recording (Start recording asks): saved with the visit
        and in the audit log, before any audio is kept."""
        enc = load(encounter_id)
        allow(who, "visit.record", enc)
        if not enc.consent_recorded:

            def agree(now: Encounter) -> None:
                now.consent_recorded = True

            store.update(enc.id, agree)
            store.audit(who.actor, "recording_consent", enc.id, {"consent": True})
        return load(enc.id)

    @app.post(
        "/api/encounters/{encounter_id}/audio",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def add_audio(
        encounter_id: str,
        file: UploadFile = File(...),
        chunk_index: int = Form(0),
        who: Caller = Depends(auth),
    ) -> Encounter:
        enc = load(encounter_id)
        allow(who, "visit.record", enc)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(
                409, "This visit is signed, so no more audio can be added."
            )
        if not enc.consent_recorded:
            raise HTTPException(
                409, "The owner hasn't agreed to recording yet, so nothing is kept."
            )
        data = await read_upload(file)
        # A reloaded page restarts its chunk count, so the name also carries a random
        # tag: nothing is overwritten.
        path = (
            store.media_dir
            / enc.id
            / f"audio_{chunk_index:04d}_{uuid.uuid4().hex[:6]}_"
            f"{Path(file.filename or 'a.wav').name}"
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        try:
            fitted = (
                sample_for(
                    await adapter.get_appointment(enc.appointment_id)
                    if len(enc.patient_ids) > 1
                    else None,
                    enc.patient_id,
                )
                if stt.plays_sample
                else ""
            )
            text = await stt.transcribe(
                data, file.filename or "audio.m4a", chunk_index, enc.transcript, fitted
            )
        except (
            Exception
        ) as exc:  # the audio is already saved; say why this chunk has no text
            detail = (
                str(exc)
                if isinstance(exc, TranscriptionError)
                else f"Transcription failed ({exc.__class__.__name__})."
            )
            store.audit(
                "device",
                "audio_chunk_failed",
                enc.id,
                {"chunk": chunk_index, "bytes": len(data), "detail": detail},
            )
            raise HTTPException(502, detail) from exc
        enc.parts_received += 1
        enc.last_part = max(enc.last_part, chunk_index)
        enc.first_part_at = enc.first_part_at or datetime.now(UTC)
        enc.last_part_at = datetime.now(UTC)  # audio is live while these keep coming
        enc.audio_seconds = audio_seconds(enc, data)
        if text:
            enc.transcript = (enc.transcript + "\n" + text).strip()
            enc = await speakers.label(enc, await speaker_appt(enc))
        store.save(enc)
        store.audit(
            "device",
            "audio_chunk",
            enc.id,
            {"chunk": chunk_index, "bytes": len(data), "chars": len(text)},
        )
        return enc

    @app.post(
        "/api/encounters/{encounter_id}/transcript",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def add_transcript(
        encounter_id: str, body: TranscriptIn, who: Caller = Depends(auth)
    ) -> Encounter:
        enc = load(encounter_id)
        allow(who, "visit.record", enc)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(
                409, "This visit is signed, so the transcript can't be changed."
            )
        enc.transcript = (
            (enc.transcript + "\n" + body.text).strip()
            if body.append
            else body.text.strip()
        )
        enc = await speakers.label(enc, await speaker_appt(enc))
        store.audit(
            who.actor,
            "transcript_edited",
            enc.id,
            {"chars": len(body.text), "append": body.append},
        )
        return store.save(enc)

    @app.post(
        "/api/encounters/{encounter_id}/photos",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def add_photo(
        encounter_id: str,
        file: UploadFile = File(...),
        hint: str = Form(""),
        who: Caller = Depends(auth),
    ) -> Encounter:
        enc = load(encounter_id)
        allow(who, "visit.record", enc)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(
                409, "This visit is signed, so no more photos can be added."
            )
        data = await read_upload(file)
        # The file's own bytes decide its type and extension, never its name.
        suffix = images.SUFFIX.get(images.kind(data))
        if not suffix:
            raise HTTPException(415, "Use a JPEG or PNG photo.")
        found = images.size(data)
        if found and found[0] * found[1] > images.MAX_PIXELS:
            raise HTTPException(
                413, "This photo is too large. Use 50 megapixels or less."
            )
        pid = uuid.uuid4().hex[:10]
        path = store.media_dir / enc.id / f"photo_{pid}{suffix}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        reading = await vision.describe(data, hint)
        segments = await vision.segment(data, hint)
        enc.photos.append(
            Photo.model_validate(
                {
                    "id": pid,
                    "path": str(path),
                    "label": hint.strip()[:80],
                    "caption": reading.caption[:300],
                    "findings": reading.findings[:1000],
                    "segments": segments,
                    "source_orientation": images.orientation(data),
                    "taken_at": datetime.now(UTC),
                }
            )
        )
        store.audit(
            "device", "photo_added", enc.id, {"photo": pid, "regions": len(segments)}
        )
        return store.save(enc)

    @app.get("/api/encounters/{encounter_id}/photos/{photo_id}")
    def photo_file(
        encounter_id: str, photo_id: str, who: Caller = Depends(auth)
    ) -> FileResponse:
        """A photo the reader may see: any on their own visit, the note's photos on
        another vet's signed visit (vets). Hidden ones answer like missing ones."""
        for p in permissions.visit_view(who, load(encounter_id)).photos:
            if p.id == photo_id:
                return FileResponse(p.path)
        raise HTTPException(404, "Photo not found")

    def editable_photo(
        encounter_id: str, photo_id: str, who: Caller
    ) -> tuple[Encounter, Photo]:
        enc = load(encounter_id)
        allow(who, "photo.edit", enc)
        photo = next((p for p in enc.photos if p.id == photo_id), None)
        if not photo:
            raise HTTPException(404, "Photo not found")
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "This visit is signed, so its photos are locked.")
        return enc, photo

    @app.patch(
        "/api/encounters/{encounter_id}/photos/{photo_id}",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    def edit_photo(
        encounter_id: str, photo_id: str, body: PhotoEdit, who: Caller = Depends(auth)
    ) -> Encounter:
        """Label, caption, outline, crop, rotation and where the photo shows. The
        original image is never changed. The vet's own words are kept as written."""
        enc, photo = editable_photo(encounter_id, photo_id, who)
        changes = body.model_dump(exclude_unset=True)
        for text in ("label", "caption", "findings"):
            if text in changes:
                changes[text] = changes[text].strip()
        i = enc.photos.index(photo)
        enc.photos[i] = Photo.model_validate(
            {**photo.model_dump(), **changes, "edited_at": datetime.now(UTC)}
        )
        store.audit(
            who.actor,
            "photo_edited",
            enc.id,
            {"photo": photo_id, "changed": sorted(changes)},
        )
        return store.save(enc)

    @app.delete(
        "/api/encounters/{encounter_id}/photos/{photo_id}",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    def delete_photo(
        encounter_id: str, photo_id: str, who: Caller = Depends(auth)
    ) -> Encounter:
        """Take a photo out of the visit: gone from the note, the summary and every
        list, but its file is kept until signing, so it can be restored. A retake is
        a new upload followed by this."""
        enc, photo = editable_photo(encounter_id, photo_id, who)
        photos.remove(store, enc, photo)
        store.audit(who.actor, "photo_deleted", enc.id, {"photo": photo_id})
        return enc

    @app.post(
        "/api/encounters/{encounter_id}/photos/{photo_id}/restore",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    def restore_photo(
        encounter_id: str, photo_id: str, who: Caller = Depends(auth)
    ) -> Encounter:
        """Undo a delete, back in its place. Refused once the visit is signed."""
        enc = load(encounter_id)
        allow(who, "photo.edit", enc)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "This visit is signed, so its photos are locked.")
        if not photos.restore(store, enc, photo_id):
            raise HTTPException(404, "No deleted photo with that id")
        store.audit(who.actor, "photo_restored", enc.id, {"photo": photo_id})
        return enc

    @app.post(
        "/api/encounters/{encounter_id}/draft",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def make_draft(encounter_id: str, who: Caller = Depends(auth)) -> Encounter:
        # Checked before the progress stream opens, so a refused colleague never puts
        # a "failed" step on the doctor's screen.
        allow(who, "visit.draft", load(encounter_id))
        # Each step goes out to draft_progress subscribers (the loading states, req 58).
        progress = events.run(
            draft_topic(encounter_id),
            encounter_id=encounter_id,
            detail="",
            patient_name="",
        )
        try:
            enc = await write_draft(encounter_id, progress)
        except Exception as exc:
            detail = (
                str(exc.detail)
                if isinstance(exc, HTTPException)
                else "Writing the note failed. Try again."
            )
            progress.emit(step="error", state="failed", detail=detail, last=True)
            raise
        progress.emit(step="done", state="done", last=True)
        return enc

    async def write_draft(encounter_id: str, progress: Run) -> Encounter:
        progress.emit(step="transcript", state="started")
        enc = load(encounter_id)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "Note is already signed")
        if not enc.transcript.strip():
            raise HTTPException(400, "No transcript yet")
        if any(f.status == FollowUpStatus.approved for f in enc.followups):
            # A new draft replaces the follow ups, which would orphan a booking or a
            # text already sent.
            raise HTTPException(
                409,
                "Follow ups are already approved, so the draft can't be "
                "redone. Edit the note instead.",
            )
        appt = await adapter.get_appointment(enc.appointment_id)
        if not appt:
            raise HTTPException(404, "Appointment not found")
        # One note per pet. The first pet's note is this encounter; each other pet gets
        # a sibling encounter
        # in the same group, which is reviewed, signed and written back on its own.
        pets = await visit_routes.visit_pets(
            adapter, appt, enc.patient_ids or [enc.patient_id]
        )
        # One recording for the room: each line marked with the pet it is about.
        place_segments(enc, [p.name for p in pets])
        if enc.group_id and enc.group_id != enc.id:
            targets = [
                (enc, p) for p in pets if p.id == enc.patient_id
            ]  # a sibling redrafts only itself
        else:
            siblings = {
                e.patient_id: e
                for e in store.list(group_id=enc.id)
                if e.group_id == enc.id and e.id != enc.id
            }
            if any(
                e.status == EncounterStatus.signed
                or any(f.status == FollowUpStatus.approved for f in e.followups)
                for e in siblings.values()
            ):
                raise HTTPException(
                    409,
                    "Another pet's note from this visit is signed or has "
                    "approved follow ups, "
                    "so the draft can't be redone. Edit the notes instead.",
                )
            targets = [(enc, pets[0])] + [
                (siblings.get(p.id) or sibling(enc, p), p) for p in pets[1:]
            ]
        lines = len(enc.transcript.strip().splitlines())
        progress.emit(step="transcript", state="done", detail=f"{lines} lines")
        progress.emit(step="photos", state="started")
        shown = sum(p.in_note for p in enc.photos)
        progress.emit(
            step="photos",
            state="done",
            detail=f"{shown} photo{'s' if shown != 1 else ''}" if shown else "",
        )
        voice = voice_for(
            appt.provider_id, exclude_encounter=enc.id
        )  # one vet, one style for every pet
        # A household appointment books each pet with its own reason.
        reasons = {p.patient.id: p.reason for p in appt.pets if p.reason}
        for target, pet in targets:
            pet_appt = appt.model_copy(
                update={"patient": pet, "reason": reasons.get(pet.id, appt.reason)}
            )
            if target is not enc:  # its lines split the same way
                place_segments(target, [p.name for p in pets])
            history = await adapter.get_visit_history(pet.id, pet.name)
            earlier = previous_notes(store, pet.id, exclude_encounter=target.id)
            progress.emit(step="soap", state="started", patient_name=pet.name)
            # The last plan's lines the provider ticked to cover today.
            asked = plan_checks.read(store, enc.appointment_id, pet.id)
            try:
                draft = await draft_note(
                    muse,
                    pet_appt,
                    history,
                    target,
                    voice,
                    earlier,
                    target.note_type,
                    [p.name for p in pets],
                    asked,
                )
            except CutOff as exc:
                # The model ran on or sent nothing, twice: say so, keep the visit
                # as it was.
                store.audit("ai", "note_draft_failed", target.id, {"why": str(exc)})
                raise HTTPException(
                    502, "Muse Spark couldn't write the note. Try again."
                ) from exc
            target.note = SoapNote(
                **draft.model_dump(exclude={"followups", "not_covered"})
            )
            target.plan_reminders = plan_checks.reminders(
                draft.not_covered, target.plan_reminders
            )
            for k in (
                "subjective",
                "objective",
                "assessment",
                "plan",
                "client_summary",
            ):
                setattr(target.note, k, plain_markers(getattr(target.note, k)))
            progress.emit(step="soap", state="done", patient_name=pet.name)
            progress.emit(step="followups", state="started", patient_name=pet.name)
            target.followups = await plan_followups(draft, pet_appt, adapter)
            progress.emit(
                step="followups",
                state="done",
                patient_name=pet.name,
                detail=f"{len(target.followups)} planned",
            )
            progress.emit(step="confirm", state="started", patient_name=pet.name)
            unsure = to_confirm(target.note)
            progress.emit(
                step="confirm",
                state="done",
                patient_name=pet.name,
                detail=f"{unsure} to confirm" if unsure else "Nothing to confirm",
            )
            target.status = EncounterStatus.draft_ready
            if (
                target is not enc
                and (now := store.get(target.id))
                and (
                    now.status == EncounterStatus.signed
                    or any(f.status == FollowUpStatus.approved for f in now.followups)
                )
            ):
                # signed or approved while the model was writing: keep it as it is
                continue
            store.audit(
                "ai",
                "note_drafted",
                target.id,
                {
                    "model": muse.model if muse.enabled else "mock",
                    "voice_notes": voice.notes_used if voice else 0,
                    "voice": voice.source if voice else "none",
                    "previous_notes": min(len(earlier), PREVIOUS_IN_PROMPT),
                    "followups": len(target.followups),
                    "note_type": target.note_type,
                    "pets": len(pets),
                    "plan_lines_asked": len(asked),
                    "plan_lines_not_covered": len(target.plan_reminders),
                },
            )
            store.save(target)
        return enc

    async def speaker_appt(enc: Encounter) -> Appointment | None:
        """The appointment, only when the visit doesn't already name the owner."""
        if enc.owner_name and enc.provider_name:
            return None
        try:
            return await appointment_for(enc)
        except Exception:  # labels without names beat a failed transcript
            return None

    async def appointment_for(enc: Encounter) -> Appointment | None:
        """The visit's appointment, with this encounter's pet on it: another pet in the
        visit books and
        texts for itself, never for the pet the appointment was made for."""
        return await jobs_module.appointment_for(adapter, enc)

    def sibling(first: Encounter, pet: Patient) -> Encounter:
        """Another pet's encounter in the same visit: same appointment, transcript and
        group, its own note."""
        enc = first.model_copy(
            deep=True,
            update={
                "id": uuid.uuid4().hex[:12],
                "patient_id": pet.id,
                "patient_name": pet.name,
                "note": None,
                "followups": [],
                "photos": [],
                "plan_reminders": [],
                "status": EncounterStatus.recording,
                "created_at": datetime.now(UTC),
            },
        )
        store.save(enc)
        store.audit(
            "system",
            "encounter_started",
            enc.id,
            {"source": enc.source, "consent": True, "group_id": first.id},
        )
        return enc

    @app.put(
        "/api/encounters/{encounter_id}/note",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    def edit_note(
        encounter_id: str, note: SoapNote, who: Caller = Depends(auth)
    ) -> Encounter:
        enc = load(encounter_id)
        allow(who, "note.edit", enc)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "Note is already signed")
        enc.note = note
        store.audit(who.actor, "note_edited", enc.id)
        return store.save(enc)

    @app.post(
        "/api/encounters/{encounter_id}/followups/{followup_id}",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def act_on_followup(
        encounter_id: str,
        followup_id: str,
        body: FollowUpAction,
        who: Caller = Depends(auth),
    ) -> Encounter:
        enc = load(encounter_id)
        allow(who, "followup.act", enc)
        f = next((x for x in enc.followups if x.id == followup_id), None)
        if not f:
            raise HTTPException(404, "Follow up not found")
        slot = None
        if body.slot_start:
            if f.kind != FollowUpKind.recheck:
                raise HTTPException(400, "Only a recheck can be booked")
            slot = next(
                (
                    s
                    for s in f.suggested_slots
                    if s.start == body.slot_start.replace(tzinfo=None)
                ),
                None,
            )
            if not slot:
                raise HTTPException(400, "That time is not one of the suggested slots")
        if body.action == "retry_text":
            if (
                f.status != FollowUpStatus.approved
                or not f.sms
                or f.sms.status != "failed"
            ):
                raise HTTPException(
                    409, "Only a failed text on an approved follow up can be retried"
                )
            if (
                f.booking_mode == "link"
                and f.booking_link
                and enc.status != EncounterStatus.signed
            ):
                raise HTTPException(
                    409,
                    "A booking link goes out with the signature. Sign the note first.",
                )
        elif body.action == "book":
            if f.status != FollowUpStatus.approved or (
                f.booking and f.booking.status == "written"
            ):
                raise HTTPException(
                    409, "Only an approved recheck that is not booked yet can be booked"
                )
            if not slot:
                raise HTTPException(400, "Pick a time to book")
        elif f.status != FollowUpStatus.draft:
            raise HTTPException(409, f"Follow up is already {f.status.value}")
        # Look the appointment up before changing anything, so a failed lookup leaves no
        # half-done state.
        appt = await appointment_for(enc) if body.action != "dismiss" else None

        # A chosen time always books it now. Otherwise a recheck goes out as a booking
        # link (the default).
        if slot:
            f.booking_mode = "book"
        elif body.booking_mode and body.action == "approve":
            f.booking_mode = body.booking_mode
        as_link = f.kind == FollowUpKind.recheck and f.booking_mode == "link"

        # Each step is saved before it is audited, and before the next slow call, so the
        # audit log only
        # records what persisted and a double click finds the follow up already
        # approved.
        if body.action in ("approve", "dismiss"):
            if body.message_draft is not None:
                f.message_draft = body.message_draft
            f.status = (
                FollowUpStatus.approved
                if body.action == "approve"
                else FollowUpStatus.dismissed
            )
            if f.status == FollowUpStatus.approved and as_link:
                f.booking_link = booking_links.make_link(
                    settings.booking_url_template,
                    adapter.location_id,
                    f,
                    days.visit_day(enc),
                )
                f.remind_unbooked = body.remind_unbooked is not False
            decided = f

            def decide(x: FollowUp) -> None:
                x.message_draft, x.status = decided.message_draft, decided.status
                x.booking_mode = decided.booking_mode
                if decided.status == FollowUpStatus.approved and as_link:
                    x.booking_link = decided.booking_link
                    x.remind_unbooked = decided.remind_unbooked

            f = save_followup(enc, f, decide)
            store.audit(
                who.actor,
                f"followup_{f.status.value}",
                enc.id,
                {
                    "followup": f.id,
                    "kind": f.kind.value,
                    "booking_mode": f.booking_mode,
                    **(
                        {"remind_unbooked": f.remind_unbooked}
                        if as_link and f.status == FollowUpStatus.approved
                        else {}
                    ),
                },
            )
        if slot and body.action in ("approve", "book"):
            if appt:
                f.booking = await adapter.book_appointment(enc, f, slot, appt)
            else:
                f.booking = WriteBackResult(
                    ok=False,
                    status="queued_for_staff",
                    detail="Could not load the appointment to book it. Queued for "
                    "staff.",
                )
            booked_slot = None
            if f.booking.status == "written":
                start = f.booking.start or slot.start
                booked_slot = (
                    slot
                    if start == slot.start
                    else slot.model_copy(
                        update={"start": start, "end": start + (slot.end - slot.start)}
                    )
                )
            booking, mode = f.booking, f.booking_mode

            def book(x: FollowUp) -> None:
                # Applied to the follow up as saved now, so a link texted while the
                # booking was being made is seen.
                x.booking, x.booked_slot, x.booking_mode = booking, booked_slot, mode
                if booked_slot and x.booking_link:
                    # Booked by the vet: a link not sent yet never goes out; one
                    # already sent shows as booked.
                    if x.booking_link.status == "queued":
                        x.booking_link = None
                    else:
                        x.booking_link.status, x.booking_link.booked_start = (
                            "booked",
                            booked_slot.start,
                        )

            f = save_followup(enc, f, book)
            store.audit(
                "system",
                "recheck_booked" if f.booked_slot else "recheck_booking_queued",
                enc.id,
                {
                    "followup": f.id,
                    "start": (f.booked_slot or slot).start.isoformat(),
                    "pims_id": booking.pims_id,
                    "detail": booking.detail,
                },
            )
        # Texts go out only after the vet approves, and only to the demo number (see
        # sms.py). A later
        # booking texts the confirmed time, so the owner does not also book from the
        # earlier link.
        # A booking link waits for the signature and goes out with it; approved after
        # signing, it goes now.
        waits_for_signing = (
            (as_link and not f.booked_slot) or jobs_module.is_summary(f)
        ) and (body.action == "approve" and enc.status != EncounterStatus.signed)
        # A link approved on a signed note goes now, unless another pet in the visit
        # has a recheck still to decide: then one text with one link goes for all.
        shareable = (
            as_link and not f.booked_slot and enc.status == EncounterStatus.signed
        )
        if shareable and body.action == "approve":
            await release_links(enc)
            return load(enc.id)
        if (
            f.status == FollowUpStatus.approved
            and not waits_for_signing
            and (body.action in ("approve", "retry_text") or f.booked_slot)
        ):
            await send_text(enc, f, appt)
        if body.action == "dismiss" and f.kind == FollowUpKind.recheck:
            await release_links(enc)  # the other pets' links may wait on this one
            return load(enc.id)
        return enc

    async def release_links(enc: Encounter) -> None:
        """Send the owner's queued booking links that no longer wait: one text with
        one link when several pets have one."""
        for e in booking_links.owner_day(store, enc):
            if e.status == EncounterStatus.signed and any(
                f.booking_link and f.booking_link.status == "queued" and not f.sms
                for f in e.followups
            ):
                await jobs.texts_after_signing(e.id)

    async def send_text(enc: Encounter, f: FollowUp, appt: Appointment | None) -> None:
        await jobs_module.send_text(jobs.services, enc, f, appt)

    def save_followup(
        enc: Encounter, f: FollowUp, change: Callable[[FollowUp], None]
    ) -> FollowUp:
        """Apply `change` to this follow up on the encounter as saved right now (a
        text the worker sent meanwhile is kept), refresh `enc` from it, and return
        the saved follow up."""

        def patch(now: Encounter) -> None:
            for x in now.followups:
                if x.id == f.id:
                    change(x)

        saved = store.update(enc.id, patch)
        if saved:
            enc.followups = saved.followups
        return next(x for x in enc.followups if x.id == f.id)

    @app.post(
        "/api/encounters/{encounter_id}/sign",
        dependencies=[Depends(auth), Depends(one_at_a_time)],
        response_model=None,
    )
    async def sign(
        encounter_id: str, body: SignIn, who: Caller = Depends(auth)
    ) -> dict[str, Any]:
        enc = load(encounter_id)
        # Nobody signs for another doctor: a signed-in person signs as themselves,
        # and only on their own visit. A typed name is for the API token and demo.
        allow(who, "note.sign", enc)
        if not enc.note:
            raise HTTPException(400, "Nothing to sign yet")
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "Note is already signed")
        # The safety net under the stepping Sign button: a note still marked
        # "[confirm: ...]" is never signed, whatever the client sent.
        if left := to_confirm(enc.note):
            raise HTTPException(
                409,
                f"{left} thing{'s' if left > 1 else ''} in the note still "
                f"need{'' if left > 1 else 's'} confirming. Confirm or fill "
                f"{'them' if left > 1 else 'it'} in, then sign.",
            )
        if who.user:
            # The signed-in vet signs as themselves: their name, login and PIMS
            # provider, never a typed name.
            enc.signed_by, enc.signed_by_user, enc.signed_by_provider_id = (
                who.user.name,
                who.user.username,
                who.user.provider_id,
            )
        elif body.signed_by.strip():
            enc.signed_by = body.signed_by.strip()
        else:
            raise HTTPException(400, "Add the name of the provider signing")
        enc.status = EncounterStatus.signed
        enc.signed_at = datetime.now(UTC)
        # Blinq doesn't send prescriptions: the front desk gets a task to enter them.
        enc.prescription_task = pims_sync.prescription_task(enc)
        store.save(
            enc
        )  # lock before writing out, so a slow PIMS never leaves an editable note
        # Deleted photos were kept until now, so they could be restored.
        if purged := photos.purge(store, enc.id):
            store.audit(who.actor, "deleted_photos_purged", enc.id, {"photos": purged})
        if body.send:  # Sign and send (the default)
            result = await pims_sync.send(store, adapter, enc.id, datetime.now(UTC))
        else:  # Sign only: locked, kept out of the PIMS until the vet sends it
            saved = store.update(
                enc.id, lambda e: pims_sync.not_sent(e, datetime.now(UTC))
            )
            assert saved and saved.write_back
            result = saved.write_back
        store.audit(
            who.actor,
            "note_signed",
            enc.id,
            {
                "by": enc.signed_by,
                "provider_id": enc.signed_by_provider_id,
                "send": body.send,
                "write_back": result.status,
                "pims_id": result.pims_id,
                "detail": result.detail,
            },
        )
        # Booking links approved before signing go out now, with the signature (on
        # Temporal, just after: the reply then shows them still queued).
        await jobs.texts_after_signing(enc.id)
        return {"encounter": load(enc.id), "write_back": result}

    @app.post(
        "/api/encounters/{encounter_id}/prescription/entered",
        response_model=Encounter,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    def prescription_entered(
        encounter_id: str, who: Caller = Depends(auth)
    ) -> Encounter:
        """The front desk entered the prescription in the PIMS: who marked it, and
        when, on the task and in the audit log. Marking it twice keeps the first."""
        enc = load(encounter_id)
        allow(who, "prescription.enter", enc)
        if not enc.prescription_task:
            raise HTTPException(404, "This visit has no prescription to enter.")
        if not enc.prescription_task.done_at:
            by = who.user.name if who.user else "the front desk"

            def done(now: Encounter) -> None:
                task = now.prescription_task
                if task and not task.done_at:
                    task.done_by, task.done_at = by, datetime.now(UTC)
                    task.done_by_user = who.user.username if who.user else ""

            saved = store.update(enc.id, done)
            assert saved and saved.prescription_task
            task = saved.prescription_task
            store.audit(
                who.actor,
                "prescription_entered",
                enc.id,
                {
                    "by": task.done_by,
                    "at": task.done_at.isoformat() if task.done_at else "",
                    "medications": task.medications,
                },
            )
        return permissions.visit_view(who, load(enc.id))

    @app.post(
        "/api/encounters/{encounter_id}/write-back",
        response_model=WriteBackResult,
        dependencies=[Depends(auth), Depends(one_at_a_time)],
    )
    async def write_back(
        encounter_id: str, who: Caller = Depends(auth)
    ) -> WriteBackResult:
        """Send to the PIMS: a note signed only, or one whose save failed or is
        waiting for the front desk. Only the vet who signed it (or the open demo). A
        note already written comes back as it is, without writing it twice."""
        enc = load(encounter_id)
        # Who first (403, each refusal audited), then the note's state (409).
        allow(who, "note.sign", enc)
        if who.user and enc.signed_by_user and who.user.username != enc.signed_by_user:
            reason = f"Only {enc.signed_by} can send this note to the PIMS."
            store.audit(
                who.actor,
                "refused",
                enc.id,
                {"action": "note.sign", "reason": reason},
            )
            raise HTTPException(403, reason)
        if enc.status != EncounterStatus.signed:
            raise HTTPException(409, "Sign the note first.")
        if enc.write_back and enc.write_back.status == "written":
            return enc.write_back
        result = await pims_sync.send(store, adapter, enc.id, datetime.now(UTC))
        store.audit(
            who.actor,
            "note_sent_to_pims",
            enc.id,
            {
                "write_back": result.status,
                "pims_id": result.pims_id,
                "detail": result.detail,
            },
        )
        return result

    @app.get(
        "/api/encounters/{encounter_id}/sign-preview",
        dependencies=[Depends(auth)],
        response_model=None,
    )
    async def sign_preview(
        encounter_id: str, who: Caller = Depends(auth)
    ) -> dict[str, Any]:
        """The confirm panel before signing: where the note goes (pet and owner
        with their PIMS ids, checked against the visit's appointment), what goes,
        and the texts that follow."""
        enc = load(encounter_id)
        allow(who, "note.sign", enc)
        appt = await adapter.get_appointment(enc.appointment_id)
        mismatch = ""
        if not appt:
            mismatch = "This visit's appointment wasn't found in the PIMS."
        elif appt.patient.id != enc.patient_id:
            mismatch = (
                f"The appointment is for {appt.patient.name}, not "
                f"{enc.patient_name}. Check the record before you sign."
                if appt.client.id != enc.client_id
                else f"The appointment is for {appt.patient.name}. "
                f"{enc.patient_name}'s note goes to {enc.patient_name}'s own record."
            )
        texts = [
            {
                "followup_id": f.id,
                "kind": f.kind.value,
                "reason": f.reason,
                "message": texter.compose(f),
            }
            for f in enc.followups
            if f.status == FollowUpStatus.approved
            and f.kind.value in ("recheck", "client_update")
            and not f.sms
            and f.message_draft.strip()
        ]
        return {
            "pims_name": await pims_sync.pims_name(adapter, settings.pims_name),
            "patient": {"name": enc.patient_name, "pims_id": enc.patient_id},
            "owner": {"name": enc.owner_name, "pims_id": enc.client_id},
            "appointment": {
                "id": appt.id,
                "start": appt.start,
                "patient_name": appt.patient.name,
                "owner_name": appt.client.full_name,
            }
            if appt
            else None,
            "matches": not mismatch,
            "mismatch": mismatch,
            "note": bool(enc.note),
            "photos": len(in_note(enc)),
            "prescription": list(enc.note.medications) if enc.note else [],
            "texts": texts,
        }

    @app.get(
        "/api/encounters/{encounter_id}/audit",
        dependencies=[Depends(auth)],
        response_model=None,
    )
    def audit(encounter_id: str) -> list[dict[str, Any]]:
        load(encounter_id)
        return store.audit_log(encounter_id)

    # The patient record and the visit tools live in their own modules; they share these
    # pieces.
    ctx = SimpleNamespace(
        settings=settings,
        adapter=adapter,
        store=store,
        muse=muse,
        texter=texter,
        auth=auth,
        one_at_a_time=one_at_a_time,
        load=load,
        read_upload=read_upload,
        send_text=send_text,
        jobs=jobs,
        speech=speech,
        stt=stt,
        accounts=accounts,
        signin=signin,
        appointment_for=appointment_for,
        admin=admin,
        allow=allow,
        events=events,
    )
    app.state.signin = signin
    app.state.speech = speech
    # The REST sign in handlers that GraphQL (gql/auth.py) answers through.
    ctx.auth_ops = SimpleNamespace(
        auth_status=auth_status, invite_info=invite_info, accept_invite=accept_invite
    )
    auth_routes.register(app, ctx)
    ctx.letters = app.state.letters = letters  # referral letters (requirement 61)
    letters_routes.register(app, ctx)
    ctx.speakers = app.state.speakers = speakers
    speaker_routes.register(app, ctx)
    speech_routes.register(app, ctx)
    # GraphQL resolves through these same route handlers, so the APIs can't drift.
    ctx.ops = SimpleNamespace(
        health=health,
        sample=sample,
        schedule=schedule,
        brief=brief,
        unsigned_notes=unsigned_notes,
        end_of_day=end_of_day,
        pre_room_card=pre_room_card,
        voice_profile=voice_profile,
        patient_notes=patient_notes,
        onboard=onboard,
        providers=providers,
        doctors=doctors,
        users=users,
        add_user=add_user,
        reinvite=reinvite,
        update_user=update_user,
        ask=ask,
        start=start,
        add_pet=add_pet,
        list_encounters=list_encounters,
        get_encounter=get_encounter,
        add_transcript=add_transcript,
        add_photo=add_photo,
        edit_photo=edit_photo,
        delete_photo=delete_photo,
        restore_photo=restore_photo,
        make_draft=make_draft,
        edit_note=edit_note,
        act_on_followup=act_on_followup,
        sign=sign,
        write_back=write_back,
        prescription_entered=prescription_entered,
        sign_preview=sign_preview,
        audit=audit,
        **record_routes.register(app, ctx),
        **visit_routes.register(app, ctx),
    )
    from .gql import mount  # GraphQL imports the request models above

    mount(app, ctx)
    if (WEB_DIST / "index.html").is_file():
        serve_web_app(app)  # last, so it never hides /api, /graphql or /s/
    return app


def serve_web_app(app: FastAPI) -> None:
    """The built React app (`pnpm build` in web/): its files, and index.html for
    every other page path so the app's own routes work on reload."""
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")
    root = WEB_DIST.resolve()

    # Every method, so an unknown path is a 404 whatever the method, not a 405.
    @app.api_route(
        "/{path:path}",
        methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
        include_in_schema=False,
        response_model=None,
    )
    def web_app(path: str, request: Request) -> FileResponse:
        if (
            request.method not in ("GET", "HEAD")
            or path.split("/", 1)[0] in SERVER_PATHS
        ):
            raise HTTPException(404, "Not found")
        file = (root / path).resolve()
        if path and file.is_file() and file.is_relative_to(root):
            return FileResponse(file)
        return FileResponse(root / "index.html", headers=PAGE_HEADERS)


# The app's page loads only its own files and Google Fonts, and can't be framed.
# Inline styles stay allowed: React sets style attributes (meters, outlines).
PAGE_HEADERS = {
    "Content-Security-Policy": "; ".join(
        (
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        )
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
}
