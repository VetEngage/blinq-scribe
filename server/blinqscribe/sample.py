"""The demo's sample visits: one short, made-up transcript per demo pet, matching its
reason for the visit, species and sex (data/sample_visits/<patient id>.txt).

"Load sample visit" and demo recording use the visit's own; a household appointment
(several pets booked as one visit) uses its household's (household-<client>.txt).
Outside the demo clinic, and for a pet with no sample of its own, it's the generic
one (data/sample_visit.txt), so nothing about a real appointment ever goes into it.
"""

from __future__ import annotations

import re
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
GENERIC = DATA / "sample_visit.txt"
PER_PET = DATA / "sample_visits"
_SAFE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def text() -> str:
    """The generic sample visit."""
    return GENERIC.read_text()


def for_patient(patient_id: str) -> str:
    """The demo pet's own sample visit, else the generic one."""
    path = PER_PET / f"{patient_id}.txt"
    if _SAFE.match(patient_id) and path.is_file():
        return path.read_text()
    return text()


def for_appointment(patient_id: str, household_of: str = "") -> str:
    """The sample for a visit: a household appointment's (household_of is its
    owner's id), else its pet's own."""
    path = PER_PET / f"household-{household_of}.txt"
    if household_of and _SAFE.match(household_of) and path.is_file():
        return path.read_text()
    return for_patient(patient_id)
