"""Shared data shapes. Adapters, models and the API all speak these."""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from . import images

# ---------- practice data (comes from an adapter) ----------


class Client(BaseModel):
    id: str
    first_name: str = ""
    last_name: str = ""
    phones: list[str] = []
    emails: list[str] = []
    # Unknown stays empty: a live practice system may not share these yet.
    prefers: str = ""  # "text" | "email" | "phone"
    reminders: str = ""  # e.g. "On, by text"
    client_since: str = ""  # YYYY-MM-DD

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


SHORT_ALERT = 18  # the longest chip label, in characters
_ALERT_FILLER = {"use", "please", "the", "a", "an", "needs", "need"}


def cut_at_word(text: str, limit: int, more: str = "") -> str:
    """`text` in at most `limit` characters: cut after a whole word, with `more`
    ("…") added when cut. One word longer than that is cut inside."""
    if len(text) <= limit:
        return text
    room = limit - len(more)
    head = text[: room + 1].rsplit(" ", 1)[0] if " " in text[: room + 1] else ""
    return (head.rstrip(",;: ") or text[:room]) + more


def short_alert(text: str) -> str:
    """A chip label for an alert when the practice system has none: its first
    phrase, without filler words, cut at a word to SHORT_ALERT characters."""
    phrase = re.split(r"[,;:.(]", text, maxsplit=1)[0].strip()
    words = phrase.split()
    while len(words) > 1 and words[0].lower() in _ALERT_FILLER:
        words = words[1:]
    out = cut_at_word(" ".join(words), SHORT_ALERT)
    return out[:1].upper() + out[1:]


class LastVisit(BaseModel):
    """A pet's last visit before today, for the rail's quick card: when and why."""

    date: str  # YYYY-MM-DD
    reason: str = ""
    type: str = ""  # the practice system's visit type ("Sick", "Wellness"), or ""


class Patient(BaseModel):
    id: str
    name: str
    species: str = ""
    breed: str = ""
    age: int | None = None
    alerts: list[str] = []
    sex: str = ""
    color: str = ""
    microchip: str = ""
    client_id: str = ""
    # Chip labels the practice system gives its alerts: full text -> short label.
    alert_shorts: dict[str, str] = {}
    # Plain facts the practice system flags on a pet, shown as grey tags ("Senior").
    tags: list[str] = []
    # Short notes the practice system keeps on the pet beyond its alerts: Fear Free
    # and handling notes, medicines given at home ("Gabapentin 100 mg at home 2 hours
    # before visits"). Never a medical note. Empty when the system has no such field.
    pims_notes: list[str] = []
    # The last visit before today and the newest weight, when the practice system
    # sends them with the schedule; None otherwise (the record page reads them).
    last_visit: LastVisit | None = None
    weight: Weight | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def alert_chips(self) -> list[dict[str, str]]:
        """Each alert with a short chip label ("Towel wrap"); the full text is for
        the visit header and the chip's hover."""
        return [
            {
                "text": a,
                "short": (self.alert_shorts.get(a) or short_alert(a))[:SHORT_ALERT],
            }
            for a in self.alerts
        ]


VisitStatus = Literal["not_started", "recording", "draft_ready", "signed"]


class VisitPet(BaseModel):
    """One pet on a household appointment: several pets booked as one visit with
    their owner. Its own reason, and where its note stands in Blinq Scribe."""

    patient: Patient
    reason: str = ""
    # Filled by the API from this pet's encounter in the visit, like the
    # appointment's own.
    visit_status: VisitStatus = "not_started"
    encounter_id: str = ""


