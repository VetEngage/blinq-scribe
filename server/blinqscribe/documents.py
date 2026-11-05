"""Outside records: referral letters, outside lab results and old records uploaded to a
patient.

Muse Spark lists each document's key points with page numbers. It only
restates what the document says, and nothing enters the note unless the vet
adds the line. With no model key, key points are the document's own opening
lines per page, flagged as mock.

PDF text is read with the standard library only (plain and Flate streams), so
a scanned PDF has no text here: Muse Spark can still read a photo of a page.
"""

from __future__ import annotations

import builtins
import contextlib
import re
import uuid
import zlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from .llm import MuseClient
from .prompts import OUTSIDE_RECORDS_SYSTEM
from .store import Store

MAX_POINTS = 10
_TYPES = {
    b"%PDF": "application/pdf",
    b"\x89PNG": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}
_SUFFIX = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/heic": ".heic",
}
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")  # ids become folder and file names


class KeyPoint(BaseModel):
    text: str = Field(
        max_length=200, description="One key point of the record, one short sentence"
    )
    page: int = 1


class KeyPoints(BaseModel):
    points: list[KeyPoint] = []


def content_type(data: bytes) -> str:
    """The file's real type from its first bytes, or "" when it is not a PDF or an
    image."""
    for magic, kind in _TYPES.items():
        if data.startswith(magic):
            return kind
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1"):
        return "image/heic"
    return ""


def _pdf_strings(stream: bytes) -> list[str]:
    """Text shown by one content stream, one line per text operator."""
    out = []
    for block in re.findall(rb"BT(.*?)ET", stream, re.S):
        for raw in re.findall(rb"\(((?:\\.|[^\\)])*)\)", block):
            text = re.sub(rb"\\([()\\])", rb"\1", raw).decode("latin-1").strip()
            if text:
                out.append(text)
    return out


def pdf_pages(data: bytes) -> tuple[int, list[str]]:
    """(page count, text per page). Content streams are taken in page order, which holds
    for simple PDFs."""
    pages = len(re.findall(rb"/Type\s*/Page(?!s)", data)) or 1
    texts: list[str] = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\n?endstream", data, re.S):
        body = m.group(1)
        with contextlib.suppress(zlib.error):
            body = zlib.decompress(body)
        lines = _pdf_strings(body)
        if lines:
            texts.append("\n".join(lines))
    texts = (
        [*texts[: pages - 1], "\n".join(texts[pages - 1 :])]
        if len(texts) > pages
        else texts
    )
    return pages, texts


def mock_points(texts: list[str]) -> list[KeyPoint]:
    """Deterministic stand-in for Muse Spark: the first lines of each page, as
    written."""
    points = []
    for page, text in enumerate(texts, start=1):
        lines = [
            ln.strip()
            for ln in re.split(r"\n|(?<=[.!?])\s+", text)
            if len(ln.strip()) >= 12
        ]
        points += [KeyPoint(text=ln, page=page) for ln in lines[:3]]
    return points[:MAX_POINTS]


class Documents:
    def __init__(self, store: Store, muse: MuseClient):
        self.store = store
        self.muse = muse

    def list(self, patient_id: str) -> list[dict[str, Any]]:
        docs = self.store.documents(patient_id)
        return [
            _public(d)
            for d in sorted(docs, key=lambda d: d["uploaded_at"], reverse=True)
        ]

    def get(self, patient_id: str, doc_id: str) -> dict[str, Any] | None:
        found = self.store.documents(patient_id, doc_id)
        return found[0] if found else None

    async def add(
        self,
        patient_id: str,
        name: str,
        data: bytes,
        uploaded_at: datetime | None = None,
        doc_id: str = "",
    ) -> dict[str, Any]:
        """Save the file and list its key points. Raises ValueError for anything but a
        PDF or an image.
        With a doc_id that is already saved, returns that document and adds nothing."""
        if not SAFE_ID.match(patient_id) or (doc_id and not SAFE_ID.match(doc_id)):
            raise ValueError("Ids may use only letters, digits, - and _.")
        if doc_id and (found := self.get(patient_id, doc_id)):
            return _public(found)
        kind = content_type(data)
        if not kind:
            raise ValueError("Upload a PDF or a photo (JPEG, PNG, HEIC or WebP).")
        doc_id = doc_id or uuid.uuid4().hex[:10]
        name = Path(name or "record").name[:120] or "record"
        # The extension comes from what the file really is, never from the uploaded
        # name.
        path = (
            self.store.media_dir / "documents" / patient_id / f"{doc_id}{_SUFFIX[kind]}"
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        pages, texts = pdf_pages(data) if kind == "application/pdf" else (1, [])
        points, detail = await self._key_points(kind, data, texts, pages)
        doc = {
            "id": doc_id,
            "patient_id": patient_id,
            "name": name,
            "pages": pages,
            "content_type": kind,
            "uploaded_at": (uploaded_at or datetime.now(UTC)).isoformat(),
            "key_points": [p.model_dump() for p in points],
            "mock": not self.muse.enabled,
            "detail": detail,
            "path": str(path),
        }
        self.store.add_document(doc)
        return _public(doc)

    async def _key_points(
        self, kind: str, data: bytes, texts: builtins.list[str], pages: int
    ) -> tuple[builtins.list[KeyPoint], str]:
        if not self.muse.enabled:
            points = mock_points(texts)
            return (
                points,
                ""
                if points
                else "Mock AI reads text in PDFs only. Add MODEL_API_KEY for "
                "photos and scans.",
            )
        if kind != "application/pdf":
            user, images = (
                "Key points of this record.",
                [self.muse.image_part(data, kind)],
            )
        elif any(t.strip() for t in texts):
            user, images = (
                "\n\n".join(f"Page {i}:\n{t}" for i, t in enumerate(texts, start=1)),
                None,
            )
        else:
            return [], "No text could be read from this PDF. Try a photo of each page."
        try:
            found = await self.muse.structured(
                OUTSIDE_RECORDS_SYSTEM, user, KeyPoints, images=images
            )
        except Exception as exc:  # the file is saved; say why it has no key points
            return (
                [],
                f"Muse Spark could not read this record ({exc.__class__.__name__}).",
            )
        points = [p for p in found.points if p.text.strip() and 1 <= p.page <= pages]
        return points[:MAX_POINTS], ""


def _public(doc: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in doc.items() if k != "path"}
