"""Exam photos drawn the way the vet edited them: crop and rotation applied on top of
the untouched original, for the owner's page (SVG) and the summary PDF.

Coordinates (crop, outline) are fractions of the photo as displayed: a phone JPEG's
EXIF orientation applied first, as browsers do. The stored file keeps its raw pixels,
so drawing turns them upright, then crops, then applies the vet's rotation.

JPEG and PNG headers give the size, and both formats embed as they are (PNG only
when it is plain 8 bit RGB or gray without transparency). Pillow only makes large
photos smaller for PDFs.
"""

from __future__ import annotations

import base64
import io
import struct
import zlib
from typing import Any

Matrix = tuple[float, float, float, float, float, float]  # a b c d e f
# X = a*x + c*y + e, Y = b*x + d*y + f; pixels from the top left, y down.


def orientation(data: bytes) -> int:
    """The JPEG's EXIF orientation, 1 to 8; 1 when absent or unreadable."""
    exif = _exif(data)
    if exif is None:
        return 1
    tiff = data[exif[0] + 10 : exif[1]]  # past marker, length, Exif header
    try:
        order = {b"II": "<", b"MM": ">"}[tiff[:2]]
        first = struct.unpack(order + "I", tiff[4:8])[0]
        (count,) = struct.unpack(order + "H", tiff[first : first + 2])
        for n in range(count):
            at = first + 2 + 12 * n
            tag, kind_, _ = struct.unpack(order + "HHI", tiff[at : at + 8])
            if tag == 0x0112 and kind_ == 3:
                value = struct.unpack(order + "H", tiff[at + 8 : at + 10])[0]
                return value if 1 <= value <= 8 else 1
    except KeyError, struct.error:
        return 1
    return 1


def strip_exif(data: bytes) -> bytes:
    """The JPEG without its EXIF block, so whatever reads it sees the raw pixels the
    same way (a model, a browser, a PDF reader). Other files come back unchanged."""
    exif = _exif(data)
    return data if exif is None else data[: exif[0]] + data[exif[1] :]


def _exif(data: bytes) -> tuple[int, int] | None:
    """Start and end of the JPEG's EXIF segment (marker included), or None."""
    return _segment(data, 0xE1, b"Exif\0\0")


def _segment(data: bytes, wanted: int, starts: bytes) -> tuple[int, int] | None:
    """Start and end of the first JPEG header segment with this marker whose body
    starts with these bytes, or None."""
    if kind(data) != "jpeg":
        return None
    i = 2
    while i + 4 <= len(data) and data[i] == 0xFF:
        marker = data[i + 1]
        if marker == 0xDA:  # image data starts: no header segments after this
            return None
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if marker == wanted and data[i + 4 : i + 4 + len(starts)] == starts:
            return i, i + 2 + length
        i += 2 + length
    return None


def _orient(width: float, height: float, value: int) -> tuple[float, float, Matrix]:
    """Displayed size and the raw-to-displayed matrix for an EXIF orientation."""
    w, h = width, height
    upright: dict[int, tuple[float, float, Matrix]] = {
        1: (w, h, (1, 0, 0, 1, 0, 0)),
        2: (w, h, (-1, 0, 0, 1, w, 0)),  # mirrored
        3: (w, h, (-1, 0, 0, -1, w, h)),  # upside down
        4: (w, h, (1, 0, 0, -1, 0, h)),  # mirrored upside down
        5: (h, w, (0, 1, 1, 0, 0, 0)),  # transposed
        6: (h, w, (0, 1, -1, 0, h, 0)),  # needs a quarter turn clockwise
        7: (h, w, (0, -1, -1, 0, h, w)),  # transversed
        8: (h, w, (0, -1, 1, 0, 0, w)),  # needs a quarter turn counterclockwise
    }
    return upright.get(value, upright[1])


def _then(second: Matrix, first: Matrix) -> Matrix:
    """The matrix that applies `first`, then `second`."""
    a2, b2, c2, d2, e2, f2 = second
    a1, b1, c1, d1, e1, f1 = first
    return (
        a2 * a1 + c2 * b1,
        b2 * a1 + d2 * b1,
        a2 * c1 + c2 * d1,
        b2 * c1 + d2 * d1,
        a2 * e1 + c2 * f1 + e2,
        b2 * e1 + d2 * f1 + f2,
    )


def upright_box(box: list[float], value: int) -> list[float]:
    """A 0..1 box on the raw pixels, as a box on the displayed photo."""
    _, _, (a, b, c, d, e, f) = _orient(1, 1, value)
    x0, y0, x1, y1 = box
    xs = [a * x + c * y + e for x, y in ((x0, y0), (x1, y1))]
    ys = [b * x + d * y + f for x, y in ((x0, y0), (x1, y1))]
    return [min(xs), min(ys), max(xs), max(ys)]


MAX_PIXELS = 50_000_000  # larger photos are refused at upload
SUFFIX = {"jpeg": ".jpg", "png": ".png"}  # photos we store


