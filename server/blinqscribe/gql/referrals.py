"""Letters over GraphQL (requirement 61): referrals, records for another clinic and
letters for the owner. Create (Blinq drafts it), edit, sign and send in one step,
delete a draft, and saved contacts. The PDF and the owner's and specialist's pages
are REST (letters_routes.py), which also mirrors these operations."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

import strawberry
from fastapi import HTTPException

from ..referrals import LetterError, Letters, channels_from, fields_from
from .context import Context
from .types import Clinic, many, shaped

Info = strawberry.Info[Context, None]


# ---------- types ----------
@strawberry.type
class LetterRecipient:
    name: str
    clinic: str
    email: str


@strawberry.type
class LetterPhoto:
    encounter_id: str
    photo_id: str


@strawberry.type
class LetterAttachments:
    note_encounter_ids: list[str] = strawberry.field(
        description="Signed notes of any of the pet's visits"
    )
    photos: list[LetterPhoto] = strawberry.field(description="Exam photos")
    document_ids: list[str] = strawberry.field(description="Received documents")
    invoice_ids: list[str] = strawberry.field(
        description="Invoices: only when the vet checks them, never by default"
    )


@strawberry.type(description="One time the letter went somewhere")
class LetterSend:
    channel: str = strawberry.field(
        description='"email", "owner_text", "owner_email" or "print"'
    )
    to_masked: str
    at: datetime
    status: str = strawberry.field(
        description='"sent", "preview", "failed", "skipped" or "ready"'
    )
    detail: str


@strawberry.type(description="A letter the clinic sends")
class Letter:
    id: strawberry.ID
    patient_id: str
    patient_name: str
    encounter_id: str = strawberry.field(description="The visit, or empty")
    kind: str = strawberry.field(description='"referral", "records" or "owner"')
    recipient: LetterRecipient
    reason: str = strawberry.field(description="The vet's own words, as typed")
    urgency: str = strawberry.field(description='"routine", "soon" or "urgent"')
    attachments: LetterAttachments
    body: str
    owner_consent: bool = strawberry.field(
        description="The owner agreed to share with another clinic"
    )
    status: str = strawberry.field(description='"draft", "sent" or "opened"')
    drafted: str = strawberry.field(
        description='Who wrote the first draft: "muse", "mock" (demo mode) or ""'
    )
    created_by: str
    created_at: datetime
    updated_at: datetime
    signed_by: str
    signer_title: str = strawberry.field(
        description='As the letter shows it: "Dr. Ana Rivera, DVM"'
    )
    signed_at: datetime | None
    sent_to: list[str] = strawberry.field(description="Where it went, in words")
    sent: list[LetterSend]
    opened_at: datetime | None
    view: str = strawberry.field(
        description='"full", or "summary" for front office and admins who aren\'t '
        "vets (kind, recipient name, status, where it went; no letter or PDF)"
    )
    pdf_url: str


@strawberry.type(description="What one channel did, or in demo mode would do")
class LetterChannelResult:
    channel: str
    status: str = strawberry.field(
        description='"sent", "preview" (nothing went out), "failed", "skipped" or '
        '"ready" (print)'
    )
    detail: str
    to: str = strawberry.field(description="email: the address")
    subject: str = strawberry.field(description="email: the subject")
    body: str = strawberry.field(description="email: the message text")
    text: str = strawberry.field(description="owner_text: the text message")
    url: str = strawberry.field(
        description="owner_text: the owner's link; email: the view online link"
    )
    pdf_url: str
    expires_at: str | None


@strawberry.type
class SendLetterResult:
    letter: Letter
    results: list[LetterChannelResult]


@strawberry.input
class LetterRecipientInput:
    name: str = ""
    clinic: str = ""
    email: str = ""


@strawberry.input
class LetterPhotoInput:
    encounter_id: str
    photo_id: str


@strawberry.input
class LetterAttachmentsInput:
    note_encounter_ids: list[str] = strawberry.field(default_factory=list)
    photos: list[LetterPhotoInput] = strawberry.field(default_factory=list)
    document_ids: list[str] = strawberry.field(default_factory=list)
    invoice_ids: list[str] = strawberry.field(default_factory=list)


@strawberry.input(description="Leave a field out to keep it as it is")
class LetterInput:
    kind: str | None = strawberry.field(
        default=None, description='"referral", "records" or "owner"'
    )
    recipient: LetterRecipientInput | None = None
    reason: str | None = None
    urgency: str | None = strawberry.field(
        default=None, description='"routine", "soon" or "urgent"'
    )
    attachments: LetterAttachmentsInput | None = None
    body: str | None = None
    owner_consent: bool | None = None


# ---------- helpers ----------
def _letters(info: Info) -> Letters:
    service: Letters = info.context.parts.letters
    return service


def _input(data: LetterInput | None) -> dict[str, Any] | None:
    return strawberry.asdict(data) if data is not None else None


def _refused(exc: ValueError) -> HTTPException:
    if isinstance(exc, LetterError):
        return HTTPException(exc.status, str(exc))
    return HTTPException(400, "Check the letter's fields.")  # pydantic: out of range


def _sync[T](step: Callable[[], T]) -> T:
    try:
        return step()
    except ValueError as exc:
        raise _refused(exc) from exc


async def _run[T](step: Callable[[], Awaitable[T]]) -> T:
    try:
        return await step()
    except ValueError as exc:
        raise _refused(exc) from exc


def _request_base(info: Info) -> str:
    """This request's address. Letters uses it for a link only in demo mode;
    otherwise only BLINQ_SCRIBE_PUBLIC_URL (see Letters._link_base)."""
    return str(info.context.http_request().base_url)


# ---------- queries ----------
async def letters(info: Info, patient_id: str) -> list[Letter]:
    who = info.context.caller()
    return many(Letter, _letters(info).readable_for_patient(who, patient_id))


async def letter(info: Info, id: str) -> Letter:
    who = info.context.caller()
    return shaped(Letter, _sync(lambda: _letters(info).readable(who, id)))


async def contacts(info: Info, q: str = "") -> list[LetterRecipient]:
    info.context.caller()
    return many(LetterRecipient, _letters(info).contacts(q))


async def letterhead(info: Info) -> Clinic:
    info.context.caller()
    return shaped(Clinic, (await info.context.parts.adapter.get_clinic()).model_dump())


@strawberry.type
class LettersQuery:
    letters: list[Letter] = strawberry.field(
        resolver=letters, description="A pet's letters, newest first"
    )
    letter: Letter = strawberry.field(resolver=letter, description="One letter")
    letterhead: Clinic = strawberry.field(
        resolver=letterhead,
        description="The clinic's name, address, phone and logo for a letter",
    )
    contacts: list[LetterRecipient] = strawberry.field(
        resolver=contacts,
        description="Saved contacts: specialists and clinics from past letters",
    )


# ---------- mutations ----------
async def create_letter(
    info: Info,
    patient_id: str = "",
    encounter_id: str = "",
    input: LetterInput | None = None,
    draft: bool = True,
) -> Letter:
    who = info.context.caller()
    fields = _sync(lambda: fields_from(_input(input)))
    out = await _run(
        lambda: _letters(info).create(who, patient_id, encounter_id, fields, draft)
    )
    return shaped(Letter, out)


async def draft_letter(info: Info, id: str) -> Letter:
    who = info.context.caller()
    return shaped(Letter, await _run(lambda: _letters(info).draft(who, id)))


async def update_letter(info: Info, id: str, input: LetterInput) -> Letter:
    who = info.context.caller()
    fields = _sync(lambda: fields_from(_input(input)))
    out = await _run(lambda: _letters(info).update(who, id, fields))
    return shaped(Letter, out)


async def send_letter(
    info: Info,
    id: str,
    channels: list[str],
    to_email: str = "",
    owner_copy: bool = False,
) -> SendLetterResult:
    who = info.context.caller()
    wanted = channels_from(channels)
    out = await _run(
        lambda: _letters(info).send(
            who, id, wanted, to_email, owner_copy, _request_base(info)
        )
    )
    return SendLetterResult(
        letter=shaped(Letter, out["letter"]),
        results=many(LetterChannelResult, out["results"]),
    )


async def delete_letter(info: Info, id: str) -> bool:
    who = info.context.caller()
    await _run(lambda: _letters(info).delete(who, id))
    return True


@strawberry.type
class LettersMutation:
    create_letter: Letter = strawberry.mutation(
        resolver=create_letter,
        description="Start a letter (kind referral, records or owner) for a pet, "
        "from a visit (encounter_id: its signed note is attached) or from the record "
        "(patient_id). Returns Blinq's draft unless draft is false",
    )
    draft_letter: Letter = strawberry.mutation(
        resolver=draft_letter,
        description="Blinq drafts the body again, from the signed notes, the "
        "attachments and the reason only; gaps become [confirm: ...]. Mock in demo "
        "mode",
    )
    update_letter: Letter = strawberry.mutation(
        resolver=update_letter,
        description="Edit a draft: recipient, reason, attachments, body, "
        "owner_consent. Refused once signed",
    )
    send_letter: SendLetterResult = strawberry.mutation(
        resolver=send_letter,
        description="Sign and send in one step (or send again): channels email "
        "(one PDF to to_email or the recipient), owner_text, owner_email and print; "
        "owner_copy adds a text to the owner. Refused while anything is marked to "
        "confirm, or without owner_consent for another clinic",
    )
    delete_letter: bool = strawberry.mutation(
        resolver=delete_letter, description="Delete a draft. Sent letters stay"
    )
