"""Letters the clinic sends (requirement 61): a referral to a specialist, records for
another clinic, or a letter for the owner.

Letter rules (sent): Blinq drafts only from the signed notes, the files the vet
attached and the vet's reason, which stays in the vet's words. It never adds a
finding, diagnosis, recommendation or dose; anything unclear becomes "[confirm: ...]";
outside records are credited ("Your Feb 18 letter noted...") and never presented as
this clinic's findings. Invoices go along only when the vet checks them. Signing and
sending are one step, and a signed letter is locked. Records or a referral go to
another clinic only after the vet records that the owner agreed. Demo mode emails only
the demo address, or shows what would go out. Every step is audited.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import json
import re
import secrets
import unicodedata
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from email.errors import HeaderParseError
from email.headerregistry import Address
from pathlib import Path
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator

from . import letter_pdf, permissions, share
from .accounts import Caller
from .adapters import PracticeAdapter
from .day import visit_day
from .documents import Documents
from .llm import LONG_TOKENS, CutOff, MuseClient
from .mailer import Mailer, masked
from .notes import local_naive
from .phone import clinic_contact, clinic_with_phone, format_phone
from .plain import plain_markers
from .schemas import Appointment, Client, Encounter, EncounterStatus, Invoice, Photo
from .signin import Limiter
from .sms import Texter, mask
from .store import Store

LINK_DAYS = 14
MAX_TRIES = 5
MAX_BODY = 20_000
Kind = Literal["referral", "records", "owner"]
Urgency = Literal["routine", "soon", "urgent"]
Channel = Literal["email", "owner_text", "owner_email", "print"]
CHANNELS: tuple[Channel, ...] = ("email", "owner_text", "owner_email", "print")
KIND_TEXT = {
    "referral": "Referral",
    "records": "Records",
    "owner": "Letter",
}
URGENCY_TEXT = {"routine": "Routine", "soon": "Within 2 weeks", "urgent": "Urgent"}
# Control characters, keeping line breaks and tabs in a letter's body.
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
# A number with a unit: the doses and measures a draft must not invent.
_DOSE = re.compile(
    r"\b\d+(?:\.\d+)?\s?"
    r"(?:mg/kg|mg|mcg|µg|ug|g|kg|lbs?|ml|cc|IU|units?|mEq|mmol|tablets?|tabs?|%)"
    r"(?![A-Za-z])",
    re.I,
)
# Words that look like a drug name by their ending (cefpodoxime, meloxicam,
# prednisolone, gabapentin...): any the sources' medicines don't have is flagged.
_DRUG = re.compile(
    r"\b[A-Za-z]{3,}(?:cillin|mycin|floxacin|oxime|azole|olol|pril|sartan|prazole|"
    r"tidine|oxetine|profen|oxicam|coxib|cycline|olone|isone|asone|amide|azepam|"
    r"azolam|apentin|adol|idine|statin|dronate|ectin|antel)\b",
    re.I,
)
_WORD = re.compile(r"[A-Za-z][A-Za-z-]+")
_HEADER_UNSAFE = re.compile(r"[\s:,;<>\"'()\[\]\\]")


class LetterError(ValueError):
    """A refused step. The message is safe to show."""

    status = 400


class NotFound(LetterError):
    status = 404


class TooManySends(LetterError):
    status = 429


class DraftFailed(LetterError):
    status = 502


class Forbidden(LetterError):
    status = 403


# ---------- the letter ----------
class Recipient(BaseModel):
    name: str = Field("", max_length=120)
    clinic: str = Field("", max_length=120)
    email: str = Field("", max_length=254)


class PhotoRef(BaseModel):
    encounter_id: str = Field(max_length=64)
    photo_id: str = Field(max_length=64)


class Attachments(BaseModel):
    note_encounter_ids: list[str] = Field(default_factory=list, max_length=20)
    photos: list[PhotoRef] = Field(default_factory=list, max_length=12)
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    invoice_ids: list[str] = Field(default_factory=list, max_length=20)  # if checked

    @model_validator(mode="before")
    @classmethod
    def _one_note(cls, data: Any) -> Any:
        # Letters saved before several notes could be attached had one.
        if isinstance(data, dict) and "note_encounter_id" in data:
            data = dict(data)
            one = data.pop("note_encounter_id")
            data.setdefault("note_encounter_ids", [one] if one else [])
        return data


class SendEntry(BaseModel):
    channel: Channel
    to_masked: str = ""
    at: datetime
    status: str  # sent | preview | failed | skipped | ready
    detail: str = ""


class Letter(BaseModel):
    id: str
    patient_id: str
    patient_name: str = ""
    encounter_id: str = ""  # the visit it came from, or "" for the record
    kind: Kind = "referral"
    recipient: Recipient = Field(default_factory=Recipient)
    reason: str = ""  # the vet's own words, kept as typed
    urgency: Urgency = "routine"
    attachments: Attachments = Field(default_factory=Attachments)
    body: str = ""
    owner_consent: bool = False  # the owner agreed to share with another clinic
    status: Literal["draft", "sent", "opened"] = "draft"
    drafted: Literal["", "muse", "mock"] = ""  # who wrote the body's first draft
    created_by: str = ""
    created_at: datetime
    updated_at: datetime
    signed_by: str = ""
    signed_by_user: str = ""
    signed_at: datetime | None = None
    # A letter from the record (no visit) belongs to the vet who started it.
    owner_provider_id: str = ""
    owner_name: str = ""
    sent_to: list[str] = Field(default_factory=list)  # where it went, for the list
    sent: list[SendEntry] = Field(default_factory=list)
    opened_at: datetime | None = None
    # "summary": what front office and non-vet admins see (kind, recipient name,
    # status, where it went); "full" for vets and the open demo.
    view: Literal["full", "summary"] = "full"

    @model_validator(mode="before")
    @classmethod
    def _signed_is_sent(cls, data: Any) -> Any:
        # Signing and sending became one step: an older "signed" letter was sent.
        if isinstance(data, dict) and data.get("status") == "signed":
            data = {**data, "status": "sent"}
        return data

    @property
    def pdf_url(self) -> str:
        return f"/api/letters/{self.id}.pdf"

    @property
    def signer_title(self) -> str:
        """Who signed, as the letter and its PDF show them: "Dr. Ana Rivera, DVM"."""
        return with_credentials(self.signed_by)

    @property
    def to_another_clinic(self) -> bool:
        return self.kind in ("referral", "records")


class LetterFields(BaseModel):
    """What the vet sets; None leaves a field as it is."""

    kind: Kind | None = None
    recipient: Recipient | None = None
    reason: str | None = Field(None, max_length=2000)
    urgency: Urgency | None = None
    attachments: Attachments | None = None
    body: str | None = Field(None, max_length=MAX_BODY)
    owner_consent: bool | None = None


class LetterDraft(BaseModel):
    body: str = Field(
        description="The letter, plain text, paragraphs split by a blank line"
    )


DRAFT_RULES = """Use ONLY these sources: the signed notes from this clinic, the
files the vet attached, and the vet's reason. Never add a finding, diagnosis,
recommendation, test result, drug or dose that is not in them. Where the letter needs
something the sources don't say, write "[confirm: what is missing]" instead of
guessing, in plain words with no slashes ("[confirm: name and dose]"). Facts from
an outside record belong to whoever wrote it: credit them
("Your Feb 18 letter noted...", "Lakeside's Feb 18 letter noted...") and never write
them as this clinic's findings. Use the vet's reason as written. Plain English, short
paragraphs, no markdown. End with "Kind regards," and no name: the vet signs below."""

DRAFT_SYSTEM = {
    "referral": "You write a veterinary referral letter from one vet to a specialist "
    'or another clinic. Start with "Dear <recipient>,", thank them for seeing the '
    "pet, give the reason, then the history, today's findings, current medicines and "
    "what is attached.\n" + DRAFT_RULES,
    "records": "You write a short cover letter sending a pet's records to another "
    'clinic. Start with "Dear <recipient>,", say whose records these are and that '
    "the owner asked for them, give the reason, and list what is attached.\n"
    + DRAFT_RULES,
    "owner": "You write a short letter from the vet to the pet's owner, in plain "
    "words for someone who isn't a vet. Start with \"Dear <owner's first name>,\" and "
    "say what the letter is for, as the reason gives it.\n" + DRAFT_RULES,
}


def _clean(text: str, limit: int) -> str:
    return _CONTROL.sub("", text).strip()[:limit]


def _one_line(text: str, limit: int) -> str:
    return " ".join(_clean(text, limit * 2).split())[:limit]


def _check_email(email: str) -> str:
    """One plain address (no display name, no second address, nothing that could
    become another mail header), or ""."""
    bad = LetterError("That email address doesn't look right.")
    if not email.strip().isprintable():  # control or invisible characters
        raise bad
    email = _clean(email, 254).lower()
    if not email:
        return ""
    if _HEADER_UNSAFE.search(email):
        raise bad
    try:
        address = Address(addr_spec=email)
    except (ValueError, IndexError, HeaderParseError) as exc:
        raise bad from exc
    if not address.username or "." not in address.domain:
        raise bad
    return email


def _last_name_key(last_name: str) -> str:
    # The same matching as summary links: letters only, no case or accents.
    return "".join(
        c for c in unicodedata.normalize("NFKD", last_name.casefold()) if c.isalpha()
    )


def _name_hash(token: str, last_name: str) -> str:
    key = _last_name_key(last_name)
    return hashlib.sha256(f"blinq-letter:{token}:{key}".encode()).hexdigest()


def _dose_key(dose: str) -> str:
    return dose.replace(" ", "").lower().replace("µg", "mcg").replace("ug", "mcg")


def _drug_before(text: str, end: int, drugs: set[str]) -> str:
    """The drug a dose belongs to: the nearest known or drug-like word in the few
    words before it, or ""."""
    # Only the same sentence: "Meloxicam 100 mg. Weight 12 kg" pairs 12 kg with nothing.
    clause = re.split(r"[.;!?\n](?!\d)", text[max(0, end - 60) : end])[-1]
    words = _WORD.findall(clause)[-4:]
    for word in reversed(words):
        if str(word).lower() in drugs or _DRUG.fullmatch(word):
            return str(word).lower()
    return ""


def guard_doses(body: str, sources: str, medicines: list[str] | None = None) -> str:
    """No new drug and no new dose. A drug the note's medicines (or the sources)
    don't name, and a dose that isn't in the sources with that same drug, become
    "[confirm: ...]". A measure with no drug next to it (a weight) must simply be
    in the sources."""
    named = " ".join(medicines or []) + " " + sources
    drugs = {w.lower() for w in _DRUG.findall(named)} | {
        w.lower() for m in medicines or [] for w in _WORD.findall(m)[:1]
    }
    pairs, measures = set(), set()
    for m in _DOSE.finditer(sources):
        drug = _drug_before(sources, m.start(), drugs)
        pairs.add((drug, _dose_key(m.group(0))))
        measures.add(_dose_key(m.group(0)))

    def dose(m: re.Match[str]) -> str:
        found, drug = m.group(0), _drug_before(body, m.start(), drugs)
        ok = (drug, _dose_key(found)) in pairs if drug else _dose_key(found) in measures
        return found if ok else f"[confirm: {found}]"

    def new_drug(m: re.Match[str]) -> str:
        found = m.group(0)
        return found if found.lower() in drugs else f"[confirm: {found}]"

    return _DRUG.sub(new_drug, _DOSE.sub(dose, body))


def _when(at: str) -> str:
    """An ISO date or datetime as "Feb 18, 2026", or "" when there is none."""
    try:
        return f"{datetime.fromisoformat(at):%b %-d, %Y}"
    except ValueError:
        return ""


class Letters:
    def __init__(
        self,
        store: Store,
        adapter: PracticeAdapter,
        muse: MuseClient,
        mailer: Mailer,
        texter: Texter,
        demo: bool,
        public_url: str = "",
        demo_email_to: str = "",
    ):
        self.store, self.adapter, self.muse = store, adapter, muse
        self.mailer, self.texter, self.demo = mailer, texter, demo
        self.public_url = public_url.rstrip("/")
        self.demo_email_to = demo_email_to.strip().lower()
        self.documents = Documents(store, muse)
        self.send_limit = Limiter(20, 60 * 60)  # per person
        self.letter_limit = Limiter(5, 10 * 60)  # per letter
        self.draft_limit = Limiter(20, 60 * 60)  # Muse Spark drafts, per person
        # One change at a time per letter: a send or an edit never overwrites
        # another's result. In-process, like the visit locks in api.py.
        self.locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    # ---------- reading ----------
    def get(self, letter_id: str) -> Letter:
        raw = self.store.letter(letter_id) if letter_id else None
        if not raw:
            raise NotFound("That letter wasn't found.")
        return Letter.model_validate_json(raw)

    def for_patient(self, patient_id: str) -> list[Letter]:
        return [Letter.model_validate_json(r) for r in self.store.letters(patient_id)]

    # ---------- what a reader may see (the same rules as notes) ----------
    def view(self, who: Caller, letter: Letter) -> Letter | None:
        """The letter as this reader may see it, or None. A draft is only its own
        vet's. A sent letter: vets read it all (another vet's view only, as with
        signed notes); front office and admins who aren't vets see its kind, the
        recipient's name, its status and where it went, never the letter."""
        if letter.status == "draft" and not permissions.owns(
            who, self._owner_of(letter)[0]
        ):
            return None
        if permissions.sees_notes(who):
            return letter
        return Letter(
            id=letter.id,
            patient_id=letter.patient_id,
            patient_name=letter.patient_name,
            encounter_id=letter.encounter_id,
            kind=letter.kind,
            recipient=Recipient(name=letter.recipient.name),
            status=letter.status,
            created_at=letter.created_at,
            updated_at=letter.updated_at,
            signed_by=letter.signed_by,
            signed_at=letter.signed_at,
            sent_to=letter.sent_to,
            opened_at=letter.opened_at,
            view="summary",
        )

    def readable(self, who: Caller, letter_id: str) -> Letter:
        """One letter for this reader; one they may not see is "not found"."""
        shown = self.view(who, self.get(letter_id))
        if shown is None:
            raise NotFound("That letter wasn't found.")
        self._log_colleague(who, shown)
        return shown

    def _log_colleague(self, who: Caller, letter: Letter) -> None:
        """Another vet opening a letter (and the notes it carries) is logged, as
        opening their signed note is."""
        if letter.view == "full" and not permissions.owns(
            who, self._owner_of(letter)[0]
        ):
            self._audit(who, "letter_read", letter, by=who.actor)

    def readable_for_patient(self, who: Caller, patient_id: str) -> list[Letter]:
        shown = (self.view(who, x) for x in self.for_patient(patient_id))
        return [x for x in shown if x is not None]

    async def pdf_for(self, who: Caller, letter_id: str) -> tuple[Letter, bytes]:
        """The PDF holds the letter and the notes it carries: only for readers of
        notes, and a draft only for its own vet."""
        letter = self.get(letter_id)
        shown = self.view(who, letter)
        if shown is None:
            raise NotFound("That letter wasn't found.")
        if shown.view != "full":
            raise Forbidden("The letter's PDF is for providers. You can resend it.")
        self._log_colleague(who, shown)
        return letter, await self.pdf(letter)

    def contacts(self, q: str = "", limit: int = 20) -> list[Recipient]:
        """Specialists and clinics the clinic has written to, most recent first:
        offered when starting a letter. Owners aren't contacts."""
        q = q.strip().lower()
        seen: set[tuple[str, str, str]] = set()
        out: list[Recipient] = []
        for raw in self.store.recent_letters(500):
            letter = Letter.model_validate_json(raw)
            r = letter.recipient
            key = (r.name.lower(), r.clinic.lower(), r.email)
            if letter.status == "draft" or not letter.to_another_clinic or key in seen:
                continue
            if not r.name and not r.email:
                continue
            seen.add(key)
            if not q or q in " ".join(key):
                out.append(r)
            if len(out) >= limit:
                break
        return out

    def _save(self, letter: Letter) -> Letter:
        letter.updated_at = datetime.now(UTC)
        self.store.save_letter(
            letter.id,
            letter.patient_id,
            letter.encounter_id,
            letter.status,
            letter.created_at.isoformat(),
            letter.model_dump_json(),
        )
        return letter

    def _audit(self, who: Caller, action: str, letter: Letter, **detail: Any) -> None:
        self.store.audit(
            who.actor,
            action,
            letter.encounter_id or None,
            {"letter_id": letter.id, "patient_id": letter.patient_id, **detail},
        )

    # ---------- who may (requirement 62, permissions.py) ----------
    def _owner_of(self, letter: Letter) -> tuple[str, str]:
        """The vet a letter belongs to: the visit's, or whoever started it."""
        enc = self.store.get(letter.encounter_id) if letter.encounter_id else None
        if enc:
            return enc.provider_id, enc.provider_name
        return letter.owner_provider_id, letter.owner_name

    def _refuse(self, who: Caller, action: str, letter: Letter, reason: str) -> None:
        self.store.audit(
            who.actor,
            "refused",
            letter.encounter_id or None,
            {"action": action, "reason": reason},
        )
        raise HTTPException(403, reason)

    def _allow(self, who: Caller, action: str, letter: Letter) -> None:
        """letter.write and letter.sign (signing and the first send) are the
        owning vet's. letter.send, a resend: front office and admins for any vet,
        a vet only their own (permissions.py). Raises 403, audited."""
        provider_id, name = self._owner_of(letter)
        eid = letter.encounter_id or None
        # Never "no provider means anyone's" for a letter, sending included: a
        # letter with no owning vet is nobody's to change or send.
        if not provider_id and who.via != "open":  # a session or the API token
            self._refuse(
                who,
                action,
                letter,
                "This letter has no provider it belongs to, so it can't be changed.",
            )
        permissions.check(who, action, provider_id, name, self.store, eid)

    # ---------- what may be attached ----------
    def _encounter(self, encounter_id: str, patient_id: str) -> Encounter:
        enc = self.store.get(encounter_id) if encounter_id else None
        if not enc or enc.patient_id != patient_id:
            raise LetterError("That visit isn't this pet's.")
        return enc

    async def _invoices(self, patient_id: str) -> dict[str, Invoice]:
        pet = await self.adapter.get_patient(patient_id)
        if not pet or not pet.client_id:
            return {}
        household = await self.adapter.get_invoices(pet.client_id)
        return {
            i.id: i
            for i in household.invoices
            if not i.patient_id or i.patient_id == patient_id
        }

    async def _check_attachments(
        self, who: Caller, patient_id: str, att: Attachments
    ) -> Attachments:
        """Only what the caller may see of each visit (permissions.visit_view): a
        draft visit or a hidden photo of another vet's can't go out in a letter."""
        notes: list[str] = []
        for eid in att.note_encounter_ids:
            enc = self._encounter(eid, patient_id)
            view = permissions.visit_view(who, enc)
            if view.view == "status" or not view.note:
                raise LetterError("That note isn't available.")
            if enc.status != EncounterStatus.signed:
                raise LetterError("Only a signed note can be attached.")
            if eid not in notes:
                notes.append(eid)
        photos: list[PhotoRef] = []
        for ref in att.photos:
            enc = self._encounter(ref.encounter_id, patient_id)
            shown = permissions.visit_view(who, enc).photos
            if not any(p.id == ref.photo_id for p in shown):
                raise LetterError("That photo isn't available.")
            if ref not in photos:
                photos.append(ref)
        docs: list[str] = []
        for doc_id in att.document_ids:
            if not self.documents.get(patient_id, doc_id):
                raise LetterError("That record isn't this pet's.")
            if doc_id not in docs:
                docs.append(doc_id)
        invoices: list[str] = []
        if att.invoice_ids:
            known = await self._invoices(patient_id)
            for inv in att.invoice_ids:
                if inv not in known:
                    raise LetterError("That invoice isn't this pet's.")
                if inv not in invoices:
                    invoices.append(inv)
        return Attachments(
            note_encounter_ids=notes,
            photos=photos,
            document_ids=docs,
            invoice_ids=invoices,
        )

    async def _apply(self, who: Caller, letter: Letter, fields: LetterFields) -> None:
        if fields.kind is not None:
            letter.kind = fields.kind
        if fields.recipient is not None:
            r = fields.recipient
            letter.recipient = Recipient(
                name=_one_line(r.name, 120),
                clinic=_one_line(r.clinic, 120),
                email=_check_email(r.email),
            )
        if fields.reason is not None:
            letter.reason = _clean(fields.reason, 2000)  # word for word
        if fields.urgency is not None:
            letter.urgency = fields.urgency
        if fields.attachments is not None:
            letter.attachments = await self._check_attachments(
                who, letter.patient_id, fields.attachments
            )
        if fields.body is not None:
            letter.body = plain_markers(_clean(fields.body, MAX_BODY))
        if fields.owner_consent is not None:
            letter.owner_consent = fields.owner_consent

    # ---------- create, edit, delete ----------
    async def create(
        self,
        who: Caller,
        patient_id: str,
        encounter_id: str,
        fields: LetterFields,
        draft: bool = True,
    ) -> Letter:
        """Start a letter and, unless draft is False, have Blinq draft it."""
        name = ""
        if encounter_id:
            enc = self.store.get(encounter_id)
            if not enc:
                raise NotFound("That visit wasn't found.")
            patient_id = patient_id or enc.patient_id
            if enc.patient_id != patient_id:
                raise LetterError("That visit isn't this pet's.")
            name = enc.patient_name
        if not patient_id:
            raise LetterError("Pick the pet the letter is about.")
        mine = who.user.provider_id if who.user and not encounter_id else ""
        now = datetime.now(UTC)
        letter = Letter(
            id=uuid.uuid4().hex[:12],
            patient_id=patient_id,
            encounter_id=encounter_id,
            created_by=who.actor,
            created_at=now,
            updated_at=now,
            owner_provider_id=mine,
            owner_name=who.user.name if mine and who.user else "",
        )
        if who.via == "session" and not encounter_id and not mine:  # the token: _allow
            self._refuse(
                who, "letter.write", letter, "Only a provider can write a letter."
            )
        self._allow(who, "letter.write", letter)
        if not name:
            pet = await self.adapter.get_patient(patient_id)
            if not pet:
                raise NotFound("That pet wasn't found.")
            name = pet.name
        letter.patient_name = name
        enc = self.store.get(encounter_id) if encounter_id else None
        if enc and enc.status == EncounterStatus.signed and not fields.attachments:
            # From a visit: its signed note goes along unless the vet says otherwise.
            letter.attachments = Attachments(note_encounter_ids=[encounter_id])
        await self._apply(who, letter, fields)
        if letter.kind == "owner" and not fields.recipient:
            client, _ = await self._owner(letter)
            if client:
                email = client.emails[0] if client.emails else ""
                letter.recipient = Recipient(
                    name=client.full_name, email=_safe_email(email)
                )
        self._save(letter)
        self._audit(who, "letter_created", letter, kind=letter.kind)
        return await self.draft(who, letter.id) if draft else letter

    def _draft_only(self, letter: Letter, what: str) -> None:
        if letter.status != "draft":
            raise LetterError(f"A signed letter can't be {what}.")

    async def update(self, who: Caller, letter_id: str, fields: LetterFields) -> Letter:
        async with self.locks[letter_id]:
            letter = self.get(letter_id)
            self._allow(who, "letter.write", letter)
            self._draft_only(letter, "changed")
            await self._apply(who, letter, fields)
            self._save(letter)
        changed = sorted(k for k, v in fields.model_dump().items() if v is not None)
        self._audit(who, "letter_edited", letter, fields=changed)
        return letter

    async def delete(self, who: Caller, letter_id: str) -> None:
        async with self.locks[letter_id]:
            letter = self.get(letter_id)
            self._allow(who, "letter.write", letter)
            self._draft_only(letter, "deleted")
            self.store.delete_letter(letter.id)
        self.locks.pop(letter_id, None)
        self._audit(who, "letter_deleted", letter)

    # ---------- the draft ----------
    def _notes(self, letter: Letter) -> list[Encounter]:
        found = (self.store.get(i) for i in letter.attachments.note_encounter_ids)
        return [e for e in found if e and e.status == EncounterStatus.signed and e.note]

    def _source_text(self, letter: Letter, invoices: list[Invoice]) -> str:
        """Everything a draft may use, each part labeled with where it is from."""
        parts = [f"Patient: {letter.patient_name}", f"Vet's reason: {letter.reason}"]
        for e in self._notes(letter):
            n = e.note
            assert n is not None
            parts.append(
                f"This clinic's signed note, {visit_day(e):%b %-d, %Y}:\n"
                f"Subjective: {n.subjective}\nObjective: {n.objective}\n"
                f"Vitals: {json.dumps(n.vitals)}\nAssessment: {n.assessment}\n"
                f"Plan: {n.plan}\nMedicines: {'; '.join(n.medications)}"
            )
        for _, photo in self._photos(letter):
            outlined = ", ".join(o.label for o in photo.outline if o.label)
            parts.append(
                f"Attached exam photo: {photo.label or 'photo'}. {photo.caption}"
                + (f" Outlined: {outlined}." if outlined else "")
            )
        for doc in self._docs(letter):
            points = "; ".join(
                f"{p['text']} (page {p['page']})" for p in doc.get("key_points", [])
            )
            parts.append(
                f"OUTSIDE record, not this clinic's findings: {doc['name']}, "
                f"received {_when(doc['uploaded_at'])}: {points}"
            )
        for inv in invoices:
            items = ", ".join(i.name for i in inv.items)
            parts.append(f"Attached invoice {inv.date:%b %-d, %Y}: {items}")
        return "\n\n".join(parts)

    def _credit(self, letter: Letter, doc: dict[str, Any]) -> str:
        """Who an outside record is from, as the letter should say it."""
        clinic = letter.recipient.clinic.lower()
        when = _when(doc["uploaded_at"])
        if clinic and clinic in doc["name"].lower():
            return f"Your letter{f' (received {when})' if when else ''}"
        return f'The outside record "{doc["name"]}"'

    def _mock_draft(self, letter: Letter, client: Client | None) -> str:
        """The demo draft: the same rules, filled in without a model."""
        notes = self._notes(letter)
        note = notes[0].note if notes else None
        pet = letter.patient_name
        reason = letter.reason or "[confirm: the reason for this letter]"
        lines: list[str] = []
        if letter.kind == "owner":
            first = client.first_name if client and client.first_name else "there"
            lines += [f"Dear {first},", reason]
            if note and note.client_summary:
                lines.append(note.client_summary)
        else:
            to = letter.recipient.name or "[confirm: who this is to]"
            lines.append(f"Dear {to},")
            if letter.kind == "records":
                owner = client.full_name if client else "the owner"
                lines.append(
                    f"Please find {pet}'s records attached, sent at {owner}'s request."
                )
                lines.append(reason)
            else:
                lines.append(f"Thank you for seeing {pet}. {reason}")
                if note:
                    if note.subjective:
                        lines.append(note.subjective)
                    found = note.objective or note.assessment
                    lines.append(found or "[confirm: today's findings]")
                for doc in self._docs(letter):
                    points = "; ".join(p["text"] for p in doc.get("key_points", []))
                    if points:
                        lines.append(f"{self._credit(letter, doc)} noted: {points}")
                if note:
                    lines.append(
                        "Current medications: "
                        + ("; ".join(note.medications) or "[confirm: medications]")
                    )
        attached = self.attachment_names(letter)
        if attached and letter.kind != "owner":
            lines.append("Attached: " + "; ".join(attached) + ".")
        lines.append("Kind regards,")
        return "\n\n".join(lines)

    async def draft(self, who: Caller, letter_id: str) -> Letter:
        """Muse Spark writes the body (the mock in demo mode, flagged). The model
        takes seconds, so the letter isn't held meanwhile: if it was edited or sent
        in that time, the draft is thrown away rather than written over it."""
        async with self.locks[letter_id]:
            letter = self.get(letter_id)
            self._allow(who, "letter.write", letter)
            self._draft_only(letter, "redrafted")
            if not self.draft_limit.allow(who.actor):
                raise TooManySends("Too many drafts. Wait a while and try again.")
        seen = (letter.status, letter.updated_at)
        known = await self._invoices(letter.patient_id)
        invoices = [known[i] for i in letter.attachments.invoice_ids if i in known]
        sources = self._source_text(letter, invoices)
        client, _ = await self._owner(letter)
        if self.muse.enabled:
            r = letter.recipient
            ask = (
                f"Letter: {KIND_TEXT[letter.kind]}\n"
                f"To: {r.name or 'the recipient'}"
                + (f", {r.clinic}" if r.clinic else "")
                + (
                    f"\nOwner: {client.full_name}"
                    if client and letter.kind == "owner"
                    else ""
                )
                + f"\nHow soon: {URGENCY_TEXT[letter.urgency]}\n\nSources:\n{sources}"
            )
            try:
                out = await self.muse.structured(
                    DRAFT_SYSTEM[letter.kind],
                    ask,
                    LetterDraft,
                    max_tokens=LONG_TOKENS,
                    must_finish=True,
                )
                if not out.body.strip():
                    raise CutOff("Muse Spark's letter came back empty.")
            except CutOff as exc:
                self._audit(who, "letter_draft_failed", letter, why=str(exc))
                raise DraftFailed(
                    "Muse Spark couldn't write the letter. Try again."
                ) from exc
            body = out.body
        else:
            body = self._mock_draft(letter, client)
        drafted: Literal["muse", "mock"] = "muse" if self.muse.enabled else "mock"
        medicines = [
            m for e in self._notes(letter) if e.note for m in e.note.medications
        ]
        body = guard_doses(_clean(body, MAX_BODY), sources, medicines)
        async with self.locks[letter_id]:
            now = self.get(letter_id)
            if (now.status, now.updated_at) != seen:
                raise LetterError("The letter changed while drafting. Try again.")
            now.body, now.drafted = body, drafted
            self._save(now)
        self._audit(who, "letter_drafted", now, by=now.drafted)
        return now

    # ---------- what goes along ----------
    def _photos(self, letter: Letter) -> list[tuple[PhotoRef, Photo]]:
        out = []
        for ref in letter.attachments.photos:
            enc = self.store.get(ref.encounter_id)
            found = [p for p in enc.photos if p.id == ref.photo_id] if enc else []
            if found:
                out.append((ref, found[0]))
        return out

    def _docs(self, letter: Letter) -> list[dict[str, Any]]:
        docs = (
            self.documents.get(letter.patient_id, d)
            for d in letter.attachments.document_ids
        )
        return [d for d in docs if d]

    def attachment_names(self, letter: Letter) -> list[str]:
        names = [
            f"Visit note, {visit_day(e):%b %-d, %Y} (signed)"
            for e in self._notes(letter)
        ]
        for _, photo in self._photos(letter):
            outline = ", with outline" if photo.outline else ""
            names.append(f"Exam photo, {photo.label or 'photo'}{outline}")
        names += [f"{d['name']}" for d in self._docs(letter)]
        names += [f"Invoice {i}" for i in letter.attachments.invoice_ids]
        return names

    # ---------- the PDF: the letter on the letterhead, then what's attached ----------
    async def attachment_parts(self, letter: Letter) -> list[letter_pdf.Attachment]:
        """Each attachment as the letter PDF draws it, in the order it's numbered."""
        parts: list[letter_pdf.Attachment] = []
        for e in self._notes(letter):
            n = e.note
            assert n is not None
            signed = (
                f"Signed by {with_credentials(e.signed_by)}, "
                f"{local_naive(e.signed_at):%b %-d, %Y, %-I:%M %p}"
                if e.signed_at and e.signed_by
                else ""
            )
            parts.append(
                letter_pdf.NoteAttachment(
                    title=f"Visit note, {visit_day(e):%b %-d, %Y} (signed)",
                    sections=[
                        (label, text)
                        for label, text in (
                            ("Subjective", n.subjective),
                            ("Objective", n.objective),
                            ("Assessment", n.assessment),
                            ("Plan", n.plan),
                        )
                        if text.strip()
                    ],
                    medicines=list(n.medications),
                    signed=signed,
                )
            )
        for _, photo in self._photos(letter):
            if Path(photo.path).is_file():
                outline = ", with outline" if photo.outline else ""
                parts.append(
                    letter_pdf.PhotoAttachment(
                        title=f"Exam photo, {photo.label or 'photo'}{outline}",
                        data=Path(photo.path).read_bytes(),
                        crop=photo.crop.model_dump() if photo.crop else None,
                        rotation=photo.rotation,
                        outline=[o.model_dump() for o in photo.outline],
                        caption=photo.caption,
                    )
                )
        for doc in self._docs(letter):
            path = Path(str(doc.get("path", "")))
            parts.append(
                letter_pdf.FileAttachment(
                    title=doc["name"],
                    data=path.read_bytes() if path.is_file() else b"",
                    content_type=doc["content_type"],
                )
            )
        known = await self._invoices(letter.patient_id)
        for inv_id in letter.attachments.invoice_ids:
            if inv := known.get(inv_id):
                parts.append(
                    letter_pdf.InvoiceAttachment(
                        title=f"Invoice, {inv.date:%b %-d, %Y}",
                        lines=[(i.name, i.qty, i.price) for i in inv.items],
                        total=inv.total,
                    )
                )
        return parts

    async def pdf(self, letter: Letter) -> bytes:
        """One PDF: the letter on the clinic letterhead, then every attachment
        (data's letter_pdf module draws it)."""
        clinic = (await self.adapter.get_clinic()).model_dump()
        pet = await self.adapter.get_patient(letter.patient_id)
        client, _ = await self._owner(letter)
        notes = self._notes(letter)
        weight = next(
            (
                v
                for e in notes
                if e.note
                for k, v in e.note.vitals.items()
                if "weight" in k.lower()
            ),
            "",
        )
        species = " · ".join(x for x in (pet.species, pet.breed) if x) if pet else ""
        r = letter.recipient
        signer = with_credentials(letter.signed_by) if letter.signed_at else ""
        return letter_pdf.render(
            letter_pdf.LetterPdf(
                kind="letter" if letter.kind == "owner" else letter.kind,
                clinic={
                    k: str(clinic.get(k, "")) for k in ("name", "address", "phone")
                },
                recipient=[x for x in (r.name, r.clinic, r.email) if x],
                date=local_naive(letter.signed_at or datetime.now(UTC)).date(),
                how_soon=URGENCY_TEXT[letter.urgency].lower(),
                patient=[
                    x
                    for x in (
                        letter.patient_name,
                        species,
                        share.age_text(pet.age if pet else None, "en"),
                        pet.sex if pet else "",
                        weight,
                    )
                    if x
                ],
                owner=[
                    x
                    for x in (
                        client.full_name if client else "",
                        format_phone(client.phones[0])
                        if client and client.phones
                        else "",
                    )
                    if x
                ],
                owner_consent=letter.owner_consent,
                referring_vet=with_credentials(
                    letter.signed_by or self._owner_of(letter)[1]
                ),
                paragraphs=[
                    p.strip() for p in re.split(r"\n\s*\n", letter.body) if p.strip()
                ],
                signer=signer,
                signed_at=local_naive(letter.signed_at) if letter.signed_at else None,
                draft=letter.status == "draft",
                attachments=await self.attachment_parts(letter),
            )
        )

    # ---------- sending ----------
    async def _owner(self, letter: Letter) -> tuple[Client | None, Appointment | None]:
        enc = self.store.get(letter.encounter_id) if letter.encounter_id else None
        appt = await self.adapter.get_appointment(enc.appointment_id) if enc else None
        if appt:
            return appt.client, appt
        pet = await self.adapter.get_patient(letter.patient_id)
        client = (
            await self.adapter.get_client(pet.client_id)
            if pet and pet.client_id
            else None
        )
        return client, None

    def _link_base(self, request_base: str) -> str:
        """Where a link in a text or email points: BLINQ_SCRIBE_PUBLIC_URL, never a
        request's Host header, except in demo mode (nothing reaches a real person)."""
        if self.public_url:
            return self.public_url
        if self.demo:
            return request_base.rstrip("/")
        raise LetterError(
            "Sending a link needs BLINQ_SCRIBE_PUBLIC_URL to be set. Print the letter "
            "instead."
        )

    async def _signer_name(self, who: Caller, letter: Letter) -> str:
        """The vet's real name: the signed-in vet, else (the open demo, a script)
        the letter's vet, else in demo mode the demo clinic's first vet."""
        if who.user:
            return who.user.name
        name = self._owner_of(letter)[1]
        if not name and self.demo:
            providers = await self.adapter.list_providers()
            name = str(providers[0]["name"]) if providers else ""
        return name or "The clinic's provider"

    def _check_ready(self, letter: Letter) -> None:
        """What signing needs: refused while anything is left to confirm."""
        missing = [
            what
            for what, value in (
                ("who it's to", letter.recipient.name or letter.kind == "owner"),
                ("the reason", letter.reason),
                ("the letter", letter.body.strip()),
            )
            if not value
        ]
        if missing:
            raise LetterError("Add " + " and ".join(missing) + " before signing.")
        if "[confirm" in letter.body.lower():
            raise LetterError("Check the [confirm: ...] items first.")

    async def send(
        self,
        who: Caller,
        letter_id: str,
        channels: list[Channel],
        to_email: str = "",
        owner_copy: bool = False,
        request_base: str = "",
    ) -> dict[str, Any]:
        """Sign (the first time) and send, in one step. Returns the letter and one
        result per channel. A letter already sent can be sent again."""
        async with self.locks[letter_id]:
            return await self._send(
                who, letter_id, channels, to_email, owner_copy, request_base
            )

    async def _send(
        self,
        who: Caller,
        letter_id: str,
        channels: list[Channel],
        to_email: str,
        owner_copy: bool,
        request_base: str,
    ) -> dict[str, Any]:
        letter = self.get(letter_id)
        first = letter.status == "draft"
        self._allow(who, "letter.sign" if first else "letter.send", letter)
        wanted = list(dict.fromkeys(channels))
        if owner_copy and not {"owner_text", "owner_email"} & set(wanted):
            wanted.append("owner_text")
        if not wanted:
            raise LetterError("Pick where the letter goes.")
        if first:
            self._check_ready(letter)
        if letter.to_another_clinic and not letter.owner_consent:
            raise LetterError("Record that the owner agreed to share these records.")
        # Everything that can refuse comes first: only a send that can go out counts.
        client, appt = await self._owner(letter)
        email_to = ""
        if "email" in wanted:
            if letter.kind == "owner":  # the owner's email on file, nothing else
                email_to = (
                    _safe_email(client.emails[0]) if client and client.emails else ""
                )
            else:
                email_to = _check_email(to_email) or letter.recipient.email
                if email_to != letter.recipient.email and not permissions.can(
                    who, "letter.sign", self._owner_of(letter)[0]
                ):
                    # A new address is part of signing: only the letter's own vet
                    # may send it somewhere else, never on a resend by anyone.
                    self._refuse(
                        who,
                        "letter.sign",
                        letter,
                        "Only the letter's provider can send it to a new address.",
                    )
            if not email_to:
                raise LetterError("Add the email address to send it to.")
        base = ""
        if {"owner_text", "email"} & set(wanted):
            base = self._link_base(request_base)
        if "owner_text" in wanted and (
            not client or not _last_name_key(client.last_name)
        ):
            raise LetterError(
                "We don't have the owner's last name, so the link can't be protected. "
                "Print the letter instead."
            )
        owner_email = ""
        if "owner_email" in wanted:
            owner_email = (
                _safe_email(client.emails[0]) if client and client.emails else ""
            )
            if not owner_email:
                raise LetterError("We don't have an email address for the owner.")
        if self.send_limit.full(who.actor) or self.letter_limit.full(letter.id):
            raise TooManySends("Too many sends. Wait a few minutes and try again.")
        self.send_limit.hit(who.actor)
        self.letter_limit.hit(letter.id)
        if first:  # signing: as the signed-in vet, then the letter is locked
            letter.status = "sent"
            letter.signed_by = await self._signer_name(who, letter)
            letter.signed_by_user = who.user.username if who.user else ""
            letter.signed_at = datetime.now(UTC)
            if email_to and letter.kind != "owner":
                letter.recipient = letter.recipient.model_copy(
                    update={"email": email_to}
                )
            self._audit(who, "letter_signed", letter)
        results: list[dict[str, Any]] = []
        document = await self.pdf(letter)
        for channel in wanted:
            out = _result(channel, letter)
            if channel == "email":
                await self._send_email(letter, out, email_to, base, document)
            elif channel == "owner_text":
                assert client is not None
                await self._send_text(letter, out, base, client, appt)
            elif channel == "owner_email":
                await self._send_owner_email(letter, out, owner_email, client, document)
            else:
                out["detail"] = "The PDF is ready to print."
            entry = SendEntry(
                channel=channel,
                to_masked=out.pop("to_masked", ""),
                at=datetime.now(UTC),
                status=out["status"],
                detail=out["detail"][:300],
            )
            letter.sent.append(entry)
            if out["status"] in ("sent", "preview", "ready"):
                letter.sent_to.append(_where(channel, entry.to_masked))
            results.append(out)
            self._audit(
                who, "letter_sent", letter, channel=channel, result=out["status"]
            )
        if not first and email_to and letter.kind != "owner":
            letter.recipient = letter.recipient.model_copy(update={"email": email_to})
        self._save(letter)
        # Only the letter's own vet (or the open demo) gets the specialist's link and
        # the letter's text back; front office resending sees where it went.
        if not permissions.owns(who, self._owner_of(letter)[0]):
            # Every channel: a link (the owner's /r/ or the specialist's /l/) or the
            # letter's text would hand over what the letter carries.
            masked_to = [e.to_masked for e in letter.sent[-len(results) :]]
            results = [
                {
                    **_result(out["channel"], letter),
                    "status": out["status"],
                    "detail": out["detail"],
                    "to": to,
                    "pdf_url": "",
                }
                for out, to in zip(results, masked_to, strict=True)
            ]
        shown = self.view(who, letter) or letter.model_copy(
            update={"body": "", "reason": "", "view": "summary"}
        )
        return {"letter": shown, "results": results}

    async def _mail(
        self,
        to: str,
        template: str,
        out: dict[str, Any],
        files: list[tuple[str, bytes, str]],
        **context: Any,
    ) -> None:
        """Send, or in demo mode send only to the demo address, or show what would
        go out (demo mode with no demo address, or no SMTP)."""
        rendered = self.mailer.render(template, **context)
        out.update(to=to, to_masked=masked(to), subject=rendered.subject)
        out["body"] = rendered.text
        if self.demo and not (self.demo_email_to and self.mailer.live):
            out["status"] = "preview"
            out["detail"] = "Demo mode: not sent. This is the email that would go out."
            return
        if not self.mailer.live:
            out["status"] = "preview"
            out["detail"] = "Email isn't set up here, so nothing was sent."
            return
        real = to if not self.demo else self.demo_email_to
        try:
            await self.mailer.send(real, template, attachments=files, **context)
        except Exception as exc:  # the vet sees it failed and can resend or print
            out.update(
                status="failed", detail=f"Couldn't send: {exc.__class__.__name__}"
            )
            return
        out["status"] = "sent"
        out["detail"] = (
            f"Demo mode: sent to the demo address {masked(real)}, not {masked(to)}."
            if self.demo
            else f"Sent to {masked(to)}."
        )

    async def _send_email(
        self,
        letter: Letter,
        out: dict[str, Any],
        to: str,
        base: str,
        document: bytes,
    ) -> None:
        """The specialist: one PDF, and a "view online" link that records the open."""
        clinic = (await self.adapter.get_clinic()).model_dump()
        token = self._new_link(letter, "specialist", "")
        url = f"{base}/l/{token}"
        out["url"] = url
        await self._mail(
            to,
            "referral_letter",
            out,
            [
                (
                    f"{KIND_TEXT[letter.kind]} {letter.patient_name}.pdf",
                    document,
                    "application/pdf",
                )
            ],
            pet=letter.patient_name,
            clinic=clinic["name"],
            phone=format_phone(clinic["phone"]),
            kind_title=KIND_TEXT[letter.kind],
            intro=(
                f"{letter.signed_by} at {clinic['name']} sent you a "
                f"{KIND_TEXT[letter.kind].lower()} for {letter.patient_name} "
                f"({URGENCY_TEXT[letter.urgency].lower()})."
            ),
            letter=letter.body,
            view_url=url,
            extra=f"{len(self.attachment_names(letter))} attachment(s)",
        )

    async def _send_owner_email(
        self,
        letter: Letter,
        out: dict[str, Any],
        to: str,
        client: Client | None,
        document: bytes,
    ) -> None:
        clinic = (await self.adapter.get_clinic()).model_dump()
        await self._mail(
            to,
            "letter_for_owner",
            out,
            [
                (
                    f"{KIND_TEXT[letter.kind]} {letter.patient_name}.pdf",
                    document,
                    "application/pdf",
                )
            ],
            pet=letter.patient_name,
            clinic=clinic["name"],
            phone=format_phone(clinic["phone"]),
            first=client.first_name if client and client.first_name else "there",
            what=(
                "a letter about "
                if letter.kind == "owner"
                else f"the {KIND_TEXT[letter.kind].lower()} for "
            )
            + letter.patient_name,
            to_whom=(
                ""
                if letter.kind == "owner"
                else ", ".join(
                    x for x in (letter.recipient.name, letter.recipient.clinic) if x
                )
            ),
        )

    def _new_link(self, letter: Letter, kind: str, last_name: str) -> str:
        token = secrets.token_urlsafe(24)
        now = datetime.now(UTC)
        name_hash = _name_hash(token, last_name) if kind == "owner" else ""
        self.store.add_letter_link(
            token, letter.id, name_hash, now, now + timedelta(days=LINK_DAYS), kind
        )
        return token

    async def _send_text(
        self,
        letter: Letter,
        out: dict[str, Any],
        base: str,
        client: Client,
        appt: Appointment | None,
    ) -> None:
        token = self._new_link(letter, "owner", client.last_name)
        clinic = (await self.adapter.get_clinic()).model_dump()
        url = f"{base}/r/{token}"
        # Only that a letter is ready, with the link: nothing medical in the text.
        what = (
            "a letter"
            if letter.kind == "owner"
            else f"a {KIND_TEXT[letter.kind].lower()}"
        )
        text = (
            f"Hi {client.first_name or 'there'}, {clinic['name']} has {what} for "
            f"{letter.patient_name} ready: {url}. Reply STOP to opt out."
        )
        sms = await self.texter.send_text(text, appt)
        out.update(
            status={"preview": "preview", "sent": "sent", "failed": "failed"}.get(
                sms.status, "skipped"
            ),
            detail=sms.detail
            if sms.status != "skipped"
            else "Texting is off. Copy the link to share it.",
            text=text,
            url=url,
            expires_at=(datetime.now(UTC) + timedelta(days=LINK_DAYS)).isoformat(),
            to_masked=sms.to_masked
            or (mask(client.phones[0]) if client.phones else "owner"),
        )

    # ---------- the owner's and the specialist's pages ----------
    def _opened(self, letter: Letter, by: str) -> None:
        """The first time the owner or the specialist opens it."""
        self.store.audit(
            by, "letter_opened", letter.encounter_id or None, {"letter_id": letter.id}
        )
        if letter.status == "sent":
            letter.status, letter.opened_at = "opened", datetime.now(UTC)
            self._save(letter)

    def open_link(
        self, token: str, last_name: str | None, kind: str = "owner"
    ) -> tuple[str, Letter | None]:
        """missing, expired, locked, ask, wrong (with tries left) or ok. A
        specialist's link needs no last name: its token is the key."""
        link = self.store.letter_link(token) if token else None
        raw = self.store.letter(link.letter_id) if link else None
        if not link or not raw or link.kind != kind:
            return "missing", None
        letter = Letter.model_validate_json(raw)
        if letter.status == "draft":
            return "missing", None
        if datetime.fromisoformat(link.expires_at) < datetime.now(UTC):
            return "expired", None
        if kind == "specialist":
            self._opened(letter, "specialist")
            return "ok", letter
        if link.failures >= MAX_TRIES:
            return "locked", None
        if last_name is None:
            return "ask", None
        if hmac.compare_digest(_name_hash(token, last_name), link.name_hash):
            self.store.letter_link_tried(token, ok=True, most=MAX_TRIES)
            self._opened(letter, "owner")
            return "ok", letter
        # Counted in one UPDATE, so tries made at the same moment can't slip past.
        failures = self.store.letter_link_tried(token, ok=False, most=MAX_TRIES)
        state = "locked" if failures is None or failures >= MAX_TRIES else "wrong"
        self.store.audit(
            "owner",
            "letter_link_locked" if state == "locked" else "letter_link_wrong",
            letter.encounter_id or None,
            {"letter_id": letter.id},
        )
        return state, None


