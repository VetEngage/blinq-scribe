"""Last-plan checkboxes: the lines of their own last plan a provider ticks in Before
you walk in, asked to cover today. Kept with the visit (its appointment and pet) on
the server, so a reload, another computer or the draft sees the same ticks.

When the note is drafted, the ticked lines go to the scribe; each one the visit
didn't talk about comes back on the draft as a reminder, quoted as the provider wrote
it: "From your last plan, not covered: ...". Reminders never block signing.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence

from .schemas import PlanReminder
from .store import Store

MAX_LINES = 20
MAX_CHARS = 300


def _key(appointment_id: str, patient_id: str) -> str:
    return f"plan_checks|{appointment_id}|{patient_id}"


def read(store: Store, appointment_id: str, patient_id: str) -> list[str]:
    """The lines ticked for this pet on this visit, in the plan's order."""
    raw = store.get_meta(_key(appointment_id, patient_id))
    try:
        lines = json.loads(raw) if raw else []
    except ValueError:
        return []
    return [x for x in lines if isinstance(x, str)] if isinstance(lines, list) else []


def write(
    store: Store, appointment_id: str, patient_id: str, lines: list[str]
) -> list[str]:
    """Keep exactly these ticked lines (cleaned, each once)."""
    kept: list[str] = []
    for line in lines[:MAX_LINES]:
        text = " ".join(line.split())[:MAX_CHARS]
        if text and text not in kept:
            kept.append(text)
    store.set_meta(_key(appointment_id, patient_id), json.dumps(kept))
    return kept


def reminders(
    not_covered: Sequence[str], before: Sequence[PlanReminder]
) -> list[PlanReminder]:
    """The draft's reminders: one per line not covered. A redraft keeps what the
    provider already did with a line (added to the plan, or dismissed)."""
    was = {r.text: r for r in before}
    out: list[PlanReminder] = []
    for text in not_covered:
        rid = hashlib.sha256(text.encode()).hexdigest()[:10]
        status = was[text].status if text in was else "open"
        out.append(PlanReminder(id=rid, text=text, status=status))
    return out
