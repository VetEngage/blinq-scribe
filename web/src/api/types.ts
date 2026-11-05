// The shapes the console reads and writes. They mirror the server's API (snake_case, as sent).

export type VisitStatus = "not_started" | "recording" | "draft_ready" | "signed";

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phones: string[];
  emails: string[];
  prefers?: string;
  reminders?: string;
  client_since?: string;
  name?: string;
  latest_message?: { at: string; text: string } | null;
}

export interface Patient {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number | null;
  alerts: string[];
  /** Each alert with a short label for chips ("Towel wrap", at most 18 characters), in the same order. */
  alert_chips?: { text: string; short: string }[];
  sex?: string;
  color?: string;
  microchip?: string;
  client_id?: string;
  /** Short notes the PIMS keeps on the pet (Fear Free, handling, medicines at home); never a medical note. */
  pims_notes?: string[];
  /** The last visit before today, when the PIMS sends it with the schedule. */
  last_visit?: { date: string; reason: string } | null;
  /** The newest weight on file, when the PIMS sends it with the schedule. */
  weight?: { value: number; unit: string } | null;
}

export interface Appointment {
  /** Missing in older data: then everything is allowed, as before roles. */
  can?: VisitCan;
  id: string;
  start: string;
  duration_min: number;
  reason: string;
  type: string;
  status: string;
  provider_id: string;
  provider_name: string;
  room: string;
  patient: Patient;
  client: Client;
  visit_status: VisitStatus;
  /** Audio is arriving for its visit now (a part in the last 30 seconds, from the glasses or any console). */
  audio_live?: boolean;
  encounter_id: string;
  note_type: string;
  /** A household appointment: every pet booked in it, the appointment's pet first. Empty for one pet. */
  pets?: VisitPet[];
  /** When the visit started in Blinq Scribe, clinic-local wall time. */
  started_at?: string | null;
  /** Demo clinic only: its busy day reads as it stands at this clinic-local time ("13:15"). */
  demo_clock?: string;
  /** When the practice system checked the pet in (clinic-local), or null. */
  checked_in_at?: string | null;
  /** When Blinq Scribe read this schedule from the PIMS (clinic-local): "Synced 8:02 AM". */
  synced_at?: string | null;
}

/** One pet on a household appointment, with its own reason and where its note stands. */
export interface VisitPet {
  patient: Patient;
  reason: string;
  visit_status: VisitStatus;
  encounter_id: string;
}

export interface Health {
  ok: boolean;
  ai: string;
  practice: string;
  stt: string;
  sam: string;
  sms: string;
  /** The demo clinic's busy day (YYYY-MM-DD, 20 visits and 24 pets), or "". */
  busy_day?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  provider_id: string;
  role: "vet" | "front_office" | "admin";
  active: boolean;
  has_password: boolean;
  two_factor?: boolean;
  two_factor_required?: boolean;
  /** Two step codes come from an authenticator app; an emailed code is the backup. */
  authenticator?: boolean;
  created_at: string;
}

export interface Me {
  via: "session" | "token" | "open";
  user: User | null;
  admin: boolean;
  /** "vet", "front_office" or "admin"; "" for the open demo and the API token. */
  role?: string;
  provider_id?: string;
  /** What this person may do ("letter.write", "note.sign"); the open demo gets all. */
  permissions?: string[];
}

export interface AuthStatus {
  login_required: boolean;
  demo?: boolean;
  google?: boolean;
  microsoft?: boolean;
  password_reset?: boolean;
}

/** Signing in either finishes (a session token) or asks for the emailed 6 digit code first. */
export type SignInResult =
  | { kind: "signed_in"; token: string }
  /** `method`: "app" for an authenticator code, "email" for an emailed one. */
  | { kind: "code_needed"; challenge: string; sent_to: string; method: "app" | "email" };

