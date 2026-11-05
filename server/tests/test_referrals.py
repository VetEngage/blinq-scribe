"""Letters the clinic sends (requirement 61): referral, records and owner letters,
Blinq's draft under the letter rules, owner consent, sign and send in one step, the
channels, opened, saved contacts, roles, and the owner's and specialist's pages."""

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any

import anyio
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from blinqscribe import mailer as mailer_module
from blinqscribe import pdf
from blinqscribe.accounts import Caller, User
from blinqscribe.api import create_app
from blinqscribe.referrals import (
    Attachments,
    LetterError,
    LetterFields,
    PhotoRef,
    Recipient,
    TooManySends,
    guard_doses,
)
from blinqscribe.schemas import Client, FollowUp, FollowUpKind

VET = Caller(via="open")
SPECIALIST = Recipient(
    name="Dr. Priya Shah", clinic="Lakeside Dermatology", email="priya@lakeside.test"
)


def _client(settings: Any, **changes: Any) -> TestClient:
    return TestClient(
        create_app(replace(settings, sms_mode="preview", **changes)),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


@pytest.fixture
def client(settings: Any) -> TestClient:
    return _client(settings)


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    out: list[EmailMessage] = []

    async def fake_send(msg: EmailMessage, **_: Any) -> None:
        out.append(msg)

    monkeypatch.setattr(mailer_module.aiosmtplib, "send", fake_send)
    return out


def _letters(client: TestClient) -> Any:
    return client.app.state.letters  # type: ignore[attr-defined]


def _person(role: str, provider_id: str = "") -> Caller:
    user = User(
        id=f"u-{role}-{provider_id}",
        username=f"{role}{provider_id}".replace("_", "."),
        name=f"{role.title()} {provider_id}".strip(),
        role=role,  # type: ignore[arg-type]
        provider_id=provider_id,
        created_at=datetime.now(UTC),
    )
    return Caller(via="session", user=user)


def _visit(client: TestClient, sign: bool = True) -> str:
    eid = str(
        client.post(
            "/api/encounters",
            json={"appointment_id": "appt-1", "consent_recorded": True},
        ).json()["id"]
    )
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    if sign:
        client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    return eid


REASON = "Second ear infection this year. Please assess for an underlying allergy."


def _new(client: TestClient, who: Caller = VET, **fields: Any) -> Any:
    """A drafted referral from a visit, ready to send once confirmed."""
    letters = _letters(client)
    eid = fields.pop("encounter_id", None) or _visit(client)
    given = {"recipient": SPECIALIST, "reason": REASON, **fields}
    letter = anyio.run(letters.create, who, "", eid, LetterFields(**given))
    body = letter.body.replace("[confirm:", "(checked:")
    return anyio.run(
        letters.update, who, letter.id, LetterFields(body=body, owner_consent=True)
    )


def _send(client: TestClient, letter: Any, *channels: str, **kw: Any) -> Any:
    return anyio.run(
        lambda: _letters(client).send(
            kw.pop("who", VET),
            letter.id,
            list(channels),
            kw.pop("to_email", ""),
            kw.pop("owner_copy", False),
            "http://localhost/",
        )
    )


@pytest.fixture
def audits(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    store = _letters(client).store
    seen: list[str] = []
    real = store.audit

    def record(actor: str, action: str, *rest: Any) -> None:
        seen.append(action)
        real(actor, action, *rest)

    monkeypatch.setattr(store, "audit", record)
    return seen


# ---------- creating: kinds and what goes along ----------
def test_a_letter_from_a_visit_is_drafted_with_its_signed_note(client, audits):
    eid = _visit(client)
    letters = _letters(client)
    letter = anyio.run(
        letters.create, VET, "", eid, LetterFields(recipient=SPECIALIST, reason=REASON)
    )
    assert letter.kind == "referral" and letter.status == "draft"
    assert letter.attachments.note_encounter_ids == [eid]
    assert letter.attachments.invoice_ids == []  # never by default
    assert letter.drafted == "mock" and letter.body.startswith("Dear Dr. Priya Shah,")
    assert REASON in letter.body  # the vet's reason, word for word
    assert letter.reason == REASON
    assert {"letter_created", "letter_drafted"} <= set(audits)


def test_records_and_owner_letters(client):
    letters = _letters(client)
    records = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(kind="records", recipient=SPECIALIST, reason="Moving to Denver."),
    )
    assert "Biscuit's records attached, sent at Jordan Lee's request" in records.body
    owner = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(kind="owner", reason="Biscuit is fit to fly."),
    )
    assert owner.recipient.name == "Jordan Lee"
    assert owner.recipient.email == "jordan@example.com"
    assert (
        owner.body.startswith("Dear Jordan,") and "Biscuit is fit to fly." in owner.body
    )