def kind(data: bytes) -> str:
    """jpeg or png, from the file's first bytes; "" for anything else."""
    if data.startswith(b"\xff\xd8"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    return ""


def size(data: bytes) -> tuple[int, int] | None:
    """(width, height) in pixels, or None when it isn't a JPEG or PNG we can read."""
    if kind(data) == "png" and len(data) >= 24 and data[12:16] == b"IHDR":
        w, h = struct.unpack(">II", data[16:24])
        return (w, h) if w and h else None
    if kind(data) != "jpeg":
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", data[i + 5 : i + 9])
            return (w, h) if w and h else None
        i += 2 + length
    return None


def view(
    raw_width: int,
    raw_height: int,
    crop: dict[str, Any] | None,
    rotation: int,
    exif: int = 1,
) -> tuple[float, float, Matrix]:
    """The shown size (pixels of the crop, turned) and the matrix that maps the
    stored file's raw pixels onto it: upright (EXIF), crop, then the vet's turn."""
    width, height, upright = _orient(raw_width, raw_height, exif)
    c = crop or {"x": 0, "y": 0, "w": 1, "h": 1}
    cx, cy = c["x"] * width, c["y"] * height
    cw, ch = c["w"] * width, c["h"] * height
    # Move the crop to the origin, then turn clockwise about it.
    turned: dict[int, tuple[float, float, Matrix]] = {
        0: (cw, ch, (1, 0, 0, 1, -cx, -cy)),
        90: (ch, cw, (0, 1, -1, 0, ch + cy, -cx)),
        180: (cw, ch, (-1, 0, 0, -1, cw + cx, ch + cy)),
        270: (ch, cw, (0, -1, 1, 0, -cy, cw + cx)),
    }
    vw, vh, turn = turned[rotation if rotation in turned else 0]
    return vw, vh, _then(turn, upright)


def svg(data: bytes, crop: dict[str, Any] | None, rotation: int, alt: str) -> str:
    """An inline SVG of the edited photo, the image as a data: URI. "" if unreadable.
    The EXIF block is dropped so the browser can't turn the pixels a second time."""
    found = size(data)
    if not found:
        return ""
    w, h = found
    vw, vh, m = view(w, h, crop, rotation, orientation(data))
    data = strip_exif(data)
    uri = f"data:image/{kind(data)};base64,{base64.b64encode(data).decode()}"
    matrix = " ".join(f"{v:.4f}" for v in m)
    return (
        f'<svg class="photo" role="img" viewBox="0 0 {vw:.1f} {vh:.1f}" '
        f'xmlns="http://www.w3.org/2000/svg"><title>{alt}</title>'
        f'<image href="{uri}" width="{w}" height="{h}" '
        f'transform="matrix({matrix})"/></svg>'
    )


PDF_PIXELS = 1400  # longest side of a photo in a PDF: sharp in print, small to send


def downscale(data: bytes, longest: int = PDF_PIXELS, quality: int = 80) -> bytes:
    """A smaller JPEG of the photo for a PDF: turned upright (so its EXIF no longer
    applies), at most `longest` pixels a side. The original comes back unchanged
    when it is already small or can't be read."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    found = size(data)
    if not found or (max(found) <= longest and kind(data) == "jpeg"):
        return data
    try:
        with Image.open(io.BytesIO(data)) as raw:
            img = ImageOps.exif_transpose(raw)
            img.thumbnail((longest, longest))
            if img.mode not in ("RGB", "L"):
                flat = Image.new("RGB", img.size, "white")  # transparency on white
                flat.paste(
                    img.convert("RGBA"), mask=img.convert("RGBA").getchannel("A")
                )
                img = flat
            out = io.BytesIO()
            img.save(out, "JPEG", quality=quality, optimize=True)
    except OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError:
        return data
    return out.getvalue()


def pdf_xobject(data: bytes) -> tuple[bytes, int, int] | None:
    """(image XObject dictionary + stream, width, height), or None if it can't embed."""
    found = size(data)
    if not found:
        return None
    w, h = found
    if kind(data) == "jpeg":
        data = strip_exif(data)
        components = _jpeg_components(data)
        space = {1: b"/DeviceGray", 3: b"/DeviceRGB", 4: b"/DeviceCMYK"}.get(components)
        if not space:
            return None
        # Adobe's CMYK JPEGs store inverted ink values; without /Decode the PDF
        # would draw them as a negative.
        adobe = components == 4 and _segment(data, 0xEE, b"Adobe") is not None
        decode = b"/Decode [1 0 1 0 1 0 1 0] " if adobe else b""
        head = (
            b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace %s "
            b"%s/BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n"
            % (w, h, space, decode, len(data))
        )
        return head + data + b"\nendstream", w, h
    idat = _png_plain(data)
    if idat is None:
        return None
    pixels, colors = idat
    head = (
        b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace %s "
        b"/BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 "
        b"/Colors %d /BitsPerComponent 8 /Columns %d >> /Length %d >>\nstream\n"
        % (
            w,
            h,
            b"/DeviceRGB" if colors == 3 else b"/DeviceGray",
            colors,
            w,
            len(pixels),
        )
    )
    return head + pixels + b"\nendstream", w, h


def _jpeg_components(data: bytes) -> int:
    i = 2
    while i + 9 < len(data):
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            return data[i + 9]
        i += 2 + length
    return 0


def _png_plain(data: bytes) -> tuple[bytes, int] | None:
    """The zlib pixel stream and color count of an 8 bit, non-interlaced RGB or gray
    PNG. PDF reads PNG's own row filters (Predictor 15), so no decoding is needed."""
    i, idat, colors = 8, b"", 0
    while i + 8 <= len(data):
        length, name = struct.unpack(">I4s", data[i : i + 8])
        body = data[i + 8 : i + 8 + length]
        if name == b"IHDR":
            if len(body) < 13:
                return None
            depth, color, interlace = body[8], body[9], body[12]
            if depth != 8 or interlace or color not in (0, 2):
                return None
            colors = 1 if color == 0 else 3
        elif name == b"IDAT":
            idat += body
        elif name == b"tRNS":
            return None
        i += 12 + length
    if not idat or not colors:
        return None
    try:
        zlib.decompressobj().decompress(idat[:64])  # a real zlib stream
    except zlib.error:
        return None
    return idat, colors