export type ItemKind =
  | "unsigned"
  | "followup"
  | "failed_text"
  | "queued"
  | "not_sent"
  | "pims_failed"
  /** The front desk enters the prescription in the PIMS. */
  | "prescription";

export interface OpenItem {
  kind: ItemKind;
  text: string;
  encounter_id: string;
  appointment_id: string;
  date: string;
  patient_name?: string;
  followup_id?: string | null;
  followup_kind?: string | null;
  reason?: string | null;
  /** A short row label without the pet ("Sign note"); `text` is the full sentence for Read aloud. */
  title?: string;
  /** The To do row's short title with the pet or owner ("Sign Pepper's note"). */
  label?: string;
  /** One short line under the title: "To Jordan Lee", the follow up's reason. */
  detail?: string | null;
  patient_id?: string;
  client_id?: string;
  /** The owner's name, to group one owner's rows. */
  owner_name?: string;
}

/** One part of the brief's sentence: "bold" needs attention, "failed" is bold and red. */
export interface BriefPart {
  text: string;
  emphasis: string;
  /** What a counted part counts: "visits", "needs" (To do's count), "failed", "new"; empty otherwise. */
  kind?: string;
}

export interface Brief {
  spoken: string;
  /** The brief in one sentence, in parts; what "needs you" is To do's count. */
  sentence?: BriefPart[];
  /** Two or three questions to ask about today. */
  suggestions?: string[];
  date?: string;
  from_yesterday?: OpenItem[];
  /** Today's follow ups still to approve. */
  pending_followups?: {
    encounter_id: string;
    followup_id: string;
    kind: string;
    reason: string;
    title?: string;
    patient_id?: string;
    patient_name?: string;
    appointment_id?: string;
  }[];
  heads_up?: { text: string; appointment_id: string; patient_id?: string; patient_name: string; time: string }[];
  new_since_yesterday?: BriefUpdate[];
}

/** New since yesterday: "result", "reply" or "booked". */
export interface BriefUpdate {
  kind: string;
  text: string;
  at: string;
  patient_name: string;
  mock?: boolean;
  /** One short line to show: "Kidney panel", "11:30 AM today". */
  detail?: string;
  patient_id?: string;
  client_id?: string;
  appointment_id?: string;
  document_id?: string;
}

export interface DayMark {
  date: string;
  visits: number;
  open: number;
  failed: number;
  marker: "failed" | "open" | "done" | "none";
}

export interface EndOfDay {
  spoken: string;
  visits_seen: number;
  rechecks_booked?: number;
  /** Rechecks whose booking link went to the owner, and how many of those the owner booked. */
  recheck_links_sent?: number;
  recheck_links_booked?: number;
  texts_sent?: number | null;
  left_to_do: OpenItem[];
  done_today: { text: string; encounter_id: string }[];
  waiting_on_owners: WaitingLink[];
  tomorrow: {
    date: string;
    visits: number;
    first: string;
    last: string;
    prepare: { text: string; appointment_id: string; patient_name: string }[];
  } | null;
}

export interface WaitingLink {
  encounter_id: string;
  followup_id: string;
  patient_id: string;
  patient_name: string;
  owner_name: string;
  reason: string;
  /** Short, made by the server: use it in rows and sentences. */
  title?: string;
  url: string;
  sent_at: string;
  days_waiting: number | null;
  status: string;
  /** One link for several pets: every pet it books. Empty for one pet. */
  pets?: string[];
}

export interface RememberItem {
  id: string;
  client_id?: string;
  patient_id?: string;
  patient_name?: string;
  text: string;
  kind: string;
  date?: string;
  said_at?: string;
  encounter_id?: string;
  expires_at?: string;
  kept_by?: string;
  /** Who said it, as the transcript labels it: "Jordan Lee · Owner". */
  said_by?: string | null;
}

