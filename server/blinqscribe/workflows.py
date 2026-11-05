"""Temporal workflows for the background work in jobs.py.

Each workflow runs one activity, by name, so this module imports nothing from the
server and loads cleanly in Temporal's workflow sandbox.
"""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

TASK_QUEUE = "blinq-scribe"
_RETRY = RetryPolicy(maximum_attempts=3)


@workflow.defn
class TextsAfterSigning:
    """Booking links approved before signing go out once the note is signed."""

    @workflow.run
    async def run(self, encounter_id: str) -> int:
        sent: int = await workflow.execute_activity(
            "send_signing_texts",
            encounter_id,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=_RETRY,
        )
        return sent


@workflow.defn
class NoteSync:
    """The onboarding sync of the last N days of notes, and the nightly one."""

    @workflow.run
    async def run(self, days: int) -> dict[str, object]:
        report: dict[str, object] = await workflow.execute_activity(
            "sync_notes",
            days,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=_RETRY,
        )
        return report


@workflow.defn
class BookingLinkCheck:
    """Mark booking links whose 14 days are up as expired."""

    @workflow.run
    async def run(self) -> int:
        expired: int = await workflow.execute_activity(
            "check_booking_links",
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=_RETRY,
        )
        return expired


@workflow.defn
class RememberExpiry:
    """The daily cleanup: Remember items after 12 months, and deleted photos of
    visits nobody signed after 30 days."""

    @workflow.run
    async def run(self) -> int:
        purged: int = await workflow.execute_activity(
            "expire_remember",
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=_RETRY,
        )
        return purged


@workflow.defn
class PimsRetry:
    """Every 5 minutes: try again the notes the practice system couldn't take, and
    hand those failing for an hour to the front desk."""

    @workflow.run
    async def run(self) -> int:
        tried: int = await workflow.execute_activity(
            "retry_pims_writes",
            start_to_close_timeout=timedelta(minutes=4),
            retry_policy=_RETRY,
        )
        return tried


WORKFLOWS = [TextsAfterSigning, NoteSync, BookingLinkCheck, RememberExpiry, PimsRetry]