def test_attachments_any_signed_visit_photos_records_and_invoices(client):
    letters = _letters(client)
    first, second = _visit(client), _visit(client)
    record = pdf.render({"name": "Lab", "address": "", "phone": ""}, [("text", "CBC")])
    doc = anyio.run(letters.documents.add, "pat-1", "Antech lab results.pdf", record)
    att = Attachments(
        note_encounter_ids=[first, second],
        document_ids=[doc["id"]],
        invoice_ids=["inv-1001"],
    )
    letter = anyio.run(
        letters.create, VET, "pat-1", "", LetterFields(attachments=att), False
    )
    names = letters.attachment_names(letter)
    assert sum(n.startswith("Visit note") for n in names) == 2
    assert "Antech lab results.pdf" in names and "Invoice inv-1001" in names
    for bad, message in (
        (Attachments(invoice_ids=["inv-2001"]), "invoice"),  # another pet's
        (Attachments(photos=[PhotoRef(encounter_id=first, photo_id="x")]), "photo"),
        (Attachments(document_ids=["nope"]), "record"),
        (Attachments(note_encounter_ids=[_visit(client, sign=False)]), "signed note"),
    ):
        with pytest.raises(LetterError, match=message):
            anyio.run(letters.update, VET, letter.id, LetterFields(attachments=bad))


def test_the_recipient_email_is_strict(client):
    letters = _letters(client)
    letter = anyio.run(letters.create, VET, "pat-1", "", LetterFields(), False)
    for bad in (
        "kim@",
        "Kim <k@v.test>",
        "k:x@v.test",
        "k@v.test\x00",
        "a@b.test,c@d.test",
    ):
        with pytest.raises(LetterError, match="email address"):
            anyio.run(
                letters.update,
                VET,
                letter.id,
                LetterFields(recipient=Recipient(name="K", email=bad)),
            )


# ---------- the letter rules ----------
def test_outside_records_are_credited_never_presented_as_ours(client):
    letters = _letters(client)
    record = pdf.render({"name": "Derm", "address": "", "phone": ""}, [("text", "x")])
    doc = anyio.run(
        letters.documents.add, "pat-1", "Lakeside Dermatology letter.pdf", record
    )
    letters.store.run(
        "UPDATE documents SET body = ? WHERE id = ?",
        (
            letters.store.run("SELECT body FROM documents WHERE id = ?", (doc["id"],))[
                0
            ][0].replace(
                '"key_points": []',
                '"key_points": [{"text": "Dust mite allergy.", "page": 3}]',
            ),
            doc["id"],
        ),
    )
    eid = _visit(client)
    letter = anyio.run(
        letters.create,
        VET,
        "",
        eid,
        LetterFields(
            recipient=SPECIALIST,
            reason=REASON,
            attachments=Attachments(note_encounter_ids=[eid], document_ids=[doc["id"]]),
        ),
    )
    assert "Your letter" in letter.body and "noted: Dust mite allergy." in letter.body


