"""A small PDF writer for the owner summary: Letter pages, Helvetica text, a branded
header. No dependencies.

Text is WinAnsi (cp1252) encoded, so Spanish accents and the bullet render with the
built-in fonts.
"""

from __future__ import annotations

import struct
import textwrap
from typing import Any

from . import images
from .images import Matrix
from .phone import clinic_contact

WIDTH, HEIGHT, MARGIN = 612, 792, 54
GREEN = (0.016, 0.471, 0.341)  # #047857
INK = (0.1, 0.1, 0.1)
GRAY = (0.42, 0.42, 0.42)
RULE = (0.85, 0.85, 0.85)
FILL = (0.955, 0.955, 0.955)
STYLES = {  # kind -> (font, size, space before, indent)
    "title": ("F2", 17, 14, 0),
    "pet": ("F2", 12, 20, 0),
    "label": ("F2", 8, 14, 0),
    "text": ("F1", 9, 4, 0),
    "detail": ("F1", 9, 2, 0),
    "bullet": ("F1", 9, 4, 10),
    "med": ("F1", 9, 4, 10),  # a bullet whose words before ": " are bold
    "small": ("F1", 8, 14, 0),
    "image": ("F1", 0, 6, 0),  # text is a key of render's photos
    "caption": ("F1", 8, 0, 0),  # beside the photo just before it
}
THUMB = 76  # a photo's height on the page, in points: a thumbnail beside its caption
LEAD = 1.45  # line height, as a multiple of the font size


def _escape(text: str) -> bytes:
    raw = text.encode("cp1252", errors="replace")
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def _width(text: str, size: float, bold: bool = False) -> float:
    """About how wide Helvetica sets it: a little over half its size per character."""
    return len(text) * size * (0.54 if bold else 0.5)


def _wrap(text: str, size: int, indent: float, width: float = 0) -> list[str]:
    room = (width or WIDTH - 2 * MARGIN) - indent
    return textwrap.wrap(text, max(10, int(room / (size * 0.5)))) or [""]


def _text(
    font: str,
    size: float,
    x: float,
    y: float,
    text: str,
    rgb: tuple[Any, ...] = INK,
    spacing: float = 0,
) -> bytes:
    return (
        b"BT %.3f %.3f %.3f rg /%s %.1f Tf %.2f Tc %.1f %.1f Td ("
        % (*rgb, font.encode(), size, spacing, x, y)
        + _escape(text)
        + b") Tj ET\n"
    )


def _rect(
    x: float, y: float, w: float, h: float, rgb: tuple[Any, ...], r: float = 0
) -> bytes:
    """A filled rectangle, its corners rounded by r points."""
    if not r:
        return b"%.3f %.3f %.3f rg %.1f %.1f %.1f %.1f re f\n" % (*rgb, x, y, w, h)
    k = r * 0.5523  # a quarter circle as a bezier
    return (
        b"%.3f %.3f %.3f rg %.1f %.1f m %.1f %.1f l %.1f %.1f %.1f %.1f %.1f %.1f c "
        b"%.1f %.1f l %.1f %.1f %.1f %.1f %.1f %.1f c %.1f %.1f l "
        b"%.1f %.1f %.1f %.1f %.1f %.1f c %.1f %.1f l "
        b"%.1f %.1f %.1f %.1f %.1f %.1f c f\n"
        % (
            *rgb,
            x + r, y, x + w - r, y, x + w - r + k, y, x + w, y + r - k, x + w, y + r,
            x + w, y + h - r, x + w, y + h - r + k,
            x + w - r + k, y + h, x + w - r, y + h,
            x + r, y + h, x + r - k, y + h, x, y + h - r + k, x, y + h - r,
            x, y + r, x, y + r - k, x + r - k, y, x + r, y,
        )
    )  # fmt: skip


def _line(x1: float, y: float, x2: float, rgb: tuple[Any, ...], w: float) -> bytes:
    return b"%.3f %.3f %.3f RG %.2f w %.1f %.1f m %.1f %.1f l S\n" % (
        *rgb, w, x1, y, x2, y,
    )  # fmt: skip


def initials(name: str) -> str:
    """ "Maple Street Animal Hospital" -> "MS": the clinic's mark on the letterhead."""
    words = [w for w in name.replace("&", " ").split() if w[:1].isalnum()]
    return "".join(w[0] for w in words[:2]).upper() or "+"


