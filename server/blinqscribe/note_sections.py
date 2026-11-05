"""A note's text as sections, from the headings it was written with, so a record can
show it in SOAP form: "S:" or "Subjective:", and each note type's own labels
("History:", "Since last visit:"...), plus Vitals and Medications."""

from __future__ import annotations

import re
from functools import cache

from .schemas import NoteSection

_LETTERS = {"s": "Subjective", "o": "Objective", "a": "Assessment", "p": "Plan"}
_EXTRA = ("Vitals", "Medications", "Comments")


@cache
def _header() -> re.Pattern[str]:
    from .note_types import NOTE_TYPES

    labels = {*_LETTERS.values(), *_EXTRA}
    for kind in NOTE_TYPES.values():
        labels |= {s["label"] for s in kind["sections"] if s["key"] != "client_summary"}
    names = sorted(labels, key=len, reverse=True)  # longest first: "Plan and vaccines"
    words = "|".join(re.escape(n) for n in names)
    return re.compile(rf"^\s*({words}|[SOAP])\s*[:\-]\s*(.*)$", re.IGNORECASE)


def _label(heading: str) -> str:
    if len(heading) == 1:
        return _LETTERS[heading.lower()]
    from .note_types import NOTE_TYPES

    known = {*_LETTERS.values(), *_EXTRA} | {
        s["label"] for kind in NOTE_TYPES.values() for s in kind["sections"]
    }
    return next((k for k in known if k.lower() == heading.lower()), heading)


def note_sections(text: str) -> list[NoteSection]:
    """The note's sections in order, or [] when it has no headings (show the text as
    it is then). Text before the first heading becomes a "Note" section."""
    header = _header()
    sections: list[NoteSection] = []
    before: list[str] = []
    for line in text.splitlines():
        m = header.match(line)
        # A lone letter followed by a number is a vital ("P: 120" is pulse), not a
        # heading.
        if m and len(m.group(1)) == 1 and re.match(r"\d", m.group(2)):
            m = None
        if m:
            sections.append(NoteSection(label=_label(m.group(1)), text=m.group(2)))
        elif sections:
            if line.strip():
                last = sections[-1]
                last.text = (
                    f"{last.text}\n{line.rstrip()}" if last.text else line.rstrip()
                )
        elif line.strip():
            before.append(line.rstrip())
    if not sections:
        return []
    for s in sections:
        s.text = s.text.strip()
    if before:
        sections.insert(0, NoteSection(label="Note", text="\n".join(before)))
    return [s for s in sections if s.text]
