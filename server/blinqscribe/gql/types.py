"""GraphQL object and input types.

Resolvers return the same values the REST routes do: Pydantic models and plain dicts.
Fields resolve by name from either (see `field_value` in schema.py), so these classes
describe the shapes and never copy data. Enum-like values stay strings, with the
allowed values in each description, so GraphQL and REST read the same.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON

from .. import permissions
from .context import Context


def shaped[T](_: type[T], value: Any) -> T:
    """Declare that a handler's value (a Pydantic model or a dict) has the shape of
    this GraphQL type. Nothing is copied: its fields resolve by name."""
    return cast(T, value)


def many[T](_: type[T], value: Any) -> list[T]:
    return cast(list[T], value)


@strawberry.type(
    description="What the signed-in person may do on this visit, from their role and "
    "whether it's their own (requirement 62). Permissions only: a signed note is "
    "still locked whatever these say"
)
class VisitCan:
    start: bool = strawberry.field(description="Start the visit (consent, record)")
    record: bool = strawberry.field(description="Add audio, transcript and photos")
    draft: bool = strawberry.field(description="Write the note")
    edit: bool = strawberry.field(description="Edit the note, note type, edit tools")
    approve: bool = strawberry.field(description="Approve, dismiss or book follow ups")
    sign: bool
    edit_photos: bool
    remember: bool = strawberry.field(description="Keep or forget Remember items")
    write_letter: bool
    share: bool = strawberry.field(description="Share a signed summary")
    resend: bool = strawberry.field(description="Resend a booking link")


def visit_can(
    root: strawberry.Parent[Any], info: strawberry.Info[Context, None]
) -> VisitCan:
    # An appointment on a by-column practice is its column vet's.
    vet = root.provider_id or getattr(root, "column_vet_id", "")
    who, provider_id = info.context.caller(), str(vet or "")

    def may(action: str) -> bool:
        return permissions.can(who, action, provider_id)

    return VisitCan(
        # Any vet may start an appointment booked with no provider; it's theirs then.
        start=permissions.can(who, "visit.start", provider_id, ownerless_ok=True),
        record=may("visit.record"),
        draft=may("visit.draft"),
        edit=may("note.edit"),
        approve=may("followup.act"),
        sign=may("note.sign"),
        edit_photos=may("photo.edit"),
        remember=may("remember.keep"),
        write_letter=may("letter.write"),
        share=may("summary.share"),
        resend=may("link.resend"),
    )


# ---------- practice data ----------


@strawberry.type(description="A pet owner, as the practice system shares them.")
class Client:
    id: strawberry.ID
    first_name: str
    last_name: str
    full_name: str
    phones: list[str]
    emails: list[str]
    prefers: str = strawberry.field(description='"text", "email", "phone" or ""')
    reminders: str
    client_since: str = strawberry.field(description="YYYY-MM-DD or empty")


@strawberry.type(description="An alert with its short chip label")
class AlertChip:
    text: str = strawberry.field(description="The full alert")
    short: str = strawberry.field(description='About 18 characters: "Towel wrap"')


@strawberry.type
class Patient:
    id: strawberry.ID
    name: str
    species: str
    breed: str
    age: int | None
    alerts: list[str]
    alert_chips: list[AlertChip]
    sex: str
    color: str
    microchip: str
    client_id: str
    pims_notes: list[str] = strawberry.field(
        description="Short notes the practice system keeps on the pet beyond its "
        "alerts (Fear Free and handling notes, medicines given at home), never a "
        "medical note. Empty when the system has no such field"
    )
    last_visit: LastVisit | None = strawberry.field(
        description="The last visit before today, when the practice system sends "
        "it with the schedule"
    )
    weight: WeightReading | None = strawberry.field(
        description="The newest weight on file, when the practice system sends it "
        "with the schedule"
    )


@strawberry.type(
    description="One pet on a household appointment (several pets booked as one "
    "visit), with its own reason and where its note stands."
)
class VisitPet:
    patient: Patient
    reason: str
    visit_status: str = strawberry.field(
        description='"not_started", "recording", "draft_ready" or "signed"'
    )
    encounter_id: str


@strawberry.type(description="One appointment on the schedule.")
class Appointment:
    id: strawberry.ID
    start: datetime = strawberry.field(description="Clinic-local wall time")
    duration_min: int
    reason: str
    type: str
    status: str
    provider_id: str
    provider_name: str
    room: str
    patient: Patient
    client: Client
    visit_status: str = strawberry.field(
        description='"not_started", "recording", "draft_ready" or "signed"'
    )
    encounter_id: str
    audio_live: bool = strawberry.field(
        description="Audio is arriving for the visit now (a part in the last 30 "
        'seconds, from the glasses or a console): show "Recording"'
    )
    note_type: str
    column_vet_id: str = strawberry.field(
        description="Practices that schedule by column: the column's vet, or empty"
    )
    column_vet_name: str
    pets: list[VisitPet] = strawberry.field(
        description="A household appointment: every pet booked in it, the "
        "appointment's pet first. Empty for a visit booked for one pet"
    )
    started_at: datetime | None = strawberry.field(
        description="When the visit started in Blinq Scribe, clinic-local wall time"
    )
    checked_in_at: datetime | None = strawberry.field(
        description="When the practice system checked the pet in (clinic-local), "
        "or null"
    )
    demo_clock: str = strawberry.field(
        description="Demo clinic only: its busy day reads as it stands at this "
        'clinic-local time ("13:15"). Empty everywhere else'
    )
    synced_at: datetime | None = strawberry.field(
        description="When Blinq Scribe read this schedule from the practice system, "
        "clinic-local wall time"
    )
    can: VisitCan = strawberry.field(
        resolver=visit_can, description="What you may do on this visit"
    )


@strawberry.type(description="One heading of a written note and what it says.")
class PastNoteSection:
    label: str = strawberry.field(
        description='"Subjective", "Objective", "Assessment", "Plan", a note type\'s '
        'own heading ("History", "Since last visit"...), "Vitals", "Medications"'
    )
    text: str


@strawberry.type(description="A note from an earlier visit, by any vet.")
class PastNote:
    id: strawberry.ID
    patient_id: str
    date: datetime
    provider_id: str
    provider_name: str
    text: str
    source: str = strawberry.field(description='"pims" or "blinq"')
    sections: list[PastNoteSection] = strawberry.field(
        description="The note by its headings, for SOAP form; empty when it has "
        "none (show text then)"
    )


@strawberry.type
class Slot:
    start: datetime
    end: datetime
    provider_id: str
    service_id: str
    booking_url: str


# ---------- the visit ----------


@strawberry.type
class SoapNote:
    subjective: str
    objective: str
    assessment: str
    plan: str
    vitals: JSON = strawberry.field(description="Vital name to value, as written")
    medications: list[str]
    client_summary: str = strawberry.field(description="For the owner, plain English")
    vitals_by: str = strawberry.field(
        description='Who said the vitals when a tech did: "tech Priya"; else empty'
    )


@strawberry.type(description="A text to the owner, sent or shown as a preview.")
class SmsResult:
    status: str = strawberry.field(description='"sent", "preview", "skipped", "failed"')
    detail: str
    text: str
    to_masked: str
    provider_id: str
    at: datetime | None


@strawberry.type(description="One thing on its way to the PIMS, and where it stands.")
class PimsItem:
    kind: str = strawberry.field(description='"note", "photo" or "prescription"')
    id: str = strawberry.field(description='"note", the photo\'s id, or "prescription"')
    label: str = strawberry.field(
        description='"Note", "Photo: Left ear", "Prescription"'
    )
    status: str = strawberry.field(
        description='One of: "sending", "synced" (saved; see synced_at and pims_id), '
        '"not_sent" (signed only, or the PIMS can\'t take it yet: detail says which) '
        'or "failed" (couldn\'t save; tried again every 5 minutes)'
    )
    synced_at: datetime | None
    pims_id: str
    detail: str


@strawberry.type(description="What the practice system did with one write.")
class WriteBackResult:
    ok: bool
    status: str = strawberry.field(
        description='One of: "written" (in the practice system), '
        '"queued_for_staff" (not in it: the front desk will file it, and Send to PIMS '
        'can try again), "failed" (couldn\'t save: tried again every 5 minutes, then '
        'the front desk after an hour) or "not_sent" (signed only: Send to PIMS)'
    )
    detail: str
    pims_id: str
    start: datetime | None
    at: datetime | None


@strawberry.type(description="An online booking link texted to the owner.")
class BookingLink:
    url: str
    from_: str = strawberry.field(name="from", description="First day, YYYY-MM-DD")
    to: str
    expires_at: datetime | None
    status: str = strawberry.field(
        description='"queued", "sent", "opened", "booked" or "expired"'
    )
    sent_at: datetime | None
    booked_start: datetime | None
    pets: list[str] = strawberry.field(
        description="One link for several pets of the same owner seen that day: "
        "every pet it books, in the visit's order. Empty for one pet"
    )


@strawberry.type
class FollowUp:
    id: strawberry.ID
    kind: str = strawberry.field(
        description='"recheck", "client_update", "callback", "lab_result" or "task"'
    )
    reason: str
    title: str = strawberry.field(
        description='Short, made by the server for display: "Recheck: ear '
        'infection", at most 60 characters. Use it instead of reason in rows and '
        "sentences"
    )
    due_in_days: int | None
    message_draft: str
    suggested_slots: list[Slot]
    status: str = strawberry.field(description='"draft", "approved" or "dismissed"')
    sms: SmsResult | None
    booked_slot: Slot | None
    booking: WriteBackResult | None
    booking_mode: str = strawberry.field(description='"link" or "book"')
    booking_link: BookingLink | None
    suggest_letter: bool = strawberry.field(
        description="A referral: offer Create referral letter"
    )
    remind_unbooked: bool = strawberry.field(
        description="A booking link not booked 3 days after it was sent gets one "
        "reminder text"
    )
    reminder: SmsResult | None = strawberry.field(
        description="That reminder text, once it went (or was tried)"
    )


@strawberry.type(
    description="An outlined area, in 0..1 fractions of the displayed photo"
)
class OutlineRegion:
    label: str
    box: list[float] = strawberry.field(description="[x0, y0, x1, y1]")
    polygon: list[list[float]] = strawberry.field(description="[x, y] points, or []")


@strawberry.type(
    description="The part of the displayed photo to show, 0..1 from the top left"
)
class Crop:
    x: float
    y: float
    w: float
    h: float


@strawberry.type(
    description="An exam photo. The original file, at /api/encounters/{id}/photos/"
    "{photo id}, is never changed: crop, rotation and outline are drawn on top of it. "
    "Coordinates are 0..1 of the photo as a browser displays it (EXIF orientation "
    "applied), from the top left; rotation is applied after the crop"
)
class Photo:
    id: strawberry.ID
    label: str = strawberry.field(description="What it is, e.g. Left ear canal")
    caption: str = strawberry.field(
        description="Blinq's short description of what's visible, never a diagnosis. "
        "Editable; the vet's own words are kept as written"
    )
    findings: str = strawberry.field(
        description="Blinq's longer description, same rule"
    )
    segments: JSON = strawberry.field(
        description="SAM 3.1's outlines as returned: [{label, score, box}]"
    )
    outline: list[OutlineRegion] = strawberry.field(
        description="The outline shown and edited (starts as SAM's)"
    )
    crop: Crop | None
    rotation: int = strawberry.field(description="0, 90, 180 or 270, clockwise")
    in_note: bool = strawberry.field(
        description="Written back with the signed note and read by the draft"
    )
    show_owner: bool = strawberry.field(description="Shown in the owner's summary")
    taken_at: datetime
    edited_at: datetime | None
    source_orientation: int = strawberry.field(
        description="The file's EXIF orientation, 1 to 8 (1 = upright). Browsers "
        "apply it; coordinates are already relative to the upright photo"
    )


@strawberry.type(description="One transcript line and who said it")
class Segment:
    id: strawberry.ID
    line: int = strawberry.field(description="Its line in the transcript, from 1")
    speaker_id: str = strawberry.field(
        description='"vet", "owner", "speaker-3"...; "" when Blinq isn\'t sure'
    )
    speaker_name: str = strawberry.field(
        description='"Dr. Ana Rivera", "Speaker 3"; "" when Blinq isn\'t sure'
    )
    role: str = strawberry.field(
        description='"vet", "owner", "tech", "family", "other_vet", "other" or '
        '"unknown"'
    )
    offset_seconds: int = strawberry.field(description="Time into the visit")
    text: str
    pets: list[str] = strawberry.field(
        description="A visit with several pets: the pets this line is about (one, "
        "several when it names them, or the ones it could be about when pet_sure is "
        "false). Empty for one pet"
    )
    pet_sure: bool = strawberry.field(
        description="False when Blinq couldn't tell which pet the line is about"
    )


@strawberry.type(description="Enter the prescription in the PIMS: a front desk task")
class PrescriptionTask:
    text: str = strawberry.field(
        description='"Enter Cefpodoxime for Biscuit in the PIMS"'
    )
    medications: list[str]
    done_by: str = strawberry.field(description="Who marked it entered; empty until")
    done_by_user: str
    done_at: datetime | None


@strawberry.type(
    description="A line of the provider's own last plan, ticked to cover today, that "
    "the visit didn't talk about. Quoted as written. A reminder: never blocks signing"
)
class PlanReminder:
    id: strawberry.ID
    text: str
    status: str = strawberry.field(description='"open", "added" or "dismissed"')


@strawberry.type(description="One visit for one pet: transcript, note, follow ups.")
class Encounter:
    id: strawberry.ID
    appointment_id: str
    patient_id: str
    provider_id: str
    provider_name: str
    consent_recorded: bool
    source: str = strawberry.field(description='"glasses", "web" or "upload"')
    status: str = strawberry.field(description='"recording", "draft_ready" or "signed"')
    transcript: str
    segments: list[Segment] = strawberry.field(
        description="Who said each transcript line (empty where the transcript is "
        "hidden)"
    )
    parts_received: int = strawberry.field(
        description="Audio parts received from the glasses or the console"
    )
    last_part: int = strawberry.field(
        description="The highest audio part number received, or -1"
    )
    first_part_at: datetime | None = strawberry.field(
        description="When the first audio part arrived: the recording timer's start"
    )
    last_part_at: datetime | None = strawberry.field(
        description="When the latest audio part arrived (glasses or a console)"
    )
    audio_seconds: float = strawberry.field(
        description="How much audio was recorded, in seconds"
    )
    note: SoapNote | None
    followups: list[FollowUp]
    photos: list[Photo]
    created_at: datetime
    signed_at: datetime | None
    signed_by: str
    signed_by_user: str
    signed_by_provider_id: str
    started_by: str
    write_back: WriteBackResult | None
    pims_items: list[PimsItem] = strawberry.field(
        description="The note, each photo with it and the prescription, and where "
        "each stands in the PIMS; empty until signed"
    )
    pims_failing_since: datetime | None
    pims_next_try_at: datetime | None = strawberry.field(
        description="When a failed save is tried again; null unless retrying"
    )
    prescription_task: PrescriptionTask | None = strawberry.field(
        description="The front desk's task to enter the prescription in the PIMS, "
        "from the signature; null when the note has no medications"
    )
    patient_ids: list[str]
    patient_name: str
    client_id: str
    owner_name: str
    note_type: str
    group_id: str
    view: str = strawberry.field(
        description='"full" (your visit), "view_only" (another vet\'s signed note: no '
        'transcript) or "status" (status only: a draft in progress, or front office)'
    )
    hidden: str = strawberry.field(
        description='Why parts are empty, e.g. "Draft in progress"; "" when full'
    )
    plan_reminders: list[PlanReminder] = strawberry.field(
        description="Lines of the last plan the provider asked to cover today that "
        "the visit didn't, from the draft"
    )
    can: VisitCan = strawberry.field(
        resolver=visit_can, description="What you may do on this visit"
    )


@strawberry.type
class PimsRecordRef:
    name: str
    pims_id: str


@strawberry.type
class SignPreviewAppointment:
    id: str
    start: datetime
    patient_name: str
    owner_name: str


@strawberry.type
class FollowingText:
    followup_id: str
    kind: str
    reason: str
    message: str = strawberry.field(description="The text the owner will get")


@strawberry.type(
    description="The confirm panel before signing: where the note goes, what goes, "
    "and the texts that follow"
)
class SignPreview:
    pims_name: str = strawberry.field(
        description='The practice system\'s real name ("" when unknown); data only, '
        'screens say "PIMS"'
    )
    patient: PimsRecordRef
    owner: PimsRecordRef
    appointment: SignPreviewAppointment | None
    matches: bool = strawberry.field(
        description="The note's pet is the one on the visit's appointment"
    )
    mismatch: str = strawberry.field(description='What to check; "" when it matches')
    note: bool
    photos: int = strawberry.field(description="Photos going with the note")
    prescription: list[str] = strawberry.field(
        description="The note's medications; prescriptions aren't sent to the PIMS yet"
    )
    texts: list[FollowingText]


@strawberry.type
class SignResult:
    encounter: Encounter
    write_back: WriteBackResult


@strawberry.type
class AuditEntry:
    ts: str
    actor: str
    action: str
    detail: JSON


@strawberry.type
class NoteSection:
    key: str
    label: str


@strawberry.type
class NoteType:
    id: strawberry.ID
    name: str
    sections: list[NoteSection]
    from_types: list[str]


@strawberry.type
class SourceLink:
    sentence: str
    lines: list[int] = strawberry.field(description="Transcript line numbers, from 1")
    text: str


@strawberry.type(description="An edit tool suggestion. Nothing is saved.")
class AssistResult:
    suggestion: str
    sources: list[SourceLink]
    unsourced: list[str]
    refused: str
    mock: bool


@strawberry.type
class Template:
    id: strawberry.ID
    name: str
    shortcut: str
    text: str
    note_type: str
    owner: str = strawberry.field(description='"me" or "clinic"')


@strawberry.type(description="A booking link sent and not booked yet.")
class WaitingLink:
    encounter_id: str
    followup_id: str
    patient_id: str
    patient_name: str
    owner_name: str
    reason: str
    title: str = strawberry.field(
        description='Short, made by the server for display: "Recheck: ear '
        'infection", at most 60 characters. Use it instead of reason in rows and '
        "sentences"
    )
    url: str
    sent_at: str | None
    days_waiting: int
    status: str
    pets: list[str] = strawberry.field(
        description="One link for several pets: every pet it books. Empty for one"
    )


@strawberry.type(
    description="A note not signed yet, from any day, in its bucket: ready (drafted, "
    "nothing to confirm, every follow up decided) or pending"
)
class NoteToSign:
    encounter_id: str
    appointment_id: str
    patient_id: str
    patient_name: str
    owner_name: str
    client_id: str
    provider_id: str
    provider_name: str
    date: str = strawberry.field(description="The visit's day, YYYY-MM-DD")
    time: str = strawberry.field(description="The visit's clinic time, HH:MM")
    visit_reason: str
    assessment: str = strawberry.field(
        description="The first line of the draft's assessment"
    )
    status: str = strawberry.field(description='"draft_ready" or "recording"')
    bucket: str = strawberry.field(description='"ready" or "pending"')
    to_confirm: int
    followups_undecided: int
    reason: str = strawberry.field(
        description='What is left, for a pending note: "1 thing to confirm, 1 follow '
        'up to decide", or "Not drafted yet". Empty when ready'
    )
    waiting_days: int = strawberry.field(description="Days since the visit")


@strawberry.type
class RememberSuggestion:
    id: strawberry.ID
    text: str
    kind: str
    date: str | None
    transcript_lines: list[str]
    said_by: str = strawberry.field(
        description='Who said it, as the transcript labels it: "Jordan Lee · Owner"'
    )
    kept: bool


@strawberry.type
class RememberSuggestions:
    suggestions: list[RememberSuggestion]
    left_out: int
    mock: bool


@strawberry.type(description="Something the owner shared, kept for staff only.")
class RememberItem:
    id: strawberry.ID
    client_id: str
    patient_id: str
    patient_name: str
    text: str
    kind: str
    date: str | None
    said_at: str
    encounter_id: str
    expires_at: str | None
    kept_by: str
    said_by: str | None = strawberry.field(
        description='Who said it, as the transcript labels it: "Jordan Lee · Owner"'
    )


# ---------- owner summary ----------


@strawberry.type
class Clinic:
    name: str
    address: str
    phone: str
    logo_url: str
    pims_name: str = strawberry.field(
        description='The practice system\'s real name; "" when unknown. Data only: '
        'screens say "PIMS"'
    )


@strawberry.type
class NextVisit:
    kind: str = strawberry.field(description='"booked", "pick_a_time" or "none"')
    text: str
    url: str


@strawberry.type(description="A photo the vet chose to show the owner")
class SummaryPhoto:
    id: strawberry.ID
    encounter_id: str
    label: str
    caption: str
    url: str
    crop: Crop | None
    rotation: int


@strawberry.type(description="When the visit was and who saw the pets")
class SummaryVisit:
    date: str = strawberry.field(description="YYYY-MM-DD, clinic-local")
    start: str | None = strawberry.field(
        description="The appointment time, clinic-local ISO, or null"
    )
    when: str = strawberry.field(
        description="Ready to show, in the summary's language: \"Sat, Oct 31, 2026 at "
        '1:30 PM" or "sáb. 31 de oct. de 2026, 1:30 p. m."'
    )
    provider_name: str = strawberry.field(
        description="The vet who signed, else the booked vet"
    )


@strawberry.type
class SummaryPet:
    patient_id: str
    name: str
    species: str = strawberry.field(description="As the record has it; may be empty")
    breed: str
    sex: str
    age: int | None = strawberry.field(description="Years; 0 is under a year")
    age_text: str = strawberry.field(description='"6 years" or "6 años"; may be empty')
    for_owner: str
    medicines: list[str]
    home_care: list[str]
    next_visit: NextVisit
    photos: list[SummaryPhoto]


@strawberry.type
class OwnerSummary:
    clinic: Clinic
    language: str
    visit: SummaryVisit
    owner_name: str = strawberry.field(description="First and last name only")
    pets: list[SummaryPet]
    when_to_call: str
    translated: bool
    mock: bool


@strawberry.type
class ShareResult:
    channel: str
    language: str
    status: str = strawberry.field(description='"preview", "sent", "ready" or "failed"')
    detail: str
    text: str
    url: str
    pdf_url: str
    expires_at: str | None
    translated: bool


# ---------- the day ----------


@strawberry.type(description="One day on the week strip.")
class DaySummary:
    date: str
    visits: int
    open: int
    failed: int
    marker: str = strawberry.field(description='"failed", "open", "done" or "none"')


@strawberry.type(
    description="Something still to do: sign, approve, a failed text, queued."
)
class OpenItem:
    kind: str = strawberry.field(
        description='"unsigned", "followup", "failed_text", "not_sent" (signed '
        'only: send it to the PIMS), "pims_failed" (couldn\'t save yet, retrying), '
        '"queued" (for the front desk) or "prescription" (the front desk enters it '
        "in the PIMS)"
    )
    text: str = strawberry.field(
        description="The whole sentence, for Read aloud and the glasses"
    )
    title: str = strawberry.field(
        description='A short row label without the pet, e.g. "Sign note"'
    )
    label: str = strawberry.field(
        description="The To do row's short title with the pet or owner, e.g. "
        '"Sign Pepper\'s note", "Approve Max\'s follow up", '
        '"Text to Jordan didn\'t send". The whole sentence stays in text'
    )
    encounter_id: str
    appointment_id: str
    patient_id: str
    client_id: str = strawberry.field(
        default="", description="The owner, so their visit can show what failed"
    )
    owner_name: str = strawberry.field(
        default="", description="The owner's name, to group one owner's rows"
    )
    date: str
    patient_name: str
    status: str | None
    followup_id: str | None
    followup_kind: str | None
    reason: str | None
    what: str | None
    detail: str | None = strawberry.field(
        description="A short line under the title: the follow up's reason, "
        '"To Jordan Lee", "Draft ready", or why it was queued'
    )


@strawberry.type
class PendingFollowUp:
    encounter_id: str
    followup_id: str
    kind: str
    reason: str
    title: str = strawberry.field(description='"Approve follow up: <short reason>"')
    patient_id: str
    patient_name: str
    appointment_id: str = strawberry.field(description="The visit's appointment")


@strawberry.type
class HeadsUp:
    text: str
    appointment_id: str
    patient_id: str
    patient_name: str
    time: str


@strawberry.type
class Update:
    kind: str = strawberry.field(description='"result", "reply" or "booked"')
    text: str
    detail: str = strawberry.field(
        description='A short line to show, e.g. "Kidney panel", "11:30 AM today"'
    )
    at: str
    patient_name: str
    patient_id: str
    appointment_id: str = strawberry.field(
        description="Today's appointment for the pet, or empty (booked: the booking)"
    )
    client_id: str = strawberry.field(description="The owner: a reply opens here")
    document_id: str = strawberry.field(
        description="A result: the received document in the pet's Documents, or empty"
    )
    mock: bool | None


@strawberry.type(description="One part of the brief's sentence")
class BriefPart:
    text: str
    emphasis: str = strawberry.field(
        description='"none", "bold" (what needs attention) or "failed" (bold and red)'
    )
    kind: str = strawberry.field(
        description='What a counted part counts: "visits", "needs" (To do\'s '
        'count), "failed", "new"; empty for the words between'
    )


@strawberry.type(description="The morning brief.")
class Brief:
    spoken: str
    sentence: list[BriefPart] = strawberry.field(
        description="The brief in one sentence, in parts to bold or color; what "
        '"needs you" is To do\'s count (requirement 71)'
    )
    suggestions: list[str] = strawberry.field(
        description="Two or three questions to ask about today, from today's data"
    )
    appointments: list[str]
    pending_followups: list[PendingFollowUp]
    date: str
    from_yesterday: list[OpenItem]
    heads_up: list[HeadsUp]
    new_since_yesterday: list[Update]
    mock: bool


@strawberry.type
class UnsignedNote:
    encounter_id: str
    patient: str
    status: str


@strawberry.type
class WaitingFollowUp:
    encounter_id: str
    followup_id: str
    patient: str
    kind: str
    reason: str


@strawberry.type
class ApprovedRecheck:
    encounter_id: str
    patient: str
    reason: str
    due_in_days: int | None
    booked_for: str | None
    link: str = strawberry.field(
        description='Its booking link: "queued", "sent", "opened", "booked", '
        '"expired", or "" when it has none'
    )


@strawberry.type
class QueuedItem:
    encounter_id: str
    patient: str
    what: str
    detail: str


@strawberry.type
class DoneItem:
    text: str
    encounter_id: str


@strawberry.type
class PrepareItem:
    text: str
    appointment_id: str
    patient_name: str


@strawberry.type
class Tomorrow:
    date: str
    visits: int
    first: str = strawberry.field(description='"HH:MM" or ""')
    last: str
    prepare: list[PrepareItem]


@strawberry.type(description="The end of day list.")
class EndOfDay:
    spoken: str
    date: str
    visits_seen: int
    appointments: int
    unsigned_notes: list[UnsignedNote]
    followups_waiting: list[WaitingFollowUp]
    rechecks_approved: list[ApprovedRecheck]
    rechecks_booked: int
    rechecks_waiting: int
    recheck_links_sent: int = strawberry.field(
        description="Rechecks whose booking link went to the owner"
    )
    recheck_links_booked: int = strawberry.field(
        description="Of those, how many the owner booked"
    )
    queued_for_staff: list[QueuedItem]
    not_started: list[str]
    left_to_do: list[OpenItem]
    done_today: list[DoneItem]
    waiting_on_owners: list[WaitingLink]
    tomorrow: Tomorrow


@strawberry.type
class LastNote:
    date: str
    by: str
    other_vet: bool
    gist: str


@strawberry.type(description="One line of a past plan, as a checkbox before the visit")
class WalkInItem:
    text: str = strawberry.field(
        description='The plan line in plain words: "Recheck in 4 weeks"'
    )
    status: str = strawberry.field(
        description='What the record says about it: "Was due Sep 28, not booked"'
    )
    note: str = strawberry.field(
        description='From the invoices: "30 tablets dispensed Aug 31, none since"'
    )
    checked: bool = strawberry.field(
        description="Ticked by the provider before the visit: asked to cover today. "
        "Set with set_plan_checks"
    )


@strawberry.type(description="One dated fact in Before you walk in, newest first")
class WalkInEntry:
    date: str = strawberry.field(description="YYYY-MM-DD")
    kind: str = strawberry.field(
        description='"message" (the owner\'s latest text), "result" (results that '
        'came in), "plan" (the last visit\'s plan, as checkboxes) or "visit" (a past '
        "visit about the same problem)"
    )
    who: str = strawberry.field(
        description="The owner's first name, or the provider who saw the pet"
    )
    mine: bool = strawberry.field(description="Written by the person reading")
    text: str = strawberry.field(
        description="The message as sent, or the visit's reason and summary"
    )
    items: list[WalkInItem]


@strawberry.type(description="What to know before walking in.")
class PreRoomCard:
    spoken: str
    take: str = strawberry.field(
        description="Blinq's one line on the visit, facts only: what came in since "
        "yesterday, then the last visit"
    )
    patient: str
    owner: str
    reason: str
    room: str
    alerts: list[str]
    last_visit: str
    promised: list[str]
    last_note: LastNote | None
    previous_notes: int
    remember: list[str]
    remember_items: list[RememberItem]
    medications: list[str] = strawberry.field(
        description="The newest visit's medications, as written"
    )
    why: list[str] = strawberry.field(
        description="Why the visit matters, as facts on record (the last visit, a "
        "recheck that was due, care due soon, results in, the owner's latest text "
        "quoted). Never advice"
    )
    prep: list[str] = strawberry.field(
        description='The same facts as short neutral chips: "Recheck overdue", '
        '"Owner messaged", "Results in"'
    )
    owner_message: OwnerMessage | None = strawberry.field(
        description="The owner's latest text, from the last two days"
    )
    last_visit_on: str = strawberry.field(
        description="The last visit's day, YYYY-MM-DD, or empty"
    )
    weight: str = strawberry.field(
        description='The latest weight on record, "72 lb", or empty'
    )
    walk_in: list[WalkInEntry] = strawberry.field(
        description="Before you walk in as dated facts, newest first. Never advice"
    )
    can_do_today: list[str] = strawberry.field(
        description='Care due within 30 days: "Rabies vaccine due Nov 21"'
    )


@strawberry.type(description="A text from the owner")
class OwnerMessage:
    who: str = strawberry.field(description="The owner's first name")
    text: str
    at: str


@strawberry.type
class SectionStyle:
    format: str = strawberry.field(description='"bullets" or "prose"')
    length: str = strawberry.field(description='"brief", "moderate" or "detailed"')


@strawberry.type
class SectionStyleEntry:
    section: str
    style: SectionStyle


def section_styles(root: strawberry.Parent[Any]) -> list[SectionStyleEntry]:
    return [
        SectionStyleEntry(section=k, style=shaped(SectionStyle, v))
        for k, v in root.sections.items()
    ]


@strawberry.type(description="How a vet writes, learned from their own notes.")
class VoiceProfile:
    provider_id: str
    notes_used: int
    abbreviations: list[str]
    source: str = strawberry.field(description='"synced" or "default" (demo only)')
    sections: list[SectionStyleEntry] = strawberry.field(
        resolver=section_styles, description="Format and length per SOAP section"
    )


# ---------- the patient record ----------


@strawberry.type
class VisitPhoto:
    id: strawberry.ID
    caption: str
    url: str


@strawberry.type(description="A past visit on the patient record.")
class PastVisit:
    id: strawberry.ID
    date: str
    type: str
    kind: str = strawberry.field(description='"sick", "wellness" or "other"')
    reason: str
    provider_name: str
    appointment_id: str
    summary: str
    related: bool
    note: str | None
    sections: list[PastNoteSection] = strawberry.field(
        description="The note by its headings, for SOAP form; empty when it has "
        "none (show note then)"
    )
    medications: list[str]
    photos: list[VisitPhoto]


@strawberry.type
class LastVisit:
    date: str
    reason: str
    type: str = strawberry.field(
        description='The visit type ("Sick", "Wellness"), or ""'
    )


@strawberry.type
class NextAppointment:
    date: str
    time: str
    appointment_id: str


@strawberry.type
class LatestMessage:
    at: str
    text: str


@strawberry.type(description="The owner's name and how to reach them")
class ClientContact:
    id: strawberry.ID
    name: str
    first_name: str
    last_name: str
    phones: list[str]
    emails: list[str]
    prefers: str
    reminders: str
    client_since: str


@strawberry.type
class ClientCard(ClientContact):
    latest_message: LatestMessage | None


@strawberry.type
class PetDetails:
    id: strawberry.ID
    name: str
    species: str
    breed: str
    age: int | None
    sex: str
    alerts: list[str]
    color: str
    microchip: str


@strawberry.type
class WeightReading:
    date: str
    value: float
    unit: str
    note: str | None


@strawberry.type
class Weights:
    latest: WeightReading | None = strawberry.field(
        description="The newest: a weight written in a visit's note when it is newer "
        "than the PIMS's"
    )
    previous: WeightReading | None = strawberry.field(
        description="The reading before a weight from a visit, for the change"
    )
    history: list[WeightReading]


@strawberry.type
class ReminderDue:
    patient_id: str
    patient_name: str
    text: str
    due: str


@strawberry.type(description="Another pet in the household")
class PetBasics:
    id: strawberry.ID
    name: str
    species: str
    breed: str
    age: int | None
    sex: str
    alerts: list[str]


@strawberry.type
class OtherPet(PetBasics):
    last_visit: LastVisit | None
    due: list[str]


@strawberry.type
class PanelVisit:
    id: strawberry.ID
    date: str
    kind: str = strawberry.field(description='"sick", "wellness" or "other"')
    type: str
    reason: str
    provider_name: str


@strawberry.type(
    description="The Record side panel on a visit page, read only: the pet, owner "
    "contact, other pets, weight, what's due and recent visits (lines, never notes)"
)
class RecordPanel:
    patient: PetDetails
    pims_patient_id: str = strawberry.field(
        description="The pet's id in the practice system (as the adapter gives it)"
    )
    pims_client_id: str = strawberry.field(description="The owner's id there")
    weight: Weights
    reminders_due: list[ReminderDue]
    recent_visits: list[PanelVisit] = strawberry.field(
        description="The latest visits, as many as the panel shows"
    )
    client: ClientContact | None
    other_pets: list[PetBasics]
    mock: bool


@strawberry.type(description="Patient record, Client and patient tab.")
class PatientProfile:
    patient: PetDetails
    weight: Weights
    reminders_due: list[ReminderDue]
    client: ClientCard | None
    other_pets: list[OtherPet]
    mock: bool


@strawberry.type
class InvoiceItem:
    name: str
    qty: float
    price: float | None


@strawberry.type
class Invoice:
    id: strawberry.ID
    date: str
    patient_id: str
    patient_name: str
    visit: str
    provider_name: str
    total: float
    status: str = strawberry.field(description='"paid" or "open"')
    items: list[InvoiceItem]
    paid_by: str | None


@strawberry.type(description="Patient record, Invoices tab. Never a card number.")
class InvoiceList:
    balance: float | None
    last_12_months: float
    last_payment: JSON | None = strawberry.field(description="{date, amount, paid_by}")
    invoices: list[Invoice]
    counts: JSON = strawberry.field(description='Invoices per pet id, plus "all"')
    mock: bool


@strawberry.type
class TodayVisit:
    appointment_id: str
    time: str
    reason: str
    visit_status: str
    encounter_id: str


@strawberry.type
class NextDue:
    text: str
    due: str = strawberry.field(description="The day, YYYY-MM-DD")
    state: str = strawberry.field(description='"overdue", "soon" or "later"')


@strawberry.type
class HouseholdPet:
    id: strawberry.ID
    name: str
    species: str
    breed: str
    age: int | None
    sex: str
    alerts: list[str]
    last_visit: LastVisit | None
    due: list[str]
    next_due: NextDue | None = strawberry.field(
        description="The reminder that comes first, for the Next due column"
    )
    tags: list[str] = strawberry.field(description='Plain facts, like "Senior"')
    alert_tags: list[str] = strawberry.field(description="Each alert's short label")
    today: TodayVisit | None
    spend_12m: float


@strawberry.type
class ComingUp:
    date: str
    text: str
    patient_name: str


@strawberry.type
class ClientMessage:
    at: str
    direction: str = strawberry.field(description='"in" or "out"')
    text: str


@strawberry.type(description="The household page.")
class Household:
    client: ClientCard
    pets: list[HouseholdPet]
    balance: float | None
    book_url: str = strawberry.field(
        description="The clinic's online booking link, or empty when it has none"
    )
    spend_12m: float
    coming_up: list[ComingUp]
    messages: list[ClientMessage]
    remember: list[RememberItem]
    mock: bool


@strawberry.type
class PetHit:
    id: strawberry.ID
    name: str
    species: str
    breed: str
    age: int | None
    client_id: str
    owner_name: str
    last_visit: LastVisit | None
    next_visit: NextAppointment | None


@strawberry.type
class OwnerHit:
    id: strawberry.ID
    name: str
    phone: str
    email: str
    pets: list[str]


@strawberry.type
class SearchResult:
    pets: list[PetHit]
    owners: list[OwnerHit]


@strawberry.type
class KeyPoint:
    text: str
    page: int


@strawberry.type(
    description="An outside record. The file is at .../documents/{id}/file."
)
class Document:
    id: strawberry.ID
    patient_id: str
    name: str
    pages: int
    content_type: str
    uploaded_at: str
    key_points: list[KeyPoint]
    mock: bool
    detail: str | None


# ---------- assistant, team, meta ----------


@strawberry.type(
    description="Where part of an answer points: a link chip or a source line"
)
class AssistLink:
    label: str
    to: str = strawberry.field(
        description='"visit", "record", "documents" or "household"'
    )
    appointment_id: str
    encounter_id: str
    date: str = strawberry.field(description="The visit's day, when it isn't today")
    patient_id: str
    client_id: str
    document_id: str


@strawberry.type
class AssistantReply:
    reply: str
    tools_used: list[str]
    links: list[AssistLink] = strawberry.field(
        description="Link chips to the visit or the record the answer is about"
    )
    sources: list[AssistLink] = strawberry.field(
        description="Where a clinical answer's facts came from"
    )
    followups: list[str] = strawberry.field(
        description="Two or three questions to ask next"
    )


@strawberry.type
class SpeechVoice:
    id: strawberry.ID
    name: str
    language: str
    gender: str


@strawberry.type(description="Read aloud: the server's voices, or the browser's")
class SpeechOptions:
    available: bool = strawberry.field(
        description="False: use the browser's voice (POST /api/speech answers 503)"
    )
    default_voice: str
    voices: list[SpeechVoice]


@strawberry.type
class Health:
    ok: bool
    ai: str
    practice: str
    stt: str
    sam: str
    sms: str
    tts: str = strawberry.field(description='Read aloud: "kokoro" or "browser"')
    busy_day: str = strawberry.field(
        description="The demo clinic's busy day (YYYY-MM-DD), or empty"
    )


@strawberry.type
class User:
    id: strawberry.ID
    username: str
    name: str
    provider_id: str
    role: str = strawberry.field(description='"vet" or "admin"')
    active: bool
    has_password: bool
    created_at: datetime
    email: str
    two_factor: bool = strawberry.field(description="Signs in with an email code too")
    two_factor_required: bool = strawberry.field(
        description="An admin requires the email code"
    )
    authenticator: bool = strawberry.field(
        description="Two step codes come from an authenticator app (email is backup)"
    )


@strawberry.type
class Invite:
    user: User
    invite_url: str


@strawberry.type(description="A vet in the practice, for the doctor picker")
class Doctor:
    id: strawberry.ID = strawberry.field(description="The vet's provider id")
    name: str


@strawberry.type
class Provider:
    id: strawberry.ID
    name: str
    linked_to: str


@strawberry.type
class OnboardReport:
    days: int
    patients: int
    notes: int
    purged: int
    removed: int
    failed_patients: int
    notes_supported: bool
    profiles_ready: list[str]


# ---------- subscriptions ----------


@strawberry.type(description="One step of writing the note.")
class DraftProgress:
    encounter_id: str
    run_id: str = strawberry.field(description="Same for every event of one draft")
    step: str = strawberry.field(
        description='"transcript", "photos", "soap", "followups", "confirm", '
        'then "done"; "error" if it stopped'
    )
    state: str = strawberry.field(description='"started", "done" or "failed"')
    detail: str
    patient_name: str
    at: datetime


@strawberry.type(description="What Ask Blinq is doing for one question.")
class AssistantTurn:
    turn_id: str
    kind: str = strawberry.field(description='"checking", then "reply"; or "error"')
    text: str
    tools_used: list[str]
    at: datetime


# ---------- inputs ----------


@strawberry.input
class NewEncounterInput:
    appointment_id: str
    consent_recorded: bool
    source: str = "web"
    patient_ids: list[str] = strawberry.field(default_factory=list)
    note_type: str = ""


@strawberry.input
class SoapNoteInput:
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    vitals: JSON = strawberry.field(default_factory=dict)
    medications: list[str] = strawberry.field(default_factory=list)
    client_summary: str = ""
    vitals_by: str = ""


@strawberry.input
class OutlineRegionInput:
    label: str = ""
    box: list[float] = strawberry.field(description="[x0, y0, x1, y1], 0..1")
    polygon: list[list[float]] = strawberry.field(default_factory=list)


@strawberry.input
class CropInput:
    x: float
    y: float
    w: float
    h: float


@strawberry.input(description="Only the fields sent change. Send crop: null to uncrop")
class PhotoEditInput:
    label: str | None = strawberry.UNSET
    caption: str | None = strawberry.UNSET
    findings: str | None = strawberry.UNSET
    outline: list[OutlineRegionInput] | None = strawberry.UNSET
    crop: CropInput | None = strawberry.UNSET
    rotation: int | None = strawberry.UNSET
    in_note: bool | None = strawberry.UNSET
    show_owner: bool | None = strawberry.UNSET


@strawberry.input
class FollowUpActionInput:
    action: str = strawberry.field(
        description='"approve", "dismiss", "retry_text" or "book"'
    )
    message_draft: str | None = None
    slot_start: datetime | None = None
    booking_mode: str | None = strawberry.field(
        default=None, description='"link" or "book"'
    )
    remind_unbooked: bool | None = strawberry.field(
        default=None,
        description="With a booking link: one reminder text if it isn't booked 3 "
        "days after it was sent (on unless false)",
    )


@strawberry.input
class AssistInput:
    section: str
    action: str = strawberry.field(
        description='"tighten", "bullets", "prose", "repull", "sources", '
        '"translate_es" or "custom"'
    )
    text: str | None = None
    instruction: str = ""


@strawberry.input
class TemplateInput:
    name: str
    shortcut: str
    text: str
    note_type: str = ""
    owner: str = "me"


@strawberry.input
class ChatTurnInput:
    role: str
    content: str


@strawberry.input
class AssistantInput:
    message: str
    history: list[ChatTurnInput] = strawberry.field(default_factory=list)
    provider_id: str = ""
    appointment_id: str = ""
    patient_id: str = ""
    turn_id: str = strawberry.field(
        default="", description="Pick one to follow assistant_turn(turn_id)"
    )
    showing: str = strawberry.field(
        default="",
        description="The appointment already on screen (Morning's Up next card), so "
        "the answer doesn't repeat it",
    )


@strawberry.input
class NewUserInput:
    username: str
    name: str
    provider_id: str = ""
    role: str = "vet"
    email: str = ""


@strawberry.input
class UserUpdateInput:
    name: str | None = None
    email: str | None = None
    provider_id: str | None = None
    role: str | None = None
    active: bool | None = None