export interface PreRoomCard {
  spoken: string;
  /** Blinq's one line on the visit, facts only: what came in since yesterday, then the last visit. */
  take?: string;
  /** The newest earlier note: who wrote it, when, and its plan in short. Vets only. */
  last_note?: { date: string; by: string; other_vet: boolean; gist: string } | null;
  promised?: string[];
  medications?: string[];
  remember_items?: RememberItem[];
  /** Why the visit matters, as facts on record (never advice): Blinq's purple block on Up next. */
  why?: string[];
  /** The same facts as short neutral chips: "Recheck overdue", "Owner messaged". */
  prep?: string[];
  /** The owner's latest text, from the last two days. */
  owner_message?: { who: string; text: string; at: string } | null;
  /** The last visit's day, YYYY-MM-DD, or "". */
  last_visit_on?: string;
  /** The latest weight on record, "72 lb", or "". */
  weight?: string;
  /** Before you walk in as dated facts, newest first: the owner's text, the last plan, older visits. */
  walk_in?: WalkInEntry[];
  /** Care due within 30 days: "Rabies vaccine due Nov 21". */
  can_do_today?: string[];
}

export interface WalkInEntry {
  /** YYYY-MM-DD */
  date: string;
  kind: "message" | "plan" | "visit" | string;
  /** The owner's first name, or the provider who saw the pet. */
  who: string;
  /** Written by the person reading: "From your last plan". */
  mine: boolean;
  text: string;
  /** The plan's lines, in plain words, as checkboxes; `checked` is ticked (asked to cover today), kept on the server. */
  items: { text: string; status: string; note: string; checked?: boolean }[];
}

/** A note not signed yet, from any day: Ready to sign (nothing left to confirm or decide) or Pending. */
export interface NoteToSign {
  encounter_id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  owner_name: string;
  client_id: string;
  provider_id: string;
  provider_name: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, clinic time */
  time: string;
  visit_reason: string;
  assessment: string;
  status: string;
  bucket: "ready" | "pending";
  to_confirm: number;
  followups_undecided: number;
  /** What is left on a pending note: "1 thing to confirm", "Not drafted yet". */
  reason: string;
  waiting_days: number;
}

export interface VoiceProfile {
  source: string;
  notes_used: number;
}

export interface PastNote {
  id: string;
  date: string;
  provider_id: string;
  provider_name: string;
  text: string;
  /** "blinq" notes are signed visits here: their id is "blinq-" and the visit's id. */
  source?: "pims" | "blinq";
  /** The note under its headings, when it has them; else `text` as written. */
  sections?: { label: string; text: string }[] | null;
}

export interface Slot {
  start: string;
  end: string;
  provider_id?: string;
}

export interface SmsResult {
  status: "sent" | "preview" | "skipped" | "failed" | string;
  detail: string;
  text: string;
  to_masked: string;
}

export interface WriteBack {
  ok: boolean;
  status: "written" | "queued_for_staff" | "failed" | string;
  detail: string;
  /** The note's id in the PIMS once written. */
  pims_id?: string;
  /** When it was written. */
  at?: string | null;
  start?: string | null;
}

export interface BookingLink {
  url: string;
  from: string;
  to: string;
  expires_at: string | null;
  status: "queued" | "sent" | "opened" | "booked" | "expired";
  sent_at: string | null;
  booked_start: string | null;
  /** One link for several pets of the same owner seen that day: every pet it books. Empty for one pet. */
  pets?: string[];
}

export type FollowUpKind = "recheck" | "client_update" | "callback" | "lab_result" | "task";

export interface Weight {
  date: string;
  value: string | number;
  unit: string;
}

export interface PrescriptionTask {
  /** "Enter Cefpodoxime for Biscuit in the PIMS". */
  text: string;
  medications: string[];
  /** Who marked it entered, and when; empty until then. */
  done_by: string;
  done_at: string | null;
}

