"""Phone numbers as people read them, for anything the server writes as text: pages,
PDFs, emails, texts and Ask Blinq. Data fields (a client's phones) stay as stored, and
texting still sends to E.164 numbers; the web formats its own.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

_EXT = re.compile(r"\s*(?:ext\.?|extension|x|#)\s*(\d{1,6})\s*$", re.I)
_DIALABLE = re.compile(r"^[\d\s().+-]+$")
_IN_TEXT = re.compile(
    r"(?<![\w+])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"
)
DOT = "•"


def format_phone(value: str) -> str:
    """A US number as "(555) 014-2231", with "+1" dropped and an extension as
    "ext. 12". Anything else comes back unchanged."""
    text = value.strip()
    ext = ""
    if m := _EXT.search(text):
        ext, text = m.group(1), text[: m.start()]
    if not text or not _DIALABLE.match(text):
        return value
    digits = re.sub(r"\D", "", text)
    if text.startswith("+") and not digits.startswith("1"):
        return value  # another country: leave it as written
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return value
    out = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return f"{out} ext. {ext}" if ext else out


def mask_phone(value: str) -> str:
    """Where a text went, without the number: "(•••) •••-0101"."""
    digits = re.sub(r"\D", "", _EXT.sub("", value))
    if len(digits) < 4:
        return f"({DOT * 3}) {DOT * 3}-{DOT * 4}"
    return f"({DOT * 3}) {DOT * 3}-{digits[-4:]}"


def format_phones_in(text: str) -> str:
    """Every US number written inside a sentence, formatted."""
    return _IN_TEXT.sub(lambda m: format_phone(m.group(0)), text)


def clinic_contact(clinic: Mapping[str, Any], sep: str) -> str:
    """The clinic's address and phone on one line: "12 Elm St | (555) 014-2231"."""
    phone = format_phone(clinic.get("phone", ""))
    return sep.join(x for x in (clinic.get("address", ""), phone) if x)


def clinic_with_phone(clinic: Mapping[str, Any]) -> str:
    """The clinic's name with its phone: "Lakeside Vet ((555) 014-2231)"."""
    phone = format_phone(clinic.get("phone", ""))
    return str(clinic["name"]) + (f" ({phone})" if phone else "")
