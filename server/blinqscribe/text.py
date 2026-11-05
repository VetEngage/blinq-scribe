"""Small text helpers shared by the scribe and the edit tools: sentences, bullets and
prose. Kept apart so scribe.py and editor.py can both use them (editor imports scribe).
"""

from __future__ import annotations

import re

_SENTENCE = re.compile(r"(?<=[.!?])\s+|\n+")
BULLET = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")


def sentences(text: str) -> list[str]:
    """Each sentence or line, without its bullet marker."""
    return [s for s in (BULLET.sub("", p).strip() for p in _SENTENCE.split(text)) if s]


def cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def bullets(text: str) -> str:
    return "\n".join(f"- {s.rstrip('.')}" for s in sentences(text))


def prose(text: str) -> str:
    return " ".join(
        s if s[-1:] in ".!?" else s + "." for s in (cap(s) for s in sentences(text))
    )


# "Dr. Rivera: ...", "Owner: ...", "Speaker 3: ...": a short label of letters (or
# Speaker N), a colon and a space, then the words. "At 10:30 we'll..." has no label.
_LABEL = re.compile(r"^\s*([A-Za-z][A-Za-z .'-]{0,38}?|Speaker \d{1,2})\s*:\s+(\S.*)$")


def split_label(line: str, loose: bool = False) -> tuple[str, str]:
    """A transcript line as (who, words): ("Owner", "He's itchy"), or ("", the line)
    when it has no speaker label. `loose` takes anything before the first colon as
    the label ("Owner (Jordan):", "Owner:no space"), for the mock draft, where a
    missed owner label would chart the owner's words as the vet's."""
    if loose:
        who, sep, text = line.partition(":")
        return (who.strip(), text.strip()) if sep else ("", line.strip())
    m = _LABEL.match(line)
    return (m.group(1).strip(), m.group(2).strip()) if m else ("", line.strip())
