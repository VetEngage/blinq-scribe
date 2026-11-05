"""The referral letter as one PDF: the letter on the clinic's letterhead, then what
goes along as pages: signed visit notes in the same style, exam photos (crop, turn
and outline as the vet left them, made small), and received records (images drawn
as pages, PDFs merged in as they are, with pypdf).

Letter size, Helvetica, WinAnsi text: every string is escaped (pdf._escape), so a
name or a note can't break out of the page.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

from pypdf import PageObject, PdfReader, PdfWriter, Transformation
from pypdf.errors import PyPdfError

from . import pdf
from .phone import clinic_contact, format_phone

Kind = Literal["referral", "records", "letter"]

WIDTH, HEIGHT = pdf.WIDTH, pdf.HEIGHT
LEFT, RIGHT, TOP, BOTTOM = 44, WIDTH - 44, HEIGHT - 40, 40
INK = (0.102, 0.102, 0.102)  # #1A1A1A
MUTED = (0.4, 0.4, 0.4)  # #666666
BRAND = (0.118, 0.2, 0.204)  # #1E3334
LINE = (0.933, 0.933, 0.933)  # #EEEEEE
OUTLINE = (0.976, 0.451, 0.086)  # orange, as the console draws outlines
FOOTER = 54  # the footer band at the bottom of every page
CONFIDENTIAL = "Confidential medical record, shared with the owner's consent."
MISSING = "This file couldn't be included here. Ask the clinic for a copy."


@dataclass
class NoteAttachment:
    title: str  # "Visit note, Oct 30, 2026 (signed)"
    sections: list[tuple[str, str]]  # (label, text): Subjective, Objective...
    medicines: list[str] = field(default_factory=list)
    signed: str = ""  # "Signed by Dr. Ana Rivera, DVM, Oct 30, 2026, 9:52 AM"


@dataclass
class PhotoAttachment:
    title: str  # "Exam photo, right ear canal, with outline"
    data: bytes
    crop: dict[str, Any] | None = None
    rotation: int = 0
    outline: list[dict[str, Any]] = field(default_factory=list)  # OutlineRegion dumps
    caption: str = ""


@dataclass
class FileAttachment:
    title: str  # "Antech lab results, Jun 25, 2026"
    data: bytes  # a PDF is merged in as it is; a JPEG or PNG is drawn as a page
    content_type: str


@dataclass
class InvoiceAttachment:
    title: str  # "Invoice, Oct 30, 2026"
    lines: list[tuple[str, float, float | None]]  # (item, quantity, price or None)
    total: float | None = None


Attachment = NoteAttachment | PhotoAttachment | FileAttachment | InvoiceAttachment


@dataclass
class LetterPdf:
    kind: Kind
    clinic: dict[str, str]  # name, address, phone
    recipient: list[str]  # lines: name, clinic, email
    date: date
    how_soon: str  # "routine"
    patient: list[str]  # name, species and breed, age, sex, weight
    owner: list[str]  # name, phone
    owner_consent: bool
    referring_vet: str
    paragraphs: list[str]
    signer: str = ""  # "Dr. Ana Rivera, DVM"; blank while it isn't signed
    signed_at: datetime | None = None  # clinic-local
    draft: bool = False
    attachments: list[Attachment] = field(default_factory=list)


# Helvetica widths per 1000 em, for ASCII 32 to 126 (Adobe's metrics), so text is
# wrapped and right-aligned where it really ends.
_REGULAR = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]  # fmt: skip
_BOLD = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]  # fmt: skip
_OTHER = {"·": 278, "•": 350, "’": 222, "‘": 222, "“": 333, "”": 333, "—": 1000}


def width(text: str, font: str, size: float) -> float:
    table = _BOLD if font == "F2" else _REGULAR
    units = sum(
        table[ord(c) - 32] if 32 <= ord(c) <= 126 else _OTHER.get(c, 556) for c in text
    )
    return units * size / 1000


def wrap(text: str, font: str, size: float, room: float) -> list[str]:
    lines: list[str] = []
    for part in text.splitlines() or [""]:
        line = ""
        for word in part.split():
            trial = f"{line} {word}" if line else word
            if line and width(trial, font, size) > room:
                lines.append(line)
                line = word
            else:
                line = trial
        lines.append(line)
    return lines


def when(at: datetime) -> str:
    return f"{at:%b} {at.day}, {at.year}, {at:%I:%M %p}".replace(" 0", " ")


class _Pages:
    """Pages drawn top to bottom, a new page when the next thing doesn't fit."""

    def __init__(self, letter: LetterPdf, total: int):
        self.letter, self.total = letter, total
        self.pages: list[bytes] = []
        self.images: list[dict[str, int]] = []
        self.xobjects: list[bytes] = []
        self.page, self.y = b"", 0.0
        self.merged = 0  # pages of received PDFs before this one, for numbering

    # ---------- drawing ----------
    def text(
        self,
        x: float,
        y: float,
        s: str,
        font: str = "F1",
        size: float = 11,
        rgb: tuple[float, ...] = INK,
        spacing: float = 0,
    ) -> None:
        self.page += (
            b"BT %.3f %.3f %.3f rg /%s %.1f Tf %.2f Tc %.2f %.2f Td ("
            % (rgb[0], rgb[1], rgb[2], font.encode(), size, spacing, x, y)
            + pdf._escape(s)
            + b") Tj ET\n"
        )

    def right(
        self, y: float, s: str, font: str, size: float, rgb: tuple[float, ...]
    ) -> None:
        self.text(RIGHT - width(s, font, size), y, s, font, size, rgb)

    def rule(self, y: float, thick: float, rgb: tuple[float, ...]) -> None:
        self.page += b"%.3f %.3f %.3f RG %.2f w %d %.2f m %d %.2f l S\n" % (
            *rgb,
            thick,
            LEFT,
            y,
            RIGHT,
            y,
        )

    # ---------- pages ----------
    def new_page(self, heading: str = "") -> None:
        if self.page:
            self.pages.append(self.page)
        self.images.append({})
        self.page = b""
        self._footer()
        if heading:
            self._running_header(heading)
            self.y = TOP - 64
        else:
            self.y = TOP

    def _running_header(self, heading: str) -> None:
        """A page after the letter: who it's from, and what it is."""
        clinic = self.letter.clinic.get("name", "")
        self.text(LEFT, TOP - 10, clinic, "F2", 10, BRAND)
        self.right(TOP - 10, _letter_label(self.letter), "F1", 9, MUTED)
        self.text(LEFT, TOP - 34, heading, "F2", 14)
        self.rule(TOP - 44, 1, BRAND)

    def _footer(self, number: int = 0) -> None:
        n = number or len(self.pages) + 1 + self.merged
        label = f"Page {n} of {self.total or n}"
        if n == 1 and self.letter.attachments:
            label += " · with attachments"
        self.right(BOTTOM + 30, label, "F1", 9, MUTED)
        self.page += b"%.3f %.3f %.3f RG 1 w %d %d m %d %d l S\n" % (
            0.902,
            0.902,
            0.902,
            LEFT,
            BOTTOM + 22,
            RIGHT,
            BOTTOM + 22,
        )
        phone = format_phone(self.letter.clinic.get("phone", ""))
        footer = CONFIDENTIAL + (f" Questions: call {phone}." if phone else "")
        self.text(LEFT, BOTTOM + 8, footer, "F1", 9, MUTED)

    def room(self, needed: float, heading: str = "") -> None:
        if self.y - needed < BOTTOM + FOOTER:
            self.new_page(heading)

    def lines(
        self,
        text: str,
        font: str = "F1",
        size: float = 11,
        leading: float = 1.55,
        indent: float = 0,
        rgb: tuple[float, ...] = INK,
        heading: str = "",
    ) -> None:
        step = size * leading
        for line in wrap(text, font, size, RIGHT - LEFT - indent):
            self.room(step, heading)
            self.y -= step
            self.text(LEFT + indent, self.y + (step - size) / 2, line, font, size, rgb)

    def finish(self) -> list[bytes]:
        if self.page:
            self.pages.append(self.page)
            self.page = b""
        return self.pages