def fields_from(data: dict[str, Any] | None) -> LetterFields:
    """LetterFields from GraphQL input or a REST body (the same shape)."""
    if not data:
        return LetterFields()
    raw = {**data}
    att = data.get("attachments")
    if att is not None:
        raw["attachments"] = Attachments.model_validate(att)
    if data.get("recipient") is not None:
        raw["recipient"] = Recipient.model_validate(data["recipient"])
    return LetterFields.model_validate(raw)


def channels_from(names: list[str]) -> list[Channel]:
    if any(c not in CHANNELS for c in names):
        raise LetterError(
            'channels are "email", "owner_text", "owner_email" or "print".'
        )
    return [c for c in CHANNELS if c in names]


def _safe_email(email: str) -> str:
    try:
        return _check_email(email)
    except LetterError:
        return ""


def _result(channel: Channel, letter: Letter) -> dict[str, Any]:
    return {
        "channel": channel,
        "status": "ready",
        "detail": "",
        "to": "",
        "subject": "",
        "body": "",
        "text": "",
        "url": "",
        "pdf_url": letter.pdf_url,
        "expires_at": None,
    }


def _where(channel: Channel, to: str) -> str:
    return {
        "email": f"emailed to {to}",
        "owner_text": f"texted to the owner ({to})",
        "owner_email": f"emailed to the owner ({to})",
        "print": "printed",
    }[channel]