class Appointment(BaseModel):
    id: str
    start: datetime
    duration_min: int = 30
    reason: str = ""
    type: str = ""
    status: str = ""
    provider_id: str = ""
    provider_name: str = ""
    room: str = ""
    patient: Patient
    client: Client
    # Filled by the API from Blinq Scribe's own encounters for this appointment on its
    # day.
    visit_status: VisitStatus = "not_started"
    encounter_id: str = ""
    # A household appointment: every pet booked in it, the appointment's pet first.
    # Empty for a visit booked for one pet.
    pets: list[VisitPet] = []
    # When the visit started in Blinq Scribe (clinic-local wall time), so the day's
    # pace comes from the record, never a guess.
    started_at: datetime | None = None
    # Demo clinic only: its busy day reads as it stands at this clinic-local time
    # ("13:15"), so the heavy day shows mid-afternoon at any hour. Empty elsewhere.
    demo_clock: str = ""
    # When the practice system checked the pet in (clinic-local wall time), when it
    # says: "checked in at 1:24 PM".
    checked_in_at: datetime | None = None
    # When Blinq Scribe last read this schedule from the practice system
    # (clinic-local wall time): the quick card's "Synced 8:02 AM".
    synced_at: datetime | None = None
    # Audio parts arriving for the visit right now (glasses or a console), within
    # AUDIO_LIVE_SECONDS: the schedule shows "Recording", not just "In progress".
    audio_live: bool = False
    # the note type a visit for this appointment starts with (see note_types.guess)
    note_type: str = ""
    # Practices that schedule by column: the vet whose column this is, when the
    # practice system says. A visit belongs to provider_id, else to this vet.
    column_vet_id: str = ""
    column_vet_name: str = ""

    @property
    def vet_id(self) -> str:
        """Whose appointment this is: the provider, else the column's vet."""
        return self.provider_id or self.column_vet_id

    @property
    def vet_name(self) -> str:
        return self.provider_name if self.provider_id else self.column_vet_name


class PastVisit(BaseModel):
    date: datetime
    reason: str
    summary: str = ""
    type: str = ""  # the practice system's own visit type text
    provider_id: str = ""
    provider_name: str = ""
    appointment_id: str = ""
    medications: list[str] = []


class NoteSection(BaseModel):
    """One heading of a note and what it says, e.g. Subjective and the owner's
    history."""

    label: str
    text: str


class PastNote(BaseModel):
    """A medical note from an earlier visit, by any vet. Synced from the practice system
    or signed in Blinq Scribe."""

    id: str
    patient_id: str
    date: datetime
    provider_id: str = ""  # who wrote it
    provider_name: str = ""
    text: str  # the whole note, as the practice system stores it
    source: Literal["pims", "blinq"] = "pims"
    # The note by its headings (S:, Subjective:, History:...); [] when it has none.
    sections: list[NoteSection] = []

    @model_validator(mode="after")
    def _sectioned(self) -> PastNote:
        if not self.sections:
            from .note_sections import note_sections  # it reads the note types

            self.sections = note_sections(self.text)
        return self


class Slot(BaseModel):
    start: datetime
    end: datetime
    provider_id: str = ""
    service_id: str = ""
    booking_url: str = ""


# ---------- clinical note ----------