def render(
    header: dict[str, Any],
    blocks: list[tuple[str, str]],
    footer: str = "",
    photos: dict[str, tuple[bytes, dict[str, Any] | None, int]] | None = None,
    facts: list[list[tuple[str, str]]] | None = None,
    page_label: str = "Page {n} of {total}",
) -> bytes:
    """The clinic letterhead on every page, then `blocks`, then the footer and the page
    count at the foot of every page.

    header: {name, address, phone}; blocks: (kind, text) with kind in STYLES; facts:
    the visit details box under the title, rows of (label, value) cells, drawn right
    after the "title" block. photos: key -> (image bytes, crop, rotation) for "image"
    blocks, drawn as a thumbnail with the "caption" block after it beside it; a photo
    that can't be embedded is left out."""
    pages: list[bytes] = []
    page_images: list[dict[str, int]] = []
    xobjects: list[bytes] = []
    page, y = b"", 0.0
    right = WIDTH - MARGIN
    bottom = MARGIN + 28  # above the footer

    def new_page() -> None:
        nonlocal page, y
        if page:
            pages.append(page)
        page_images.append({})  # the new page's photos: name -> xobject index
        top = HEIGHT - MARGIN
        page = _rect(MARGIN, top - 30, 30, 30, GREEN, 5)
        mark = initials(str(header.get("name", "")))
        page += _text(
            "F2",
            11,
            MARGIN + 15 - _width(mark, 11, True) / 2,
            top - 19,
            mark,
            (1, 1, 1),
        )
        page += _text("F2", 12, MARGIN + 40, top - 13, str(header.get("name", "")))
        contact = clinic_contact(header, "  \xb7  ")
        page += _text("F1", 7.5, MARGIN + 40, top - 25, contact, GRAY)
        page += _line(MARGIN, top - 40, right, GREEN, 1.5)
        y = top - 40

    def room(h: float) -> None:
        if y - h < bottom:
            new_page()

    def box(rows: list[list[tuple[str, str]]]) -> None:
        nonlocal page, y
        cols = max(len(r) for r in rows)
        cw = (right - MARGIN - 20) / cols
        heights = []
        for r in rows:
            lines = max(len(_wrap(v, 8, 0, cw - 8)) for _, v in r)
            heights.append(10 + lines * 10 + 6)
        h = sum(heights) + 12
        room(h + 6)
        y -= 8
        page += _rect(MARGIN, y - h, right - MARGIN, h, FILL, 4)
        top = y - 10
        for r, rh in zip(rows, heights, strict=True):
            for c, (label, value) in enumerate(r):
                x = MARGIN + 10 + c * cw
                page += _text("F1", 6.5, x, top - 7, label, GRAY)
                for i, line in enumerate(_wrap(value, 8, 0, cw - 8)):
                    page += _text("F2", 8, x, top - 18 - i * 10, line)
            top -= rh
        y -= h

    new_page()
    i = 0
    while i < len(blocks):
        kind, text = blocks[i]
        i += 1
        font, size, before, indent = STYLES[kind]
        if kind == "image":
            photo = (photos or {}).get(text)
            shown = prepare(photo[0], photo[1], photo[2]) if photo else None
            caption = (
                blocks[i][1] if i < len(blocks) and blocks[i][0] == "caption" else ""
            )
            if caption:
                i += 1
            if not shown:
                continue  # a damaged image is left out, never a failed PDF
            k = min(THUMB / shown.height, 120 / shown.width)
            h = k * shown.height
            room(before + h)
            y -= before + h
            xobjects.append(shown.xobject)
            name = f"Im{len(xobjects)}"
            page_images[-1][name] = len(xobjects) - 1
            page += shown.draw(name, MARGIN, y, k)
            if caption:
                x = MARGIN + k * shown.width + 12
                lines = _wrap(caption, 8, 0, right - x)
                cy = y + h / 2 + (len(lines) * 11) / 2 - 8
                for n, line in enumerate(lines):
                    page += _text("F1", 8, x, cy - n * 11, line, GRAY)
            continue
        if kind == "caption":
            continue
        lead = size * LEAD
        bold_upto = text.find(": ") if kind == "med" else -1
        shown_text = text.upper() if kind == "label" else text
        lines = _wrap(
            shown_text, size, indent + (8 if kind in ("bullet", "med") else 0)
        )
        room(before + lead * min(2, len(lines)))
        y -= before
        for n, line in enumerate(lines):
            room(lead)
            y -= lead if n or kind != "title" else size
            x = MARGIN + indent
            if kind in ("bullet", "med") and n == 0:
                page += _text("F1", size, x - 8, y, "\u2022")
            if kind == "label":
                page += _text(font, size, x, y, line, GREEN, 0.6)
            elif kind == "pet":
                page += _text(font, size, x, y, line)
            elif n == 0 and bold_upto > 0:
                lead_words = line[: bold_upto + 1]
                page += _text("F2", size, x, y, lead_words)
                page += _text(
                    font,
                    size,
                    x + _width(lead_words, size, True) + 2,
                    y,
                    line[bold_upto + 1 :],
                )
            else:
                page += _text(font, size, x, y, line)
        if kind == "pet":
            y -= 5
            page += _line(MARGIN, y, right, RULE, 0.6)
        if kind == "title" and facts:
            box(facts)
    pages.append(page)

    total = len(pages)
    for n in range(total):
        if footer:
            pages[n] += _text("F1", 7, MARGIN, MARGIN, footer, GRAY)
        mark = page_label.format(n=n + 1, total=total)
        pages[n] += _text("F1", 7, right - _width(mark, 7), MARGIN, mark, GRAY)

    return document(pages, page_images, xobjects)