export interface FollowUp {
  id: string;
  kind: FollowUpKind;
  /** The full reason, from the model; never a heading. */
  reason: string;
  /** Short, made by the server ("Recheck: ear infection", at most 60 characters): use it in rows and sentences. */
  title?: string;
  due_in_days: number | null;
  message_draft: string;
  suggested_slots: Slot[];
  status: "draft" | "approved" | "dismissed";
  sms: SmsResult | null;
  booked_slot: Slot | null;
  booking: WriteBack | null;
  booking_mode: "link" | "book";
  booking_link: BookingLink | null;
  /** A referral: offer "Create referral letter". */
  suggest_letter?: boolean;
  /** A booking link not booked 3 days after it went out gets one reminder text. */
  remind_unbooked?: boolean;
  /** That reminder, once it went (or was tried). */
  reminder?: { status: string; detail: string; text: string; at: string | null } | null;
}

export interface Segment {
  label?: string;
  score?: number;
  box?: number[];
}

/** One outlined area, as [x0, y0, x1, y1] fractions of the original image. */
export interface OutlineRegion {
  label: string;
  box: number[];
  polygon: number[][];
}

/** The part of the original image to show, fractions from the top left. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An exam photo. The original file never changes; everything else is drawn on top of it. */
export interface Photo {
  id: string;
  /** The vet's short name for it ("Left ear canal"). */
  label: string;
  /** Blinq's short description of what is visible: editable, never a diagnosis. */
  caption: string;
  /** Blinq's longer description, same rule. */
  findings: string;
  segments: Segment[];
  outline: OutlineRegion[];
  crop: Crop | null;
  /** Clockwise, applied after the crop: 0, 90, 180 or 270. */
  rotation: number;
  in_note: boolean;
  show_owner: boolean;
}

/** The edits a vet makes to one photo. Only what changed is sent; crop null removes the crop. */
export interface PhotoEdit {
  label?: string;
  caption?: string;
  findings?: string;
  outline?: OutlineRegion[];
  crop?: Crop | null;
  rotation?: number;
  in_note?: boolean;
  show_owner?: boolean;
}

export type SectionKey = "subjective" | "objective" | "assessment" | "plan" | "client_summary";

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  client_summary: string;
  vitals: Record<string, string>;
  medications: string[];
  /** Who said the vitals when a tech did ("tech Priya"), from the transcript; else empty. */
  vitals_by?: string;
}

/** One transcript line and who said it. `line` is its line in the transcript, from 1. */
export interface Segment {
  id: string;
  line: number;
  /** "vet", "owner", "speaker-3"; "" when Blinq isn't sure. */
  speaker_id: string;
  /** "Dr. Ana Rivera", "Speaker 3"; "" when Blinq isn't sure. */
  speaker_name: string;
  role: "vet" | "owner" | "tech" | "family" | "other_vet" | "other" | "unknown";
  offset_seconds: number;
  text: string;
  /** A visit with several pets: the pets this line is about (the ones it could be about when not sure). */
  pets?: string[];
  /** False when Blinq couldn't tell which pet the line is about. */
  pet_sure?: boolean;
}

export interface Encounter {
  /** The owner agreed to recording: asked at the first Start recording; no audio is kept before it. */
  consent_recorded?: boolean;
  can?: VisitCan;
  /** The note, each photo with it and the prescription, and where each stands in the PIMS; empty until signed. */
  pims_items?: PimsItem[];
  /** When a failed save is tried again; null unless retrying. */
  pims_next_try_at?: string | null;
  /** "full", "view_only" (another vet's signed note: no transcript) or "status" (a draft in progress, or front office). */
  view?: "full" | "view_only" | "status";
  /** Why parts are empty ("Draft in progress"); "" when full. */
  hidden?: string;
  id: string;
  appointment_id: string;
  patient_id: string;
  provider_id: string;
  provider_name: string;
  source: "glasses" | "web" | "upload";
  status: "recording" | "draft_ready" | "signed";
  transcript: string;
  /** Who said each transcript line; empty where the transcript is hidden or no one is known. */
  segments?: Segment[];
  /** Audio parts that arrived from the glasses or this computer, and the highest part number (-1 for none). */
  parts_received?: number;
  last_part?: number;
  /** When the first audio part arrived (the recording clock counts up from it); null before. */
  first_part_at?: string | null;
  /** When the latest audio part arrived; null before any. */
  last_part_at?: string | null;
  /** How much audio was recorded, in seconds. */
  audio_seconds?: number;
  /** When the visit started. */
  created_at?: string;
  note: SoapNote | null;
  followups: FollowUp[];
  photos: Photo[];
  /** The front desk's task to enter the prescription in the PIMS, from the signature. */
  prescription_task?: PrescriptionTask | null;
  signed_at: string | null;
  signed_by: string;
  write_back: WriteBack | null;
  patient_ids: string[];
  patient_name: string;
  client_id: string;
  owner_name: string;
  note_type: string;
  group_id: string;
  /** Lines of the last plan the provider asked to cover today that the visit didn't, quoted. Never block signing. */
  plan_reminders?: PlanReminder[];
}