def _letter_label(letter: LetterPdf) -> str:
    label = {"referral": "Referral", "records": "Records", "letter": "Letter"}[
        letter.kind
    ]
    return label + (" (draft)" if letter.draft else "")


def _letterhead(p: _Pages) -> None:
    letter, clinic = p.letter, p.letter.clinic
    name = clinic.get("name", "")
    initials = "".join(w[0] for w in name.split()[:2] if w[:1].isalnum()).upper()
    p.page += b"%.3f %.3f %.3f rg %d %d 40 40 re f\n" % (*BRAND, LEFT, TOP - 40)
    p.text(
        LEFT + 20 - width(initials, "F2", 13) / 2,
        TOP - 24,
        initials,
        "F2",
        13,
        (1, 1, 1),
    )
    p.text(LEFT + 52, TOP - 17, name, "F2", 15)
    contact = clinic_contact(clinic, " · ")
    p.text(LEFT + 52, TOP - 32, contact, "F1", 10, MUTED)
    label = _letter_label(letter).upper()
    p.text(
        RIGHT - width(label, "F2", 11) - 0.66 * len(label),
        TOP - 24,
        label,
        "F2",
        11,
        BRAND,
        0.66,
    )
    p.rule(TOP - 52, 2, BRAND)
    p.y = TOP - 66