class Shown:
    """A photo ready to draw: its image XObject, and how its raw pixels map onto the
    shown photo (EXIF upright, the vet's crop, then their turn)."""

    def __init__(
        self, xobject: bytes, w: int, h: int, width: float, height: float, m: Matrix
    ):
        self.xobject, self.w, self.h = xobject, w, h
        self.width, self.height, self.matrix = width, height, m

    def draw(self, name: str, x: float, y: float, k: float) -> bytes:
        """Draw it `k` points per shown pixel, its bottom left corner at (x, y)."""
        a, b, c, d, e, f = self.matrix
        w, h = self.w, self.h
        return (
            b"q %.2f %.2f %.2f %.2f re W n "
            b"%.4f %.4f %.4f %.4f %.2f %.2f cm /%s Do Q\n"
            % (
                x,
                y,
                k * self.width,
                k * self.height,
                k * a * w,
                -k * b * w,
                -k * c * h,
                k * d * h,
                x + k * (c * h + e),
                y + k * (self.height - d * h - f),
                name.encode(),
            )
        )


def prepare(data: bytes, crop: dict[str, Any] | None, rotation: int) -> Shown | None:
    """A photo made small enough for a PDF, or None when it can't be embedded."""
    data = images.downscale(data)
    try:
        embedded = images.pdf_xobject(data)
    except IndexError, struct.error, ValueError:
        return None
    if not embedded:
        return None
    body, w, h = embedded
    width, height, m = images.view(w, h, crop, rotation, images.orientation(data))
    return Shown(body, w, h, width, height, m)


FONTS = (b"Helvetica", b"Helvetica-Bold", b"Helvetica-Oblique")  # F1, F2, F3


def document(
    pages: list[bytes], page_images: list[dict[str, int]], xobjects: list[bytes]
) -> bytes:
    """The PDF file: each page's content stream, and the images it names (name ->
    index in xobjects)."""
    # Objects: 1 catalog, 2 page tree, the fonts, the images, then a page and its
    # content per page.
    objects: list[bytes] = [
        b"",
        b"",
        *(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding "
            b"/WinAnsiEncoding >>" % f
            for f in FONTS
        ),
    ]
    fonts = b" ".join(b"/F%d %d 0 R" % (n, n + 2) for n in range(1, len(FONTS) + 1))
    first_image = len(objects) + 1
    objects += xobjects
    kids = []
    for content, used in zip(pages, page_images, strict=True):
        page_no, content_no = len(objects) + 1, len(objects) + 2
        kids.append(b"%d 0 R" % page_no)
        named = b" ".join(
            b"/%s %d 0 R" % (n.encode(), first_image + i) for n, i in used.items()
        )
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources "
            b"<< /Font << %s >> /XObject << %s >> >> "
            b"/Contents %d 0 R >>" % (WIDTH, HEIGHT, fonts, named, content_no)
        )
        objects.append(
            b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream"
        )
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = (
        b"<< /Type /Pages /Kids [" + b" ".join(kids) + b"] /Count %d >>" % len(kids)
    )

    out = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return out