/** A line of the provider's own last plan, ticked to cover today, that the visit didn't talk about. */
export interface PlanReminder {
  id: string;
  text: string;
  status: "open" | "added" | "dismissed";
}

export interface NoteType {
  id: string;
  name: string;
  sections: { key: SectionKey; label: string }[];
}

export type AssistAction = "tighten" | "bullets" | "prose" | "repull" | "sources" | "translate_es" | "custom";

export interface AssistResult {
  suggestion: string;
  sources: { sentence: string; lines: number[]; text: string }[];
  unsourced: string[];
  refused: string;
  mock: boolean;
}

export interface Template {
  id: string;
  name: string;
  shortcut: string;
  text: string;
  note_type: string;
  owner: "me" | "clinic";
}

export interface RememberSuggestions {
  suggestions: {
    id: string;
    text: string;
    kind: string;
    date: string;
    transcript_lines: string[];
    /** Who said it, as the transcript labels it: "Jordan Lee · Owner". */
    said_by?: string;
    kept: boolean;
  }[];
  left_out: number;
  mock?: boolean;
}

export interface Summary {
  clinic: { name: string; address: string; phone: string; logo_url?: string };
  language: string;
  translated?: boolean;
  /** `when` is ready to show, in the summary's language. */
  visit: { date: string; start: string | null; when: string; provider_name: string };
  owner_name: string;
  pets: {
    patient_id: string;
    name: string;
    /** Empty when the record doesn't have it. */
    species: string;
    breed: string;
    sex: string;
    age: number | null;
    age_text: string;
    for_owner: string;
    medicines: string[];
    home_care: string[];
    next_visit: { kind: "booked" | "pick_a_time" | "none"; text: string; url: string } | null;
  }[];
  when_to_call: string;
  mock?: boolean;
}

export interface ShareResult {
  channel: "text" | "email" | "print";
  language: string;
  status: "preview" | "sent" | "ready" | "failed";
  detail: string;
  text: string;
  url: string;
  expires_at: string | null;
  translated?: boolean;
}

export interface PastVisit {
  id: string;
  date: string;
  /** The appointment it was, or "" for a note with no visit behind it. */
  appointment_id: string;
  type: string;
  kind: "sick" | "wellness" | "other";
  reason: string;
  provider_name: string;
  summary: string;
  related: boolean;
  note: string | null;
  /** The note under its headings, when it has them; else `note` as written. */
  sections?: { label: string; text: string }[] | null;
  medications: string[];
  photos: { id: string; caption: string; url: string }[];
}

export interface PetSummary {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number | null;
  sex?: string;
  alerts: string[];
  last_visit: { date: string; reason: string; type?: string } | null;
  due: string[];
}

export interface Profile {
  patient: Patient;
  weight: {
    latest: Weight | null;
    /** The reading before a weight written in this visit, for the change. */
    previous?: Weight | null;
    history: { date: string; value: string; unit: string; note: string }[];
  };
  reminders_due: { patient_id: string; patient_name: string; text: string; due: string }[];
  client: Client;
  other_pets: PetSummary[];
  mock?: boolean;
}

