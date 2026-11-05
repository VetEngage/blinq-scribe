"""Queries. Each one calls the REST route handler of the same operation."""

from __future__ import annotations

from datetime import date
from typing import Annotated, cast

import strawberry
from fastapi import HTTPException

from .context import Context
from .types import (
    Appointment,
    AuditEntry,
    Brief,
    DaySummary,
    Doctor,
    Document,
    Encounter,
    EndOfDay,
    Health,
    Household,
    InvoiceList,
    NoteToSign,
    NoteType,
    OwnerSummary,
    PastNote,
    PastVisit,
    PatientProfile,
    PreRoomCard,
    Provider,
    RecordPanel,
    RememberItem,
    RememberSuggestions,
    SearchResult,
    SignPreview,
    SpeechOptions,
    Template,
    User,
    VoiceProfile,
    WaitingLink,
    many,
    shaped,
)

Info = strawberry.Info[Context, None]


def health(info: Info) -> Health:
    return shaped(Health, info.context.ops.health())


async def sample_transcript(info: Info, appointment_id: str = "") -> str:
    who = info.context.caller()
    out = await info.context.ops.sample(appointment_id, who)
    return cast(str, out["text"])


async def schedule(
    info: Info, date: date | None = None, provider_id: str = ""
) -> list[Appointment]:
    who = info.context.caller()
    return many(Appointment, await info.context.ops.schedule(date, provider_id, who))


async def days(
    info: Info,
    start: Annotated[date | None, strawberry.argument(name="from")] = None,
    end: Annotated[date | None, strawberry.argument(name="to")] = None,
    provider_id: str = "",
) -> list[DaySummary]:
    who = info.context.caller()
    rows = await info.context.ops.week_strip(start, end, provider_id, who)
    return many(DaySummary, rows)


async def brief(info: Info, provider_id: str = "") -> Brief:
    who = info.context.caller()
    return shaped(Brief, await info.context.ops.brief(provider_id, who))


async def notes_to_sign(info: Info, provider_id: str = "") -> list[NoteToSign]:
    who = info.context.caller()
    return many(NoteToSign, await info.context.ops.unsigned_notes(provider_id, who))


async def end_of_day(
    info: Info, date: date | None = None, provider_id: str = ""
) -> EndOfDay:
    who = info.context.caller()
    return shaped(EndOfDay, await info.context.ops.end_of_day(date, provider_id, who))


async def pre_room_card(info: Info, appointment_id: str) -> PreRoomCard:
    who = info.context.caller()
    return shaped(
        PreRoomCard, await info.context.ops.pre_room_card(appointment_id, who)
    )


def voice_profile(info: Info, provider_id: str) -> VoiceProfile | None:
    info.context.caller()
    return shaped(VoiceProfile, info.context.ops.voice_profile(provider_id))


async def sign_preview(info: Info, encounter_id: str) -> SignPreview:
    who = info.context.caller()
    return shaped(SignPreview, await info.context.ops.sign_preview(encounter_id, who))


def patient_notes(info: Info, patient_id: str) -> list[PastNote]:
    who = info.context.caller()
    return many(PastNote, info.context.ops.patient_notes(patient_id, who))


async def search(info: Info, q: str) -> SearchResult:
    info.context.caller()
    return shaped(SearchResult, await info.context.ops.search(q))


async def patient_visits(
    info: Info,
    patient_id: str,
    type: Annotated[
        str, strawberry.argument(description='"sick", "wellness" or ""')
    ] = "",
    q: str = "",
    related_to: str = "",
) -> list[PastVisit]:
    who = info.context.caller()
    rows = await info.context.ops.patient_visits(patient_id, type, q, related_to, who)
    return many(PastVisit, rows)


async def patient_profile(info: Info, patient_id: str) -> PatientProfile:
    info.context.caller()
    found = await info.context.ops.patient_profile(patient_id)
    return shaped(PatientProfile, found)


async def client_invoices(
    info: Info, client_id: str, patient_id: str = ""
) -> InvoiceList:
    info.context.caller()
    found = await info.context.ops.client_invoices(client_id, patient_id)
    return shaped(InvoiceList, found)


async def client_household(info: Info, client_id: str) -> Household:
    info.context.caller()
    return shaped(Household, await info.context.ops.client_household(client_id))


def patient_documents(info: Info, patient_id: str) -> list[Document]:
    info.context.caller()
    return many(Document, info.context.ops.patient_documents(patient_id))


def note_types(info: Info) -> list[NoteType]:
    info.context.caller()
    return many(NoteType, info.context.ops.list_note_types())


def encounters(info: Info, group_id: str = "") -> list[Encounter]:
    who = info.context.caller()
    return many(Encounter, info.context.ops.list_encounters(group_id, who))


def encounter(info: Info, encounter_id: str) -> Encounter:
    who = info.context.caller()
    return shaped(Encounter, info.context.ops.get_encounter(encounter_id, who))


def encounter_audit(info: Info, encounter_id: str) -> list[AuditEntry]:
    info.context.caller()
    return many(AuditEntry, info.context.ops.audit(encounter_id))


def templates(info: Info, note_type: str = "") -> list[Template]:
    who = info.context.caller()
    return many(Template, info.context.ops.list_templates(note_type, who))


def waiting_followups(info: Info) -> list[WaitingLink]:
    who = info.context.caller()
    return many(WaitingLink, info.context.ops.waiting(who))


async def remember_suggestions(info: Info, encounter_id: str) -> RememberSuggestions:
    who = info.context.caller()
    found = await info.context.ops.remember_suggestions(encounter_id, who)
    return shaped(RememberSuggestions, found)