def test_the_muse_draft_follows_the_rules(client, monkeypatch):
    letters = _letters(client)
    eid = _visit(client)  # drafted with the mock, before Muse is switched on
    asked: dict[str, str] = {}

    async def fake(system: str, user: str, schema: Any, **_: Any) -> Any:
        asked.update(system=system, user=user)
        return schema(
            body="Dear Dr. Shah,\n\nStart prednisolone 5 mg.\n\nKind regards,"
        )

    monkeypatch.setattr(letters.muse, "enabled", True)
    monkeypatch.setattr(letters.muse, "structured", fake)
    letter = anyio.run(
        letters.create,
        VET,
        "",
        eid,
        LetterFields(recipient=SPECIALIST, reason=REASON),
    )
    assert letter.drafted == "muse"
    assert "[confirm: prednisolone] [confirm: 5 mg]" in letter.body
    system = " ".join(asked["system"].split())
    assert "never write them as this clinic's findings" in system
    assert "Never add a finding, diagnosis, recommendation" in system
    assert f"Vet's reason: {REASON}" in asked["user"]
    assert "Cefpodoxime 100 mg" in asked["user"]  # the signed note is a source


def test_the_dose_guard_checks_drugs_units_and_pairs():
    sources = "Plan: Cefpodoxime 100 mg once a day. Weight 12 kg. KCl 20 mEq."
    out = guard_doses(
        "Cefpodoxime 100 mg. Meloxicam 100 mg. Weight 12 kg. Give 2 tablets, 5 cc.",
        sources,
        ["Cefpodoxime 100 mg tablets"],
    )
    assert "Cefpodoxime 100 mg." in out and "Weight 12 kg" in out
    assert "[confirm: Meloxicam] [confirm: 100 mg]" in out
    assert "[confirm: 2 tablets]" in out and "[confirm: 5 cc]" in out


# ---------- sign and send, one step ----------
def test_send_signs_and_locks_it(client, audits):
    letter = _new(client)
    out = _send(client, letter, "print")
    assert out["results"][0]["status"] == "ready"
    done = out["letter"]
    assert done.status == "sent" and done.signed_at and done.sent_to == ["printed"]
    letters = _letters(client)
    with pytest.raises(LetterError, match="can't be changed"):
        anyio.run(letters.update, VET, letter.id, LetterFields(reason="other"))
    with pytest.raises(LetterError, match="can't be deleted"):
        anyio.run(letters.delete, VET, letter.id)
    assert "letter_signed" in audits and "letter_sent" in audits


def test_nothing_goes_out_with_confirms_or_without_consent(client):
    letters = _letters(client)
    letter = anyio.run(
        letters.create,
        VET,
        "",
        _visit(client),
        LetterFields(
            recipient=SPECIALIST, reason=REASON, body="Dear Dr. Shah, [confirm: weight]"
        ),
        False,
    )
    with pytest.raises(LetterError, match="confirm"):
        _send(client, letter, "print")
    anyio.run(letters.update, VET, letter.id, LetterFields(body="Dear Dr. Shah,"))
    with pytest.raises(LetterError, match="Record that the owner agreed"):
        _send(client, letter, "print")
    assert letters.get(letter.id).status == "draft"  # still editable
    owner = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(kind="owner", reason="Fit to fly.", body="Dear Jordan,"),
        False,
    )
    assert _send(client, owner, "print")["letter"].status == "sent"  # no consent needed


def test_email_in_demo_mode_is_a_preview(client, sent):
    letter = _new(client)
    out = _send(client, letter, "email")
    [result] = out["results"]
    assert result["status"] == "preview" and result["to"] == "priya@lakeside.test"
    assert (
        result["subject"]
        == "Referral for Biscuit from Maple Street Animal Hospital (demo)"
    )
    assert "View it online: http://localhost/l/" in result["body"] and not sent


