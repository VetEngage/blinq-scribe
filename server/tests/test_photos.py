"""Photo capture and edit (requirement 59): edits are metadata on the untouched
original, locked at signing, and only chosen photos reach the note or the owner."""

import struct
import zlib
from pathlib import Path

import pytest

from blinqscribe import images
from blinqscribe.schemas import Photo
from blinqscribe.scribe import build_context
from blinqscribe.store import Store


def jpeg(width=32, height=16, components=3, adobe=False):
    """Enough of a JPEG for its header to be read: SOI, a baseline frame, EOI."""
    frame = struct.pack(">BHHB", 8, height, width, components)
    frame += b"\x01\x22\x00" * components
    app14 = b"\xff\xee\x00\x0eAdobe\x00\x64\x00\x00\x00\x00\x02" if adobe else b""
    return (
        b"\xff\xd8"
        + app14
        + b"\xff\xc0"
        + struct.pack(">H", len(frame) + 2)
        + frame
        + b"\x00" * 64
        + b"\xff\xd9"
    )


def exif_jpeg(width=32, height=16, orientation=6, order="MM"):
    """A JPEG whose EXIF says how to turn it upright, like a phone photo."""
    e = ">" if order == "MM" else "<"
    tiff = (
        order.encode()
        + struct.pack(e + "HI", 42, 8)
        + struct.pack(e + "H", 1)
        + struct.pack(e + "HHI", 0x0112, 3, 1)
        + struct.pack(e + "HH", orientation, 0)
        + struct.pack(e + "I", 0)
    )
    app1 = b"Exif\0\0" + tiff
    plain = jpeg(width, height)
    return plain[:2] + b"\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1 + plain[2:]