export interface Invoices {
  balance: number | null;
  last_12_months: number | null;
  last_payment: { amount: number; date: string } | null;
  invoices: {
    id: string;
    date: string;
    patient_id: string;
    patient_name: string;
    visit: string;
    provider_name: string;
    total: number;
    status: "paid" | "open";
    items: { name: string; qty: number; price: number }[];
    paid_by: string | null;
  }[];
  counts?: Record<string, number>;
  mock?: boolean;
}

export interface Household {
  client: Client;
  pets: (PetSummary & {
    today: {
      appointment_id: string;
      time: string;
      reason: string;
      visit_status: VisitStatus;
      encounter_id: string;
    } | null;
    spend_12m: number | null;
    /** The reminder that comes first; `state` says how soon. */
    next_due: { text: string; due: string; state: "overdue" | "soon" | "later" } | null;
    /** Plain facts ("Senior") and the short label of each alert ("Towel wrap"). */
    tags: string[];
    alert_tags: string[];
  })[];
  balance: number | null;
  /** The clinic's online booking link; empty when it has none. */
  book_url: string;
  spend_12m: number | null;
  coming_up: { date: string; text: string; patient_name: string }[];
  messages: { at: string; direction: "in" | "out"; text: string }[];
  remember: RememberItem[];
  mock?: boolean;
}

export interface OutsideDoc {
  id: string;
  name: string;
  uploaded_at: string;
  pages: number | null;
  content_type: string;
  key_points: { text: string; page: number | null }[];
  mock?: boolean;
}

export interface SearchResults {
  pets: {
    id: string;
    name: string;
    species: string;
    breed: string;
    age: number | null;
    sex?: string;
    client_id: string;
    owner_name: string;
    last_visit: { date: string; reason: string } | null;
    next_visit: { date: string; time: string; appointment_id: string } | null;
  }[];
  owners: { id: string; name: string; phone: string; email: string; pets: string[] }[];
}

export interface Provider {
  id: string;
  name: string;
  linked_to: string;
}

export interface Invite {
  user: User;
  invite_url: string;
}

/** One step of writing the note, from the draft_progress subscription. */
export interface DraftStep {
  step: string;
  label: string;
  detail?: string;
  patient_name?: string;
  state: "pending" | "running" | "done" | "failed";
}

/** What Ask Blinq is doing before it answers, from the assistant_turn subscription. */
/** Where part of an answer points: a link chip or a source line. */
export interface AssistLink {
  label: string;
  /** "visit", "record", "documents" or "household". */
  to: string;
  appointment_id: string;
  encounter_id: string;
  date: string;
  patient_id: string;
  client_id: string;
  document_id: string;
}

/** One Ask Blinq answer. */
export interface AskReply {
  reply: string;
  links: AssistLink[];
  sources: AssistLink[];
  followups: string[];
}

export interface AssistantActivity {
  checking: string;
  done: boolean;
  reply?: string;
}

/** A Google or Microsoft account connected for signing in. */
export interface ConnectedAccount {
  provider: "google" | "microsoft";
  email: string;
  connected_at: string | null;
}

export interface ProfileEdit {
  name?: string;
  email?: string;
  /** Needed to change the email. */
  current_password?: string;
}

export type LetterKind = "referral" | "records" | "owner";
export type LetterChannel = "email" | "owner_text" | "owner_email" | "print";

