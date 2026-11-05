"""The referral letter PDF: letterhead, details, body, signature, and what goes
along as pages, received PDFs merged in. Also: photos are made small in PDFs."""

import io
from datetime import date, datetime

from PIL import Image
from pypdf import PdfReader, PdfWriter

from blinqscribe import pdf
from blinqscribe.letter_pdf import (
    FileAttachment,
    InvoiceAttachment,
    LetterPdf,
    NoteAttachment,
    PhotoAttachment,
    render,
)


def _photo(w=4000, h=3000):
    """A phone-sized JPEG (12 MP, grainy, saved at high quality), about 4 MB."""
    base = Image.radial_gradient("L").resize((w, h))
    grain = Image.effect_noise((w, h), 12)
    img = Image.merge("RGB", (base, Image.blend(base, grain, 0.3), grain))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=95)
    return out.getvalue()


def _received(pages=2):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(612, 792)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _letter(**changes):
    letter = LetterPdf(
        kind="referral",
        clinic={
            "name": "Maple Street Animal Hospital",
            "address": "120 Maple Street, Austin, TX",
            "phone": "(555) 010-4400",
        },
        recipient=["Dr. Priya Shah", "Lakeside Veterinary Dermatology"],
        date=date(2026, 10, 30),
        how_soon="routine",
        patient=["Biscuit", "Golden Retriever", "6 years", "male neutered", "74 lb"],
        owner=["Jordan Lee", "(555) 014-2231"],
        owner_consent=True,
        referring_vet="Dr. Ana Rivera, DVM",
        paragraphs=["Dear Dr. Shah,", "Thank you for seeing Biscuit."],
        signer="Dr. Ana Rivera, DVM",
        signed_at=datetime(2026, 10, 30, 9, 52),
        attachments=[
            NoteAttachment(
                "Visit note, Oct 30, 2026 (signed)",
                [("Subjective", "Head shaking for a week."), ("Plan", "Recheck.")],
                ["Cefpodoxime 100 mg once a day"],
                "Signed by Dr. Ana Rivera, DVM",
            ),
            PhotoAttachment(
                "Exam photo, right ear canal, with outline",
                _photo(),
                {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8},
                90,
                [{"label": "Redness", "box": [0.3, 0.3, 0.6, 0.6], "polygon": []}],
                "Red, swollen canal.",
            ),
            FileAttachment(
                "Antech lab results, Jun 25, 2026", _received(), "application/pdf"
            ),
        ],
    )
    for key, value in changes.items():
        setattr(letter, key, value)
    return letter


def _text(data):
    return [page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages]


def test_the_letter_page_has_everything_on_the_board():
    first = _text(render(_letter()))[0]
    for expected in (
        "Maple Street Animal Hospital",
        "120 Maple Street, Austin, TX · (555) 010-4400",
        "REFERRAL",
        "Dr. Priya Shah",
        "Oct 30, 2026",
        "How soon: routine",
        "Biscuit · Golden Retriever · 6 years · male neutered · 74 lb",
        "Jordan Lee · (555) 014-2231 · agreed to share these records",
        "Dr. Ana Rivera, DVM",
        "Dear Dr. Shah,",
        "Thank you for seeing Biscuit.",
        "1. Visit note, Oct 30, 2026 (signed)",
        "2. Exam photo, right ear canal, with outline",
        "3. Antech lab results, Jun 25, 2026",
        "signed Oct 30, 2026, 9:52 AM",
        "Page 1 of 5 · with attachments",
        "Confidential medical record, shared with the owner's consent. "
        "Questions: call (555) 010-4400.",
    ):
        assert expected in first, expected


def test_attachments_follow_as_pages_and_received_pdfs_merge_in():
    data = render(_letter())
    pages = _text(data)
    # letter, note, photo, then the lab's two pages as they are
    assert len(pages) == 5
    assert "Attachment 1: Visit note" in pages[1] and "Cefpodoxime" in pages[1]
    assert "Attachment 2: Exam photo" in pages[2] and "Redness" in pages[2]
    assert "Page 3 of 5" in pages[2]
    # Each received page says what it is, with the page number and footer.
    for number, page in ((4, pages[3]), (5, pages[4])):
        assert (
            "Attachment 3: Antech lab results, Jun 25, 2026 (received document)" in page
        )
        assert f"Page {number} of 5" in page and "Confidential medical record" in page
        assert "Maple Street Animal Hospital Referral" in page  # the running header
    first = _text(data)[0]
    assert "Page 1 of 5 · with attachments" in first


def test_a_broken_received_file_is_a_note_not_a_failure():
    letter = _letter(
        attachments=[
            FileAttachment("Old x-ray", b"%PDF-1.4 not really", "application/pdf")
        ]
    )
    pages = _text(render(letter))
    assert len(pages) == 2 and "couldn't be included" in pages[1]


def test_text_is_escaped():
    sneaky = "Owner (said) \\ ) Tj ET BT /F1 99 Tf (hello"
    pages = _text(render(_letter(paragraphs=[sneaky], attachments=[])))
    assert len(pages) == 1 and sneaky in pages[0]


def test_a_draft_says_so():
    first = _text(render(_letter(signer="", signed_at=None, draft=True)))[0]
    assert "REFERRAL (DRAFT)" in first and "Not signed yet" in first


def test_photos_are_made_small():
    big = _photo()
    assert len(big) > 3_000_000
    assert len(render(_letter())) < 300_000
    summary = pdf.render(
        {"name": "Maple Street", "address": "", "phone": ""},
        [("image", "p1")],
        photos={"p1": (big, None, 0)},
    )
    assert len(summary) < 300_000


def test_an_invoice_is_a_table_of_items():
    invoice = InvoiceAttachment(
        "Invoice, Oct 30, 2026",
        [("Ear cytology", 1, 45.0), ("Cefpodoxime 100 mg", 7, 3.5), ("Exam", 1, None)],
        69.5,
    )
    pages = _text(render(_letter(attachments=[invoice])))
    assert len(pages) == 2
    for expected in ("Attachment 1: Invoice, Oct 30, 2026", "Ear cytology", "$45.00"):
        assert expected in pages[1], expected
    assert "Total" in pages[1] and "$69.50" in pages[1]


def test_a_received_page_stays_readable_under_its_stamp():
    lab = io.BytesIO()
    page = Image.new("RGB", (850, 1100), "white")
    from PIL import ImageDraw

    ImageDraw.Draw(page).text((60, 60), "CYTOLOGY RESULT", fill="black")
    page.save(lab, "PDF", resolution=100)  # a Letter page, drawn edge to edge
    letter = _letter(
        attachments=[FileAttachment("Lab result", lab.getvalue(), "application/pdf")]
    )
    received = PdfReader(io.BytesIO(render(letter))).pages[1]
    assert (float(received.mediabox.width), float(received.mediabox.height)) == (
        612,
        792,
    )
    assert "Attachment 1: Lab result (received document)" in received.extract_text()