def png(width=2, height=2):
    def chunk(name, body):
        return struct.pack(">I", len(body)) + name + body + b"\0\0\0\0"

    rows = b"".join(b"\x00" + b"\x10\x20\x30" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


def start(client, appt="appt-1"):
    eid = client.post(
        "/api/encounters", json={"appointment_id": appt, "consent_recorded": True}
    ).json()["id"]
    return eid


def add_photo(client, eid, hint="Left ear canal", data=None):
    enc = client.post(
        f"/api/encounters/{eid}/photos",
        files={"file": ("ear.jpg", data or jpeg(), "image/jpeg")},
        data={"hint": hint},
    ).json()
    return enc["photos"][-1]


def patch(client, eid, pid, **body):
    return client.patch(f"/api/encounters/{eid}/photos/{pid}", json=body)


def sign(client, eid):
    sample = client.get("/api/sample-transcript").json()["text"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": sample})
    client.post(f"/api/encounters/{eid}/draft")
    return client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()


def test_a_new_photo_starts_with_the_hint_as_label_and_sams_outline(client):
    photo = add_photo(client, start(client))
    assert photo["label"] == "Left ear canal"
    assert photo["outline"] == [
        {"label": "Left ear canal", "box": [0.35, 0.35, 0.65, 0.65], "polygon": []}
    ]
    assert photo["crop"] is None and photo["rotation"] == 0
    assert photo["in_note"] is True and photo["show_owner"] is False
    assert photo["edited_at"] is None


def test_edits_are_metadata_and_the_original_is_kept(client, settings):
    eid = start(client)
    photo = add_photo(client, eid)
    original = client.get(f"/api/encounters/{eid}/photos/{photo['id']}").content
    outline = [
        {
            "label": "Mass",
            "box": [0.1, 0.2, 0.4, 0.5],
            "polygon": [[0.1, 0.2], [0.4, 0.2], [0.25, 0.5]],
        }
    ]
    r = patch(
        client,
        eid,
        photo["id"],
        label="  Right flank  ",
        caption="Raised pink lump, about the size of a grape.",
        outline=outline,
        crop={"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
        rotation=90,
        in_note=False,
        show_owner=True,
    )
    assert r.status_code == 200, r.text
    edited = r.json()["photos"][0]
    assert edited["label"] == "Right flank"
    assert edited["caption"] == "Raised pink lump, about the size of a grape."
    assert edited["outline"] == outline
    assert edited["crop"] == {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5}
    assert edited["rotation"] == 90 and not edited["in_note"] and edited["show_owner"]
    assert edited["edited_at"] and edited["segments"] == photo["segments"]
    assert client.get(f"/api/encounters/{eid}/photos/{photo['id']}").content == original

    # Only what is sent changes; a null crop removes the crop.
    again = patch(client, eid, photo["id"], crop=None).json()["photos"][0]
    assert again["crop"] is None and again["label"] == "Right flank"
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    edits = [a["detail"] for a in audit if a["action"] == "photo_edited"]
    assert edits[0]["changed"] == [
        "caption",
        "crop",
        "in_note",
        "label",
        "outline",
        "rotation",
        "show_owner",
    ]
    assert edits[1]["changed"] == ["crop"]


@pytest.mark.parametrize(
    "body",
    [
        {"outline": [{"label": "x", "box": [0.1, 0.1, 1.2, 0.5]}]},  # off the photo
        {"outline": [{"label": "x", "box": [0.5, 0.1, 0.2, 0.5]}]},  # x0 after x1
        {"outline": [{"label": "x", "box": [0.1, 0.1, 0.5]}]},  # three numbers
        {"outline": [{"box": [0.1, 0.1, 0.2, 0.2], "polygon": [[0.1, 1.5]]}]},
        {"outline": [{"box": [0.1, 0.1, 0.2, 0.2]}] * 21},  # too many regions
        {"rotation": 45},
        {"crop": {"x": 0.6, "y": 0, "w": 0.6, "h": 0.5}},  # past the right edge
        {"crop": {"x": 0, "y": 0, "w": 0, "h": 0.5}},  # empty
        {"label": "x" * 81},
        {"caption": "x" * 301},
        {"findings": "x" * 1001},
        {"diagnosis": "Lipoma"},  # not a photo field
        {"in_note": None},  # null is refused everywhere but crop
        {"show_owner": None},
        {"rotation": None},
        {"outline": None},
        {"label": None},
        {"caption": None},
    ],
)
def test_every_field_is_checked(client, body):
    eid = start(client)
    photo = add_photo(client, eid)
    assert patch(client, eid, photo["id"], **body).status_code == 422
    assert client.get(f"/api/encounters/{eid}").json()["photos"][0] == photo


def photo_files(settings, pid):
    return list(Path(settings.data_dir).rglob(f"photo_{pid}*"))


def test_delete_hides_the_photo_and_keeps_its_file_until_signing(client, settings):
    eid = start(client)
    old = add_photo(client, eid)
    new = add_photo(client, eid, hint="Left ear canal, closer")  # a retake
    patch(client, eid, old["id"], show_owner=True)
    r = client.delete(f"/api/encounters/{eid}/photos/{old['id']}")
    assert [p["id"] for p in r.json()["photos"]] == [new["id"]]
    assert old["id"] not in client.get(f"/api/encounters/{eid}").text
    assert client.get(f"/api/encounters/{eid}/photos/{old['id']}").status_code == 404
    assert client.delete(f"/api/encounters/{eid}/photos/{old['id']}").status_code == 404
    assert patch(client, eid, old["id"], label="x").status_code == 404
    assert photo_files(settings, old["id"])  # kept until signing

    # Undo puts it back in its place, edits and all.
    back = client.post(f"/api/encounters/{eid}/photos/{old['id']}/restore").json()
    assert [p["id"] for p in back["photos"]] == [old["id"], new["id"]]
    assert back["photos"][0]["show_owner"] is True
    assert (
        client.post(f"/api/encounters/{eid}/photos/{old['id']}/restore").status_code
        == 404
    )

    # Deleted again, then signed: out of the summary and the write back, file purged.
    client.delete(f"/api/encounters/{eid}/photos/{old['id']}")
    signed = sign(client, eid)
    assert "1 photo(s)" in signed["write_back"]["detail"]
    assert not photo_files(settings, old["id"]) and photo_files(settings, new["id"])
    summary = client.get(f"/api/encounters/{eid}/summary").json()
    assert summary["pets"][0]["photos"] == []
    assert (
        client.post(f"/api/encounters/{eid}/photos/{old['id']}/restore").status_code
        == 409
    )
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    actions = [a["action"] for a in audit]
    assert actions.count("photo_deleted") == 2 and "photo_restored" in actions
    purged = next(a for a in audit if a["action"] == "deleted_photos_purged")
    assert purged["detail"] == {"photos": [old["id"]]}


def test_signed_visits_lock_their_photos(client):
    eid = start(client)
    photo = add_photo(client, eid)
    assert sign(client, eid)["encounter"]["status"] == "signed"
    r = patch(client, eid, photo["id"], label="Changed")
    assert r.status_code == 409 and "signed" in r.json()["detail"]
    assert (
        client.delete(f"/api/encounters/{eid}/photos/{photo['id']}").status_code == 409
    )
    assert patch(client, eid, "nope", label="x").status_code == 404


def test_photos_left_out_of_the_note_skip_the_draft_and_the_write_back(
    client, settings
):
    eid = start(client)
    add_photo(client, eid, hint="Left ear canal")
    left_out = add_photo(client, eid, hint="Owner's sofa")
    patch(client, eid, left_out["id"], in_note=False)
    enc = Store(settings.data_dir, settings.database_url).get(eid)
    context = build_context(_appt(client), [], enc, [])
    assert "Left ear canal" in context and "Owner's sofa" not in context
    signed = sign(client, eid)
    assert "1 photo(s)" in signed["write_back"]["detail"]


def _appt(client):
    from blinqscribe.schemas import Appointment

    raw = next(a for a in client.get("/api/schedule").json() if a["id"] == "appt-1")
    return Appointment.model_validate(raw)


def test_owner_summary_shows_only_chosen_photos_without_outlines(client):
    eid = start(client)
    shown = add_photo(client, eid, hint="Left ear <script>alert(1)</script>")
    hidden = add_photo(client, eid, hint="Back molar")
    patch(
        client,
        eid,
        shown["id"],
        caption="Red & swollen canal",
        show_owner=True,
        rotation=180,
        crop={"x": 0, "y": 0, "w": 0.5, "h": 1},
    )
    sign(client, eid)
    summary = client.get(f"/api/encounters/{eid}/summary").json()
    [photo] = summary["pets"][0]["photos"]
    assert photo["id"] == shown["id"] and hidden["id"] != photo["id"]
    assert photo["caption"] == "Red & swollen canal" and photo["rotation"] == 180
    assert "outline" not in photo and "segments" not in photo
    assert "findings" not in photo

    pdf = client.get(f"/api/encounters/{eid}/summary.pdf").content
    assert pdf.count(b"/Subtype /Image") == 1 and b"/DCTDecode" in pdf
    assert b"Red & swollen canal" in pdf

    share = client.post(
        f"/api/encounters/{eid}/share", json={"channel": "text", "language": "en"}
    ).json()
    token = share["url"].rsplit("/s/", 1)[1]
    page = client.post(f"/s/{token}", data={"last_name": "Lee"})
    assert page.status_code == 200
    assert "img-src data:" in page.headers["content-security-policy"]
    html = page.text
    assert html.count("<svg") == 1 and "data:image/jpeg;base64," in html
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert "Red &amp; swollen canal" in html
    assert "Back molar" not in html


def test_old_photos_get_an_outline_from_sam():
    photo = Photo.model_validate(
        {
            "id": "p1",
            "path": "/x.jpg",
            "caption": "Ear",
            "segments": [
                {"label": "ear", "score": 0.9, "box": [0.1, 0.1, 1.02, 0.4]},
                {"label": "bad", "box": [0.5, 0.5, 0.5, 0.6]},  # empty, dropped
            ],
            "taken_at": "2026-10-31T10:00:00",
        }
    )
    assert [(r.label, r.box) for r in photo.outline] == [("ear", [0.1, 0.1, 1.0, 0.4])]
    assert photo.in_note and not photo.show_owner


def test_image_headers_and_turns():
    assert images.size(jpeg(32, 16)) == (32, 16)
    assert images.size(png(3, 2)) == (3, 2)
    assert images.size(b"GIF89a") is None
    assert images.pdf_xobject(png())[0].count(b"/Predictor 15") == 1

    def corner(rotation, px, py, crop=None):
        vw, vh, (a, b, c, d, e, f) = images.view(40, 20, crop, rotation)
        return (vw, vh), (a * px + c * py + e, b * px + d * py + f)

    # The original's top left corner after each turn, and the turned size.
    assert corner(0, 0, 0) == ((40, 20), (0, 0))
    assert corner(90, 0, 0) == ((20, 40), (20, 0))  # top left -> top right
    assert corner(180, 0, 0) == ((40, 20), (40, 20))
    assert corner(270, 0, 0) == ((20, 40), (0, 40))  # top left -> bottom left
    half = {"x": 0.5, "y": 0, "w": 0.5, "h": 1}
    assert corner(0, 20, 0, half) == ((20, 20), (0, 0))  # the crop starts at 0, 0
    assert corner(90, 20, 0, half) == ((20, 20), (20, 0))


def test_exif_orientation_is_read_and_stripped():
    assert images.orientation(exif_jpeg(orientation=6)) == 6
    assert images.orientation(exif_jpeg(orientation=8, order="II")) == 8
    assert images.orientation(jpeg()) == images.orientation(png()) == 1
    assert images.orientation(exif_jpeg(orientation=99)) == 1
    assert images.orientation(b"\xff\xd8\xff\xe1\x00\x08Exif\x00\x00") == 1
    assert images.strip_exif(exif_jpeg()) == jpeg()
    assert images.size(exif_jpeg(32, 16)) == (32, 16)  # raw pixels


def test_coordinates_are_on_the_upright_photo():
    # Raw 40 x 20 pixels, EXIF 6: displayed 20 wide and 40 tall.
    def where(px, py, crop=None, rotation=0):
        vw, vh, (a, b, c, d, e, f) = images.view(40, 20, crop, rotation, 6)
        return (vw, vh), (a * px + c * py + e, b * px + d * py + f)

    assert where(0, 0) == ((20, 40), (20, 0))  # raw top left -> displayed top right
    assert where(40, 0) == ((20, 40), (20, 40))
    # The top half of the displayed photo, then the vet's quarter turn.
    top = {"x": 0, "y": 0, "w": 1, "h": 0.5}
    assert where(0, 0, top) == ((20, 20), (20, 0))
    assert where(0, 0, top, 90) == ((20, 20), (20, 20))
    # SAM's raw-pixel box is turned upright for the outline.
    assert images.upright_box([0.0, 0.0, 0.5, 0.25], 6) == [0.75, 0.0, 1.0, 0.5]


def test_a_phone_photo_keeps_its_orientation_through_to_the_owner(client):
    eid = start(client)
    photo = add_photo(client, eid, data=exif_jpeg(40, 20, 6))
    assert photo["source_orientation"] == 6
    raw = client.get(f"/api/encounters/{eid}/photos/{photo['id']}").content
    assert images.orientation(raw) == 6  # the original is served untouched
    patch(client, eid, photo["id"], show_owner=True)
    sign(client, eid)
    pdf = client.get(f"/api/encounters/{eid}/summary.pdf").content
    assert b"/Width 40 /Height 20" in pdf and b"Exif" not in pdf
    share = client.post(
        f"/api/encounters/{eid}/share", json={"channel": "text", "language": "en"}
    ).json()
    page = client.post(
        f"/s/{share['url'].rsplit('/s/', 1)[1]}", data={"last_name": "Lee"}
    )
    assert 'viewBox="0 0 20.0 40.0"' in page.text  # drawn upright


def test_uploads_are_typed_by_their_bytes_and_size_capped(client, settings):
    eid = start(client)

    def upload(name, data):
        return client.post(
            f"/api/encounters/{eid}/photos", files={"file": (name, data, "image/jpeg")}
        )

    refused = upload("notes.jpg", b"<html>not a photo</html>")
    assert refused.status_code == 415
    assert refused.json()["detail"] == "Use a JPEG or PNG photo."
    huge = upload("huge.jpg", jpeg(10_000, 6_000))  # 60 megapixels
    assert huge.status_code == 413 and "50 megapixels" in huge.json()["detail"]
    assert upload("ear.exe", png()).status_code == 200
    heic = b"\0\0\0\x18ftypheic" + b"\0" * 64  # an iPhone's own format
    assert upload("ear.heic", heic).status_code == 415
    assert upload("ear.webp", b"RIFF\0\0\0\0WEBPVP8 ").status_code == 415
    stored = sorted(p.suffix for p in Path(settings.data_dir).rglob("photo_*"))
    assert stored == [".png"]


def test_a_damaged_image_is_left_out_of_the_pdf(client, monkeypatch):
    eid = start(client)
    short_ihdr = (
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", 8)
        + b"IHDR"
        + struct.pack(">II", 4, 4)
        + b"\0\0\0\0"
    )
    bad = add_photo(client, eid, data=short_ihdr)
    good = add_photo(client, eid)
    for photo in (bad, good):
        patch(client, eid, photo["id"], show_owner=True)
    sign(client, eid)
    pdf = client.get(f"/api/encounters/{eid}/summary.pdf")
    assert pdf.status_code == 200 and pdf.content.count(b"/Subtype /Image") == 1

    def broken(data):
        raise IndexError("truncated")

    monkeypatch.setattr(images, "pdf_xobject", broken)
    pdf = client.get(f"/api/encounters/{eid}/summary.pdf")
    assert pdf.status_code == 200 and b"/Subtype /Image" not in pdf.content


def test_deleted_photos_of_unsigned_visits_go_after_30_days(client, settings):
    import json
    from datetime import UTC, datetime, timedelta

    from blinqscribe import photos

    eid = start(client)
    old, recent = add_photo(client, eid), add_photo(client, eid)
    for photo in (old, recent):
        client.delete(f"/api/encounters/{eid}/photos/{photo['id']}")
    store = Store(settings.data_dir, settings.database_url)
    items = photos.removed(store, eid)
    items[old["id"]]["deleted_at"] = (
        datetime.now(UTC) - timedelta(days=31)
    ).isoformat()
    store.set_meta(f"removed_photos:{eid}", json.dumps(items))

    # The daily cleanup job (in the server, or Temporal's activity) runs it.
    import anyio

    from blinqscribe.jobs import Activities, Services

    activities = Activities(Services.from_settings(settings))
    assert anyio.run(activities.expire_remember) == 1
    assert not photo_files(settings, old["id"]) and photo_files(settings, recent["id"])
    assert set(photos.removed(store, eid)) == {recent["id"]}
    assert (
        client.post(f"/api/encounters/{eid}/photos/{old['id']}/restore").status_code
        == 404
    )
    assert (
        client.post(f"/api/encounters/{eid}/photos/{recent['id']}/restore").status_code
        == 200
    )
    assert json.loads(store.get_meta("removed_photos")) == []  # nothing left to watch
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    assert {"photos": [old["id"]]} in [
        a["detail"] for a in audit if a["action"] == "deleted_photos_purged"
    ]


def test_adobe_cmyk_jpegs_are_not_drawn_as_negatives():
    decode = b"/Decode [1 0 1 0 1 0 1 0]"
    adobe = images.pdf_xobject(jpeg(components=4, adobe=True))[0]
    assert b"/DeviceCMYK" in adobe and decode in adobe
    plain_cmyk = images.pdf_xobject(jpeg(components=4))[0]
    assert b"/DeviceCMYK" in plain_cmyk and decode not in plain_cmyk
    rgb = images.pdf_xobject(jpeg(adobe=True))[0]
    assert b"/DeviceRGB" in rgb and decode not in rgb