/** A letter from the clinic: a referral, records for another clinic, or a letter for the owner. */
export interface Letter {
  id: string;
  patient_id: string;
  patient_name: string;
  /** The visit it was started from, or "". */
  encounter_id: string;
  kind: LetterKind;
  recipient: { name: string; clinic: string; email: string };
  /** The vet's words, kept as written. */
  reason: string;
  urgency: "routine" | "soon" | "urgent";
  attachments: {
    /** Signed notes of any of the pet's visits. */
    note_encounter_ids: string[];
    photos: { encounter_id: string; photo_id: string }[];
    document_ids: string[];
    /** Only when the vet checks them. */
    invoice_ids: string[];
  };
  body: string;
  status: "draft" | "sent" | "opened";
  /** Who wrote the first draft: "muse", "mock" (demo) or "". */
  drafted: string;
  owner_consent: boolean;
  created_at: string;
  updated_at: string;
  signed_by: string;
  /** As the PDF signs it: "Dr. Ana Rivera, DVM". */
  signer_title: string;
  signed_at: string | null;
  /** Where it went, in words. */
  sent_to: string[];
  opened_at: string | null;
  sent: { channel: string; to_masked: string; at: string; status: string; detail: string }[];
  pdf_url: string;
}

export type LetterRecipient = Letter["recipient"];

export interface LetterEdit {
  kind?: LetterKind;
  owner_consent?: boolean;
  recipient?: { name: string; clinic: string; email: string };
  reason?: string;
  urgency?: string;
  attachments?: Letter["attachments"];
  body?: string;
}

/** What a send did; in demo mode, what would have gone out. */
export interface LetterSendResult {
  channel: string;
  status: "sent" | "preview" | "failed" | "skipped" | "ready";
  detail: string;
  to: string;
  subject: string;
  body: string;
  text: string;
  url: string;
  pdf_url: string;
  expires_at: string | null;
}

/** Read aloud on the server: off means the browser's voice reads instead. */
export interface SpeechOptions {
  available: boolean;
  default_voice: string;
  voices: { id: string; name: string; language: string; gender: string }[];
}

/** What the signed-in person may do on one visit (their role, and whether it's their own visit). */
export interface VisitCan {
  start: boolean;
  record: boolean;
  draft: boolean;
  edit: boolean;
  approve: boolean;
  sign: boolean;
  edit_photos: boolean;
  remember: boolean;
  write_letter: boolean;
  share: boolean;
  resend: boolean;
}

/** The clinic's letterhead: what heads a letter and its PDF. */
export interface Clinic {
  name: string;
  address: string;
  phone: string;
  logo_url: string;
  /** The real system name; "" when unknown. Data only, screens say "the PIMS". */
  pims_name?: string;
}

/** One thing that goes to the PIMS with a signed note. */
export interface PimsItem {
  kind: "note" | "photo" | "prescription" | string;
  id: string;
  /** "Note", "Photo: Left ear", "Prescription". */
  label: string;
  status: "sending" | "synced" | "not_sent" | "failed" | string;
  synced_at?: string | null;
  pims_id: string;
  detail: string;
}

/** The confirm panel before signing: where the note goes, what goes and the texts that follow. */
export interface SignPreview {
  pims_name: string;
  patient: { name: string; pims_id: string };
  owner: { name: string; pims_id: string };
  appointment: { id: string; start: string; patient_name: string; owner_name: string } | null;
  matches: boolean;
  mismatch: string;
  note: boolean;
  photos: number;
  prescription: string[];
  texts: { followup_id: string; kind: string; reason: string; message: string }[];
}

/** The pet and owner record beside a visit: read only, one-line visits, never a note. */
export interface RecordPanelData {
  patient: {
    id: string;
    name: string;
    species: string;
    breed: string;
    age: number | null;
    sex: string;
    alerts: string[];
  };
  pims_patient_id: string;
  pims_client_id: string;
  weight: { latest: Weight | null; previous?: Weight | null; history?: Weight[] };
  reminders_due: { patient_id: string; text: string; due: string }[];
  recent_visits: { id: string; date: string; kind: string; type: string; reason: string; provider_name: string }[];
  client: {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    phones: string[];
    emails: string[];
    prefers: string;
  } | null;
  other_pets: { id: string; name: string }[];
  mock: boolean;
}