def test_demo_emails_go_only_to_the_demo_address(settings, sent):
    client = _client(
        settings, email_smtp_host="smtp.test", demo_email_to="demo@blinq.test"
    )
    letter = _new(client)
    [result] = _send(client, letter, "email")["results"]
    assert result["status"] == "sent" and "demo address" in result["detail"]
    assert [m["To"] for m in sent] == ["demo@blinq.test"]


def test_email_goes_to_the_specialist_with_one_pdf(settings, sent):
    client = _client(
        settings, email_smtp_host="smtp.test", public_url="https://scribe.test"
    )
    letters = _letters(client)
    letters.demo = False
    letter = _new(client)
    out = _send(client, letter, "email", to_email="Front@Lakeside.test")
    assert out["results"][0]["status"] == "sent"
    assert sent[0]["To"] == "front@lakeside.test"
    [pdf_part] = list(sent[0].iter_attachments())
    assert pdf_part.get_content_type() == "application/pdf"
    assert pdf_part.get_content().startswith(b"%PDF")
    assert out["letter"].recipient.email == "front@lakeside.test"
    assert "https://scribe.test/l/" in out["results"][0]["url"]


def test_owner_channels_and_the_owner_copy(client):
    letter = _new(client)
    out = _send(client, letter, "email", owner_copy=True)
    assert [r["channel"] for r in out["results"]] == ["email", "owner_text"]
    text = out["results"][1]
    assert text["status"] == "preview" and "/r/" in text["url"]
    assert "Second ear" not in text["text"]  # nothing medical in the text
    again = _send(client, letter, "owner_email", "print")
    assert [r["channel"] for r in again["results"]] == ["owner_email", "print"]
    assert again["results"][0]["to"] == "jordan@example.com"
    assert len(again["letter"].sent_to) == 4


def test_resending_is_logged(client):
    letter = _new(client)
    _send(client, letter, "print")
    again = _send(client, letter, "print")["letter"]
    assert len(again.sent) == 2 and again.status == "sent"


# ---------- opened ----------
def test_the_owner_page_marks_it_opened_and_gives_the_pdf(client):
    letter = _new(client)
    url = _send(client, letter, "owner_text")["results"][0]["url"]
    path = "/r/" + url.rsplit("/r/", 1)[1]
    assert client.get(path).status_code == 200
    assert client.post(path, data={"last_name": "Smith"}).status_code == 401
    page = client.post(path, data={"last_name": " lee "})
    assert page.status_code == 200 and "Biscuit" in page.text
    assert "default-src 'none'" in page.headers["content-security-policy"]
    assert _letters(client).get(letter.id).status == "opened"
    pdf_file = client.post(path + "/pdf", data={"last_name": "Lee"})
    assert pdf_file.content.startswith(b"%PDF")
    assert client.post(path + "/pdf", data={"last_name": "x"}).status_code == 401


def test_the_specialists_link_marks_it_opened(client, audits):
    letter = _new(client)
    url = _send(client, letter, "email")["results"][0]["url"]
    path = "/l/" + url.rsplit("/l/", 1)[1]
    page = client.get(path)
    assert page.status_code == 200 and "Dear Dr. Priya Shah" in page.text
    assert _letters(client).get(letter.id).status == "opened"
    assert "letter_opened" in audits
    assert client.get(path + "/pdf").content.startswith(b"%PDF")
    # A specialist token is not an owner link, and the other way round.
    assert client.get("/r/" + path.rsplit("/", 1)[1]).status_code == 404


def test_links_expire_and_lock(client, audits):
    letter = _new(client)
    url = _send(client, letter, "owner_text")["results"][0]["url"]
    path = "/r/" + url.rsplit("/r/", 1)[1]
    for _ in range(5):
        client.post(path, data={"last_name": "wrong"})
    assert client.post(path, data={"last_name": "Lee"}).status_code == 423
    assert "letter_link_locked" in audits
    url = _send(client, letter, "owner_text")["results"][0]["url"]
    token = url.rsplit("/r/", 1)[1]
    _letters(client).store.run(
        "UPDATE letter_links SET expires_at = ? WHERE token = ?",
        ((datetime.now(UTC) - timedelta(seconds=1)).isoformat(), token),
    )
    assert client.get(f"/r/{token}").status_code == 410