def _addressee(p: _Pages) -> None:
    letter = p.letter
    left = [x for x in letter.recipient if x] or ["To be added"]
    right = [
        f"{letter.date:%b} {letter.date.day}, {letter.date.year}",
        f"How soon: {letter.how_soon}",
    ]
    top = p.y
    for i in range(max(len(left), len(right))):
        p.y -= 16.5
        if i < len(left):
            p.text(LEFT, p.y, left[i], "F1", 11)
        if i < len(right):
            p.right(p.y, right[i], "F1", 11, INK)
    p.y = min(p.y, top - 33) - 14


def _details(p: _Pages) -> None:
    letter = p.letter
    owner = [x for x in letter.owner if x]
    if letter.owner_consent:
        owner.append("agreed to share these records")
    for label, value in (
        ("Patient", " · ".join(x for x in letter.patient if x)),
        ("Owner", " · ".join(owner)),
        ("Referring provider", letter.referring_vet),
    ):
        rows = wrap(value or "Not recorded", "F1", 10.5, RIGHT - LEFT - 132)
        p.page += b"%.3f %.3f %.3f RG 1 w %d %.2f m %d %.2f l S\n" % (
            *LINE,
            LEFT,
            p.y,
            RIGHT,
            p.y,
        )
        p.y -= 15
        p.text(LEFT, p.y, label, "F1", 10.5, MUTED)
        for n, row in enumerate(rows):
            p.text(LEFT + 132, p.y - n * 14, row, "F1", 10.5)
        p.y -= 14 * (len(rows) - 1) + 5
    p.y -= 10


def _signature(p: _Pages) -> None:
    letter = p.letter
    p.room(70)
    p.y -= 30
    if letter.signer and letter.signed_at:
        shown = letter.signer.removeprefix("Dr. ").split(",")[0]
        p.text(LEFT, p.y, shown, "F3", 16, BRAND)
        p.y -= 18
        p.text(
            LEFT, p.y, f"{letter.signer} · signed {when(letter.signed_at)}", "F1", 11
        )
    else:
        p.text(LEFT, p.y, "Not signed yet", "F3", 13, MUTED)
        p.y -= 18
        p.text(LEFT, p.y, letter.referring_vet, "F1", 11)


def _pages(
    letter: LetterPdf, total: int, merged: dict[int, int]
) -> tuple[_Pages, list[int]]:
    """Our pages, and where each attachment starts among them. `merged`: attachment
    index -> pages it brings from a received PDF (drawn by pypdf, not here)."""
    p = _Pages(letter, total)
    p.new_page()
    _letterhead(p)
    _addressee(p)
    _details(p)
    for paragraph in letter.paragraphs:
        p.lines(paragraph)
        p.y -= 6
    if letter.attachments:
        p.room(40)
        p.y -= 6
        p.lines("Attached", "F2", 11)
        for n, a in enumerate(letter.attachments, start=1):
            p.lines(f"{n}. {a.title}", size=10.5, leading=1.6, indent=0)
    _signature(p)

    starts: list[int] = []
    for n, a in enumerate(letter.attachments, start=1):
        heading = f"Attachment {n}: {a.title}"
        if n - 1 in merged:  # a received PDF goes here, merged after drawing
            starts.append(len(p.pages) + (1 if p.page else 0))
            p.merged += merged[n - 1]
            continue
        p.new_page(heading)
        starts.append(len(p.pages))
        if isinstance(a, NoteAttachment):
            for label, text in a.sections:
                if text.strip():
                    p.room(40, heading)
                    p.y -= 4
                    p.lines(label, "F2", 11, rgb=BRAND, heading=heading)
                    p.lines(text, size=10.5, heading=heading)
            if a.medicines:
                p.y -= 4
                p.lines("Medicines", "F2", 11, rgb=BRAND, heading=heading)
                for m in a.medicines:
                    p.lines(f"• {m}", size=10.5, indent=8, heading=heading)
            if a.signed:
                p.y -= 8
                p.lines(a.signed, "F3", 10.5, rgb=MUTED, heading=heading)
        elif isinstance(a, InvoiceAttachment):
            _invoice(p, a, heading)
        elif isinstance(a, PhotoAttachment):
            if not _photo(p, a.data, a.crop, a.rotation, a.outline):
                p.lines(MISSING, rgb=MUTED)
            if a.caption:
                p.lines(a.caption, size=10.5, heading=heading)
        else:
            if not _photo(p, a.data, None, 0, []):
                p.lines(MISSING, rgb=MUTED)
    p.finish()
    return p, starts