def with_credentials(name: str) -> str:
    """The signer as the letter shows them: "Dr. Ana Rivera, DVM"."""
    name = name.strip()
    if not name or "dvm" in name.lower() or not name.lower().startswith("dr"):
        return name
    return f"{name}, DVM"


# ---------- the pages (the owner summary page's look) ----------
_e = html.escape
PAGE_TEXT = {
    "title": "Letter from the clinic",
    "ask": "To see the letter, type the pet owner's last name.",
    "wrong": "That last name doesn't match. Try again.",
    "locked": "This link is locked after too many tries. Call {clinic} for the letter.",
    "expired": "This link has expired. Call {clinic} and we'll send a new one.",
    "missing": "This link doesn't work. Call the clinic and we'll send a new one.",
}
OWNER_TEXT = PAGE_TEXT  # the name the routes used before letters had kinds


def _page(clinic: dict[str, Any], body: str) -> str:
    contact = clinic_contact(clinic, " | ")
    return share.PAGE.format(
        lang="en",
        title=_e(PAGE_TEXT["title"]),
        clinic=_e(clinic["name"]),
        contact=_e(contact),
        body=body,
    )


def page_message(clinic: dict[str, Any], state: str) -> str:
    who = clinic_with_phone(clinic)
    return _page(
        clinic,
        f'<div class="card"><p>{_e(PAGE_TEXT[state].format(clinic=who))}</p></div>',
    )