# ---------- saved contacts ----------
def test_saved_contacts_come_from_sent_letters(client):
    letters = _letters(client)
    assert letters.contacts() == []
    _send(client, _new(client), "print")
    _new(client, recipient=Recipient(name="Dr. Draft", email="d@x.test"))  # a draft
    [contact] = letters.contacts()
    assert contact.email == "priya@lakeside.test"
    assert letters.contacts("lakeside") == [contact] and letters.contacts("zzz") == []


# ---------- roles ----------
def test_who_may_create_send_and_resend(client, audits):
    letters = _letters(client)
    eid = _visit(client)  # Dr. Ana Rivera's (prov-1)
    for who in (_person("front_office"), _person("vet", "prov-2"), _person("admin")):
        with pytest.raises(HTTPException) as refused:
            anyio.run(letters.create, who, "", eid, LetterFields())
        assert refused.value.status_code == 403
    ana = _person("vet", "prov-1")
    letter = _new(client, who=ana, encounter_id=eid)
    with pytest.raises(HTTPException):  # front office never signs
        _send(client, letter, "print", who=_person("front_office"))
    _send(client, letter, "print", who=ana)
    # Once a vet sent it: front office and admins may resend; another vet may not.
    _send(client, letter, "print", who=_person("front_office"))
    _send(client, letter, "print", who=_person("admin"))
    with pytest.raises(HTTPException):
        _send(client, letter, "print", who=_person("vet", "prov-2"))
    assert "refused" in audits


def test_a_record_letter_belongs_to_the_vet_who_started_it(client):
    letters = _letters(client)
    ana, sam = _person("vet", "prov-1"), _person("vet", "prov-2")
    letter = anyio.run(letters.create, ana, "pat-1", "", LetterFields(), False)
    assert letter.owner_provider_id == "prov-1"
    with pytest.raises(HTTPException):
        anyio.run(letters.update, sam, letter.id, LetterFields(reason="x"))
    with pytest.raises(HTTPException, match="Only a provider can write a letter"):
        anyio.run(letters.create, _person("admin"), "pat-1", "", LetterFields())


# ---------- REST, as the API table lists it ----------
def test_rest_letters(client):
    eid = _visit(client)
    start = client.post(
        "/api/patients/pat-1/letters",
        json={
            "kind": "referral",
            "encounter_id": eid,
            "recipient": SPECIALIST.model_dump(),
            "reason": REASON,
        },
    )
    assert start.status_code == 200, start.text
    letter = start.json()
    assert letter["drafted"] == "mock" and letter["kind"] == "referral"
    listed = client.get("/api/patients/pat-1/letters").json()
    assert [x["id"] for x in listed] == [letter["id"]]
    body = letter["body"].replace("[confirm:", "(checked:")
    put = client.put(
        f"/api/letters/{letter['id']}", json={"body": body, "owner_consent": True}
    )
    assert put.status_code == 200 and put.json()["owner_consent"] is True
    bad = client.post(f"/api/letters/{letter['id']}/send", json={"channels": ["fax"]})
    assert bad.status_code == 400
    out = client.post(
        f"/api/letters/{letter['id']}/send", json={"channels": ["print", "email"]}
    )
    assert out.status_code == 200, out.text
    assert out.json()["letter"]["status"] == "sent"
    assert client.get(f"/api/letters/{letter['id']}.pdf").content.startswith(b"%PDF")