def client_remember(info: Info, client_id: str) -> list[RememberItem]:
    info.context.caller()
    return many(RememberItem, info.context.ops.client_remember(client_id))


async def owner_summary(
    info: Info, encounter_id: str, lang: str = "en"
) -> OwnerSummary:
    info.context.caller()
    found = await info.context.ops.owner_summary(encounter_id, _lang(lang))
    return shaped(OwnerSummary, found)


def users(info: Info) -> list[User]:
    info.context.admin()
    return many(User, info.context.ops.users())


async def providers(info: Info) -> list[Provider]:
    info.context.admin()
    return many(Provider, await info.context.ops.providers())


def speech_options(info: Info) -> SpeechOptions:
    info.context.caller()
    return shaped(SpeechOptions, info.context.parts.speech.options())


async def doctors(info: Info) -> list[Doctor]:
    info.context.caller()
    return many(Doctor, await info.context.ops.doctors())


async def record_panel(info: Info, patient_id: str) -> RecordPanel:
    who = info.context.caller()
    return shaped(RecordPanel, await info.context.ops.record_panel(patient_id, who))


@strawberry.type
class Query:
    record_panel: RecordPanel = strawberry.field(
        resolver=record_panel,
        description="Everything the visit page's Record panel shows, in one read. "
        "Read only and lock-free, so recording and draft_progress carry on",
    )
    doctors: list[Doctor] = strawberry.field(
        resolver=doctors,
        description="Every vet in the practice (provider id and name), for any "
        "signed-in role: the doctor picker",
    )
    speech_options: SpeechOptions = strawberry.field(
        resolver=speech_options,
        description="Voices for reading aloud. The clip itself is REST: POST "
        "/api/speech {text, voice} returns audio/wav",
    )
    health: Health = strawberry.field(
        resolver=health, description="Which models and data source are live or mock"
    )
    sample_transcript: str = strawberry.field(
        resolver=sample_transcript,
        description="The demo's sample visit: with appointment_id, that demo pet's "
        "own (demo clinic only; otherwise the generic one)",
    )
    schedule: list[Appointment] = strawberry.field(
        resolver=schedule, description="One day's appointments with their visit status"
    )
    days: list[DaySummary] = strawberry.field(
        resolver=days, description="Week strip: one entry per day, oldest first"
    )
    brief: Brief = strawberry.field(resolver=brief, description="Morning brief")
    end_of_day: EndOfDay = strawberry.field(
        resolver=end_of_day, description="End of day list"
    )
    notes_to_sign: list[NoteToSign] = strawberry.field(
        resolver=notes_to_sign,
        description="Every note not signed yet, any day, newest first, each in its "
        "bucket (Ready to sign or Pending): the Notes page",
    )
    pre_room_card: PreRoomCard = strawberry.field(
        resolver=pre_room_card, description="What to know before walking in"
    )
    voice_profile: VoiceProfile | None = strawberry.field(
        resolver=voice_profile,
        description="A vet's voice profile, or null until it has notes",
    )
    sign_preview: SignPreview = strawberry.field(
        resolver=sign_preview,
        description="The confirm panel before Sign and send or Sign only: where the "
        "note goes, what goes, the texts that follow",
    )
    patient_notes: list[PastNote] = strawberry.field(
        resolver=patient_notes,
        description="Earlier notes on the patient from every vet",
    )
    search: SearchResult = strawberry.field(
        resolver=search, description="Pets and owners: name, email or phone digits"
    )
    patient_visits: list[PastVisit] = strawberry.field(
        resolver=patient_visits, description="Past visits, newest first"
    )
    patient_profile: PatientProfile = strawberry.field(
        resolver=patient_profile,
        description="Patient details, weights, reminders and owner",
    )
    client_invoices: InvoiceList = strawberry.field(
        resolver=client_invoices, description="Invoices for a household, last 12 months"
    )
    client_household: Household = strawberry.field(
        resolver=client_household, description="The household page"
    )
    patient_documents: list[Document] = strawberry.field(
        resolver=patient_documents, description="Outside records with their key points"
    )
    note_types: list[NoteType] = strawberry.field(
        resolver=note_types, description="The note types and their sections"
    )
    encounters: list[Encounter] = strawberry.field(
        resolver=encounters,
        description="Visits, newest first; with group_id, one visit's pets",
    )
    encounter: Encounter = strawberry.field(resolver=encounter)
    encounter_audit: list[AuditEntry] = strawberry.field(
        resolver=encounter_audit, description="Audit log for a visit"
    )
    templates: list[Template] = strawberry.field(
        resolver=templates, description="Saved phrases: the vet's and the clinic's"
    )
    waiting_followups: list[WaitingLink] = strawberry.field(
        resolver=waiting_followups, description="Booking links sent and not booked yet"
    )
    remember_suggestions: RememberSuggestions = strawberry.field(
        resolver=remember_suggestions, description="Remember suggestions for a visit"
    )
    client_remember: list[RememberItem] = strawberry.field(
        resolver=client_remember, description="Kept Remember items for a household"
    )
    owner_summary: OwnerSummary = strawberry.field(
        resolver=owner_summary, description="The owner summary of a signed visit"
    )
    users: list[User] = strawberry.field(
        resolver=users, description="Everyone with a login"
    )
    providers: list[Provider] = strawberry.field(
        resolver=providers, description="Practice system providers, with who is linked"
    )


def _lang(lang: str) -> str:
    if lang not in ("en", "es"):
        raise HTTPException(400, 'Language is "en" or "es".')
    return lang