def _money(amount: float | None) -> str:
    return "" if amount is None else f"${amount:,.2f}"


def _invoice(p: _Pages, invoice: InvoiceAttachment, heading: str) -> None:
    """Item, quantity and price per row, numbers on the right, then the total."""
    qty_x, price_right = RIGHT - 120, RIGHT

    def row(item: str, qty: str, price: str, font: str = "F1") -> None:
        cells = wrap(item, font, 10.5, qty_x - LEFT - 12)
        p.room(16 * len(cells), heading)
        p.page += b"%.3f %.3f %.3f RG 1 w %d %.2f m %d %.2f l S\n" % (
            *LINE,
            LEFT,
            p.y,
            RIGHT,
            p.y,
        )
        p.y -= 15
        for n, cell in enumerate(cells):
            p.text(LEFT, p.y - n * 14, cell, font, 10.5)
        p.text(qty_x, p.y, qty, font, 10.5)
        p.text(price_right - width(price, font, 10.5), p.y, price, font, 10.5)
        p.y -= 14 * (len(cells) - 1) + 5

    row("Item", "Qty", "Price", "F2")
    for item, qty, price in invoice.lines:
        row(item, f"{qty:g}", _money(price))
    if invoice.total is not None:
        row("Total", "", _money(invoice.total), "F2")


def _photo(
    p: _Pages,
    data: bytes,
    crop: dict[str, Any] | None,
    rotation: int,
    outline: list[dict[str, Any]],
) -> bool:
    shown = pdf.prepare(data, crop, rotation)
    if not shown:
        return False
    room_h = p.y - (BOTTOM + FOOTER) - 40
    k = min((RIGHT - LEFT) / shown.width, room_h / shown.height)
    x, y = LEFT, p.y - k * shown.height
    p.xobjects.append(shown.xobject)
    name = f"Im{len(p.xobjects)}"
    p.images[-1][name] = len(p.xobjects) - 1
    p.page += shown.draw(name, x, y, k)
    for region in outline:
        _outline(p, region, crop, rotation, x, y, k * shown.width, k * shown.height)
    p.y = y - 10
    return True


def _turn(
    px: float, py: float, crop: dict[str, Any] | None, rotation: int
) -> tuple[float, float]:
    """A point in 0..1 of the whole photo, as 0..1 of the cropped, turned photo."""
    c = crop or {"x": 0, "y": 0, "w": 1, "h": 1}
    u, v = (px - c["x"]) / c["w"], (py - c["y"]) / c["h"]
    return {90: (1 - v, u), 180: (1 - u, 1 - v), 270: (v, 1 - u)}.get(rotation, (u, v))


def _outline(
    p: _Pages,
    region: dict[str, Any],
    crop: dict[str, Any] | None,
    rotation: int,
    x: float,
    y: float,
    w: float,
    h: float,
) -> None:
    """The vet's outline over the photo: its polygon, or its box."""
    points = region.get("polygon") or []
    if len(points) < 3:
        x0, y0, x1, y1 = region["box"]
        points = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    shown = [_turn(px, py, crop, rotation) for px, py in points]
    shown = [(min(max(u, 0.0), 1.0), min(max(v, 0.0), 1.0)) for u, v in shown]
    path = b" ".join(
        b"%.2f %.2f %s" % (x + u * w, y + (1 - v) * h, b"m" if i == 0 else b"l")
        for i, (u, v) in enumerate(shown)
    )
    p.page += b"q %.3f %.3f %.3f RG 2 w %s h S Q\n" % (*OUTLINE, path)
    label = str(region.get("label") or "")
    if label:  # on a white tab above the outline's top left corner
        u, v = min(shown, key=lambda q: (q[1], q[0]))
        lx, ly = x + u * w, y + (1 - v) * h + 2
        p.page += b"1 1 1 rg %.2f %.2f %.2f 13 re f\n" % (
            lx,
            ly,
            width(label, "F2", 9) + 6,
        )
        p.text(lx + 3, ly + 3.5, label, "F2", 9, OUTLINE)