def page_form(clinic: dict[str, Any], error: str = "") -> str:
    err = f'<p class="error" role="alert">{_e(error)}</p>' if error else ""
    return _page(
        clinic,
        '<form class="card" method="post" autocomplete="off">'
        f"<h2>{_e(PAGE_TEXT['title'])}</h2><p>{_e(PAGE_TEXT['ask'])}</p>"
        '<label for="last_name">Last name</label>'
        '<input id="last_name" name="last_name" autocomplete="family-name" '
        'required maxlength="80">'
        f'{err}<button type="submit">Open letter</button></form>',
    )


def page_letter(
    clinic: dict[str, Any],
    letter: Letter,
    attached: list[str],
    pdf_form: str = "",
) -> str:
    """The letter itself. pdf_form: a form or link that gets the PDF to bring."""
    r = letter.recipient
    paras = "".join(
        f"<p>{_e(p)}</p><br>" for p in re.split(r"\n\s*\n", letter.body) if p.strip()
    )
    items = "".join(f"<li>{_e(a)}</li>" for a in attached)
    signed = f"{letter.signed_at:%b %-d, %Y}" if letter.signed_at else ""
    to = ", ".join(x for x in (r.name, r.clinic) if x)
    body = (
        f'<div class="card"><h2>{_e(KIND_TEXT[letter.kind])}: '
        f"{_e(letter.patient_name)}</h2>"
        + (f"<h3>To</h3><p>{_e(to)}</p>" if to else "")
        + (
            f"<h3>How soon</h3><p>{_e(URGENCY_TEXT[letter.urgency])}</p>"
            if letter.kind != "owner"
            else ""
        )
        + f"{paras}<p>{_e(letter.signed_by)} · signed {_e(signed)}</p>"
        + (f"<h3>Attached</h3><ul>{items}</ul>" if items else "")
        + pdf_form
        + "</div>"
    )
    return _page(clinic, body)


def owner_pdf_form(token: str, last_name: str) -> str:
    """The owner gets the PDF by sending the same last name again (no session)."""
    return (
        f'<form method="post" action="/r/{_e(token)}/pdf" autocomplete="off">'
        f'<input type="hidden" name="last_name" value="{_e(last_name)}">'
        '<button type="submit">Download the PDF to bring</button></form>'
    )
