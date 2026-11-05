"""Onboard a practice: sync 24 months of medical notes, ready the voice profiles.

Run once when a practice is onboarded, then nightly to stay current:

    python -m blinqscribe.onboard --days 730

It lists the patients seen in the window, pulls each one's notes from the
practice system (every vet), keeps those inside the window and drops older
ones. Voice profiles are then built from these notes on every draft, so each
vet's profile is ready on day one and keeps up as they write.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import date, datetime, time, timedelta
from typing import Any

from .adapters.base import PracticeAdapter
from .notes import HISTORY_DAYS
from .schemas import PastNote
from .store import Store
from .voice import profile_for

CONCURRENCY = 4


async def sync_notes(
    adapter: PracticeAdapter,
    store: Store,
    days: int = HISTORY_DAYS,
    today: date | None = None,
) -> dict[str, Any]:
    today = today or date.today()
    since = datetime.combine(today - timedelta(days=days), time.min)
    patients = await adapter.patients_seen(since.date(), today)
    gate = asyncio.Semaphore(CONCURRENCY)

    async def one(patient_id: str) -> list[PastNote] | None:
        async with gate:
            return await adapter.get_patient_notes(patient_id)

    results = await asyncio.gather(*(one(p) for p in patients), return_exceptions=True)
    failed = [
        p
        for p, r in zip(patients, results, strict=False)
        if isinstance(r, BaseException)
    ]
    notes, removed = [], 0
    unsupported = all(r is None for r in results) and bool(results)
    for patient_id, result in zip(patients, results, strict=False):
        if isinstance(result, BaseException) or result is None:
            # keep what we had for a patient we could not reach, or a system that shares
            # no notes
            continue
        kept = [n for n in result if n.date >= since]
        # A note voided or moved in the practice system must not linger as this
        # patient's history.
        removed += store.replace_patient_notes(patient_id, kept, since)
        notes += kept
    purged = store.purge_notes(before=since)
    store.set_meta("notes_synced_at", datetime.now().isoformat(timespec="seconds"))

    vets = {n.provider_id: n.provider_name for n in notes if n.provider_id}
    profiles = {pid: profile_for(store, pid) for pid in vets}
    return {
        "days": days,
        "patients": len(patients),
        "notes": len(notes),
        "purged": purged,
        "removed": removed,
        "failed_patients": failed,
        "notes_supported": not unsupported,
        "profiles_ready": sorted(vets[p] or p for p, prof in profiles.items() if prof),
        "profiles_waiting": sorted(
            vets[p] or p for p, prof in profiles.items() if not prof
        ),
    }


def main() -> None:
    from .adapters import build_adapter
    from .config import get_settings

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=HISTORY_DAYS)
    args = parser.parse_args()
    settings = get_settings()
    report = asyncio.run(
        sync_notes(build_adapter(settings), Store(settings.data_dir), args.days)
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
