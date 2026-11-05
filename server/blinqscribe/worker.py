"""The Temporal worker: `python -m blinqscribe.worker` (from the server/ folder).

Runs the background work in jobs.py for a server started with the same
TEMPORAL_ADDRESS and DATABASE_URL, and keeps its schedules: the nightly note sync,
the hourly booking link check and the daily Remember expiry.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import timedelta
from typing import Any

from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleIntervalSpec,
    ScheduleSpec,
)
from temporalio.worker import Worker

from .config import get_settings, load_dotenv
from .jobs import Activities, Services
from .notes import HISTORY_DAYS, use_clinic_timezone
from .workflows import (
    TASK_QUEUE,
    WORKFLOWS,
    BookingLinkCheck,
    NoteSync,
    PimsRetry,
    RememberExpiry,
)

log = logging.getLogger("blinqscribe.worker")


def _start(schedule_id: str, run: Any, *args: Any) -> ScheduleActionStartWorkflow:
    return ScheduleActionStartWorkflow(
        run, args=list(args), id=schedule_id, task_queue=TASK_QUEUE
    )


SCHEDULES = {
    "nightly-note-sync": Schedule(
        action=_start("nightly-note-sync", NoteSync.run, HISTORY_DAYS),
        spec=ScheduleSpec(cron_expressions=["0 3 * * *"]),
    ),
    "pims-retry": Schedule(
        action=_start("pims-retry", PimsRetry.run),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=5))]),
    ),
    "booking-link-check": Schedule(
        action=_start("booking-link-check", BookingLinkCheck.run),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(hours=1))]),
    ),
    "remember-expiry": Schedule(
        action=_start("remember-expiry", RememberExpiry.run),
        spec=ScheduleSpec(cron_expressions=["30 3 * * *"]),
    ),
}


async def ensure_schedules(client: Client) -> None:
    for schedule_id, schedule in SCHEDULES.items():
        with contextlib.suppress(ScheduleAlreadyRunningError):  # kept from before
            await client.create_schedule(schedule_id, schedule)


async def main() -> None:
    load_dotenv()
    settings = get_settings()
    use_clinic_timezone(settings.clinic_tz)
    if not settings.temporal_address:
        raise SystemExit("Set TEMPORAL_ADDRESS to run the worker.")
    client = await Client.connect(settings.temporal_address)
    await ensure_schedules(client)
    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=WORKFLOWS,
        activities=Activities(Services.from_settings(settings)).all(),
    )
    log.info("Worker on %s, task queue %s", settings.temporal_address, TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("alembic.runtime.plugins").setLevel(logging.WARNING)
    asyncio.run(main())
