"""Note types beyond SOAP. Each keeps the four stored sections, with its own labels and
prompt guidance."""

from __future__ import annotations

import re
from typing import Any

from .schemas import Appointment

OWNER = {"key": "client_summary", "label": "For the owner"}


def _sections(
    subjective: str, objective: str, assessment: str, plan: str
) -> list[dict[str, Any]]:
    return [
        {"key": "subjective", "label": subjective},
        {"key": "objective", "label": objective},
        {"key": "assessment", "label": assessment},
        {"key": "plan", "label": plan},
        OWNER,
    ]


# id -> name, sections, the appointment type words that pick it, and what the model is
# told about it.
NOTE_TYPES: dict[str, dict[str, Any]] = {
    "sick": {
        "name": "Sick visit",
        "sections": _sections("Subjective", "Objective", "Assessment", "Plan"),
        "from_types": [
            "sick",
            "problem",
            "illness",
            "urgent",
            "emergency",
            "lame",
            "vomit",
            "diarrhea",
            "itch",
            "ear",
        ],
        "guidance": "A sick visit SOAP note: the owner's history, the exam, the vet's "
        "assessment and the plan.",
    },
    "wellness": {
        "name": "Wellness exam",
        "sections": _sections("History", "Exam", "Assessment", "Plan and vaccines"),
        "from_types": [
            "wellness",
            "annual",
            "vaccine",
            "vaccination",
            "checkup",
            "check up",
            "puppy",
            "kitten",
        ],
        "guidance": "A wellness exam: the owner's report, the exam system by system as "
        "the vet said it, "
        "the vet's overall assessment, and vaccines, preventives and next "
        "due dates the vet named.",
    },
    "recheck": {
        "name": "Recheck",
        "sections": _sections("Since last visit", "Exam", "Progress", "Plan"),
        "from_types": [
            "recheck",
            "re-check",
            "follow up",
            "follow-up",
            "suture",
            "progress exam",
        ],
        "guidance": "A recheck: what changed since the last visit per the owner, "
        "today's "
        "exam, how the problem "
        "is progressing in the vet's words, and the plan.",
    },
    "surgery": {
        "name": "Surgery report",
        "sections": _sections("Pre-op", "Procedure", "Findings", "Recovery and plan"),
        "from_types": [
            "surgery",
            "spay",
            "neuter",
            "mass removal",
            "procedure",
            "anesthesia",
        ],
        "guidance": "A surgery report: pre-op status, the procedure as the vet "
        "described "
        "it, intra-op findings, "
        "and recovery and discharge plan. Drugs and doses only as said.",
    },
    "dental": {
        "name": "Dental",
        "sections": _sections(
            "History", "Oral exam", "Findings", "Treatment and home care"
        ),
        "from_types": ["dental", "dentistry", "teeth", "cleaning", "extraction"],
        "guidance": "A dental note: history, the oral exam, findings per tooth or area "
        "as the vet said them, "
        "and treatment done plus home care.",
    },
    "radiology": {
        "name": "Radiology report",
        "sections": _sections("Clinical history", "Views", "Findings", "Conclusion"),
        "from_types": [
            "radiograph",
            "radiology",
            "x-ray",
            "xray",
            "ultrasound",
            "imaging",
        ],
        "guidance": "A radiology report: the clinical question, the views taken, "
        "findings as the vet read them, "
        "and the vet's conclusion. Never read an image yourself.",
    },
    "phone": {
        "name": "Phone call log",
        "sections": _sections(
            "Caller and reason",
            "What was discussed",
            "Assessment",
            "Advice and next steps",
        ),
        "from_types": ["phone", "call", "telehealth", "tele"],
        "guidance": "A phone call log: who called and why, what was discussed, the "
        "vet's "
        "assessment if they "
        "gave one, and the advice and next steps they gave.",
    },
    "progress": {
        "name": "Progress note",
        "sections": _sections("Update", "Observations", "Assessment", "Plan"),
        "from_types": [
            "hospitalized",
            "hospital",
            "boarding",
            "progress",
            "treatment",
            "in-patient",
            "inpatient",
        ],
        "guidance": "A progress note for a patient in care: the update, today's "
        "observations, the vet's "
        "assessment and the plan for the next hours or days.",
    },
}


def public(note_type_id: str) -> dict[str, Any]:
    t = NOTE_TYPES[note_type_id]
    return {
        "id": note_type_id,
        "name": t["name"],
        "sections": t["sections"],
        "from_types": t["from_types"],
    }


def guess(appt: Appointment) -> str:
    """The note type for an appointment, from the practice system's type text, then the
    reason."""
    # Sick is checked last, so "ear recheck" is a recheck and not a sick visit.
    order = [*(k for k in NOTE_TYPES if k != "sick"), "sick"]
    for text in (appt.type, appt.reason):
        low = text.lower()
        for type_id in order:
            t = NOTE_TYPES[type_id]
            if any(re.search(rf"\b{re.escape(word)}", low) for word in t["from_types"]):
                return type_id
    return "sick"


def guidance(note_type_id: str) -> str:
    """What the scribe is told about this note type, including the section labels the
    vet sees."""
    t = NOTE_TYPES.get(note_type_id) or NOTE_TYPES["sick"]
    labels = ", ".join(f"`{s['key']}` = {s['label']}" for s in t["sections"])
    return f"{t['name']}. {t['guidance']} Fill the fields as: {labels}."