# ---------- safety: races, limits, links ----------
def test_a_draft_never_overwrites_a_letter_sent_meanwhile(client, monkeypatch):
    letters = _letters(client)
    letter = _new(client)

    async def slow_muse(system: str, user: str, schema: Any, **_: Any) -> Any:
        await letters.send(VET, letter.id, ["print"], "", False, "http://x/")
        return schema(body="Body B, never reviewed.")

    monkeypatch.setattr(letters.muse, "enabled", True)
    monkeypatch.setattr(letters.muse, "structured", slow_muse)
    with pytest.raises(LetterError, match="changed while drafting"):
        anyio.run(letters.draft, VET, letter.id)
    assert letters.get(letter.id).status == "sent"


def test_sends_at_the_same_moment_are_both_logged(client, monkeypatch):
    letters = _letters(client)
    letter = _new(client)
    _send(client, letter, "print")
    real = letters.texter.send_text

    async def slow_text(text: str, appt: Any) -> Any:
        await anyio.sleep(0.05)
        return await real(text, appt)

    monkeypatch.setattr(letters.texter, "send_text", slow_text)

    async def both() -> None:
        async with anyio.create_task_group() as tg:
            for _ in range(2):
                tg.start_soon(
                    letters.send, VET, letter.id, ["owner_text"], "", False, "http://x/"
                )

    anyio.run(both)
    assert len(letters.get(letter.id).sent) == 3


def test_refused_sends_dont_count_and_sends_are_limited(client):
    letter = _new(client, recipient=Recipient(name="Dr. Shah"))  # no email
    for _ in range(8):
        with pytest.raises(LetterError, match="email address"):
            _send(client, letter, "email")
    for _ in range(5):
        _send(client, letter, "print")
    with pytest.raises(TooManySends):
        _send(client, letter, "print")


def test_owner_links_need_a_last_name_and_the_public_url(client, monkeypatch):
    letters = _letters(client)
    letter = _new(client)

    async def no_name(_: Any) -> Any:
        return Client(id="c", first_name="Sam", last_name="-- 42 --"), None

    monkeypatch.setattr(letters, "_owner", no_name)
    with pytest.raises(LetterError, match="last name"):
        _send(client, letter, "owner_text")
    monkeypatch.undo()
    letters.demo = False
    with pytest.raises(LetterError, match="BLINQ_SCRIBE_PUBLIC_URL"):
        _send(client, letter, "owner_text")
    assert not letters.store.run("SELECT 1 FROM letter_links")


# ---------- the referral follow up ----------
def test_a_referral_follow_up_offers_a_letter():
    refer = FollowUp(kind=FollowUpKind.task, reason="Refer to cardiology for an echo")
    plain = FollowUp(kind=FollowUpKind.task, reason="Call with lab results")
    assert refer.suggest_letter and not plain.suggest_letter
    assert re.search(r'"suggest_letter":\s*true', refer.model_dump_json())


def test_a_vet_who_also_manages_the_team_writes_their_own_letters(client):
    """One login with both: role admin, linked to their provider."""
    both = _person("admin", "prov-1")
    assert both.admin
    letter = _new(client, who=both)
    assert _send(client, letter, "print", who=both)["letter"].status == "sent"


# ---------- what a caller may see is all they may attach ----------
def _with_photo(client: TestClient, eid: str, photo_id: str, in_note: bool) -> None:
    from blinqscribe.schemas import Photo

    store = _letters(client).store
    enc = store.get(eid)
    photo = Photo(
        id=photo_id, path="/nope.jpg", taken_at=datetime.now(UTC), in_note=in_note
    )
    store.save(enc.model_copy(update={"photos": [*enc.photos, photo]}))