def _received(data: bytes) -> PdfReader | None:
    """A received PDF that opens, or None."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            return None
        return reader if len(reader.pages) else None
    except PyPdfError, ValueError, OSError, KeyError, TypeError:
        return None


FRAME_TOP = TOP - 58  # a received page sits between our title and our footer
FRAME = (0.851, 0.851, 0.851)  # the light gray border around it


def _upright_size(page: PageObject) -> tuple[float, float]:
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    return (h, w) if page.rotation % 180 == 90 else (w, h)


def _fit(w: float, h: float) -> tuple[float, float, float]:
    """Scale and bottom left corner that fit a w x h page in the frame area,
    keeping its shape, centered across."""
    room_w, room_h = RIGHT - LEFT, FRAME_TOP - (BOTTOM + FOOTER)
    k = min(room_w / w, room_h / h)
    return k, LEFT + (room_w - k * w) / 2, FRAME_TOP - k * h


def _stamps(
    letter: LetterPdf, stamps: list[tuple[str, int, tuple[float, float]]], total: int
) -> bytes:
    """One overlay page per received page: the running header and title the other
    attachment pages have, a border around where the received page goes, and the
    page number and footer. stamps: (title, page number, received page size)."""
    p = _Pages(letter, total)
    for heading, number, (w, h) in stamps:
        if p.page:
            p.pages.append(p.page)
        p.images.append({})
        p.page = b""
        p._footer(number)
        p._running_header(heading)
        k, x, y = _fit(w, h)
        p.page += b"%.3f %.3f %.3f RG 0.75 w %.2f %.2f %.2f %.2f re S\n" % (
            *FRAME,
            x,
            y,
            k * w,
            k * h,
        )
    p.finish()
    return pdf.document(p.pages, p.images, p.xobjects)


def _add_framed(writer: PdfWriter, original: PageObject, stamp: PageObject) -> None:
    """A received page on a Letter page, scaled to fit between our title and our
    footer, with the stamp (header, border, footer) drawn over it."""
    received = PdfWriter().add_page(original)  # a copy we may change
    received.transfer_rotation_to_content()  # so its box is the way it reads
    box = received.mediabox
    w, h = float(box.width), float(box.height)
    k, x, y = _fit(w, h)
    move = (
        Transformation()
        .scale(k)
        .translate(x - k * float(box.left), y - k * float(box.bottom))
    )
    page = writer.add_blank_page(width=WIDTH, height=HEIGHT)
    page.merge_transformed_page(received, move)
    page.merge_page(stamp)


def render(letter: LetterPdf) -> bytes:
    """The letter and everything attached, as one PDF."""
    readers: dict[int, PdfReader] = {}
    for n, a in enumerate(letter.attachments):
        if isinstance(a, FileAttachment) and a.content_type == "application/pdf":
            reader = _received(a.data)
            if reader:
                readers[n] = reader
    merged = {n: len(r.pages) for n, r in readers.items()}
    first, _ = _pages(letter, 0, merged)  # how many pages we draw
    total = len(first.pages) + sum(merged.values())
    ours, starts = _pages(letter, total, merged)
    own = pdf.document(ours.pages, ours.images, ours.xobjects)
    if not readers:
        return own

    # The final order: our pages, with each received PDF's pages where it belongs.
    drawn = PdfReader(io.BytesIO(own))
    order: list[tuple[int, int]] = []  # (attachment, received page), -1: ours
    at = 0
    for n in sorted(readers):
        order += [(-1, i) for i in range(at, starts[n])]
        order += [(n, i) for i in range(len(readers[n].pages))]
        at = starts[n]
    order += [(-1, i) for i in range(at, len(drawn.pages))]
    stamps = PdfReader(
        io.BytesIO(
            _stamps(
                letter,
                [
                    (
                        f"Attachment {n + 1}: {letter.attachments[n].title} "
                        "(received document)",
                        number,
                        _upright_size(readers[n].pages[i]),
                    )
                    for number, (n, i) in enumerate(order, start=1)
                    if n >= 0
                ],
                total,
            )
        )
    )
    writer, stamp = PdfWriter(), iter(stamps.pages)
    for n, i in order:
        if n < 0:
            writer.add_page(drawn.pages[i])
        else:
            _add_framed(writer, readers[n].pages[i], next(stamp))
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