class SoapNote(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    vitals: dict[str, str] = Field(default_factory=dict)
    medications: list[str] = []
    client_summary: str = Field(
        "", description="Plain language summary for the pet owner"
    )
    vitals_by: str = Field(
        "",
        description="Who said the vitals, when the transcript labels them a tech: "
        "'tech Priya'. Empty otherwise",
    )


class FollowUpKind(str, Enum):
    recheck = "recheck"
    client_update = "client_update"
    callback = "callback"
    lab_result = "lab_result"
    task = "task"


KIND_LABEL = {
    FollowUpKind.recheck: "Recheck",
    FollowUpKind.client_update: "Update the owner",
    FollowUpKind.callback: "Call the owner",
    FollowUpKind.lab_result: "Lab results",
    FollowUpKind.task: "Task",
}
# Each kind's own words, taken out of the title's topic so it isn't said twice.
_KIND_WORDS = {
    kind: re.compile(rf"\b({words})\b", re.I)
    for kind, words in {
        FollowUpKind.recheck: r"re-?check|follow[- ]?up",
        FollowUpKind.client_update: r"update( the)?( owner)?|let( the)? owner know",
        FollowUpKind.callback: r"call ?back|call( the)?( owner)?",
        FollowUpKind.lab_result: r"lab results?|call( the)?( owner)?",
        FollowUpKind.task: r"task",
    }.items()
}
_WHEN = re.compile(
    r"\b(in|within|after)\s+\d+\s*(days?|weeks?|months?|d|wks?)\b.*$", re.I
)


# Words left at either end once the kind is taken out: "Call owner with lab results"
# is about the lab results.
_FILLER = {
    "the",
    "owner",
    "owner's",
    "owners",
    "with",
    "about",
    "on",
    "re",
    "regarding",
    "for",
    "to",
    "of",
    "and",
    "a",
    "an",
}


def followup_fallback(kind: FollowUpKind, due_in_days: int | None) -> str:
    """A plain label when the model's reason can't be used: "Recheck in 14 days"."""
    label = KIND_LABEL.get(kind, "Follow up")
    return f"{label} in {due_in_days} days" if due_in_days else label


def followup_title(kind: FollowUpKind, reason: str, limit: int = 60) -> str:
    """A short display title made here, never by the model: "Recheck: ear
    infection". At most `limit` characters."""
    label = KIND_LABEL.get(kind, "Follow up")
    own = _KIND_WORDS.get(kind)
    first = reason.split("\n")[0]
    topic = _WHEN.sub("", own.sub("", first) if own else first)
    words = re.sub(r"[\s,;:–-]+", " ", topic).strip(" .").split()
    while words and words[0].lower().rstrip(":") in _FILLER:
        words.pop(0)
    while words and words[-1].lower() in _FILLER:
        words.pop()
    topic = " ".join(words)
    if not topic:
        return label
    return cut_at_word(f"{label}: {topic[0].lower()}{topic[1:]}", limit, "…")


class FollowUpStatus(str, Enum):
    draft = "draft"
    approved = "approved"
    dismissed = "dismissed"


class SmsResult(BaseModel):
    status: str  # "sent" | "preview" | "skipped" | "failed"
    detail: str = ""
    text: str = ""  # preview only: the exact text that would have gone out
    to_masked: str = ""
    provider_id: str = ""
    at: datetime | None = None


PimsStatus = Literal["sending", "synced", "not_sent", "failed"]


class PimsItem(BaseModel):
    """One thing on its way to the practice system, and where it stands."""

    kind: Literal["note", "photo", "prescription"]
    id: str  # "note", the photo's id, or "prescription"
    label: str  # "Note", "Photo: Left ear", "Prescription"
    status: PimsStatus
    synced_at: datetime | None = None
    pims_id: str = ""
    detail: str = ""


class WriteBackResult(BaseModel):
    """What the practice system did with one write: the signed note, or a recheck
    booking."""

    ok: bool
    # written: it's in the practice system. queued_for_staff: it didn't go in and
    # the front desk will file it. failed: couldn't save it; it is tried again every
    # 5 minutes, then goes to the front desk after an hour. not_sent: signed only,
    # waiting for the vet to send it.
    status: Literal["written", "queued_for_staff", "failed", "not_sent"]
    detail: str = ""
    pims_id: str = ""  # note id or appointment id in the practice system
    # bookings only: the time the practice system actually booked
    start: datetime | None = None
    at: datetime | None = None


class BookingLink(BaseModel):
    """An online booking link texted to the owner. Not a booking until they book from
    it."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    url: str = ""
    from_: str = Field(
        "", alias="from"
    )  # first and last day the owner can pick, YYYY-MM-DD
    to: str = ""
    expires_at: datetime | None = None  # 14 days after it was sent
    status: Literal["queued", "sent", "opened", "booked", "expired"] = "queued"
    sent_at: datetime | None = None
    booked_start: datetime | None = None
    # Server only: a sender took this queued link and its text is on the way, so no
    # other sender sends it too. The status stays "queued" meanwhile.
    claimed_at: datetime | None = None
    # One link for several pets of the same owner, seen the same day: every pet it
    # books (in the visit's order) and the follow ups that share it. Empty for one pet.
    pets: list[str] = []
    followup_ids: list[str] = []


class FollowUp(BaseModel):
    id: str = ""
    kind: FollowUpKind
    reason: str
    due_in_days: int | None = None
    message_draft: str = ""
    suggested_slots: list[Slot] = []
    status: FollowUpStatus = FollowUpStatus.draft
    sms: SmsResult | None = None
    booked_slot: Slot | None = None
    # set when the vet approves a recheck with a chosen time
    booking: WriteBackResult | None = None
    # A recheck goes out as a booking link the owner books from (default), or the vet
    # books it now.
    booking_mode: Literal["link", "book"] = "link"
    booking_link: BookingLink | None = None
    # A booking link still not booked 3 days after it was sent gets one reminder text
    # (the same link), when the vet left this on when approving it.
    remind_unbooked: bool = False
    reminder: SmsResult | None = None  # that reminder, once it went (or was tried)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def title(self) -> str:
        """Short, for display: "Recheck: ear infection", at most 60 characters."""
        return followup_title(self.kind, self.reason)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def suggest_letter(self) -> bool:
        """A task or callback that refers the pet elsewhere: offer a referral letter
        (requirement 61)."""
        return self.kind in (FollowUpKind.task, FollowUpKind.callback) and bool(
            _REFERRAL.search(self.reason)
        )


_REFERRAL = re.compile(r"\brefer(ral|red|ring)?\b", re.I)

Fraction = Annotated[float, Field(ge=0, le=1)]


class OutlineRegion(BaseModel):
    """One outlined area on a photo, in 0..1 fractions of the photo as displayed."""

    label: str = Field("", max_length=80)
    box: list[Fraction] = Field(min_length=4, max_length=4)  # x0, y0, x1, y1
    polygon: list[Annotated[list[Fraction], Field(min_length=2, max_length=2)]] = Field(
        default=[], max_length=200
    )  # [x, y] points, optional

    @model_validator(mode="after")
    def _ordered(self) -> OutlineRegion:
        x0, y0, x1, y1 = self.box
        if x0 >= x1 or y0 >= y1:
            raise ValueError("box is [x0, y0, x1, y1] with x0 < x1 and y0 < y1")
        return self


class Crop(BaseModel):
    """The part of the photo to show, in 0..1 fractions of the photo as displayed,
    from the top left."""

    x: Fraction
    y: Fraction
    w: Annotated[float, Field(gt=0, le=1)]
    h: Annotated[float, Field(gt=0, le=1)]

    @model_validator(mode="after")
    def _inside(self) -> Crop:
        if self.x + self.w > 1.0001 or self.y + self.h > 1.0001:
            raise ValueError("the crop must stay inside the photo")
        return self


class Photo(BaseModel):
    """An exam photo. The original file is never changed: label, caption, outline,
    crop and rotation are edits drawn on top of it. Coordinates are fractions of the
    photo as displayed, its EXIF orientation applied (what a browser shows)."""

    id: str
    path: str
    label: str = ""  # what it is, e.g. "Left ear canal" (the vet's hint by default)
    caption: str = ""  # Blinq's short description of what's visible, never a diagnosis
    findings: str = ""  # Blinq's longer description, same rule
    segments: list[dict[str, Any]] = []  # SAM 3.1's own outlines, as returned
    outline: list[OutlineRegion] = []  # the outline the vet sees and can adjust
    crop: Crop | None = None
    rotation: Literal[0, 90, 180, 270] = 0  # degrees clockwise
    in_note: bool = True  # written back with the signed note, read by the draft
    show_owner: bool = False  # shown in the owner's summary
    taken_at: datetime
    edited_at: datetime | None = None
    # The file's EXIF orientation (1 = upright), read at upload; drawing applies it.
    source_orientation: int = Field(1, ge=1, le=8)

    @model_validator(mode="before")
    @classmethod
    def _outline_from_sam(cls, data: Any) -> Any:
        # A new photo, or one saved before outlines were editable, starts from SAM.
        if isinstance(data, dict) and "outline" not in data:
            turn = int(data.get("source_orientation") or 1)
            data = {**data, "outline": outline_of(data.get("segments") or [], turn)}
        return data


def outline_of(
    segments: list[dict[str, Any]], orientation: int = 1
) -> list[dict[str, Any]]:
    """SAM 3.1 regions as an editable outline: label and box, kept inside the photo.
    SAM reads the raw pixels (sent without EXIF), so boxes are turned upright."""
    out = []
    for s in segments:
        box = s.get("box")
        if not (isinstance(box, list) and len(box) == 4):
            continue
        raw = [min(max(float(v), 0.0), 1.0) for v in box]
        x0, y0, x1, y1 = images.upright_box(raw, orientation)
        if x0 < x1 and y0 < y1:
            out.append(
                {"label": str(s.get("label") or "")[:80], "box": [x0, y0, x1, y1]}
            )
    return out


class PhotoEdit(BaseModel):
    """A vet's edit to one photo. Only the fields sent change; crop null removes it."""

    model_config = ConfigDict(extra="forbid")

    # Left out means unchanged. Only crop takes null (no crop); null elsewhere is
    # refused, so a client can't blank a field the photo needs.
    label: str | None = Field(None, max_length=80)
    caption: str | None = Field(None, max_length=300)
    findings: str | None = Field(None, max_length=1000)
    outline: list[OutlineRegion] | None = Field(None, max_length=20)
    crop: Crop | None = None
    rotation: Literal[0, 90, 180, 270] | None = None
    in_note: bool | None = None
    show_owner: bool | None = None

    @field_validator(
        "label",
        "caption",
        "findings",
        "outline",
        "rotation",
        "in_note",
        "show_owner",
        mode="before",
    )
    @classmethod
    def _not_null(cls, value: Any) -> Any:
        if value is None:  # sent as null; left out never reaches here
            raise ValueError("send a value, or leave the field out")
        return value


class EncounterStatus(str, Enum):
    recording = "recording"
    draft_ready = "draft_ready"
    signed = "signed"


class Segment(BaseModel):
    """One transcript line and who said it (requirement 64). `line` is its line in
    Encounter.transcript (from 1), which stays the plain text for drafting."""

    id: str
    line: int
    speaker_id: str = ""  # "vet", "owner", "speaker-3"...; "" when unsure
    speaker_name: str = ""  # "Dr. Ana Rivera", "Speaker 3"; "" when unsure
    role: Literal["vet", "owner", "tech", "family", "other_vet", "other", "unknown"] = (
        "unknown"
    )
    offset_seconds: int = 0  # time into the visit
    text: str
    # A visit with several pets: the pets this line is about. One pet, several when
    # it names them, or, when Blinq couldn't place it, the pets it could be about
    # with pet_sure False. Empty for a visit with one pet.
    pets: list[str] = []
    pet_sure: bool = True


class PrescriptionTask(BaseModel):
    """Blinq doesn't send prescriptions to the PIMS yet, so signing a note with
    medications makes a front desk task to enter them, tracked until someone marks
    it entered."""

    text: str  # "Enter Cefpodoxime for Biscuit in the PIMS"
    medications: list[str] = []  # as the note has them
    done_by: str = ""  # who marked it entered, by name
    done_by_user: str = ""  # and login, when signed in
    done_at: datetime | None = None


class PlanReminder(BaseModel):
    """A line of the provider's own last plan that they ticked before the visit
    (asked to cover today) and the visit didn't talk about. Quoted as written, never
    Blinq's words. A reminder only: it never blocks signing."""

    id: str
    text: str
    status: Literal["open", "added", "dismissed"] = "open"


class Encounter(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    # the vet the visit was booked with; their signed notes build the voice profile
    provider_id: str = ""
    provider_name: str = ""
    consent_recorded: bool
    source: Literal["glasses", "web", "upload"] = "web"
    status: EncounterStatus = EncounterStatus.recording
    transcript: str = ""
    # Who said each line (requirement 64); hidden wherever the transcript is.
    segments: list[Segment] = []
    # Audio parts from the glasses or the console: how many arrived, and the
    # highest part number seen, for "Sending part 19 · 18 sent".
    parts_received: int = 0
    last_part: int = -1
    first_part_at: datetime | None = None  # when audio started arriving (the timer)
    # When the latest audio part arrived: audio is live while parts keep coming.
    last_part_at: datetime | None = None
    audio_seconds: float = 0  # how much audio was recorded, for "Recording ended"
    note: SoapNote | None = None
    followups: list[FollowUp] = []
    photos: list[Photo] = []
    created_at: datetime
    signed_at: datetime | None = None
    signed_by: str = ""
    # Set when a signed-in vet signs: who it was, as a login and as their PIMS provider.
    signed_by_user: str = ""
    signed_by_provider_id: str = ""
    started_by: str = ""  # username of whoever started the visit, when signed in
    write_back: WriteBackResult | None = None
    # Where each thing that goes to the practice system stands: the note, each photo
    # with it, and the prescription. Retries of a failed save are timed from these.
    pims_items: list[PimsItem] = []
    pims_failing_since: datetime | None = None
    pims_next_try_at: datetime | None = None
    pims_tries: int = 0
    prescription_task: PrescriptionTask | None = None
    # Several pets in one visit: one encounter per pet, all sharing the first
    # encounter's id as group_id.
    patient_ids: list[str] = []  # every pet in the visit (set on the first encounter)
    patient_name: str = ""
    client_id: str = ""
    owner_name: str = ""
    note_type: str = "sick"
    group_id: str = ""
    # What the reader may see, set on the way out (never stored as anything but
    # "full"): another vet sees a signed note view only, never a transcript or a
    # draft; front office sees the visit's status (permissions.visit_view).
    view: Literal["full", "view_only", "status"] = "full"
    hidden: str = ""  # why parts are hidden, e.g. "Draft in progress"
    # Lines of the last plan the provider asked to cover today that the visit didn't.
    plan_reminders: list[PlanReminder] = []


# ---------- assistant ----------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantRequest(BaseModel):
    message: str
    history: list[ChatTurn] = []
    provider_id: str = ""
    # The patient open on screen, so "how is she doing" needs no name.
    appointment_id: str = ""
    patient_id: str = ""
    # Picked by the caller to follow this turn on the assistant_turn subscription.
    turn_id: str = ""
    # The appointment the screen already shows (Morning's Up next card), so the
    # answer doesn't repeat it.
    showing: str = ""


class AssistLink(BaseModel):
    """Where part of an answer points: a visit, a pet's record or Documents, or a
    household. A link chip ("Open Miso's visit") or a source ("Kidney panel, received
    12:40 AM")."""

    label: str
    to: Literal["visit", "record", "documents", "household"]
    appointment_id: str = ""
    encounter_id: str = ""
    date: str = ""  # the visit's day, when it isn't today
    patient_id: str = ""
    client_id: str = ""
    document_id: str = ""


class AssistantReply(BaseModel):
    reply: str
    tools_used: list[str] = []
    # Link chips to the visit or the record the answer is about.
    links: list[AssistLink] = []
    # Where a clinical answer's facts came from, each a quiet link.
    sources: list[AssistLink] = []
    # Two or three questions to ask next.
    followups: list[str] = []


# ---------- visit ----------


class AssistIn(BaseModel):
    section: Literal["subjective", "objective", "assessment", "plan", "client_summary"]
    action: Literal[
        "tighten", "bullets", "prose", "repull", "sources", "translate_es", "custom"
    ]
    # the section as the vet sees it now; empty means the saved note's text
    text: str | None = None
    instruction: str = ""


class SourceLink(BaseModel):
    sentence: str
    lines: list[int] = []  # transcript line numbers, from 1
    text: str = ""


class AssistOut(BaseModel):
    """A suggestion only. Nothing changes the note until the vet accepts it."""

    suggestion: str = ""
    sources: list[SourceLink] = []
    unsourced: list[str] = []
    refused: str = ""
    mock: bool = False


class Template(BaseModel):
    id: str
    name: str
    shortcut: str
    text: str
    note_type: str = ""  # empty: any note type
    owner: Literal["me", "clinic"] = "me"


class TemplateIn(BaseModel):
    name: str
    shortcut: str
    text: str
    note_type: str = ""
    owner: Literal["me", "clinic"] = "me"


# ---------- record ----------


class Clinic(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""
    logo_url: str = ""
    pims_name: str = ""  # the practice system: AVImark, Cornerstone, ImproMed, ezyVet


class InvoiceItem(BaseModel):
    name: str
    qty: float = 1
    price: float | None = None


class Invoice(BaseModel):
    id: str
    date: datetime
    client_id: str = ""
    patient_id: str = ""
    visit: str = ""
    provider_name: str = ""
    total: float = 0
    status: Literal["paid", "open"] = "paid"
    items: list[
        InvoiceItem
    ] = []  # empty when the practice system does not share line items
    paid_by: str | None = None  # how it was paid ("Card", "Cash"), never a card number


class Invoices(BaseModel):
    """A household's invoices. Balance and last payment are None when the practice
    system does not share them."""

    invoices: list[Invoice] = []
    balance: float | None = None
    last_payment: dict[str, Any] | None = None  # {date, amount, paid_by}


class Weight(BaseModel):
    date: str  # YYYY-MM-DD
    value: float
    unit: str = "lb"
    note: str = ""


class Reminder(BaseModel):
    text: str
    due: str = ""  # YYYY-MM-DD


class PatientProfile(BaseModel):
    """What the practice system knows about a patient beyond the schedule. Empty when it
    shares nothing."""

    weights: list[Weight] = []  # newest first
    reminders: list[Reminder] = []


class Message(BaseModel):
    at: datetime
    direction: Literal["in", "out"]
    text: str