def test_only_visible_notes_and_photos_can_be_attached(client):
    letters = _letters(client)
    sam = _person("vet", "prov-2")  # another vet; the visits below are prov-1's
    draft_visit = _visit(client, sign=False)
    signed_visit = _visit(client)
    _with_photo(client, draft_visit, "p-draft", in_note=True)
    _with_photo(client, signed_visit, "p-hidden", in_note=False)
    _with_photo(client, signed_visit, "p-shown", in_note=True)
    letter = anyio.run(letters.create, sam, "pat-1", "", LetterFields(), False)
    for att, message in (
        (Attachments(note_encounter_ids=[draft_visit]), "That note isn't available."),
        (
            Attachments(
                photos=[PhotoRef(encounter_id=draft_visit, photo_id="p-draft")]
            ),
            "That photo isn't available.",
        ),
        (
            Attachments(
                photos=[PhotoRef(encounter_id=signed_visit, photo_id="p-hidden")]
            ),
            "That photo isn't available.",
        ),
    ):
        with pytest.raises(LetterError, match=message):
            anyio.run(letters.update, sam, letter.id, LetterFields(attachments=att))
    # A signed note's view-only parts are fine, and the visit's own vet sees all.
    ok = Attachments(
        note_encounter_ids=[signed_visit],
        photos=[PhotoRef(encounter_id=signed_visit, photo_id="p-shown")],
    )
    anyio.run(letters.update, sam, letter.id, LetterFields(attachments=ok))
    ana = _person("vet", "prov-1")
    mine = anyio.run(letters.create, ana, "pat-1", "", LetterFields(), False)
    hidden = Attachments(
        photos=[PhotoRef(encounter_id=signed_visit, photo_id="p-hidden")]
    )
    out = anyio.run(letters.update, ana, mine.id, LetterFields(attachments=hidden))
    assert out.attachments.photos[0].photo_id == "p-hidden"


def test_sending_follows_the_owner_rules(client, audits):
    letters = _letters(client)
    ana, sam = _person("vet", "prov-1"), _person("vet", "prov-2")
    front = _person("front_office")
    letter = _new(client, who=ana)
    with pytest.raises(HTTPException):  # another vet can't send it
        _send(client, letter, "print", who=sam)
    _send(client, letter, "print", who=ana)
    _send(client, letter, "print", who=ana)  # a vet resends their own
    _send(client, letter, "print", who=front)  # front office resends a vet's
    # A letter with no owning vet (made in the open demo) is nobody's to send.
    orphan = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(
            kind="owner", reason="Fit to fly.", body="Dear Jordan,", owner_consent=True
        ),
        False,
    )
    for who in (ana, front):
        with pytest.raises(HTTPException, match="no provider it belongs to"):
            _send(client, orphan, "print", who=who)
    _send(client, orphan, "print")  # the open demo itself still can
    for who in (ana, front):
        with pytest.raises(HTTPException, match="no provider it belongs to"):
            _send(client, orphan, "print", who=who)  # nor resend it
    assert audits.count("refused") >= 5


def test_the_signer_is_a_real_name_in_the_open_demo(client):
    letters = _letters(client)
    from_visit = _send(client, _new(client), "print")["letter"]
    assert from_visit.signed_by == "Dr. Ana Rivera"  # the visit's vet
    record = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(kind="owner", reason="Fit to fly.", body="Dear Jordan,"),
        False,
    )
    signed = _send(client, record, "print")["letter"]
    assert signed.signed_by == "Dr. Ana Rivera"  # the demo clinic's vet
    assert signed.signer_title == "Dr. Ana Rivera, DVM"


# ---------- security re-review ----------
def test_reading_letters_follows_the_note_rules(client):
    letters = _letters(client)
    ana, sam = _person("vet", "prov-1"), _person("vet", "prov-2")
    front, admin = _person("front_office"), _person("admin")
    draft = _new(client, who=ana)
    for who in (sam, front, admin):
        with pytest.raises(LetterError, match="wasn't found"):
            letters.readable(who, draft.id)
        assert letters.readable_for_patient(who, "pat-1") == []
        with pytest.raises(LetterError, match="wasn't found"):
            anyio.run(letters.pdf_for, who, draft.id)
    assert letters.readable(ana, draft.id).body == draft.body
    _send(client, draft, "print", who=ana)
    assert letters.readable(sam, draft.id).view == "full"  # another vet: view only
    for who in (front, admin):
        shown = letters.readable(who, draft.id)
        assert shown.view == "summary" and shown.status == "sent"
        assert shown.body == "" and shown.reason == "" and shown.recipient.email == ""
        assert shown.recipient.name == "Dr. Priya Shah" and shown.sent_to == ["printed"]
        with pytest.raises(LetterError, match="PDF is for providers") as no_pdf:
            anyio.run(letters.pdf_for, who, draft.id)
        assert no_pdf.value.status == 403


