"""Background work: texts after signing, booking link checks, the note sync and
Remember expiry.

With TEMPORAL_ADDRESS set, each job is a Temporal workflow that the worker runs
(`python -m blinqscribe.worker`), and the nightly and hourly ones are Temporal
schedules. Unset, the same activities run here in the server, as they always
have, so demo mode needs no Temporal.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from temporalio import activity
from temporalio.client import Client

from . import booking_links, photos, pims_sync, remember, share
from .adapters import PracticeAdapter, build_adapter
from .config import Settings
from .notes import as_utc
from .onboard import sync_notes
from .schemas import (
    Appointment,
    BookingLink,
    Encounter,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
    SmsResult,
)
from .sms import Texter
from .store import Store
from .workflows import TASK_QUEUE, NoteSync, TextsAfterSigning

log = logging.getLogger("blinqscribe.jobs")
# A link still queued this long after the signature never got its text started.
STRANDED_MINUTES = 10
CONNECT_SECONDS = 5
DOWN_SECONDS = 60


@dataclass
class Services:
    store: Store
    adapter: PracticeAdapter
    texter: Texter

    @classmethod
    def from_settings(cls, settings: Settings) -> Services:
        return cls(
            Store(settings.data_dir, settings.database_url),
            build_adapter(settings),
            Texter(settings),
        )


async def appointment_for(
    adapter: PracticeAdapter, enc: Encounter
) -> Appointment | None:
    """The visit's appointment, with this encounter's pet on it: another pet in the
    visit books and texts for itself, never for the pet the appointment was made for."""
    from .visit_routes import visit_pets

    appt = await adapter.get_appointment(enc.appointment_id)
    if appt and enc.patient_id and appt.patient.id != enc.patient_id:
        pet = (await visit_pets(adapter, appt, [enc.patient_id]))[0]
        appt = appt.model_copy(update={"patient": pet})
    return appt


async def send_text(
    services: Services, enc: Encounter, f: FollowUp, appt: Appointment | None
) -> SmsResult | None:
    """Text the owner, then save only this follow up's text and link state on the
    encounter as it is now: a booking or another text saved while the text was on
    its way is kept. `f` gets the saved values too. A link shared by several pets
    goes again as its one text, for every pet."""
    link = f.booking_link
    if link and len(link.followup_ids) > 1 and f.booking_mode == "link":
        pairs = _sharing(services.store, enc, link.followup_ids)
        if pairs:
            return await send_shared(services, pairs, link, appt)
    if is_summary(f) and enc.status == EncounterStatus.signed:
        await asyncio.to_thread(_with_summary_link, services, enc, f, appt)
    result = await services.texter.send_followup(f, appt)
    if not result:
        return None

    def record(now: Encounter) -> None:
        for x in now.followups:
            if x.id == f.id:
                x.sms = result
                if x.booking_link and x.booking_mode == "link" and not x.booked_slot:
                    booking_links.mark_sent(x.booking_link, result)
                if x.booking_link:
                    x.booking_link.claimed_at = None
                f.sms, f.booking_link = x.sms, x.booking_link

    store = services.store
    await asyncio.to_thread(store.update, enc.id, record)
    await asyncio.to_thread(
        store.audit,
        "system",
        f"text_{result.status}",
        enc.id,
        {
            "followup": f.id,
            "to": result.to_masked,
            "detail": result.detail,
            **({"booking_link": f.booking_link.status} if f.booking_link else {}),
        },
    )
    return result


def _sharing(
    store: Store, enc: Encounter, ids: list[str]
) -> list[tuple[Encounter, FollowUp]]:
    """The follow ups that share one link, as (encounter, follow up), in its order."""
    found = {
        f.id: (e, f)
        for e in booking_links.owner_day(store, enc)
        for f in e.followups
        if f.id in ids
    }
    return [found[i] for i in ids if i in found]


async def send_shared(
    services: Services,
    pairs: list[tuple[Encounter, FollowUp]],
    link: BookingLink,
    appt: Appointment | None,
) -> SmsResult:
    """One owner text for several pets' rechecks, with the one link that books them
    all. Saved on every follow up it covers, each on its encounter as it is now."""
    store = services.store
    try:
        result = await services.texter.send_text(
            booking_links.shared_text(pairs[0][0], link), appt
        )
    except Exception as exc:
        result = SmsResult(status="failed", detail=exc.__class__.__name__)
    for e, f in pairs:

        def record(now: Encounter, fid: str = f.id) -> None:
            for x in now.followups:
                if x.id == fid:
                    x.sms = result
                    x.booking_link = link.model_copy(
                        update={
                            "status": x.booking_link.status
                            if x.booking_link
                            else "queued",
                            "sent_at": x.booking_link.sent_at
                            if x.booking_link
                            else None,
                            "claimed_at": None,
                        }
                    )
                    if not x.booked_slot:
                        booking_links.mark_sent(x.booking_link, result)

        saved = await asyncio.to_thread(store.update, e.id, record)
        mine = next(
            (x for x in (saved.followups if saved else []) if x.id == f.id), None
        )
        if mine:
            f.sms, f.booking_link = mine.sms, mine.booking_link
        await asyncio.to_thread(
            store.audit,
            "system",
            f"text_{result.status}",
            e.id,
            {
                "followup": f.id,
                "to": result.to_masked,
                "detail": result.detail,
                "booking_link": f.booking_link.status if f.booking_link else "",
                "shared_with": len(pairs),
            },
        )
    return result


def is_summary(f: FollowUp) -> bool:
    """A follow up that sends the owner the visit summary ("Send Rocket's visit summary
    to the owner"): its text carries the summary's link, so it goes once the note is
    signed, the summary being the signed note's."""
    return f.kind == FollowUpKind.client_update and "summary" in (
        f"{f.reason} {f.message_draft}".lower()
    )


def _with_summary_link(
    services: Services, enc: Encounter, f: FollowUp, appt: Appointment | None
) -> None:
    """Put the owner's summary link in the follow up's text, once: the same protected
    link Text summary sends (the owner types their last name to open it). Without the
    owner's last name the link can't be protected, so the text goes as written."""
    last = appt.client.last_name.strip() if appt else ""
    if not last or "/s/" in f.message_draft:
        return
    token, _ = share.create_link(services.store, enc.id, "en", last)
    url = f"{services.texter.public_url}/s/{token}"
    text = f"{f.message_draft.rstrip()} Read it here: {url}"

    def save(now: Encounter) -> None:
        for x in now.followups:
            if x.id == f.id:
                x.message_draft = text

    services.store.update(enc.id, save)
    f.message_draft = text


def _claim(store: Store, encounter_id: str, followup_id: str) -> bool:
    """Take a queued link for sending, if it is still queued, untried and not taken:
    in one transaction, so two senders can never both send it."""
    claimed = False

    def claim(now: Encounter) -> None:
        nonlocal claimed
        for x in _queued_links(now):
            if x.id == followup_id and x.booking_link:
                x.booking_link.claimed_at = datetime.now(UTC)
                claimed = True

    store.update(encounter_id, claim)
    return claimed


def _release(store: Store, encounter_id: str, followup_id: str) -> None:
    """Give a claimed link back when nothing went out, so it can be tried again."""

    def release(now: Encounter) -> None:
        for x in now.followups:
            if x.id == followup_id and x.booking_link:
                x.booking_link.claimed_at = None

    store.update(encounter_id, release)


def _queued_links(enc: Encounter) -> list[FollowUp]:
    """Approved booking links waiting for the signature, never tried and not taken
    by a sender (or taken by one that stopped before it finished)."""
    gave_up = datetime.now(UTC) - timedelta(minutes=STRANDED_MINUTES)
    return [
        f
        for f in enc.followups
        if f.status == FollowUpStatus.approved
        and f.booking_mode == "link"
        and f.booking_link
        and f.booking_link.status == "queued"
        and not f.sms
        and (
            f.booking_link.claimed_at is None
            or as_utc(f.booking_link.claimed_at) < gave_up
        )
    ]


def _expire_links(store: Store) -> int:
    """Mark sent links past their time as expired; each encounter changes in one
    transaction, so a booking or text saved meanwhile is kept."""
    expired = 0
    for enc in store.list():
        due = [
            f.id
            for f in enc.followups
            if f.booking_link
            and f.booking_link.status in ("sent", "opened")
            and booking_links.status_now(f.booking_link) == "expired"
        ]
        if not due:
            continue
        changed: list[str] = []

        def expire(
            now: Encounter, due: list[str] = due, changed: list[str] = changed
        ) -> None:
            for f in now.followups:
                link = f.booking_link
                if (
                    f.id in due
                    and link
                    and link.status in ("sent", "opened")
                    and booking_links.status_now(link) == "expired"
                ):
                    link.status = "expired"
                    changed.append(f.id)

        store.update(enc.id, expire)
        for fid in changed:
            store.audit("system", "booking_link_expired", enc.id, {"followup": fid})
        expired += len(changed)
    return expired


def _claim_reminder(store: Store, encounter_id: str, followup_id: str) -> bool:
    """Take a due reminder for sending, in one transaction, so it goes once."""
    claimed = False

    def claim(now: Encounter) -> None:
        nonlocal claimed
        for x in now.followups:
            if x.id == followup_id and booking_links.reminder_due(x, datetime.now(UTC)):
                x.reminder = SmsResult(status="sending", at=datetime.now(UTC))
                claimed = True

    store.update(encounter_id, claim)
    return claimed


class Activities:
    """The work itself: the worker registers these, and without Temporal, Jobs calls
    them."""

    def __init__(self, services: Services):
        self.services = services

    @activity.defn(name="send_signing_texts")
    async def _send_summaries(self, enc: Encounter) -> int:
        """Visit summary follow ups approved before signing go now, with the summary's
        link. Each once: one that has been texted already is never texted again."""
        waiting = [
            f
            for f in enc.followups
            if is_summary(f) and f.status == FollowUpStatus.approved and not f.sms
        ]
        if not waiting:
            return 0
        try:
            appt = await appointment_for(self.services.adapter, enc)
        except Exception:  # a lookup failure sends the text without the link
            appt = None
        sent = 0
        for f in waiting:
            if await send_text(self.services, enc, f, appt):
                sent += 1
        return sent

    async def send_signing_texts(self, encounter_id: str, force: bool = False) -> int:
        """Booking links approved before signing go out now, with the signature.
        Several pets of one owner seen that day with a recheck each get one text
        with one link: a household's links wait while another pet's recheck is
        undecided or its note unsigned (`force`, the backstop, doesn't wait)."""
        store = self.services.store
        enc = await asyncio.to_thread(store.get, encounter_id)
        if not enc or enc.status != EncounterStatus.signed:
            return 0
        await self._send_summaries(enc)
        family = await asyncio.to_thread(booking_links.owner_day, store, enc)
        together = [
            (e, f)
            for e in family
            if e.status == EncounterStatus.signed
            for f in _queued_links(e)
        ]
        if not any(e.id == enc.id for e, _ in together):
            return 0
        if not force and await asyncio.to_thread(booking_links.held, store, enc):
            return 0
        try:
            appt = await appointment_for(self.services.adapter, enc)
        # the texter never reads the owner's number; a lookup failure must not block
        # texts
        except Exception:
            appt = None
        if len(together) > 1:
            return await self._send_together(together, appt)
        queued = _queued_links(enc)
        sent = 0
        for f in queued:
            # Taken by another sender (the hourly check, a retry)? Then not again.
            if not await asyncio.to_thread(_claim, store, enc.id, f.id):
                continue
            result = None
            try:
                result = await send_text(self.services, enc, f, appt)
            finally:
                if not result:  # nothing went out: give it back to be tried again
                    await asyncio.to_thread(_release, store, enc.id, f.id)
            if result:
                sent += 1
        return sent

    async def _send_together(
        self, together: list[tuple[Encounter, FollowUp]], appt: Appointment | None
    ) -> int:
        """One text, one link, for every pet's queued recheck: each claimed first, so
        no other sender sends one of them too."""
        store = self.services.store
        claimed = [
            (e, f)
            for e, f in together
            if await asyncio.to_thread(_claim, store, e.id, f.id)
        ]
        if not claimed:
            return 0
        if len(claimed) == 1:
            e, f = claimed[0]
            result = await send_text(self.services, e, f, appt)
            if not result:
                await asyncio.to_thread(_release, store, e.id, f.id)
            return 1 if result else 0
        link = booking_links.shared(
            [
                (e.patient_name, f.id, f.booking_link)
                for e, f in claimed
                if f.booking_link
            ]
        )
        await send_shared(self.services, claimed, link, appt)
        return len(claimed)

    @activity.defn(name="sync_notes")
    async def sync_notes(self, days: int) -> dict[str, Any]:
        """Sync the practice's last N days of notes. Run at onboarding, then nightly."""
        store = self.services.store
        report = await sync_notes(self.services.adapter, store, days)
        store.audit("system", "notes_synced", None, report)
        return report

    @activity.defn(name="check_booking_links")
    async def check_booking_links(self) -> int:
        """Save 'expired' on links past their 14 days (reads already show it),
        send links still queued on a note signed over 10 minutes ago (texts that
        never started, so none is stranded), and send the one reminder for links
        still not booked 3 days after they went out. Returns how many links
        changed."""
        store = self.services.store
        expired = await asyncio.to_thread(_expire_links, store)
        stranded = datetime.now(UTC) - timedelta(minutes=STRANDED_MINUTES)
        sent = 0
        for enc in await asyncio.to_thread(store.list):
            if (
                enc.status == EncounterStatus.signed
                and enc.signed_at
                and as_utc(enc.signed_at) < stranded
                and _queued_links(enc)
            ):
                sent += await self.send_signing_texts(enc.id, force=True)
        return expired + sent + await self.send_reminders()

    async def send_reminders(self) -> int:
        """One reminder text (the same link) for each booking link the owner hasn't
        booked 3 days after it was sent, when the vet left the reminder on. In
        preview and demo modes the text is shown, not sent, like every other."""
        store, sent = self.services.store, 0
        for enc in await asyncio.to_thread(store.list):
            if enc.status != EncounterStatus.signed:
                continue
            for f in enc.followups:
                if not booking_links.reminder_due(f, datetime.now(UTC)):
                    continue
                if not await asyncio.to_thread(_claim_reminder, store, enc.id, f.id):
                    continue  # another check took it
                try:
                    appt = await appointment_for(self.services.adapter, enc)
                except Exception:  # the texter never reads the owner's number
                    appt = None
                try:
                    result = await self.services.texter.send_text(
                        booking_links.reminder_text(enc, f), appt
                    )
                except Exception as exc:
                    result = SmsResult(status="failed", detail=exc.__class__.__name__)

                def record(
                    now: Encounter, fid: str = f.id, r: SmsResult = result
                ) -> None:
                    for x in now.followups:
                        if x.id == fid:
                            x.reminder = r.model_copy(
                                update={"at": r.at or datetime.now(UTC)}
                            )

                await asyncio.to_thread(store.update, enc.id, record)
                # One link for several pets: its one reminder shows on each of them.
                ids = f.booking_link.followup_ids if f.booking_link else []
                for other, x in _sharing(store, enc, ids[1:]):
                    await asyncio.to_thread(
                        store.update,
                        other.id,
                        functools.partial(record, fid=x.id),
                    )
                await asyncio.to_thread(
                    store.audit,
                    "system",
                    "booking_link_reminder",
                    enc.id,
                    {
                        "followup": f.id,
                        "status": result.status,
                        "to": result.to_masked,
                        "detail": result.detail,
                    },
                )
                sent += 1
        return sent

    @activity.defn(name="expire_remember")
    async def expire_remember(self) -> int:
        """The daily cleanup: kept Remember items after their 12 months, and the
        files of photos deleted from a visit nobody signed after 30 days."""
        store = self.services.store
        items = await asyncio.to_thread(remember.purge_expired, store)
        return items + await asyncio.to_thread(photos.purge_stale, store)

    @activity.defn(name="retry_pims_writes")
    async def retry_pims_writes(self) -> int:
        """Try again the failed saves to the practice system whose 5 minutes are up;
        after an hour they go to the front desk. Returns how many were tried."""
        return len(await self.retry_pims_writes_at(datetime.now(UTC)))

    async def retry_pims_writes_at(self, now: datetime) -> list[str]:
        s = self.services
        tried = await pims_sync.retry_due(s.store, s.adapter, now)
        for encounter_id, result in tried:
            await asyncio.to_thread(
                s.store.audit,
                "system",
                "note_sent_to_pims",
                encounter_id,
                {"write_back": result.status, "retry": True, "detail": result.detail},
            )
        return [encounter_id for encounter_id, _ in tried]

    def all(self) -> list[Any]:
        return [
            self.send_signing_texts,
            self.sync_notes,
            self.check_booking_links,
            self.expire_remember,
            self.retry_pims_writes,
        ]


class Jobs:
    """Starts background work on Temporal when TEMPORAL_ADDRESS is set, else runs it
    here, in the server process."""

    def __init__(self, settings: Settings, services: Services):
        self.address = settings.temporal_address
        self.services = services
        self.activities = Activities(services)
        self._client: Client | None = None
        self._down_until = 0.0  # time.monotonic() until which Temporal is skipped
        self._ticker: asyncio.Task[None] | None = None  # in-process retries

    async def _temporal(self) -> Client | None:
        if not self.address:
            return None
        if self._client is None:
            # Bounded: a signature never waits long on a Temporal that isn't there.
            self._client = await asyncio.wait_for(
                Client.connect(self.address), CONNECT_SECONDS
            )
        return self._client

    async def _start(self, run: Any, arg: object, workflow_id: str) -> str:
        """Start a workflow without waiting for it. Returns "" when Temporal took
        it, else why not. After a failure Temporal is skipped for a minute, so
        each signature doesn't wait on it while it is down."""
        if time.monotonic() < self._down_until:
            return "Temporal was unreachable moments ago"
        try:
            client = await self._temporal()
            assert client is not None
            await client.start_workflow(
                run,
                arg,
                id=workflow_id,
                task_queue=TASK_QUEUE,
                rpc_timeout=timedelta(seconds=CONNECT_SECONDS),
            )
        except Exception as exc:
            self._down_until = time.monotonic() + DOWN_SECONDS
            log.warning("Temporal didn't take %s: %r", workflow_id, exc)
            return f"Temporal: {exc.__class__.__name__}"
        return ""

    async def on_startup(self) -> None:
        """Without Temporal, the server does at startup what the worker's schedules
        do otherwise: Remember expiry and the booking link check, and from then on
        the 5 minute retry of saves the practice system couldn't take and the
        hourly booking link check."""
        if not self.address:
            await self.activities.expire_remember()
            await self.activities.check_booking_links()
            self._ticker = asyncio.create_task(self._every_five_minutes())

    async def on_shutdown(self) -> None:
        if self._ticker:
            self._ticker.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._ticker
            self._ticker = None

    async def _every_five_minutes(self) -> None:
        rounds = 0
        while True:
            await asyncio.sleep(pims_sync.RETRY_EVERY.total_seconds())
            rounds += 1
            try:
                await self.activities.retry_pims_writes()
            except Exception:  # the next round tries again
                log.exception("Retrying saves to the PIMS failed")
            if rounds % 12 == 0:  # hourly, as the worker's schedule does
                try:
                    await self.activities.check_booking_links()
                except Exception:
                    log.exception("The booking link check failed")

    async def texts_after_signing(self, encounter_id: str) -> None:
        """Never fails the signature: when Temporal can't take the work, the texts
        go from here instead, and the hourly check is the backstop for both."""
        if self.address:
            reason = await self._start(
                TextsAfterSigning.run,
                encounter_id,
                f"texts-after-signing-{encounter_id}",
            )
            if not reason:
                return
            await asyncio.to_thread(
                self.services.store.audit,
                "system",
                "texts_not_started",
                encounter_id,
                {"reason": reason},
            )
        await self.activities.send_signing_texts(encounter_id)

    async def start_note_sync(self, days: int) -> None:
        """The demo clinic's first sync at startup: started on Temporal without
        waiting for it, or run here when Temporal isn't there (or can't be reached),
        so startup never hangs or fails on it."""
        if self.address and not await self._start(
            NoteSync.run, days, f"note-sync-{uuid.uuid4().hex[:8]}"
        ):
            return
        await self.activities.sync_notes(days)

    async def sync_notes(self, days: int) -> dict[str, Any]:
        if client := await self._temporal():
            report: dict[str, Any] = await client.execute_workflow(
                NoteSync.run,
                days,
                id=f"note-sync-{uuid.uuid4().hex[:8]}",
                task_queue=TASK_QUEUE,
            )
            return report
        return await self.activities.sync_notes(days)