def test_a_resend_cant_go_to_a_new_address(client):
    ana, front = _person("vet", "prov-1"), _person("front_office")
    letter = _new(client, who=ana)
    _send(client, letter, "print", who=ana)
    with pytest.raises(HTTPException, match="Only the letter's provider"):
        _send(client, letter, "email", who=front, to_email="attacker@evil.example")
    out = _send(client, letter, "email", who=front)  # the letter's own address
    [result] = out["results"]
    assert result["to"] == "p•••@lakeside.test"  # its own address, masked
    assert result["url"] == "" and result["body"] == ""  # no link, no letter text
    assert out["letter"].view == "summary" and out["letter"].body == ""
    mine = _send(client, letter, "email", who=ana, to_email="desk@lakeside.test")
    assert mine["results"][0]["url"]  # the owning vet may, and sees the link
    assert mine["letter"].recipient.email == "desk@lakeside.test"


def test_an_owner_letter_emails_only_the_owner_on_file(client):
    letters = _letters(client)
    letter = anyio.run(
        letters.create,
        VET,
        "pat-1",
        "",
        LetterFields(kind="owner", reason="Fit to fly.", body="Dear Jordan,"),
        False,
    )
    out = _send(client, letter, "email", to_email="someone@else.test")
    assert out["results"][0]["to"] == "jordan@example.com"


def test_the_api_token_cant_write_letters(settings):
    client = _client(settings, api_token="secret-token")
    token = Caller(via="token")
    letters = _letters(client)
    with pytest.raises(HTTPException) as refused:
        anyio.run(letters.create, token, "pat-1", "", LetterFields(), False)
    assert refused.value.status_code == 403
    demo = anyio.run(letters.create, VET, "pat-1", "", LetterFields(), False)
    with pytest.raises(HTTPException):
        anyio.run(letters.update, token, demo.id, LetterFields(reason="x"))


def test_another_vet_reading_a_sent_letter_is_logged(client, audits):
    letters = _letters(client)
    ana, sam = _person("vet", "prov-1"), _person("vet", "prov-2")
    letter = _new(client, who=ana)
    _send(client, letter, "print", who=ana)
    letters.readable(ana, letter.id)
    assert "letter_read" not in audits  # the letter's own vet
    letters.readable(sam, letter.id)
    anyio.run(letters.pdf_for, sam, letter.id)
    assert audits.count("letter_read") == 2


def test_a_resend_by_front_office_never_returns_a_link_or_text(client):
    ana, front = _person("vet", "prov-1"), _person("front_office")
    letter = _new(client, who=ana)
    mine = _send(client, letter, "owner_text", who=ana)
    assert "/r/" in mine["results"][0]["url"]  # the letter's own vet sees it
    out = _send(
        client, letter, "owner_text", "owner_email", "print", who=front, owner_copy=True
    )
    for result in out["results"]:
        assert result["url"] == "" and result["text"] == "" and result["body"] == ""
        assert result["subject"] == "" and result["pdf_url"] == ""
        assert "/r/" not in str(result) and "/l/" not in str(result)
        assert result["status"] in ("preview", "ready")
    assert out["results"][0]["to"].startswith("(•••) •••-")  # the masked phone
    assert out["results"][1]["to"] == "j•••@example.com"
    assert "/r/" not in str(out["letter"].model_dump())
