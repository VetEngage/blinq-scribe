/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Date (isoformat) */
  Date: { input: string; output: string; }
  /** Date with time (isoformat) */
  DateTime: { input: string; output: string; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf). */
  JSON: { input: unknown; output: unknown; }
};

/** An alert with its short chip label */
export type AlertChip = {
  __typename?: 'AlertChip';
  /** About 18 characters: "Towel wrap" */
  short: Scalars['String']['output'];
  /** The full alert */
  text: Scalars['String']['output'];
};

/** One appointment on the schedule. */
export type Appointment = {
  __typename?: 'Appointment';
  /** Audio is arriving for the visit now (a part in the last 30 seconds, from the glasses or a console): show "Recording" */
  audio_live: Scalars['Boolean']['output'];
  /** What you may do on this visit */
  can: VisitCan;
  /** When the practice system checked the pet in (clinic-local), or null */
  checked_in_at?: Maybe<Scalars['DateTime']['output']>;
  client: Client;
  /** Practices that schedule by column: the column's vet, or empty */
  column_vet_id: Scalars['String']['output'];
  column_vet_name: Scalars['String']['output'];
  /** Demo clinic only: its busy day reads as it stands at this clinic-local time ("13:15"). Empty everywhere else */
  demo_clock: Scalars['String']['output'];
  duration_min: Scalars['Int']['output'];
  encounter_id: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  note_type: Scalars['String']['output'];
  patient: Patient;
  /** A household appointment: every pet booked in it, the appointment's pet first. Empty for a visit booked for one pet */
  pets: Array<VisitPet>;
  provider_id: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  room: Scalars['String']['output'];
  /** Clinic-local wall time */
  start: Scalars['DateTime']['output'];
  /** When the visit started in Blinq Scribe, clinic-local wall time */
  started_at?: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  /** When Blinq Scribe read this schedule from the practice system, clinic-local wall time */
  synced_at?: Maybe<Scalars['DateTime']['output']>;
  type: Scalars['String']['output'];
  /** "not_started", "recording", "draft_ready" or "signed" */
  visit_status: Scalars['String']['output'];
};

export type ApprovedRecheck = {
  __typename?: 'ApprovedRecheck';
  booked_for?: Maybe<Scalars['String']['output']>;
  due_in_days?: Maybe<Scalars['Int']['output']>;
  encounter_id: Scalars['String']['output'];
  /** Its booking link: "queued", "sent", "opened", "booked", "expired", or "" when it has none */
  link: Scalars['String']['output'];
  patient: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

export type AssistInput = {
  /** "tighten", "bullets", "prose", "repull", "sources", "translate_es" or "custom" */
  action: Scalars['String']['input'];
  instruction?: Scalars['String']['input'];
  section: Scalars['String']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
};

/** Where part of an answer points: a link chip or a source line */
export type AssistLink = {
  __typename?: 'AssistLink';
  appointment_id: Scalars['String']['output'];
  client_id: Scalars['String']['output'];
  /** The visit's day, when it isn't today */
  date: Scalars['String']['output'];
  document_id: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  /** "visit", "record", "documents" or "household" */
  to: Scalars['String']['output'];
};

/** An edit tool suggestion. Nothing is saved. */
export type AssistResult = {
  __typename?: 'AssistResult';
  mock: Scalars['Boolean']['output'];
  refused: Scalars['String']['output'];
  sources: Array<SourceLink>;
  suggestion: Scalars['String']['output'];
  unsourced: Array<Scalars['String']['output']>;
};

export type AssistantInput = {
  appointment_id?: Scalars['String']['input'];
  history?: Array<ChatTurnInput>;
  message: Scalars['String']['input'];
  patient_id?: Scalars['String']['input'];
  provider_id?: Scalars['String']['input'];
  /** The appointment already on screen (Morning's Up next card), so the answer doesn't repeat it */
  showing?: Scalars['String']['input'];
  /** Pick one to follow assistant_turn(turn_id) */
  turn_id?: Scalars['String']['input'];
};

export type AssistantReply = {
  __typename?: 'AssistantReply';
  /** Two or three questions to ask next */
  followups: Array<Scalars['String']['output']>;
  /** Link chips to the visit or the record the answer is about */
  links: Array<AssistLink>;
  reply: Scalars['String']['output'];
  /** Where a clinical answer's facts came from */
  sources: Array<AssistLink>;
  tools_used: Array<Scalars['String']['output']>;
};

/** What Ask Blinq is doing for one question. */
export type AssistantTurn = {
  __typename?: 'AssistantTurn';
  at: Scalars['DateTime']['output'];
  /** "checking", then "reply"; or "error" */
  kind: Scalars['String']['output'];
  text: Scalars['String']['output'];
  tools_used: Array<Scalars['String']['output']>;
  turn_id: Scalars['String']['output'];
};

export type AuditEntry = {
  __typename?: 'AuditEntry';
  action: Scalars['String']['output'];
  actor: Scalars['String']['output'];
  detail: Scalars['JSON']['output'];
  ts: Scalars['String']['output'];
};

export type AuthStatus = {
  __typename?: 'AuthStatus';
  /** False only for the open demo: no API token, nobody invited */
  login_required: Scalars['Boolean']['output'];
  options: SignInOptions;
};

/** Add this to an authenticator app, then confirm a code */
export type AuthenticatorSetup = {
  __typename?: 'AuthenticatorSetup';
  /** Draw this as a QR code */
  otpauth_uri: Scalars['String']['output'];
  /** To type in by hand */
  secret: Scalars['String']['output'];
};

/** An online booking link texted to the owner. */
export type BookingLink = {
  __typename?: 'BookingLink';
  booked_start?: Maybe<Scalars['DateTime']['output']>;
  expires_at?: Maybe<Scalars['DateTime']['output']>;
  /** First day, YYYY-MM-DD */
  from: Scalars['String']['output'];
  /** One link for several pets of the same owner seen that day: every pet it books, in the visit's order. Empty for one pet */
  pets: Array<Scalars['String']['output']>;
  sent_at?: Maybe<Scalars['DateTime']['output']>;
  /** "queued", "sent", "opened", "booked" or "expired" */
  status: Scalars['String']['output'];
  to: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

/** The morning brief. */
export type Brief = {
  __typename?: 'Brief';
  appointments: Array<Scalars['String']['output']>;
  date: Scalars['String']['output'];
  from_yesterday: Array<OpenItem>;
  heads_up: Array<HeadsUp>;
  mock: Scalars['Boolean']['output'];
  new_since_yesterday: Array<Update>;
  pending_followups: Array<PendingFollowUp>;
  /** The brief in one sentence, in parts to bold or color; what "needs you" is To do's count (requirement 71) */
  sentence: Array<BriefPart>;
  spoken: Scalars['String']['output'];
  /** Two or three questions to ask about today, from today's data */
  suggestions: Array<Scalars['String']['output']>;
};

/** One part of the brief's sentence */
export type BriefPart = {
  __typename?: 'BriefPart';
  /** "none", "bold" (what needs attention) or "failed" (bold and red) */
  emphasis: Scalars['String']['output'];
  /** What a counted part counts: "visits", "needs" (To do's count), "failed", "new"; empty for the words between */
  kind: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type ChatTurnInput = {
  content: Scalars['String']['input'];
  role: Scalars['String']['input'];
};

/** A pet owner, as the practice system shares them. */
export type Client = {
  __typename?: 'Client';
  /** YYYY-MM-DD or empty */
  client_since: Scalars['String']['output'];
  emails: Array<Scalars['String']['output']>;
  first_name: Scalars['String']['output'];
  full_name: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  last_name: Scalars['String']['output'];
  phones: Array<Scalars['String']['output']>;
  /** "text", "email", "phone" or "" */
  prefers: Scalars['String']['output'];
  reminders: Scalars['String']['output'];
};

export type ClientCard = {
  __typename?: 'ClientCard';
  client_since: Scalars['String']['output'];
  emails: Array<Scalars['String']['output']>;
  first_name: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  last_name: Scalars['String']['output'];
  latest_message?: Maybe<LatestMessage>;
  name: Scalars['String']['output'];
  phones: Array<Scalars['String']['output']>;
  prefers: Scalars['String']['output'];
  reminders: Scalars['String']['output'];
};

/** The owner's name and how to reach them */
export type ClientContact = {
  __typename?: 'ClientContact';
  client_since: Scalars['String']['output'];
  emails: Array<Scalars['String']['output']>;
  first_name: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  last_name: Scalars['String']['output'];
  name: Scalars['String']['output'];
  phones: Array<Scalars['String']['output']>;
  prefers: Scalars['String']['output'];
  reminders: Scalars['String']['output'];
};

export type ClientMessage = {
  __typename?: 'ClientMessage';
  at: Scalars['String']['output'];
  /** "in" or "out" */
  direction: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type Clinic = {
  __typename?: 'Clinic';
  address: Scalars['String']['output'];
  logo_url: Scalars['String']['output'];
  name: Scalars['String']['output'];
  phone: Scalars['String']['output'];
  /** The practice system's real name; "" when unknown. Data only: screens say "PIMS" */
  pims_name: Scalars['String']['output'];
};

export type ComingUp = {
  __typename?: 'ComingUp';
  date: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** A Google or Microsoft account that signs you in */
export type ConnectedAccount = {
  __typename?: 'ConnectedAccount';
  connected_at?: Maybe<Scalars['DateTime']['output']>;
  /** As the provider shows it; may be empty */
  email: Scalars['String']['output'];
  /** "google" or "microsoft" */
  provider: Scalars['String']['output'];
};

/** The part of the displayed photo to show, 0..1 from the top left */
export type Crop = {
  __typename?: 'Crop';
  h: Scalars['Float']['output'];
  w: Scalars['Float']['output'];
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
};

export type CropInput = {
  h: Scalars['Float']['input'];
  w: Scalars['Float']['input'];
  x: Scalars['Float']['input'];
  y: Scalars['Float']['input'];
};

/** One day on the week strip. */
export type DaySummary = {
  __typename?: 'DaySummary';
  date: Scalars['String']['output'];
  failed: Scalars['Int']['output'];
  /** "failed", "open", "done" or "none" */
  marker: Scalars['String']['output'];
  open: Scalars['Int']['output'];
  visits: Scalars['Int']['output'];
};

/** A vet in the practice, for the doctor picker */
export type Doctor = {
  __typename?: 'Doctor';
  /** The vet's provider id */
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

/** An outside record. The file is at .../documents/{id}/file. */
export type Document = {
  __typename?: 'Document';
  content_type: Scalars['String']['output'];
  detail?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key_points: Array<KeyPoint>;
  mock: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  pages: Scalars['Int']['output'];
  patient_id: Scalars['String']['output'];
  uploaded_at: Scalars['String']['output'];
};

export type DoneItem = {
  __typename?: 'DoneItem';
  encounter_id: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** One step of writing the note. */
export type DraftProgress = {
  __typename?: 'DraftProgress';
  at: Scalars['DateTime']['output'];
  detail: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  /** Same for every event of one draft */
  run_id: Scalars['String']['output'];
  /** "started", "done" or "failed" */
  state: Scalars['String']['output'];
  /** "transcript", "photos", "soap", "followups", "confirm", then "done"; "error" if it stopped */
  step: Scalars['String']['output'];
};

/** One visit for one pet: transcript, note, follow ups. */
export type Encounter = {
  __typename?: 'Encounter';
  appointment_id: Scalars['String']['output'];
  /** How much audio was recorded, in seconds */
  audio_seconds: Scalars['Float']['output'];
  /** What you may do on this visit */
  can: VisitCan;
  client_id: Scalars['String']['output'];
  consent_recorded: Scalars['Boolean']['output'];
  created_at: Scalars['DateTime']['output'];
  /** When the first audio part arrived: the recording timer's start */
  first_part_at?: Maybe<Scalars['DateTime']['output']>;
  followups: Array<FollowUp>;
  group_id: Scalars['String']['output'];
  /** Why parts are empty, e.g. "Draft in progress"; "" when full */
  hidden: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** The highest audio part number received, or -1 */
  last_part: Scalars['Int']['output'];
  /** When the latest audio part arrived (glasses or a console) */
  last_part_at?: Maybe<Scalars['DateTime']['output']>;
  note?: Maybe<SoapNote>;
  note_type: Scalars['String']['output'];
  owner_name: Scalars['String']['output'];
  /** Audio parts received from the glasses or the console */
  parts_received: Scalars['Int']['output'];
  patient_id: Scalars['String']['output'];
  patient_ids: Array<Scalars['String']['output']>;
  patient_name: Scalars['String']['output'];
  photos: Array<Photo>;
  pims_failing_since?: Maybe<Scalars['DateTime']['output']>;
  /** The note, each photo with it and the prescription, and where each stands in the PIMS; empty until signed */
  pims_items: Array<PimsItem>;
  /** When a failed save is tried again; null unless retrying */
  pims_next_try_at?: Maybe<Scalars['DateTime']['output']>;
  /** Lines of the last plan the provider asked to cover today that the visit didn't, from the draft */
  plan_reminders: Array<PlanReminder>;
  /** The front desk's task to enter the prescription in the PIMS, from the signature; null when the note has no medications */
  prescription_task?: Maybe<PrescriptionTask>;
  provider_id: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  /** Who said each transcript line (empty where the transcript is hidden) */
  segments: Array<Segment>;
  signed_at?: Maybe<Scalars['DateTime']['output']>;
  signed_by: Scalars['String']['output'];
  signed_by_provider_id: Scalars['String']['output'];
  signed_by_user: Scalars['String']['output'];
  /** "glasses", "web" or "upload" */
  source: Scalars['String']['output'];
  started_by: Scalars['String']['output'];
  /** "recording", "draft_ready" or "signed" */
  status: Scalars['String']['output'];
  transcript: Scalars['String']['output'];
  /** "full" (your visit), "view_only" (another vet's signed note: no transcript) or "status" (status only: a draft in progress, or front office) */
  view: Scalars['String']['output'];
  write_back?: Maybe<WriteBackResult>;
};

/** The end of day list. */
export type EndOfDay = {
  __typename?: 'EndOfDay';
  appointments: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  done_today: Array<DoneItem>;
  followups_waiting: Array<WaitingFollowUp>;
  left_to_do: Array<OpenItem>;
  not_started: Array<Scalars['String']['output']>;
  queued_for_staff: Array<QueuedItem>;
  /** Of those, how many the owner booked */
  recheck_links_booked: Scalars['Int']['output'];
  /** Rechecks whose booking link went to the owner */
  recheck_links_sent: Scalars['Int']['output'];
  rechecks_approved: Array<ApprovedRecheck>;
  rechecks_booked: Scalars['Int']['output'];
  rechecks_waiting: Scalars['Int']['output'];
  spoken: Scalars['String']['output'];
  tomorrow: Tomorrow;
  unsigned_notes: Array<UnsignedNote>;
  visits_seen: Scalars['Int']['output'];
  waiting_on_owners: Array<WaitingLink>;
};

export type FollowUp = {
  __typename?: 'FollowUp';
  booked_slot?: Maybe<Slot>;
  booking?: Maybe<WriteBackResult>;
  booking_link?: Maybe<BookingLink>;
  /** "link" or "book" */
  booking_mode: Scalars['String']['output'];
  due_in_days?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  /** "recheck", "client_update", "callback", "lab_result" or "task" */
  kind: Scalars['String']['output'];
  message_draft: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  /** A booking link not booked 3 days after it was sent gets one reminder text */
  remind_unbooked: Scalars['Boolean']['output'];
  /** That reminder text, once it went (or was tried) */
  reminder?: Maybe<SmsResult>;
  sms?: Maybe<SmsResult>;
  /** "draft", "approved" or "dismissed" */
  status: Scalars['String']['output'];
  /** A referral: offer Create referral letter */
  suggest_letter: Scalars['Boolean']['output'];
  suggested_slots: Array<Slot>;
  /** Short, made by the server for display: "Recheck: ear infection", at most 60 characters. Use it instead of reason in rows and sentences */
  title: Scalars['String']['output'];
};

export type FollowUpActionInput = {
  /** "approve", "dismiss", "retry_text" or "book" */
  action: Scalars['String']['input'];
  /** "link" or "book" */
  booking_mode?: InputMaybe<Scalars['String']['input']>;
  message_draft?: InputMaybe<Scalars['String']['input']>;
  /** With a booking link: one reminder text if it isn't booked 3 days after it was sent (on unless false) */
  remind_unbooked?: InputMaybe<Scalars['Boolean']['input']>;
  slot_start?: InputMaybe<Scalars['DateTime']['input']>;
};

export type FollowingText = {
  __typename?: 'FollowingText';
  followup_id: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  /** The text the owner will get */
  message: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

export type HeadsUp = {
  __typename?: 'HeadsUp';
  appointment_id: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
  time: Scalars['String']['output'];
};

export type Health = {
  __typename?: 'Health';
  ai: Scalars['String']['output'];
  /** The demo clinic's busy day (YYYY-MM-DD), or empty */
  busy_day: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
  practice: Scalars['String']['output'];
  sam: Scalars['String']['output'];
  sms: Scalars['String']['output'];
  stt: Scalars['String']['output'];
  /** Read aloud: "kokoro" or "browser" */
  tts: Scalars['String']['output'];
};

/** The household page. */
export type Household = {
  __typename?: 'Household';
  balance?: Maybe<Scalars['Float']['output']>;
  /** The clinic's online booking link, or empty when it has none */
  book_url: Scalars['String']['output'];
  client: ClientCard;
  coming_up: Array<ComingUp>;
  messages: Array<ClientMessage>;
  mock: Scalars['Boolean']['output'];
  pets: Array<HouseholdPet>;
  remember: Array<RememberItem>;
  spend_12m: Scalars['Float']['output'];
};

export type HouseholdPet = {
  __typename?: 'HouseholdPet';
  age?: Maybe<Scalars['Int']['output']>;
  /** Each alert's short label */
  alert_tags: Array<Scalars['String']['output']>;
  alerts: Array<Scalars['String']['output']>;
  breed: Scalars['String']['output'];
  due: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  last_visit?: Maybe<LastVisit>;
  name: Scalars['String']['output'];
  /** The reminder that comes first, for the Next due column */
  next_due?: Maybe<NextDue>;
  sex: Scalars['String']['output'];
  species: Scalars['String']['output'];
  spend_12m: Scalars['Float']['output'];
  /** Plain facts, like "Senior" */
  tags: Array<Scalars['String']['output']>;
  today?: Maybe<TodayVisit>;
};

export type Invite = {
  __typename?: 'Invite';
  invite_url: Scalars['String']['output'];
  user: User;
};

export type InviteInfo = {
  __typename?: 'InviteInfo';
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export type Invoice = {
  __typename?: 'Invoice';
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  items: Array<InvoiceItem>;
  paid_by?: Maybe<Scalars['String']['output']>;
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  /** "paid" or "open" */
  status: Scalars['String']['output'];
  total: Scalars['Float']['output'];
  visit: Scalars['String']['output'];
};

export type InvoiceItem = {
  __typename?: 'InvoiceItem';
  name: Scalars['String']['output'];
  price?: Maybe<Scalars['Float']['output']>;
  qty: Scalars['Float']['output'];
};

/** Patient record, Invoices tab. Never a card number. */
export type InvoiceList = {
  __typename?: 'InvoiceList';
  balance?: Maybe<Scalars['Float']['output']>;
  /** Invoices per pet id, plus "all" */
  counts: Scalars['JSON']['output'];
  invoices: Array<Invoice>;
  last_12_months: Scalars['Float']['output'];
  /** {date, amount, paid_by} */
  last_payment?: Maybe<Scalars['JSON']['output']>;
  mock: Scalars['Boolean']['output'];
};

export type KeyPoint = {
  __typename?: 'KeyPoint';
  page: Scalars['Int']['output'];
  text: Scalars['String']['output'];
};

export type LastNote = {
  __typename?: 'LastNote';
  by: Scalars['String']['output'];
  date: Scalars['String']['output'];
  gist: Scalars['String']['output'];
  other_vet: Scalars['Boolean']['output'];
};

export type LastVisit = {
  __typename?: 'LastVisit';
  date: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  /** The visit type ("Sick", "Wellness"), or "" */
  type: Scalars['String']['output'];
};

export type LatestMessage = {
  __typename?: 'LatestMessage';
  at: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** A letter the clinic sends */
export type Letter = {
  __typename?: 'Letter';
  attachments: LetterAttachments;
  body: Scalars['String']['output'];
  created_at: Scalars['DateTime']['output'];
  created_by: Scalars['String']['output'];
  /** Who wrote the first draft: "muse", "mock" (demo mode) or "" */
  drafted: Scalars['String']['output'];
  /** The visit, or empty */
  encounter_id: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** "referral", "records" or "owner" */
  kind: Scalars['String']['output'];
  opened_at?: Maybe<Scalars['DateTime']['output']>;
  /** The owner agreed to share with another clinic */
  owner_consent: Scalars['Boolean']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  pdf_url: Scalars['String']['output'];
  /** The vet's own words, as typed */
  reason: Scalars['String']['output'];
  recipient: LetterRecipient;
  sent: Array<LetterSend>;
  /** Where it went, in words */
  sent_to: Array<Scalars['String']['output']>;
  signed_at?: Maybe<Scalars['DateTime']['output']>;
  signed_by: Scalars['String']['output'];
  /** As the letter shows it: "Dr. Ana Rivera, DVM" */
  signer_title: Scalars['String']['output'];
  /** "draft", "sent" or "opened" */
  status: Scalars['String']['output'];
  updated_at: Scalars['DateTime']['output'];
  /** "routine", "soon" or "urgent" */
  urgency: Scalars['String']['output'];
  /** "full", or "summary" for front office and admins who aren't vets (kind, recipient name, status, where it went; no letter or PDF) */
  view: Scalars['String']['output'];
};

export type LetterAttachments = {
  __typename?: 'LetterAttachments';
  /** Received documents */
  document_ids: Array<Scalars['String']['output']>;
  /** Invoices: only when the vet checks them, never by default */
  invoice_ids: Array<Scalars['String']['output']>;
  /** Signed notes of any of the pet's visits */
  note_encounter_ids: Array<Scalars['String']['output']>;
  /** Exam photos */
  photos: Array<LetterPhoto>;
};

export type LetterAttachmentsInput = {
  document_ids?: Array<Scalars['String']['input']>;
  invoice_ids?: Array<Scalars['String']['input']>;
  note_encounter_ids?: Array<Scalars['String']['input']>;
  photos?: Array<LetterPhotoInput>;
};

/** What one channel did, or in demo mode would do */
export type LetterChannelResult = {
  __typename?: 'LetterChannelResult';
  /** email: the message text */
  body: Scalars['String']['output'];
  channel: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  expires_at?: Maybe<Scalars['String']['output']>;
  pdf_url: Scalars['String']['output'];
  /** "sent", "preview" (nothing went out), "failed", "skipped" or "ready" (print) */
  status: Scalars['String']['output'];
  /** email: the subject */
  subject: Scalars['String']['output'];
  /** owner_text: the text message */
  text: Scalars['String']['output'];
  /** email: the address */
  to: Scalars['String']['output'];
  /** owner_text: the owner's link; email: the view online link */
  url: Scalars['String']['output'];
};

/** Leave a field out to keep it as it is */
export type LetterInput = {
  attachments?: InputMaybe<LetterAttachmentsInput>;
  body?: InputMaybe<Scalars['String']['input']>;
  /** "referral", "records" or "owner" */
  kind?: InputMaybe<Scalars['String']['input']>;
  owner_consent?: InputMaybe<Scalars['Boolean']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  recipient?: InputMaybe<LetterRecipientInput>;
  /** "routine", "soon" or "urgent" */
  urgency?: InputMaybe<Scalars['String']['input']>;
};

export type LetterPhoto = {
  __typename?: 'LetterPhoto';
  encounter_id: Scalars['String']['output'];
  photo_id: Scalars['String']['output'];
};

export type LetterPhotoInput = {
  encounter_id: Scalars['String']['input'];
  photo_id: Scalars['String']['input'];
};

export type LetterRecipient = {
  __typename?: 'LetterRecipient';
  clinic: Scalars['String']['output'];
  email: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type LetterRecipientInput = {
  clinic?: Scalars['String']['input'];
  email?: Scalars['String']['input'];
  name?: Scalars['String']['input'];
};

/** One time the letter went somewhere */
export type LetterSend = {
  __typename?: 'LetterSend';
  at: Scalars['DateTime']['output'];
  /** "email", "owner_text", "owner_email" or "print" */
  channel: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  /** "sent", "preview", "failed", "skipped" or "ready" */
  status: Scalars['String']['output'];
  to_masked: Scalars['String']['output'];
};

/** Who is calling */
export type Me = {
  __typename?: 'Me';
  admin: Scalars['Boolean']['output'];
  /** What you may do, like "note.sign" or "letter.send" (clinical actions on your own visits). The API token and the open demo get all */
  permissions: Array<Scalars['String']['output']>;
  /** Who you are in the PIMS, or '' */
  provider_id: Scalars['String']['output'];
  /** "vet", "front_office" or "admin"; "" for the API token and the open demo */
  role: Scalars['String']['output'];
  user?: Maybe<User>;
  /** "session", "token" or "open" */
  via: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Set a password from an invite link */
  accept_invite: SignInPayload;
  /** Approve, dismiss, retry the text, or book */
  act_on_followup: Encounter;
  /** A last plan line the visit didn't cover: "added" (the provider put it in the Plan) or "dismissed". Never blocks signing */
  act_on_plan_reminder: Encounter;
  /** Add another of the owner's pets to a visit already started. Drafted already, its note waits (Not started) until the draft is redone */
  add_pet_to_visit: Encounter;
  add_template: Template;
  /** Add to or replace the transcript */
  add_transcript: Encounter;
  /** Ask the day assistant. Follow assistant_turn */
  ask_assistant: AssistantReply;
  /** Edit tool on one section. Saves nothing */
  assist: AssistResult;
  /** Change your password. Needs the current one; an account with none yet (Google or Microsoft only) can set one within 10 minutes of signing in. Signs out your other sessions */
  change_password: Scalars['Boolean']['output'];
  /** The first 6 digit code from the app: turns two step sign in on, with the app's codes (an emailed code stays the backup) */
  confirm_authenticator: User;
  /** Signed in: where to send the browser to connect Google or Microsoft to this account. Needs current_password (or a sign in in the last 10 minutes for an account with no password). It comes back with #oauth_link=<code> for finish_oauth_link */
  connect_oauth_account: Scalars['String']['output'];
  /** Start a letter (kind referral, records or owner) for a pet, from a visit (encounter_id: its signed note is attached) or from the record (patient_id). Returns Blinq's draft unless draft is false */
  create_letter: Letter;
  /** Delete a draft. Sent letters stay */
  delete_letter: Scalars['Boolean']['output'];
  /** Delete a photo: it leaves the note, the summary and every list. Its file is kept until the visit is signed (restore_photo undoes it), then purged. To retake, upload the new photo (REST) then delete the old one. Refused once the visit is signed */
  delete_photo: Encounter;
  delete_template: Scalars['Boolean']['output'];
  /** Disconnect Google or Microsoft. Needs current_password (or a recent sign in). Refused if it's your only way to sign in */
  disconnect_oauth_account: Scalars['Boolean']['output'];
  /** Blinq drafts the body again, from the signed notes, the attachments and the reason only; gaps become [confirm: ...]. Mock in demo mode */
  draft_letter: Letter;
  /** Write the note and plan follow ups. Steps go to draft_progress */
  draft_note: Encounter;
  /** Signed in: connect the account from the one-time #oauth_link code. Only the person who started connecting can finish */
  finish_oauth_link: User;
  /** Trade the one-time #oauth code for a session */
  finish_oauth_sign_in: SignInPayload;
  /** Delete a kept Remember item */
  forget_remember: Scalars['Boolean']['output'];
  /** Invite someone; returns their invite link */
  invite_user: Invite;
  /** Keep exactly these suggestions for the household */
  keep_remember: Array<RememberItem>;
  /** The front desk entered the prescription in the PIMS: records who and when (audited). Marking it again keeps the first */
  mark_prescription_entered: Encounter;
  /** Who is this?: role "tech", "owner" or "other" ("family" and "other_vet" too, and an optional name) for every line from that speaker. Only the visit's vet */
  name_speaker: Encounter;
  /** Sync the last N days of notes (default 90) */
  onboard: OnboardReport;
  /** A new invite link for someone */
  reinvite_user: Invite;
  /** Stop using the app: codes come by email again. Needs current_password */
  remove_authenticator: User;
  /** Email a reset link. True whether or not the email has an account */
  request_password_reset: Scalars['Boolean']['output'];
  /** Send a booking link again */
  resend_booking_link: WaitingLink;
  /** Email a new code for this sign in */
  resend_sign_in_code: SignInPayload;
  /** Choose a new password from a #reset link. Signs out everywhere */
  reset_password: Scalars['Boolean']['output'];
  /** Undo delete_photo, back in its place. Refused once signed */
  restore_photo: Encounter;
  /** Sign someone out on every device (admins) */
  revoke_user_sessions: Scalars['Boolean']['output'];
  /** Save the vet's edits. Refused once signed */
  save_note: Encounter;
  /** Sign and send in one step (or send again): channels email (one PDF to to_email or the recipient), owner_text, owner_email and print; owner_copy adds a text to the owner. Refused while anything is marked to confirm, or without owner_consent for another clinic */
  send_letter: SendLetterResult;
  /** Send a signed note to the PIMS again, when saving it failed or it is waiting for staff. Only the vet who signed it. A note already written comes back as it is */
  send_to_pims: WriteBackResult;
  /** Change the note type. Refused once signed */
  set_note_type: Encounter;
  /** Keep the last plan's lines the provider ticked for this pet before the visit (asked to cover today). Returns the lines kept */
  set_plan_checks: Array<Scalars['String']['output']>;
  /** Turn your own two step sign in on or off. Turning it off needs current_password (or a sign in in the last 10 minutes for an account with no password) */
  set_two_factor: User;
  /** Require (or stop requiring) email codes for someone (admins) */
  set_user_two_factor: User;
  /** Share the owner summary. Only after signing */
  share_summary: ShareResult;
  /** Sign in with email (or username) and password. remember keeps you signed in for 30 days instead of 12 hours */
  sign_in: SignInPayload;
  /** Sign and lock the note. send: true writes it to the PIMS now (Sign and send); false keeps it out until send_to_pims (Sign only) */
  sign_note: SignResult;
  /** End this session */
  sign_out: Scalars['Boolean']['output'];
  /** End every session of yours, on every device */
  sign_out_everywhere: Scalars['Boolean']['output'];
  /** End your sessions on every other device; this one stays */
  sign_out_other_sessions: Scalars['Boolean']['output'];
  /** Set up an authenticator app: needs current_password (or a sign in in the last 10 minutes). Nothing changes until confirm_authenticator */
  start_authenticator: AuthenticatorSetup;
  /** Start a visit. Nothing records until the owner agreed */
  start_encounter: Encounter;
  /** Where to send the browser for "google" or "microsoft". It comes back to the web app with #oauth=<code> for finish_oauth_sign_in, or #oauth_error=<message> */
  start_oauth_sign_in: Scalars['String']['output'];
  /** Sign in as the demo vet (demo mode) */
  try_demo_clinic: SignInPayload;
  /** Edit a draft: recipient, reason, attachments, body, owner_consent. Refused once signed */
  update_letter: Letter;
  /** Change your name, or your email (which needs current_password, or a sign in in the last 10 minutes for an account with no password) */
  update_my_profile: User;
  /** Edit a photo: label, caption, outline, crop, rotation, in_note, show_owner. Refused once the visit is signed. Upload photos with POST /api/encounters/{id}/photos (REST) */
  update_photo: Encounter;
  update_template: Template;
  /** Rename, relink, change role, or turn off */
  update_user: User;
  /** Finish signing in with the 6 digit email code */
  verify_sign_in_code: SignInPayload;
};


export type MutationAccept_InviteArgs = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationAct_On_FollowupArgs = {
  encounter_id: Scalars['String']['input'];
  followup_id: Scalars['String']['input'];
  input: FollowUpActionInput;
};


export type MutationAct_On_Plan_ReminderArgs = {
  action: Scalars['String']['input'];
  encounter_id: Scalars['String']['input'];
  reminder_id: Scalars['String']['input'];
};


export type MutationAdd_Pet_To_VisitArgs = {
  encounter_id: Scalars['String']['input'];
  patient_id: Scalars['String']['input'];
};


export type MutationAdd_TemplateArgs = {
  input: TemplateInput;
};


export type MutationAdd_TranscriptArgs = {
  append?: Scalars['Boolean']['input'];
  encounter_id: Scalars['String']['input'];
  text: Scalars['String']['input'];
};


export type MutationAsk_AssistantArgs = {
  input: AssistantInput;
};


export type MutationAssistArgs = {
  encounter_id: Scalars['String']['input'];
  input: AssistInput;
};


export type MutationChange_PasswordArgs = {
  current_password?: Scalars['String']['input'];
  new_password: Scalars['String']['input'];
};


export type MutationConfirm_AuthenticatorArgs = {
  code: Scalars['String']['input'];
};


export type MutationConnect_Oauth_AccountArgs = {
  current_password?: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};


export type MutationCreate_LetterArgs = {
  draft?: Scalars['Boolean']['input'];
  encounter_id?: Scalars['String']['input'];
  input?: InputMaybe<LetterInput>;
  patient_id?: Scalars['String']['input'];
};


export type MutationDelete_LetterArgs = {
  id: Scalars['String']['input'];
};


export type MutationDelete_PhotoArgs = {
  encounter_id: Scalars['String']['input'];
  photo_id: Scalars['String']['input'];
};


export type MutationDelete_TemplateArgs = {
  template_id: Scalars['String']['input'];
};


export type MutationDisconnect_Oauth_AccountArgs = {
  current_password?: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};


export type MutationDraft_LetterArgs = {
  id: Scalars['String']['input'];
};


export type MutationDraft_NoteArgs = {
  encounter_id: Scalars['String']['input'];
};


export type MutationFinish_Oauth_LinkArgs = {
  code: Scalars['String']['input'];
};


export type MutationFinish_Oauth_Sign_InArgs = {
  code: Scalars['String']['input'];
};


export type MutationForget_RememberArgs = {
  client_id: Scalars['String']['input'];
  item_id: Scalars['String']['input'];
};


export type MutationInvite_UserArgs = {
  input: NewUserInput;
};


export type MutationKeep_RememberArgs = {
  encounter_id: Scalars['String']['input'];
  keep: Array<Scalars['String']['input']>;
};


export type MutationMark_Prescription_EnteredArgs = {
  encounter_id: Scalars['String']['input'];
};


export type MutationName_SpeakerArgs = {
  encounter_id: Scalars['String']['input'];
  name?: Scalars['String']['input'];
  role: Scalars['String']['input'];
  speaker_id: Scalars['String']['input'];
};


export type MutationOnboardArgs = {
  days?: Scalars['Int']['input'];
};


export type MutationReinvite_UserArgs = {
  user_id: Scalars['String']['input'];
};


export type MutationRemove_AuthenticatorArgs = {
  current_password?: Scalars['String']['input'];
};


export type MutationRequest_Password_ResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResend_Booking_LinkArgs = {
  followup_id: Scalars['String']['input'];
};


export type MutationResend_Sign_In_CodeArgs = {
  ticket: Scalars['String']['input'];
};


export type MutationReset_PasswordArgs = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationRestore_PhotoArgs = {
  encounter_id: Scalars['String']['input'];
  photo_id: Scalars['String']['input'];
};


export type MutationRevoke_User_SessionsArgs = {
  user_id: Scalars['String']['input'];
};


export type MutationSave_NoteArgs = {
  encounter_id: Scalars['String']['input'];
  note: SoapNoteInput;
};


export type MutationSend_LetterArgs = {
  channels: Array<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  owner_copy?: Scalars['Boolean']['input'];
  to_email?: Scalars['String']['input'];
};


export type MutationSend_To_PimsArgs = {
  encounter_id: Scalars['String']['input'];
};


export type MutationSet_Note_TypeArgs = {
  encounter_id: Scalars['String']['input'];
  note_type: Scalars['String']['input'];
};


export type MutationSet_Plan_ChecksArgs = {
  appointment_id: Scalars['String']['input'];
  lines: Array<Scalars['String']['input']>;
  patient_id: Scalars['String']['input'];
};


export type MutationSet_Two_FactorArgs = {
  current_password?: Scalars['String']['input'];
  enabled: Scalars['Boolean']['input'];
};


export type MutationSet_User_Two_FactorArgs = {
  required: Scalars['Boolean']['input'];
  user_id: Scalars['String']['input'];
};


export type MutationShare_SummaryArgs = {
  channel: Scalars['String']['input'];
  encounter_id: Scalars['String']['input'];
  language?: Scalars['String']['input'];
};


export type MutationSign_InArgs = {
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
  remember?: Scalars['Boolean']['input'];
};


export type MutationSign_NoteArgs = {
  encounter_id: Scalars['String']['input'];
  send?: Scalars['Boolean']['input'];
  signed_by?: Scalars['String']['input'];
};


export type MutationStart_AuthenticatorArgs = {
  current_password?: Scalars['String']['input'];
};


export type MutationStart_EncounterArgs = {
  input: NewEncounterInput;
};


export type MutationStart_Oauth_Sign_InArgs = {
  provider: Scalars['String']['input'];
  remember?: Scalars['Boolean']['input'];
};


export type MutationUpdate_LetterArgs = {
  id: Scalars['String']['input'];
  input: LetterInput;
};


export type MutationUpdate_My_ProfileArgs = {
  current_password?: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdate_PhotoArgs = {
  encounter_id: Scalars['String']['input'];
  input: PhotoEditInput;
  photo_id: Scalars['String']['input'];
};


export type MutationUpdate_TemplateArgs = {
  input: TemplateInput;
  template_id: Scalars['String']['input'];
};


export type MutationUpdate_UserArgs = {
  input: UserUpdateInput;
  user_id: Scalars['String']['input'];
};


export type MutationVerify_Sign_In_CodeArgs = {
  code: Scalars['String']['input'];
  ticket: Scalars['String']['input'];
};

export type NewEncounterInput = {
  appointment_id: Scalars['String']['input'];
  consent_recorded: Scalars['Boolean']['input'];
  note_type?: Scalars['String']['input'];
  patient_ids?: Array<Scalars['String']['input']>;
  source?: Scalars['String']['input'];
};

export type NewUserInput = {
  email?: Scalars['String']['input'];
  name: Scalars['String']['input'];
  provider_id?: Scalars['String']['input'];
  role?: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type NextAppointment = {
  __typename?: 'NextAppointment';
  appointment_id: Scalars['String']['output'];
  date: Scalars['String']['output'];
  time: Scalars['String']['output'];
};

export type NextDue = {
  __typename?: 'NextDue';
  /** The day, YYYY-MM-DD */
  due: Scalars['String']['output'];
  /** "overdue", "soon" or "later" */
  state: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type NextVisit = {
  __typename?: 'NextVisit';
  /** "booked", "pick_a_time" or "none" */
  kind: Scalars['String']['output'];
  text: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type NoteSection = {
  __typename?: 'NoteSection';
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
};

/** A note not signed yet, from any day, in its bucket: ready (drafted, nothing to confirm, every follow up decided) or pending */
export type NoteToSign = {
  __typename?: 'NoteToSign';
  appointment_id: Scalars['String']['output'];
  /** The first line of the draft's assessment */
  assessment: Scalars['String']['output'];
  /** "ready" or "pending" */
  bucket: Scalars['String']['output'];
  client_id: Scalars['String']['output'];
  /** The visit's day, YYYY-MM-DD */
  date: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  followups_undecided: Scalars['Int']['output'];
  owner_name: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  provider_id: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  /** What is left, for a pending note: "1 thing to confirm, 1 follow up to decide", or "Not drafted yet". Empty when ready */
  reason: Scalars['String']['output'];
  /** "draft_ready" or "recording" */
  status: Scalars['String']['output'];
  /** The visit's clinic time, HH:MM */
  time: Scalars['String']['output'];
  to_confirm: Scalars['Int']['output'];
  visit_reason: Scalars['String']['output'];
  /** Days since the visit */
  waiting_days: Scalars['Int']['output'];
};

export type NoteType = {
  __typename?: 'NoteType';
  from_types: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sections: Array<NoteSection>;
};

export type OnboardReport = {
  __typename?: 'OnboardReport';
  days: Scalars['Int']['output'];
  failed_patients: Scalars['Int']['output'];
  notes: Scalars['Int']['output'];
  notes_supported: Scalars['Boolean']['output'];
  patients: Scalars['Int']['output'];
  profiles_ready: Array<Scalars['String']['output']>;
  purged: Scalars['Int']['output'];
  removed: Scalars['Int']['output'];
};

/** Something still to do: sign, approve, a failed text, queued. */
export type OpenItem = {
  __typename?: 'OpenItem';
  appointment_id: Scalars['String']['output'];
  /** The owner, so their visit can show what failed */
  client_id: Scalars['String']['output'];
  date: Scalars['String']['output'];
  /** A short line under the title: the follow up's reason, "To Jordan Lee", "Draft ready", or why it was queued */
  detail?: Maybe<Scalars['String']['output']>;
  encounter_id: Scalars['String']['output'];
  followup_id?: Maybe<Scalars['String']['output']>;
  followup_kind?: Maybe<Scalars['String']['output']>;
  /** "unsigned", "followup", "failed_text", "not_sent" (signed only: send it to the PIMS), "pims_failed" (couldn't save yet, retrying), "queued" (for the front desk) or "prescription" (the front desk enters it in the PIMS) */
  kind: Scalars['String']['output'];
  /** The To do row's short title with the pet or owner, e.g. "Sign Pepper's note", "Approve Max's follow up", "Text to Jordan didn't send". The whole sentence stays in text */
  label: Scalars['String']['output'];
  /** The owner's name, to group one owner's rows */
  owner_name: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  /** The whole sentence, for Read aloud and the glasses */
  text: Scalars['String']['output'];
  /** A short row label without the pet, e.g. "Sign note" */
  title: Scalars['String']['output'];
  what?: Maybe<Scalars['String']['output']>;
};

export type OtherPet = {
  __typename?: 'OtherPet';
  age?: Maybe<Scalars['Int']['output']>;
  alerts: Array<Scalars['String']['output']>;
  breed: Scalars['String']['output'];
  due: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  last_visit?: Maybe<LastVisit>;
  name: Scalars['String']['output'];
  sex: Scalars['String']['output'];
  species: Scalars['String']['output'];
};

/** An outlined area, in 0..1 fractions of the displayed photo */
export type OutlineRegion = {
  __typename?: 'OutlineRegion';
  /** [x0, y0, x1, y1] */
  box: Array<Scalars['Float']['output']>;
  label: Scalars['String']['output'];
  /** [x, y] points, or [] */
  polygon: Array<Array<Scalars['Float']['output']>>;
};

export type OutlineRegionInput = {
  /** [x0, y0, x1, y1], 0..1 */
  box: Array<Scalars['Float']['input']>;
  label?: Scalars['String']['input'];
  polygon?: Array<Array<Scalars['Float']['input']>>;
};

export type OwnerHit = {
  __typename?: 'OwnerHit';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pets: Array<Scalars['String']['output']>;
  phone: Scalars['String']['output'];
};

/** A text from the owner */
export type OwnerMessage = {
  __typename?: 'OwnerMessage';
  at: Scalars['String']['output'];
  text: Scalars['String']['output'];
  /** The owner's first name */
  who: Scalars['String']['output'];
};

export type OwnerSummary = {
  __typename?: 'OwnerSummary';
  clinic: Clinic;
  language: Scalars['String']['output'];
  mock: Scalars['Boolean']['output'];
  /** First and last name only */
  owner_name: Scalars['String']['output'];
  pets: Array<SummaryPet>;
  translated: Scalars['Boolean']['output'];
  visit: SummaryVisit;
  when_to_call: Scalars['String']['output'];
};

export type PanelVisit = {
  __typename?: 'PanelVisit';
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** "sick", "wellness" or "other" */
  kind: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

/** A note from an earlier visit, by any vet. */
export type PastNote = {
  __typename?: 'PastNote';
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  patient_id: Scalars['String']['output'];
  provider_id: Scalars['String']['output'];
  provider_name: Scalars['String']['output'];
  /** The note by its headings, for SOAP form; empty when it has none (show text then) */
  sections: Array<PastNoteSection>;
  /** "pims" or "blinq" */
  source: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** One heading of a written note and what it says. */
export type PastNoteSection = {
  __typename?: 'PastNoteSection';
  /** "Subjective", "Objective", "Assessment", "Plan", a note type's own heading ("History", "Since last visit"...), "Vitals", "Medications" */
  label: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** A past visit on the patient record. */
export type PastVisit = {
  __typename?: 'PastVisit';
  appointment_id: Scalars['String']['output'];
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** "sick", "wellness" or "other" */
  kind: Scalars['String']['output'];
  medications: Array<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  photos: Array<VisitPhoto>;
  provider_name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  related: Scalars['Boolean']['output'];
  /** The note by its headings, for SOAP form; empty when it has none (show note then) */
  sections: Array<PastNoteSection>;
  summary: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type Patient = {
  __typename?: 'Patient';
  age?: Maybe<Scalars['Int']['output']>;
  alert_chips: Array<AlertChip>;
  alerts: Array<Scalars['String']['output']>;
  breed: Scalars['String']['output'];
  client_id: Scalars['String']['output'];
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** The last visit before today, when the practice system sends it with the schedule */
  last_visit?: Maybe<LastVisit>;
  microchip: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** Short notes the practice system keeps on the pet beyond its alerts (Fear Free and handling notes, medicines given at home), never a medical note. Empty when the system has no such field */
  pims_notes: Array<Scalars['String']['output']>;
  sex: Scalars['String']['output'];
  species: Scalars['String']['output'];
  /** The newest weight on file, when the practice system sends it with the schedule */
  weight?: Maybe<WeightReading>;
};

/** Patient record, Client and patient tab. */
export type PatientProfile = {
  __typename?: 'PatientProfile';
  client?: Maybe<ClientCard>;
  mock: Scalars['Boolean']['output'];
  other_pets: Array<OtherPet>;
  patient: PetDetails;
  reminders_due: Array<ReminderDue>;
  weight: Weights;
};

export type PendingFollowUp = {
  __typename?: 'PendingFollowUp';
  /** The visit's appointment */
  appointment_id: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  followup_id: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  /** "Approve follow up: <short reason>" */
  title: Scalars['String']['output'];
};

/** Another pet in the household */
export type PetBasics = {
  __typename?: 'PetBasics';
  age?: Maybe<Scalars['Int']['output']>;
  alerts: Array<Scalars['String']['output']>;
  breed: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sex: Scalars['String']['output'];
  species: Scalars['String']['output'];
};

export type PetDetails = {
  __typename?: 'PetDetails';
  age?: Maybe<Scalars['Int']['output']>;
  alerts: Array<Scalars['String']['output']>;
  breed: Scalars['String']['output'];
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  microchip: Scalars['String']['output'];
  name: Scalars['String']['output'];
  sex: Scalars['String']['output'];
  species: Scalars['String']['output'];
};

export type PetHit = {
  __typename?: 'PetHit';
  age?: Maybe<Scalars['Int']['output']>;
  breed: Scalars['String']['output'];
  client_id: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  last_visit?: Maybe<LastVisit>;
  name: Scalars['String']['output'];
  next_visit?: Maybe<NextAppointment>;
  owner_name: Scalars['String']['output'];
  species: Scalars['String']['output'];
};

/** An exam photo. The original file, at /api/encounters/{id}/photos/{photo id}, is never changed: crop, rotation and outline are drawn on top of it. Coordinates are 0..1 of the photo as a browser displays it (EXIF orientation applied), from the top left; rotation is applied after the crop */
export type Photo = {
  __typename?: 'Photo';
  /** Blinq's short description of what's visible, never a diagnosis. Editable; the vet's own words are kept as written */
  caption: Scalars['String']['output'];
  crop?: Maybe<Crop>;
  edited_at?: Maybe<Scalars['DateTime']['output']>;
  /** Blinq's longer description, same rule */
  findings: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Written back with the signed note and read by the draft */
  in_note: Scalars['Boolean']['output'];
  /** What it is, e.g. Left ear canal */
  label: Scalars['String']['output'];
  /** The outline shown and edited (starts as SAM's) */
  outline: Array<OutlineRegion>;
  /** 0, 90, 180 or 270, clockwise */
  rotation: Scalars['Int']['output'];
  /** SAM 3.1's outlines as returned: [{label, score, box}] */
  segments: Scalars['JSON']['output'];
  /** Shown in the owner's summary */
  show_owner: Scalars['Boolean']['output'];
  /** The file's EXIF orientation, 1 to 8 (1 = upright). Browsers apply it; coordinates are already relative to the upright photo */
  source_orientation: Scalars['Int']['output'];
  taken_at: Scalars['DateTime']['output'];
};

/** Only the fields sent change. Send crop: null to uncrop */
export type PhotoEditInput = {
  caption?: InputMaybe<Scalars['String']['input']>;
  crop?: InputMaybe<CropInput>;
  findings?: InputMaybe<Scalars['String']['input']>;
  in_note?: InputMaybe<Scalars['Boolean']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  outline?: InputMaybe<Array<OutlineRegionInput>>;
  rotation?: InputMaybe<Scalars['Int']['input']>;
  show_owner?: InputMaybe<Scalars['Boolean']['input']>;
};

/** One thing on its way to the PIMS, and where it stands. */
export type PimsItem = {
  __typename?: 'PimsItem';
  detail: Scalars['String']['output'];
  /** "note", the photo's id, or "prescription" */
  id: Scalars['String']['output'];
  /** "note", "photo" or "prescription" */
  kind: Scalars['String']['output'];
  /** "Note", "Photo: Left ear", "Prescription" */
  label: Scalars['String']['output'];
  pims_id: Scalars['String']['output'];
  /** One of: "sending", "synced" (saved; see synced_at and pims_id), "not_sent" (signed only, or the PIMS can't take it yet: detail says which) or "failed" (couldn't save; tried again every 5 minutes) */
  status: Scalars['String']['output'];
  synced_at?: Maybe<Scalars['DateTime']['output']>;
};

export type PimsRecordRef = {
  __typename?: 'PimsRecordRef';
  name: Scalars['String']['output'];
  pims_id: Scalars['String']['output'];
};

/** A line of the provider's own last plan, ticked to cover today, that the visit didn't talk about. Quoted as written. A reminder: never blocks signing */
export type PlanReminder = {
  __typename?: 'PlanReminder';
  id: Scalars['ID']['output'];
  /** "open", "added" or "dismissed" */
  status: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** What to know before walking in. */
export type PreRoomCard = {
  __typename?: 'PreRoomCard';
  alerts: Array<Scalars['String']['output']>;
  /** Care due within 30 days: "Rabies vaccine due Nov 21" */
  can_do_today: Array<Scalars['String']['output']>;
  last_note?: Maybe<LastNote>;
  last_visit: Scalars['String']['output'];
  /** The last visit's day, YYYY-MM-DD, or empty */
  last_visit_on: Scalars['String']['output'];
  /** The newest visit's medications, as written */
  medications: Array<Scalars['String']['output']>;
  owner: Scalars['String']['output'];
  /** The owner's latest text, from the last two days */
  owner_message?: Maybe<OwnerMessage>;
  patient: Scalars['String']['output'];
  /** The same facts as short neutral chips: "Recheck overdue", "Owner messaged", "Results in" */
  prep: Array<Scalars['String']['output']>;
  previous_notes: Scalars['Int']['output'];
  promised: Array<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  remember: Array<Scalars['String']['output']>;
  remember_items: Array<RememberItem>;
  room: Scalars['String']['output'];
  spoken: Scalars['String']['output'];
  /** Blinq's one line on the visit, facts only: what came in since yesterday, then the last visit */
  take: Scalars['String']['output'];
  /** Before you walk in as dated facts, newest first. Never advice */
  walk_in: Array<WalkInEntry>;
  /** The latest weight on record, "72 lb", or empty */
  weight: Scalars['String']['output'];
  /** Why the visit matters, as facts on record (the last visit, a recheck that was due, care due soon, results in, the owner's latest text quoted). Never advice */
  why: Array<Scalars['String']['output']>;
};

export type PrepareItem = {
  __typename?: 'PrepareItem';
  appointment_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** Enter the prescription in the PIMS: a front desk task */
export type PrescriptionTask = {
  __typename?: 'PrescriptionTask';
  done_at?: Maybe<Scalars['DateTime']['output']>;
  /** Who marked it entered; empty until */
  done_by: Scalars['String']['output'];
  done_by_user: Scalars['String']['output'];
  medications: Array<Scalars['String']['output']>;
  /** "Enter Cefpodoxime for Biscuit in the PIMS" */
  text: Scalars['String']['output'];
};

export type Provider = {
  __typename?: 'Provider';
  id: Scalars['ID']['output'];
  linked_to: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Whether sign in is needed, and how */
  auth_status: AuthStatus;
  /** Morning brief */
  brief: Brief;
  /** The household page */
  client_household: Household;
  /** Invoices for a household, last 12 months */
  client_invoices: InvoiceList;
  /** Kept Remember items for a household */
  client_remember: Array<RememberItem>;
  /** Saved contacts: specialists and clinics from past letters */
  contacts: Array<LetterRecipient>;
  /** Week strip: one entry per day, oldest first */
  days: Array<DaySummary>;
  /** Every vet in the practice (provider id and name), for any signed-in role: the doctor picker */
  doctors: Array<Doctor>;
  encounter: Encounter;
  /** Audit log for a visit */
  encounter_audit: Array<AuditEntry>;
  /** Visits, newest first; with group_id, one visit's pets */
  encounters: Array<Encounter>;
  /** End of day list */
  end_of_day: EndOfDay;
  /** Which models and data source are live or mock */
  health: Health;
  /** The name on an invite link, before setting a password */
  invite_info: InviteInfo;
  /** One letter */
  letter: Letter;
  /** The clinic's name, address, phone and logo for a letter */
  letterhead: Clinic;
  /** A pet's letters, newest first */
  letters: Array<Letter>;
  /** Who is calling */
  me: Me;
  /** Your connected Google and Microsoft accounts */
  my_connected_accounts: Array<ConnectedAccount>;
  /** The note types and their sections */
  note_types: Array<NoteType>;
  /** Every note not signed yet, any day, newest first, each in its bucket (Ready to sign or Pending): the Notes page */
  notes_to_sign: Array<NoteToSign>;
  /** The owner summary of a signed visit */
  owner_summary: OwnerSummary;
  /** Outside records with their key points */
  patient_documents: Array<Document>;
  /** Earlier notes on the patient from every vet */
  patient_notes: Array<PastNote>;
  /** Patient details, weights, reminders and owner */
  patient_profile: PatientProfile;
  /** Past visits, newest first */
  patient_visits: Array<PastVisit>;
  /** What to know before walking in */
  pre_room_card: PreRoomCard;
  /** Practice system providers, with who is linked */
  providers: Array<Provider>;
  /** Everything the visit page's Record panel shows, in one read. Read only and lock-free, so recording and draft_progress carry on */
  record_panel: RecordPanel;
  /** Remember suggestions for a visit */
  remember_suggestions: RememberSuggestions;
  /** The demo's sample visit: with appointment_id, that demo pet's own (demo clinic only; otherwise the generic one) */
  sample_transcript: Scalars['String']['output'];
  /** One day's appointments with their visit status */
  schedule: Array<Appointment>;
  /** Pets and owners: name, email or phone digits */
  search: SearchResult;
  /** Which ways to sign in are on */
  sign_in_options: SignInOptions;
  /** The confirm panel before Sign and send or Sign only: where the note goes, what goes, the texts that follow */
  sign_preview: SignPreview;
  /** Voices for reading aloud. The clip itself is REST: POST /api/speech {text, voice} returns audio/wav */
  speech_options: SpeechOptions;
  /** Saved phrases: the vet's and the clinic's */
  templates: Array<Template>;
  /** Everyone with a login */
  users: Array<User>;
  /** A vet's voice profile, or null until it has notes */
  voice_profile?: Maybe<VoiceProfile>;
  /** Booking links sent and not booked yet */
  waiting_followups: Array<WaitingLink>;
};


export type QueryBriefArgs = {
  provider_id?: Scalars['String']['input'];
};


export type QueryClient_HouseholdArgs = {
  client_id: Scalars['String']['input'];
};


export type QueryClient_InvoicesArgs = {
  client_id: Scalars['String']['input'];
  patient_id?: Scalars['String']['input'];
};


export type QueryClient_RememberArgs = {
  client_id: Scalars['String']['input'];
};


export type QueryContactsArgs = {
  q?: Scalars['String']['input'];
};


export type QueryDaysArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  provider_id?: Scalars['String']['input'];
  to?: InputMaybe<Scalars['Date']['input']>;
};


export type QueryEncounterArgs = {
  encounter_id: Scalars['String']['input'];
};


export type QueryEncounter_AuditArgs = {
  encounter_id: Scalars['String']['input'];
};


export type QueryEncountersArgs = {
  group_id?: Scalars['String']['input'];
};


export type QueryEnd_Of_DayArgs = {
  date?: InputMaybe<Scalars['Date']['input']>;
  provider_id?: Scalars['String']['input'];
};


export type QueryInvite_InfoArgs = {
  token: Scalars['String']['input'];
};


export type QueryLetterArgs = {
  id: Scalars['String']['input'];
};


export type QueryLettersArgs = {
  patient_id: Scalars['String']['input'];
};


export type QueryNotes_To_SignArgs = {
  provider_id?: Scalars['String']['input'];
};


export type QueryOwner_SummaryArgs = {
  encounter_id: Scalars['String']['input'];
  lang?: Scalars['String']['input'];
};


export type QueryPatient_DocumentsArgs = {
  patient_id: Scalars['String']['input'];
};


export type QueryPatient_NotesArgs = {
  patient_id: Scalars['String']['input'];
};


export type QueryPatient_ProfileArgs = {
  patient_id: Scalars['String']['input'];
};


export type QueryPatient_VisitsArgs = {
  patient_id: Scalars['String']['input'];
  q?: Scalars['String']['input'];
  related_to?: Scalars['String']['input'];
  type?: Scalars['String']['input'];
};


export type QueryPre_Room_CardArgs = {
  appointment_id: Scalars['String']['input'];
};


export type QueryRecord_PanelArgs = {
  patient_id: Scalars['String']['input'];
};


export type QueryRemember_SuggestionsArgs = {
  encounter_id: Scalars['String']['input'];
};


export type QuerySample_TranscriptArgs = {
  appointment_id?: Scalars['String']['input'];
};


export type QueryScheduleArgs = {
  date?: InputMaybe<Scalars['Date']['input']>;
  provider_id?: Scalars['String']['input'];
};


export type QuerySearchArgs = {
  q: Scalars['String']['input'];
};


export type QuerySign_PreviewArgs = {
  encounter_id: Scalars['String']['input'];
};


export type QueryTemplatesArgs = {
  note_type?: Scalars['String']['input'];
};


export type QueryVoice_ProfileArgs = {
  provider_id: Scalars['String']['input'];
};

export type QueuedItem = {
  __typename?: 'QueuedItem';
  detail: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  patient: Scalars['String']['output'];
  what: Scalars['String']['output'];
};

/** The Record side panel on a visit page, read only: the pet, owner contact, other pets, weight, what's due and recent visits (lines, never notes) */
export type RecordPanel = {
  __typename?: 'RecordPanel';
  client?: Maybe<ClientContact>;
  mock: Scalars['Boolean']['output'];
  other_pets: Array<PetBasics>;
  patient: PetDetails;
  /** The owner's id there */
  pims_client_id: Scalars['String']['output'];
  /** The pet's id in the practice system (as the adapter gives it) */
  pims_patient_id: Scalars['String']['output'];
  /** The latest visits, as many as the panel shows */
  recent_visits: Array<PanelVisit>;
  reminders_due: Array<ReminderDue>;
  weight: Weights;
};

/** Something the owner shared, kept for staff only. */
export type RememberItem = {
  __typename?: 'RememberItem';
  client_id: Scalars['String']['output'];
  date?: Maybe<Scalars['String']['output']>;
  encounter_id: Scalars['String']['output'];
  expires_at?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kept_by: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  said_at: Scalars['String']['output'];
  /** Who said it, as the transcript labels it: "Jordan Lee · Owner" */
  said_by?: Maybe<Scalars['String']['output']>;
  text: Scalars['String']['output'];
};

export type RememberSuggestion = {
  __typename?: 'RememberSuggestion';
  date?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kept: Scalars['Boolean']['output'];
  kind: Scalars['String']['output'];
  /** Who said it, as the transcript labels it: "Jordan Lee · Owner" */
  said_by: Scalars['String']['output'];
  text: Scalars['String']['output'];
  transcript_lines: Array<Scalars['String']['output']>;
};

export type RememberSuggestions = {
  __typename?: 'RememberSuggestions';
  left_out: Scalars['Int']['output'];
  mock: Scalars['Boolean']['output'];
  suggestions: Array<RememberSuggestion>;
};

export type ReminderDue = {
  __typename?: 'ReminderDue';
  due: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type SearchResult = {
  __typename?: 'SearchResult';
  owners: Array<OwnerHit>;
  pets: Array<PetHit>;
};

export type SectionStyle = {
  __typename?: 'SectionStyle';
  /** "bullets" or "prose" */
  format: Scalars['String']['output'];
  /** "brief", "moderate" or "detailed" */
  length: Scalars['String']['output'];
};

export type SectionStyleEntry = {
  __typename?: 'SectionStyleEntry';
  section: Scalars['String']['output'];
  style: SectionStyle;
};

/** One transcript line and who said it */
export type Segment = {
  __typename?: 'Segment';
  id: Scalars['ID']['output'];
  /** Its line in the transcript, from 1 */
  line: Scalars['Int']['output'];
  /** Time into the visit */
  offset_seconds: Scalars['Int']['output'];
  /** False when Blinq couldn't tell which pet the line is about */
  pet_sure: Scalars['Boolean']['output'];
  /** A visit with several pets: the pets this line is about (one, several when it names them, or the ones it could be about when pet_sure is false). Empty for one pet */
  pets: Array<Scalars['String']['output']>;
  /** "vet", "owner", "tech", "family", "other_vet", "other" or "unknown" */
  role: Scalars['String']['output'];
  /** "vet", "owner", "speaker-3"...; "" when Blinq isn't sure */
  speaker_id: Scalars['String']['output'];
  /** "Dr. Ana Rivera", "Speaker 3"; "" when Blinq isn't sure */
  speaker_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type SendLetterResult = {
  __typename?: 'SendLetterResult';
  letter: Letter;
  results: Array<LetterChannelResult>;
};

export type ShareResult = {
  __typename?: 'ShareResult';
  channel: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  expires_at?: Maybe<Scalars['String']['output']>;
  language: Scalars['String']['output'];
  pdf_url: Scalars['String']['output'];
  /** "preview", "sent", "ready" or "failed" */
  status: Scalars['String']['output'];
  text: Scalars['String']['output'];
  translated: Scalars['Boolean']['output'];
  url: Scalars['String']['output'];
};

/** Which ways to sign in are on */
export type SignInOptions = {
  __typename?: 'SignInOptions';
  /** Try the demo clinic (demo mode only) */
  demo: Scalars['Boolean']['output'];
  google: Scalars['Boolean']['output'];
  microsoft: Scalars['Boolean']['output'];
  password: Scalars['Boolean']['output'];
  /** Forgot password works (email is set up) */
  password_reset: Scalars['Boolean']['output'];
};

/** Signed in (token and user), or a 6 digit code to enter first (two_factor_required with a ticket for verify_sign_in_code) */
export type SignInPayload = {
  __typename?: 'SignInPayload';
  /** Where the code went, like a•••@clinic.com */
  email_hint?: Maybe<Scalars['String']['output']>;
  ticket?: Maybe<Scalars['String']['output']>;
  token?: Maybe<Scalars['String']['output']>;
  /** "app": the code from their authenticator app (resend_sign_in_code emails a backup code); "email": a code we emailed */
  two_factor_method?: Maybe<Scalars['String']['output']>;
  two_factor_required: Scalars['Boolean']['output'];
  user?: Maybe<User>;
};

/** The confirm panel before signing: where the note goes, what goes, and the texts that follow */
export type SignPreview = {
  __typename?: 'SignPreview';
  appointment?: Maybe<SignPreviewAppointment>;
  /** The note's pet is the one on the visit's appointment */
  matches: Scalars['Boolean']['output'];
  /** What to check; "" when it matches */
  mismatch: Scalars['String']['output'];
  note: Scalars['Boolean']['output'];
  owner: PimsRecordRef;
  patient: PimsRecordRef;
  /** Photos going with the note */
  photos: Scalars['Int']['output'];
  /** The practice system's real name ("" when unknown); data only, screens say "PIMS" */
  pims_name: Scalars['String']['output'];
  /** The note's medications; prescriptions aren't sent to the PIMS yet */
  prescription: Array<Scalars['String']['output']>;
  texts: Array<FollowingText>;
};

export type SignPreviewAppointment = {
  __typename?: 'SignPreviewAppointment';
  id: Scalars['String']['output'];
  owner_name: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  start: Scalars['DateTime']['output'];
};

export type SignResult = {
  __typename?: 'SignResult';
  encounter: Encounter;
  write_back: WriteBackResult;
};

export type Slot = {
  __typename?: 'Slot';
  booking_url: Scalars['String']['output'];
  end: Scalars['DateTime']['output'];
  provider_id: Scalars['String']['output'];
  service_id: Scalars['String']['output'];
  start: Scalars['DateTime']['output'];
};

/** A text to the owner, sent or shown as a preview. */
export type SmsResult = {
  __typename?: 'SmsResult';
  at?: Maybe<Scalars['DateTime']['output']>;
  detail: Scalars['String']['output'];
  provider_id: Scalars['String']['output'];
  /** "sent", "preview", "skipped", "failed" */
  status: Scalars['String']['output'];
  text: Scalars['String']['output'];
  to_masked: Scalars['String']['output'];
};

export type SoapNote = {
  __typename?: 'SoapNote';
  assessment: Scalars['String']['output'];
  /** For the owner, plain English */
  client_summary: Scalars['String']['output'];
  medications: Array<Scalars['String']['output']>;
  objective: Scalars['String']['output'];
  plan: Scalars['String']['output'];
  subjective: Scalars['String']['output'];
  /** Vital name to value, as written */
  vitals: Scalars['JSON']['output'];
  /** Who said the vitals when a tech did: "tech Priya"; else empty */
  vitals_by: Scalars['String']['output'];
};

export type SoapNoteInput = {
  assessment?: Scalars['String']['input'];
  client_summary?: Scalars['String']['input'];
  medications?: Array<Scalars['String']['input']>;
  objective?: Scalars['String']['input'];
  plan?: Scalars['String']['input'];
  subjective?: Scalars['String']['input'];
  vitals?: Scalars['JSON']['input'];
  vitals_by?: Scalars['String']['input'];
};

export type SourceLink = {
  __typename?: 'SourceLink';
  /** Transcript line numbers, from 1 */
  lines: Array<Scalars['Int']['output']>;
  sentence: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

/** Read aloud: the server's voices, or the browser's */
export type SpeechOptions = {
  __typename?: 'SpeechOptions';
  /** False: use the browser's voice (POST /api/speech answers 503) */
  available: Scalars['Boolean']['output'];
  default_voice: Scalars['String']['output'];
  voices: Array<SpeechVoice>;
};

export type SpeechVoice = {
  __typename?: 'SpeechVoice';
  gender: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  language: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /** What Ask Blinq is checking, then its reply. Pass the same turn_id to ask_assistant */
  assistant_turn: AssistantTurn;
  /** Each step of draft_note for this visit, then done. Subscribe before or just after calling draft_note */
  draft_progress: DraftProgress;
};


export type SubscriptionAssistant_TurnArgs = {
  turn_id: Scalars['String']['input'];
};


export type SubscriptionDraft_ProgressArgs = {
  encounter_id: Scalars['String']['input'];
};

export type SummaryPet = {
  __typename?: 'SummaryPet';
  /** Years; 0 is under a year */
  age?: Maybe<Scalars['Int']['output']>;
  /** "6 years" or "6 años"; may be empty */
  age_text: Scalars['String']['output'];
  breed: Scalars['String']['output'];
  for_owner: Scalars['String']['output'];
  home_care: Array<Scalars['String']['output']>;
  medicines: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  next_visit: NextVisit;
  patient_id: Scalars['String']['output'];
  photos: Array<SummaryPhoto>;
  sex: Scalars['String']['output'];
  /** As the record has it; may be empty */
  species: Scalars['String']['output'];
};

/** A photo the vet chose to show the owner */
export type SummaryPhoto = {
  __typename?: 'SummaryPhoto';
  caption: Scalars['String']['output'];
  crop?: Maybe<Crop>;
  encounter_id: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  rotation: Scalars['Int']['output'];
  url: Scalars['String']['output'];
};

/** When the visit was and who saw the pets */
export type SummaryVisit = {
  __typename?: 'SummaryVisit';
  /** YYYY-MM-DD, clinic-local */
  date: Scalars['String']['output'];
  /** The vet who signed, else the booked vet */
  provider_name: Scalars['String']['output'];
  /** The appointment time, clinic-local ISO, or null */
  start?: Maybe<Scalars['String']['output']>;
  /** Ready to show, in the summary's language: "Sat, Oct 31, 2026 at 1:30 PM" or "sáb. 31 de oct. de 2026, 1:30 p. m." */
  when: Scalars['String']['output'];
};

export type Template = {
  __typename?: 'Template';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  note_type: Scalars['String']['output'];
  /** "me" or "clinic" */
  owner: Scalars['String']['output'];
  shortcut: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type TemplateInput = {
  name: Scalars['String']['input'];
  note_type?: Scalars['String']['input'];
  owner?: Scalars['String']['input'];
  shortcut: Scalars['String']['input'];
  text: Scalars['String']['input'];
};

export type TodayVisit = {
  __typename?: 'TodayVisit';
  appointment_id: Scalars['String']['output'];
  encounter_id: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  time: Scalars['String']['output'];
  visit_status: Scalars['String']['output'];
};

export type Tomorrow = {
  __typename?: 'Tomorrow';
  date: Scalars['String']['output'];
  /** "HH:MM" or "" */
  first: Scalars['String']['output'];
  last: Scalars['String']['output'];
  prepare: Array<PrepareItem>;
  visits: Scalars['Int']['output'];
};

export type UnsignedNote = {
  __typename?: 'UnsignedNote';
  encounter_id: Scalars['String']['output'];
  patient: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type Update = {
  __typename?: 'Update';
  /** Today's appointment for the pet, or empty (booked: the booking) */
  appointment_id: Scalars['String']['output'];
  at: Scalars['String']['output'];
  /** The owner: a reply opens here */
  client_id: Scalars['String']['output'];
  /** A short line to show, e.g. "Kidney panel", "11:30 AM today" */
  detail: Scalars['String']['output'];
  /** A result: the received document in the pet's Documents, or empty */
  document_id: Scalars['String']['output'];
  /** "result", "reply" or "booked" */
  kind: Scalars['String']['output'];
  mock?: Maybe<Scalars['Boolean']['output']>;
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  text: Scalars['String']['output'];
};

export type User = {
  __typename?: 'User';
  active: Scalars['Boolean']['output'];
  /** Two step codes come from an authenticator app (email is backup) */
  authenticator: Scalars['Boolean']['output'];
  created_at: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  has_password: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  provider_id: Scalars['String']['output'];
  /** "vet" or "admin" */
  role: Scalars['String']['output'];
  /** Signs in with an email code too */
  two_factor: Scalars['Boolean']['output'];
  /** An admin requires the email code */
  two_factor_required: Scalars['Boolean']['output'];
  username: Scalars['String']['output'];
};

export type UserUpdateInput = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  provider_id?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
};

/** What the signed-in person may do on this visit, from their role and whether it's their own (requirement 62). Permissions only: a signed note is still locked whatever these say */
export type VisitCan = {
  __typename?: 'VisitCan';
  /** Approve, dismiss or book follow ups */
  approve: Scalars['Boolean']['output'];
  /** Write the note */
  draft: Scalars['Boolean']['output'];
  /** Edit the note, note type, edit tools */
  edit: Scalars['Boolean']['output'];
  edit_photos: Scalars['Boolean']['output'];
  /** Add audio, transcript and photos */
  record: Scalars['Boolean']['output'];
  /** Keep or forget Remember items */
  remember: Scalars['Boolean']['output'];
  /** Resend a booking link */
  resend: Scalars['Boolean']['output'];
  /** Share a signed summary */
  share: Scalars['Boolean']['output'];
  sign: Scalars['Boolean']['output'];
  /** Start the visit (consent, record) */
  start: Scalars['Boolean']['output'];
  write_letter: Scalars['Boolean']['output'];
};

/** One pet on a household appointment (several pets booked as one visit), with its own reason and where its note stands. */
export type VisitPet = {
  __typename?: 'VisitPet';
  encounter_id: Scalars['String']['output'];
  patient: Patient;
  reason: Scalars['String']['output'];
  /** "not_started", "recording", "draft_ready" or "signed" */
  visit_status: Scalars['String']['output'];
};

export type VisitPhoto = {
  __typename?: 'VisitPhoto';
  caption: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
};

/** How a vet writes, learned from their own notes. */
export type VoiceProfile = {
  __typename?: 'VoiceProfile';
  abbreviations: Array<Scalars['String']['output']>;
  notes_used: Scalars['Int']['output'];
  provider_id: Scalars['String']['output'];
  /** Format and length per SOAP section */
  sections: Array<SectionStyleEntry>;
  /** "synced" or "default" (demo only) */
  source: Scalars['String']['output'];
};

export type WaitingFollowUp = {
  __typename?: 'WaitingFollowUp';
  encounter_id: Scalars['String']['output'];
  followup_id: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  patient: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

/** A booking link sent and not booked yet. */
export type WaitingLink = {
  __typename?: 'WaitingLink';
  days_waiting: Scalars['Int']['output'];
  encounter_id: Scalars['String']['output'];
  followup_id: Scalars['String']['output'];
  owner_name: Scalars['String']['output'];
  patient_id: Scalars['String']['output'];
  patient_name: Scalars['String']['output'];
  /** One link for several pets: every pet it books. Empty for one */
  pets: Array<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  sent_at?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  /** Short, made by the server for display: "Recheck: ear infection", at most 60 characters. Use it instead of reason in rows and sentences */
  title: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

/** One dated fact in Before you walk in, newest first */
export type WalkInEntry = {
  __typename?: 'WalkInEntry';
  /** YYYY-MM-DD */
  date: Scalars['String']['output'];
  items: Array<WalkInItem>;
  /** "message" (the owner's latest text), "result" (results that came in), "plan" (the last visit's plan, as checkboxes) or "visit" (a past visit about the same problem) */
  kind: Scalars['String']['output'];
  /** Written by the person reading */
  mine: Scalars['Boolean']['output'];
  /** The message as sent, or the visit's reason and summary */
  text: Scalars['String']['output'];
  /** The owner's first name, or the provider who saw the pet */
  who: Scalars['String']['output'];
};

/** One line of a past plan, as a checkbox before the visit */
export type WalkInItem = {
  __typename?: 'WalkInItem';
  /** Ticked by the provider before the visit: asked to cover today. Set with set_plan_checks */
  checked: Scalars['Boolean']['output'];
  /** From the invoices: "30 tablets dispensed Aug 31, none since" */
  note: Scalars['String']['output'];
  /** What the record says about it: "Was due Sep 28, not booked" */
  status: Scalars['String']['output'];
  /** The plan line in plain words: "Recheck in 4 weeks" */
  text: Scalars['String']['output'];
};

export type WeightReading = {
  __typename?: 'WeightReading';
  date: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  unit: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

export type Weights = {
  __typename?: 'Weights';
  history: Array<WeightReading>;
  /** The newest: a weight written in a visit's note when it is newer than the PIMS's */
  latest?: Maybe<WeightReading>;
  /** The reading before a weight from a visit, for the change */
  previous?: Maybe<WeightReading>;
};

/** What the practice system did with one write. */
export type WriteBackResult = {
  __typename?: 'WriteBackResult';
  at?: Maybe<Scalars['DateTime']['output']>;
  detail: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
  pims_id: Scalars['String']['output'];
  start?: Maybe<Scalars['DateTime']['output']>;
  /** One of: "written" (in the practice system), "queued_for_staff" (not in it: the front desk will file it, and Send to PIMS can try again), "failed" (couldn't save: tried again every 5 minutes, then the front desk after an hour) or "not_sent" (signed only: Send to PIMS) */
  status: Scalars['String']['output'];
};

export type UserFieldsFragment = { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string };

export type AppointmentFieldsFragment = { __typename?: 'Appointment', id: string, start: string, duration_min: number, reason: string, type: string, status: string, provider_id: string, provider_name: string, room: string, visit_status: string, audio_live: boolean, encounter_id: string, note_type: string, started_at?: string | null, demo_clock: string, checked_in_at?: string | null, synced_at?: string | null, pets: Array<{ __typename?: 'VisitPet', reason: string, visit_status: string, encounter_id: string, patient: { __typename?: 'Patient', id: string, name: string, species: string, breed: string, age?: number | null, alerts: Array<string>, sex: string, client_id: string, pims_notes: Array<string>, alert_chips: Array<{ __typename?: 'AlertChip', text: string, short: string }>, last_visit?: { __typename?: 'LastVisit', date: string, reason: string } | null, weight?: { __typename?: 'WeightReading', value: number, unit: string } | null } }>, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, patient: { __typename?: 'Patient', id: string, name: string, species: string, breed: string, age?: number | null, alerts: Array<string>, sex: string, color: string, microchip: string, client_id: string, pims_notes: Array<string>, alert_chips: Array<{ __typename?: 'AlertChip', text: string, short: string }>, last_visit?: { __typename?: 'LastVisit', date: string, reason: string } | null, weight?: { __typename?: 'WeightReading', value: number, unit: string } | null }, client: { __typename?: 'Client', id: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string, reminders: string, client_since: string } };

export type SlotFieldsFragment = { __typename?: 'Slot', start: string, end: string, provider_id: string };

export type WriteBackFieldsFragment = { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null };

export type EncounterFieldsFragment = { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> };

export type OpenItemFieldsFragment = { __typename?: 'OpenItem', kind: string, text: string, owner_name: string, encounter_id: string, appointment_id: string, date: string, patient_name: string, followup_id?: string | null, followup_kind?: string | null, reason?: string | null, title: string, label: string, patient_id: string, client_id: string, detail?: string | null };

export type WaitingFieldsFragment = { __typename?: 'WaitingLink', encounter_id: string, followup_id: string, patient_id: string, patient_name: string, owner_name: string, reason: string, title: string, url: string, sent_at?: string | null, days_waiting: number, status: string, pets: Array<string> };

export type LastVisitFieldsFragment = { __typename?: 'LastVisit', date: string, reason: string, type: string };

export type ClientCardFieldsFragment = { __typename?: 'ClientCard', id: string, name: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string, reminders: string, client_since: string, latest_message?: { __typename?: 'LatestMessage', at: string, text: string } | null };

export type RememberFieldsFragment = { __typename?: 'RememberItem', id: string, client_id: string, patient_id: string, patient_name: string, text: string, kind: string, date?: string | null, said_at: string, encounter_id: string, expires_at?: string | null, kept_by: string, said_by?: string | null };

export type DocumentFieldsFragment = { __typename?: 'Document', id: string, name: string, uploaded_at: string, pages: number, content_type: string, mock: boolean, key_points: Array<{ __typename?: 'KeyPoint', text: string, page: number }> };

export type SignInPayloadFieldsFragment = { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null };

export type AuthStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type AuthStatusQuery = { __typename?: 'Query', auth_status: { __typename?: 'AuthStatus', login_required: boolean, options: { __typename?: 'SignInOptions', password: boolean, google: boolean, microsoft: boolean, demo: boolean, password_reset: boolean } } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'Me', via: string, admin: boolean, role: string, provider_id: string, permissions: Array<string>, user?: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } | null } };

export type SignInMutationVariables = Exact<{
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
  remember: Scalars['Boolean']['input'];
}>;


export type SignInMutation = { __typename?: 'Mutation', sign_in: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type VerifyCodeMutationVariables = Exact<{
  ticket: Scalars['String']['input'];
  code: Scalars['String']['input'];
}>;


export type VerifyCodeMutation = { __typename?: 'Mutation', verify_sign_in_code: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type ResendCodeMutationVariables = Exact<{
  ticket: Scalars['String']['input'];
}>;


export type ResendCodeMutation = { __typename?: 'Mutation', resend_sign_in_code: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type StartOAuthMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  remember: Scalars['Boolean']['input'];
}>;


export type StartOAuthMutation = { __typename?: 'Mutation', start_oauth_sign_in: string };

export type FinishOAuthMutationVariables = Exact<{
  code: Scalars['String']['input'];
}>;


export type FinishOAuthMutation = { __typename?: 'Mutation', finish_oauth_sign_in: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type FinishOAuthLinkMutationVariables = Exact<{
  code: Scalars['String']['input'];
}>;


export type FinishOAuthLinkMutation = { __typename?: 'Mutation', finish_oauth_link: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type DemoSignInMutationVariables = Exact<{ [key: string]: never; }>;


export type DemoSignInMutation = { __typename?: 'Mutation', try_demo_clinic: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type RequestResetMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestResetMutation = { __typename?: 'Mutation', request_password_reset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', reset_password: boolean };

export type InviteInfoQueryVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type InviteInfoQuery = { __typename?: 'Query', invite_info: { __typename?: 'InviteInfo', name: string, username: string } };

export type AcceptInviteMutationVariables = Exact<{
  token: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type AcceptInviteMutation = { __typename?: 'Mutation', accept_invite: { __typename?: 'SignInPayload', token?: string | null, two_factor_required: boolean, ticket?: string | null, two_factor_method?: string | null, email_hint?: string | null } };

export type SignOutMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutMutation = { __typename?: 'Mutation', sign_out: boolean };

export type TeamQueryVariables = Exact<{ [key: string]: never; }>;


export type TeamQuery = { __typename?: 'Query', users: Array<{ __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string }>, providers: Array<{ __typename?: 'Provider', id: string, name: string, linked_to: string }> };

export type InviteUserMutationVariables = Exact<{
  input: NewUserInput;
}>;


export type InviteUserMutation = { __typename?: 'Mutation', invite_user: { __typename?: 'Invite', invite_url: string, user: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } } };

export type ReinviteUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ReinviteUserMutation = { __typename?: 'Mutation', reinvite_user: { __typename?: 'Invite', invite_url: string, user: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } } };

export type UpdateUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: UserUpdateInput;
}>;


export type UpdateUserMutation = { __typename?: 'Mutation', update_user: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type ScheduleQueryVariables = Exact<{
  date?: InputMaybe<Scalars['Date']['input']>;
  provider: Scalars['String']['input'];
}>;


export type ScheduleQuery = { __typename?: 'Query', schedule: Array<{ __typename?: 'Appointment', id: string, start: string, duration_min: number, reason: string, type: string, status: string, provider_id: string, provider_name: string, room: string, visit_status: string, audio_live: boolean, encounter_id: string, note_type: string, started_at?: string | null, demo_clock: string, checked_in_at?: string | null, synced_at?: string | null, pets: Array<{ __typename?: 'VisitPet', reason: string, visit_status: string, encounter_id: string, patient: { __typename?: 'Patient', id: string, name: string, species: string, breed: string, age?: number | null, alerts: Array<string>, sex: string, client_id: string, pims_notes: Array<string>, alert_chips: Array<{ __typename?: 'AlertChip', text: string, short: string }>, last_visit?: { __typename?: 'LastVisit', date: string, reason: string } | null, weight?: { __typename?: 'WeightReading', value: number, unit: string } | null } }>, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, patient: { __typename?: 'Patient', id: string, name: string, species: string, breed: string, age?: number | null, alerts: Array<string>, sex: string, color: string, microchip: string, client_id: string, pims_notes: Array<string>, alert_chips: Array<{ __typename?: 'AlertChip', text: string, short: string }>, last_visit?: { __typename?: 'LastVisit', date: string, reason: string } | null, weight?: { __typename?: 'WeightReading', value: number, unit: string } | null }, client: { __typename?: 'Client', id: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string, reminders: string, client_since: string } }> };

export type DaysQueryVariables = Exact<{
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
  provider: Scalars['String']['input'];
}>;


export type DaysQuery = { __typename?: 'Query', days: Array<{ __typename?: 'DaySummary', date: string, visits: number, open: number, failed: number, marker: string }> };

export type BriefQueryVariables = Exact<{
  provider: Scalars['String']['input'];
}>;


export type BriefQuery = { __typename?: 'Query', brief: { __typename?: 'Brief', spoken: string, suggestions: Array<string>, date: string, sentence: Array<{ __typename?: 'BriefPart', text: string, emphasis: string, kind: string }>, from_yesterday: Array<{ __typename?: 'OpenItem', kind: string, text: string, owner_name: string, encounter_id: string, appointment_id: string, date: string, patient_name: string, followup_id?: string | null, followup_kind?: string | null, reason?: string | null, title: string, label: string, patient_id: string, client_id: string, detail?: string | null }>, pending_followups: Array<{ __typename?: 'PendingFollowUp', encounter_id: string, followup_id: string, kind: string, reason: string, title: string, patient_id: string, patient_name: string, appointment_id: string }>, heads_up: Array<{ __typename?: 'HeadsUp', text: string, appointment_id: string, patient_id: string, patient_name: string, time: string }>, new_since_yesterday: Array<{ __typename?: 'Update', kind: string, text: string, at: string, patient_name: string, mock?: boolean | null, patient_id: string, appointment_id: string, client_id: string, document_id: string, detail: string }> } };

export type EndOfDayQueryVariables = Exact<{
  date?: InputMaybe<Scalars['Date']['input']>;
  provider: Scalars['String']['input'];
}>;


export type EndOfDayQuery = { __typename?: 'Query', end_of_day: { __typename?: 'EndOfDay', spoken: string, visits_seen: number, rechecks_booked: number, recheck_links_sent: number, recheck_links_booked: number, left_to_do: Array<{ __typename?: 'OpenItem', kind: string, text: string, owner_name: string, encounter_id: string, appointment_id: string, date: string, patient_name: string, followup_id?: string | null, followup_kind?: string | null, reason?: string | null, title: string, label: string, patient_id: string, client_id: string, detail?: string | null }>, done_today: Array<{ __typename?: 'DoneItem', text: string, encounter_id: string }>, waiting_on_owners: Array<{ __typename?: 'WaitingLink', encounter_id: string, followup_id: string, patient_id: string, patient_name: string, owner_name: string, reason: string, title: string, url: string, sent_at?: string | null, days_waiting: number, status: string, pets: Array<string> }>, tomorrow: { __typename?: 'Tomorrow', date: string, visits: number, first: string, last: string, prepare: Array<{ __typename?: 'PrepareItem', text: string, appointment_id: string, patient_name: string }> } } };

export type PreRoomCardQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PreRoomCardQuery = { __typename?: 'Query', pre_room_card: { __typename?: 'PreRoomCard', spoken: string, take: string, promised: Array<string>, medications: Array<string>, why: Array<string>, prep: Array<string>, last_visit_on: string, weight: string, can_do_today: Array<string>, last_note?: { __typename?: 'LastNote', date: string, by: string, other_vet: boolean, gist: string } | null, remember_items: Array<{ __typename?: 'RememberItem', id: string, client_id: string, patient_id: string, patient_name: string, text: string, kind: string, date?: string | null, said_at: string, encounter_id: string, expires_at?: string | null, kept_by: string, said_by?: string | null }>, owner_message?: { __typename?: 'OwnerMessage', who: string, text: string, at: string } | null, walk_in: Array<{ __typename?: 'WalkInEntry', date: string, kind: string, who: string, mine: boolean, text: string, items: Array<{ __typename?: 'WalkInItem', text: string, status: string, note: string, checked: boolean }> }> } };

export type NotesToSignQueryVariables = Exact<{
  provider: Scalars['String']['input'];
}>;


export type NotesToSignQuery = { __typename?: 'Query', notes_to_sign: Array<{ __typename?: 'NoteToSign', encounter_id: string, appointment_id: string, patient_id: string, patient_name: string, owner_name: string, client_id: string, provider_id: string, provider_name: string, date: string, time: string, visit_reason: string, assessment: string, status: string, bucket: string, to_confirm: number, followups_undecided: number, reason: string, waiting_days: number }> };

export type VoiceProfileQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type VoiceProfileQuery = { __typename?: 'Query', voice_profile?: { __typename?: 'VoiceProfile', source: string, notes_used: number } | null };

export type PreviousNotesQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PreviousNotesQuery = { __typename?: 'Query', patient_notes: Array<{ __typename?: 'PastNote', id: string, date: string, provider_id: string, provider_name: string, text: string, source: string, sections: Array<{ __typename?: 'PastNoteSection', label: string, text: string }> }> };

export type SampleTranscriptQueryVariables = Exact<{
  appointment: Scalars['String']['input'];
}>;


export type SampleTranscriptQuery = { __typename?: 'Query', sample_transcript: string };

export type SearchQueryVariables = Exact<{
  q: Scalars['String']['input'];
}>;


export type SearchQuery = { __typename?: 'Query', search: { __typename?: 'SearchResult', pets: Array<{ __typename?: 'PetHit', id: string, name: string, species: string, breed: string, age?: number | null, client_id: string, owner_name: string, last_visit?: { __typename?: 'LastVisit', date: string, reason: string, type: string } | null, next_visit?: { __typename?: 'NextAppointment', date: string, time: string, appointment_id: string } | null }>, owners: Array<{ __typename?: 'OwnerHit', id: string, name: string, phone: string, email: string, pets: Array<string> }> } };

export type AssistLinkFieldsFragment = { __typename?: 'AssistLink', label: string, to: string, appointment_id: string, encounter_id: string, date: string, patient_id: string, client_id: string, document_id: string };

export type AskMutationVariables = Exact<{
  input: AssistantInput;
}>;


export type AskMutation = { __typename?: 'Mutation', ask_assistant: { __typename?: 'AssistantReply', reply: string, tools_used: Array<string>, followups: Array<string>, links: Array<{ __typename?: 'AssistLink', label: string, to: string, appointment_id: string, encounter_id: string, date: string, patient_id: string, client_id: string, document_id: string }>, sources: Array<{ __typename?: 'AssistLink', label: string, to: string, appointment_id: string, encounter_id: string, date: string, patient_id: string, client_id: string, document_id: string }> } };

export type AssistantTurnSubscriptionVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type AssistantTurnSubscription = { __typename?: 'Subscription', assistant_turn: { __typename?: 'AssistantTurn', kind: string, text: string } };

export type PatientVisitsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  related: Scalars['String']['input'];
}>;


export type PatientVisitsQuery = { __typename?: 'Query', patient_visits: Array<{ __typename?: 'PastVisit', id: string, date: string, appointment_id: string, type: string, kind: string, reason: string, provider_name: string, summary: string, related: boolean, note?: string | null, medications: Array<string>, sections: Array<{ __typename?: 'PastNoteSection', label: string, text: string }>, photos: Array<{ __typename?: 'VisitPhoto', id: string, caption: string, url: string }> }> };

export type PatientProfileQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PatientProfileQuery = { __typename?: 'Query', patient_profile: { __typename?: 'PatientProfile', mock: boolean, patient: { __typename?: 'PetDetails', id: string, name: string, species: string, breed: string, age?: number | null, sex: string, alerts: Array<string>, color: string, microchip: string }, weight: { __typename?: 'Weights', latest?: { __typename?: 'WeightReading', date: string, value: number, unit: string } | null, previous?: { __typename?: 'WeightReading', date: string, value: number, unit: string } | null, history: Array<{ __typename?: 'WeightReading', date: string, value: number, unit: string, note?: string | null }> }, reminders_due: Array<{ __typename?: 'ReminderDue', patient_id: string, patient_name: string, text: string, due: string }>, client?: { __typename?: 'ClientCard', id: string, name: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string, reminders: string, client_since: string, latest_message?: { __typename?: 'LatestMessage', at: string, text: string } | null } | null, other_pets: Array<{ __typename?: 'OtherPet', id: string, name: string, species: string, breed: string, age?: number | null, sex: string, alerts: Array<string>, due: Array<string>, last_visit?: { __typename?: 'LastVisit', date: string, reason: string, type: string } | null }> } };

export type InvoicesQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type InvoicesQuery = { __typename?: 'Query', client_invoices: { __typename?: 'InvoiceList', balance?: number | null, last_12_months: number, last_payment?: unknown | null, counts: unknown, mock: boolean, invoices: Array<{ __typename?: 'Invoice', id: string, date: string, patient_id: string, patient_name: string, visit: string, provider_name: string, total: number, status: string, paid_by?: string | null, items: Array<{ __typename?: 'InvoiceItem', name: string, qty: number, price?: number | null }> }> } };

export type HouseholdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type HouseholdQuery = { __typename?: 'Query', client_household: { __typename?: 'Household', balance?: number | null, book_url: string, spend_12m: number, mock: boolean, client: { __typename?: 'ClientCard', id: string, name: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string, reminders: string, client_since: string, latest_message?: { __typename?: 'LatestMessage', at: string, text: string } | null }, pets: Array<{ __typename?: 'HouseholdPet', id: string, name: string, species: string, breed: string, age?: number | null, sex: string, alerts: Array<string>, due: Array<string>, tags: Array<string>, alert_tags: Array<string>, spend_12m: number, next_due?: { __typename?: 'NextDue', text: string, due: string, state: string } | null, last_visit?: { __typename?: 'LastVisit', date: string, reason: string, type: string } | null, today?: { __typename?: 'TodayVisit', appointment_id: string, time: string, reason: string, visit_status: string, encounter_id: string } | null }>, coming_up: Array<{ __typename?: 'ComingUp', date: string, text: string, patient_name: string }>, messages: Array<{ __typename?: 'ClientMessage', at: string, direction: string, text: string }>, remember: Array<{ __typename?: 'RememberItem', id: string, client_id: string, patient_id: string, patient_name: string, text: string, kind: string, date?: string | null, said_at: string, encounter_id: string, expires_at?: string | null, kept_by: string, said_by?: string | null }> } };

export type DocumentsQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DocumentsQuery = { __typename?: 'Query', patient_documents: Array<{ __typename?: 'Document', id: string, name: string, uploaded_at: string, pages: number, content_type: string, mock: boolean, key_points: Array<{ __typename?: 'KeyPoint', text: string, page: number }> }> };

export type ClientRememberQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ClientRememberQuery = { __typename?: 'Query', client_remember: Array<{ __typename?: 'RememberItem', id: string, client_id: string, patient_id: string, patient_name: string, text: string, kind: string, date?: string | null, said_at: string, encounter_id: string, expires_at?: string | null, kept_by: string, said_by?: string | null }> };

export type ForgetMutationVariables = Exact<{
  client: Scalars['String']['input'];
  item: Scalars['String']['input'];
}>;


export type ForgetMutation = { __typename?: 'Mutation', forget_remember: boolean };

export type EncounterQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type EncounterQuery = { __typename?: 'Query', encounter: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type GroupQueryVariables = Exact<{
  group: Scalars['String']['input'];
}>;


export type GroupQuery = { __typename?: 'Query', encounters: Array<{ __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> }> };

export type StartEncounterMutationVariables = Exact<{
  input: NewEncounterInput;
}>;


export type StartEncounterMutation = { __typename?: 'Mutation', start_encounter: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type AddTranscriptMutationVariables = Exact<{
  id: Scalars['String']['input'];
  text: Scalars['String']['input'];
  append: Scalars['Boolean']['input'];
}>;


export type AddTranscriptMutation = { __typename?: 'Mutation', add_transcript: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type DraftNoteMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DraftNoteMutation = { __typename?: 'Mutation', draft_note: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type DraftProgressSubscriptionVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DraftProgressSubscription = { __typename?: 'Subscription', draft_progress: { __typename?: 'DraftProgress', run_id: string, step: string, state: string, detail: string, patient_name: string } };

export type UpdatePhotoMutationVariables = Exact<{
  id: Scalars['String']['input'];
  photo: Scalars['String']['input'];
  input: PhotoEditInput;
}>;


export type UpdatePhotoMutation = { __typename?: 'Mutation', update_photo: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type DeletePhotoMutationVariables = Exact<{
  id: Scalars['String']['input'];
  photo: Scalars['String']['input'];
}>;


export type DeletePhotoMutation = { __typename?: 'Mutation', delete_photo: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type RestorePhotoMutationVariables = Exact<{
  id: Scalars['String']['input'];
  photo: Scalars['String']['input'];
}>;


export type RestorePhotoMutation = { __typename?: 'Mutation', restore_photo: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type SaveNoteMutationVariables = Exact<{
  id: Scalars['String']['input'];
  note: SoapNoteInput;
}>;


export type SaveNoteMutation = { __typename?: 'Mutation', save_note: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type NoteTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type NoteTypesQuery = { __typename?: 'Query', note_types: Array<{ __typename?: 'NoteType', id: string, name: string, sections: Array<{ __typename?: 'NoteSection', key: string, label: string }> }> };

export type SetNoteTypeMutationVariables = Exact<{
  id: Scalars['String']['input'];
  type: Scalars['String']['input'];
}>;


export type SetNoteTypeMutation = { __typename?: 'Mutation', set_note_type: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type AssistMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: AssistInput;
}>;


export type AssistMutation = { __typename?: 'Mutation', assist: { __typename?: 'AssistResult', suggestion: string, refused: string, mock: boolean, unsourced: Array<string>, sources: Array<{ __typename?: 'SourceLink', sentence: string, lines: Array<number>, text: string }> } };

export type TemplatesQueryVariables = Exact<{
  type: Scalars['String']['input'];
}>;


export type TemplatesQuery = { __typename?: 'Query', templates: Array<{ __typename?: 'Template', id: string, name: string, shortcut: string, text: string, note_type: string, owner: string }> };

export type FollowUpMutationVariables = Exact<{
  id: Scalars['String']['input'];
  followup: Scalars['String']['input'];
  input: FollowUpActionInput;
}>;


export type FollowUpMutation = { __typename?: 'Mutation', act_on_followup: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type AddPetToVisitMutationVariables = Exact<{
  id: Scalars['String']['input'];
  patient: Scalars['String']['input'];
}>;


export type AddPetToVisitMutation = { __typename?: 'Mutation', add_pet_to_visit: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type SetPlanChecksMutationVariables = Exact<{
  appointment: Scalars['String']['input'];
  patient: Scalars['String']['input'];
  lines: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type SetPlanChecksMutation = { __typename?: 'Mutation', set_plan_checks: Array<string> };

export type PlanReminderMutationVariables = Exact<{
  id: Scalars['String']['input'];
  reminder: Scalars['String']['input'];
  action: Scalars['String']['input'];
}>;


export type PlanReminderMutation = { __typename?: 'Mutation', act_on_plan_reminder: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type WaitingLinksQueryVariables = Exact<{ [key: string]: never; }>;


export type WaitingLinksQuery = { __typename?: 'Query', waiting_followups: Array<{ __typename?: 'WaitingLink', encounter_id: string, followup_id: string, patient_id: string, patient_name: string, owner_name: string, reason: string, title: string, url: string, sent_at?: string | null, days_waiting: number, status: string, pets: Array<string> }> };

export type ResendLinkMutationVariables = Exact<{
  followup: Scalars['String']['input'];
}>;


export type ResendLinkMutation = { __typename?: 'Mutation', resend_booking_link: { __typename?: 'WaitingLink', encounter_id: string, followup_id: string, patient_id: string, patient_name: string, owner_name: string, reason: string, title: string, url: string, sent_at?: string | null, days_waiting: number, status: string, pets: Array<string> } };

export type RememberSuggestionsQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type RememberSuggestionsQuery = { __typename?: 'Query', remember_suggestions: { __typename?: 'RememberSuggestions', left_out: number, mock: boolean, suggestions: Array<{ __typename?: 'RememberSuggestion', id: string, text: string, kind: string, date?: string | null, transcript_lines: Array<string>, said_by: string, kept: boolean }> } };

export type KeepRememberMutationVariables = Exact<{
  id: Scalars['String']['input'];
  keep: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type KeepRememberMutation = { __typename?: 'Mutation', keep_remember: Array<{ __typename?: 'RememberItem', id: string, client_id: string, patient_id: string, patient_name: string, text: string, kind: string, date?: string | null, said_at: string, encounter_id: string, expires_at?: string | null, kept_by: string, said_by?: string | null }> };

export type SignNoteMutationVariables = Exact<{
  id: Scalars['String']['input'];
  by: Scalars['String']['input'];
  send: Scalars['Boolean']['input'];
}>;


export type SignNoteMutation = { __typename?: 'Mutation', sign_note: { __typename?: 'SignResult', encounter: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } } };

export type OwnerSummaryQueryVariables = Exact<{
  id: Scalars['String']['input'];
  lang: Scalars['String']['input'];
}>;


export type OwnerSummaryQuery = { __typename?: 'Query', owner_summary: { __typename?: 'OwnerSummary', language: string, when_to_call: string, translated: boolean, mock: boolean, owner_name: string, clinic: { __typename?: 'Clinic', name: string, address: string, phone: string, logo_url: string }, visit: { __typename?: 'SummaryVisit', date: string, start?: string | null, when: string, provider_name: string }, pets: Array<{ __typename?: 'SummaryPet', patient_id: string, name: string, species: string, breed: string, sex: string, age?: number | null, age_text: string, for_owner: string, medicines: Array<string>, home_care: Array<string>, next_visit: { __typename?: 'NextVisit', kind: string, text: string, url: string } }> } };

export type ShareMutationVariables = Exact<{
  id: Scalars['String']['input'];
  channel: Scalars['String']['input'];
  lang: Scalars['String']['input'];
}>;


export type ShareMutation = { __typename?: 'Mutation', share_summary: { __typename?: 'ShareResult', channel: string, language: string, status: string, detail: string, text: string, url: string, expires_at?: string | null, translated: boolean } };

export type SetTwoFactorMutationVariables = Exact<{
  enabled: Scalars['Boolean']['input'];
}>;


export type SetTwoFactorMutation = { __typename?: 'Mutation', set_two_factor: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type ConnectOAuthMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  current: Scalars['String']['input'];
}>;


export type ConnectOAuthMutation = { __typename?: 'Mutation', connect_oauth_account: string };

export type SignOutEverywhereMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutEverywhereMutation = { __typename?: 'Mutation', sign_out_everywhere: boolean };

export type SignOutOthersMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutOthersMutation = { __typename?: 'Mutation', sign_out_other_sessions: boolean };

export type UpdateMyProfileMutationVariables = Exact<{
  name?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  current: Scalars['String']['input'];
}>;


export type UpdateMyProfileMutation = { __typename?: 'Mutation', update_my_profile: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type ChangePasswordMutationVariables = Exact<{
  next: Scalars['String']['input'];
  current: Scalars['String']['input'];
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', change_password: boolean };

export type ConnectedAccountsQueryVariables = Exact<{ [key: string]: never; }>;


export type ConnectedAccountsQuery = { __typename?: 'Query', my_connected_accounts: Array<{ __typename?: 'ConnectedAccount', provider: string, email: string, connected_at?: string | null }> };

export type DisconnectAccountMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  current: Scalars['String']['input'];
}>;


export type DisconnectAccountMutation = { __typename?: 'Mutation', disconnect_oauth_account: boolean };

export type LetterFieldsFragment = { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> };

export type LettersQueryVariables = Exact<{
  patient: Scalars['String']['input'];
}>;


export type LettersQuery = { __typename?: 'Query', letters: Array<{ __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> }> };

export type LetterQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type LetterQuery = { __typename?: 'Query', letter: { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> } };

export type ContactsQueryVariables = Exact<{
  q: Scalars['String']['input'];
}>;


export type ContactsQuery = { __typename?: 'Query', contacts: Array<{ __typename?: 'LetterRecipient', name: string, clinic: string, email: string }> };

export type CreateLetterMutationVariables = Exact<{
  patient: Scalars['String']['input'];
  encounter: Scalars['String']['input'];
  input?: InputMaybe<LetterInput>;
  draft: Scalars['Boolean']['input'];
}>;


export type CreateLetterMutation = { __typename?: 'Mutation', create_letter: { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> } };

export type DraftLetterMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DraftLetterMutation = { __typename?: 'Mutation', draft_letter: { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> } };

export type UpdateLetterMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: LetterInput;
}>;


export type UpdateLetterMutation = { __typename?: 'Mutation', update_letter: { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> } };

export type SendLetterMutationVariables = Exact<{
  id: Scalars['String']['input'];
  channels: Array<Scalars['String']['input']> | Scalars['String']['input'];
  to: Scalars['String']['input'];
  ownerCopy: Scalars['Boolean']['input'];
}>;


export type SendLetterMutation = { __typename?: 'Mutation', send_letter: { __typename?: 'SendLetterResult', letter: { __typename?: 'Letter', id: string, patient_id: string, patient_name: string, encounter_id: string, kind: string, reason: string, urgency: string, body: string, owner_consent: boolean, status: string, drafted: string, created_at: string, updated_at: string, signed_by: string, signer_title: string, signed_at?: string | null, sent_to: Array<string>, opened_at?: string | null, pdf_url: string, recipient: { __typename?: 'LetterRecipient', name: string, clinic: string, email: string }, attachments: { __typename?: 'LetterAttachments', note_encounter_ids: Array<string>, document_ids: Array<string>, invoice_ids: Array<string>, photos: Array<{ __typename?: 'LetterPhoto', encounter_id: string, photo_id: string }> }, sent: Array<{ __typename?: 'LetterSend', channel: string, to_masked: string, at: string, status: string, detail: string }> }, results: Array<{ __typename?: 'LetterChannelResult', channel: string, status: string, detail: string, to: string, subject: string, body: string, text: string, url: string, pdf_url: string, expires_at?: string | null }> } };

export type DeleteLetterMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteLetterMutation = { __typename?: 'Mutation', delete_letter: boolean };

export type SpeechOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type SpeechOptionsQuery = { __typename?: 'Query', speech_options: { __typename?: 'SpeechOptions', available: boolean, default_voice: string, voices: Array<{ __typename?: 'SpeechVoice', id: string, name: string, language: string, gender: string }> } };

export type StartAuthenticatorMutationVariables = Exact<{
  current: Scalars['String']['input'];
}>;


export type StartAuthenticatorMutation = { __typename?: 'Mutation', start_authenticator: { __typename?: 'AuthenticatorSetup', secret: string, otpauth_uri: string } };

export type ConfirmAuthenticatorMutationVariables = Exact<{
  code: Scalars['String']['input'];
}>;


export type ConfirmAuthenticatorMutation = { __typename?: 'Mutation', confirm_authenticator: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type RemoveAuthenticatorMutationVariables = Exact<{
  current: Scalars['String']['input'];
}>;


export type RemoveAuthenticatorMutation = { __typename?: 'Mutation', remove_authenticator: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type DoctorsQueryVariables = Exact<{ [key: string]: never; }>;


export type DoctorsQuery = { __typename?: 'Query', doctors: Array<{ __typename?: 'Doctor', id: string, name: string }> };

export type SetUserTwoFactorMutationVariables = Exact<{
  id: Scalars['String']['input'];
  required: Scalars['Boolean']['input'];
}>;


export type SetUserTwoFactorMutation = { __typename?: 'Mutation', set_user_two_factor: { __typename?: 'User', id: string, username: string, name: string, email: string, provider_id: string, role: string, active: boolean, has_password: boolean, two_factor: boolean, two_factor_required: boolean, authenticator: boolean, created_at: string } };

export type LetterheadQueryVariables = Exact<{ [key: string]: never; }>;


export type LetterheadQuery = { __typename?: 'Query', letterhead: { __typename?: 'Clinic', name: string, address: string, phone: string, logo_url: string, pims_name: string } };

export type NameSpeakerMutationVariables = Exact<{
  id: Scalars['String']['input'];
  speaker: Scalars['String']['input'];
  role: Scalars['String']['input'];
  name: Scalars['String']['input'];
}>;


export type NameSpeakerMutation = { __typename?: 'Mutation', name_speaker: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type MarkPrescriptionEnteredMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type MarkPrescriptionEnteredMutation = { __typename?: 'Mutation', mark_prescription_entered: { __typename?: 'Encounter', id: string, consent_recorded: boolean, appointment_id: string, patient_id: string, provider_id: string, provider_name: string, source: string, status: string, transcript: string, parts_received: number, last_part: number, first_part_at?: string | null, last_part_at?: string | null, audio_seconds: number, created_at: string, signed_at?: string | null, signed_by: string, patient_ids: Array<string>, patient_name: string, client_id: string, owner_name: string, note_type: string, group_id: string, view: string, hidden: string, pims_next_try_at?: string | null, segments: Array<{ __typename?: 'Segment', id: string, line: number, speaker_id: string, speaker_name: string, role: string, offset_seconds: number, text: string, pets: Array<string>, pet_sure: boolean }>, pims_items: Array<{ __typename?: 'PimsItem', kind: string, id: string, label: string, status: string, synced_at?: string | null, pims_id: string, detail: string }>, prescription_task?: { __typename?: 'PrescriptionTask', text: string, medications: Array<string>, done_by: string, done_at?: string | null } | null, can: { __typename?: 'VisitCan', start: boolean, record: boolean, draft: boolean, edit: boolean, approve: boolean, sign: boolean, edit_photos: boolean, remember: boolean, write_letter: boolean, share: boolean, resend: boolean }, note?: { __typename?: 'SoapNote', subjective: string, objective: string, assessment: string, plan: string, client_summary: string, vitals: unknown, medications: Array<string>, vitals_by: string } | null, followups: Array<{ __typename?: 'FollowUp', id: string, kind: string, reason: string, title: string, suggest_letter: boolean, due_in_days?: number | null, message_draft: string, status: string, booking_mode: string, remind_unbooked: boolean, suggested_slots: Array<{ __typename?: 'Slot', start: string, end: string, provider_id: string }>, sms?: { __typename?: 'SmsResult', status: string, detail: string, text: string, to_masked: string } | null, booked_slot?: { __typename?: 'Slot', start: string, end: string, provider_id: string } | null, booking?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, booking_link?: { __typename?: 'BookingLink', url: string, from: string, to: string, expires_at?: string | null, status: string, sent_at?: string | null, booked_start?: string | null, pets: Array<string> } | null, reminder?: { __typename?: 'SmsResult', status: string, detail: string, text: string, at?: string | null } | null }>, photos: Array<{ __typename?: 'Photo', id: string, label: string, caption: string, findings: string, segments: unknown, rotation: number, in_note: boolean, show_owner: boolean, outline: Array<{ __typename?: 'OutlineRegion', label: string, box: Array<number>, polygon: Array<Array<number>> }>, crop?: { __typename?: 'Crop', x: number, y: number, w: number, h: number } | null }>, write_back?: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string, start?: string | null, at?: string | null } | null, plan_reminders: Array<{ __typename?: 'PlanReminder', id: string, text: string, status: string }> } };

export type SendToPimsMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type SendToPimsMutation = { __typename?: 'Mutation', send_to_pims: { __typename?: 'WriteBackResult', ok: boolean, status: string, detail: string, pims_id: string } };

export type SignPreviewQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type SignPreviewQuery = { __typename?: 'Query', sign_preview: { __typename?: 'SignPreview', pims_name: string, matches: boolean, mismatch: string, note: boolean, photos: number, prescription: Array<string>, patient: { __typename?: 'PimsRecordRef', name: string, pims_id: string }, owner: { __typename?: 'PimsRecordRef', name: string, pims_id: string }, appointment?: { __typename?: 'SignPreviewAppointment', id: string, start: string, patient_name: string, owner_name: string } | null, texts: Array<{ __typename?: 'FollowingText', followup_id: string, kind: string, reason: string, message: string }> } };

export type RecordPanelQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type RecordPanelQuery = { __typename?: 'Query', record_panel: { __typename?: 'RecordPanel', pims_patient_id: string, pims_client_id: string, mock: boolean, patient: { __typename?: 'PetDetails', id: string, name: string, species: string, breed: string, age?: number | null, sex: string, alerts: Array<string> }, weight: { __typename?: 'Weights', latest?: { __typename?: 'WeightReading', date: string, value: number, unit: string } | null, previous?: { __typename?: 'WeightReading', date: string, value: number, unit: string } | null, history: Array<{ __typename?: 'WeightReading', date: string, value: number, unit: string }> }, reminders_due: Array<{ __typename?: 'ReminderDue', patient_id: string, text: string, due: string }>, recent_visits: Array<{ __typename?: 'PanelVisit', id: string, date: string, kind: string, type: string, reason: string, provider_name: string }>, client?: { __typename?: 'ClientContact', id: string, name: string, first_name: string, last_name: string, phones: Array<string>, emails: Array<string>, prefers: string } | null, other_pets: Array<{ __typename?: 'PetBasics', id: string, name: string }> } };

export const UserFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<UserFieldsFragment, unknown>;
export const AppointmentFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"duration_min"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"room"}},{"kind":"Field","name":{"kind":"Name","value":"visit_status"}},{"kind":"Field","name":{"kind":"Name","value":"audio_live"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"demo_clock"}},{"kind":"Field","name":{"kind":"Name","value":"checked_in_at"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"visit_status"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"alert_chips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"short"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"pims_notes"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"alert_chips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"short"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"microchip"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"pims_notes"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"}},{"kind":"Field","name":{"kind":"Name","value":"client_since"}}]}}]}}]} as unknown as DocumentNode<AppointmentFieldsFragment, unknown>;
export const SlotFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}}]} as unknown as DocumentNode<SlotFieldsFragment, unknown>;
export const WriteBackFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]} as unknown as DocumentNode<WriteBackFieldsFragment, unknown>;
export const EncounterFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]} as unknown as DocumentNode<EncounterFieldsFragment, unknown>;
export const OpenItemFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OpenItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OpenItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]} as unknown as DocumentNode<OpenItemFieldsFragment, unknown>;
export const WaitingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WaitingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WaitingLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"days_waiting"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}}]} as unknown as DocumentNode<WaitingFieldsFragment, unknown>;
export const LastVisitFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LastVisitFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LastVisit"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]} as unknown as DocumentNode<LastVisitFieldsFragment, unknown>;
export const ClientCardFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClientCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClientCard"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"}},{"kind":"Field","name":{"kind":"Name","value":"client_since"}},{"kind":"Field","name":{"kind":"Name","value":"latest_message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}}]} as unknown as DocumentNode<ClientCardFieldsFragment, unknown>;
export const RememberFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RememberFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RememberItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"said_at"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"kept_by"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}}]}}]} as unknown as DocumentNode<RememberFieldsFragment, unknown>;
export const DocumentFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DocumentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Document"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"uploaded_at"}},{"kind":"Field","name":{"kind":"Name","value":"pages"}},{"kind":"Field","name":{"kind":"Name","value":"content_type"}},{"kind":"Field","name":{"kind":"Name","value":"key_points"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"page"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mock"}}]}}]} as unknown as DocumentNode<DocumentFieldsFragment, unknown>;
export const SignInPayloadFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<SignInPayloadFieldsFragment, unknown>;
export const AssistLinkFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AssistLinkFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AssistLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"document_id"}}]}}]} as unknown as DocumentNode<AssistLinkFieldsFragment, unknown>;
export const LetterFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<LetterFieldsFragment, unknown>;
export const AuthStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AuthStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"auth_status"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login_required"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"password"}},{"kind":"Field","name":{"kind":"Name","value":"google"}},{"kind":"Field","name":{"kind":"Name","value":"microsoft"}},{"kind":"Field","name":{"kind":"Name","value":"demo"}},{"kind":"Field","name":{"kind":"Name","value":"password_reset"}}]}}]}}]}}]} as unknown as DocumentNode<AuthStatusQuery, AuthStatusQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"via"}},{"kind":"Field","name":{"kind":"Name","value":"admin"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const SignInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignIn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"login"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"remember"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_in"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"login"},"value":{"kind":"Variable","name":{"kind":"Name","value":"login"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"remember"},"value":{"kind":"Variable","name":{"kind":"Name","value":"remember"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<SignInMutation, SignInMutationVariables>;
export const VerifyCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticket"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verify_sign_in_code"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticket"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticket"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<VerifyCodeMutation, VerifyCodeMutationVariables>;
export const ResendCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticket"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resend_sign_in_code"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticket"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticket"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<ResendCodeMutation, ResendCodeMutationVariables>;
export const StartOAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartOAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"remember"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start_oauth_sign_in"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"remember"},"value":{"kind":"Variable","name":{"kind":"Name","value":"remember"}}}]}]}}]} as unknown as DocumentNode<StartOAuthMutation, StartOAuthMutationVariables>;
export const FinishOAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishOAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finish_oauth_sign_in"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<FinishOAuthMutation, FinishOAuthMutationVariables>;
export const FinishOAuthLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishOAuthLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finish_oauth_link"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<FinishOAuthLinkMutation, FinishOAuthLinkMutationVariables>;
export const DemoSignInDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DemoSignIn"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"try_demo_clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<DemoSignInMutation, DemoSignInMutationVariables>;
export const RequestResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"request_password_reset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}]}}]} as unknown as DocumentNode<RequestResetMutation, RequestResetMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reset_password"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const InviteInfoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InviteInfo"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"invite_info"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]} as unknown as DocumentNode<InviteInfoQuery, InviteInfoQueryVariables>;
export const AcceptInviteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AcceptInvite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accept_invite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignInPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignInPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SignInPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"ticket"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_method"}},{"kind":"Field","name":{"kind":"Name","value":"email_hint"}}]}}]} as unknown as DocumentNode<AcceptInviteMutation, AcceptInviteMutationVariables>;
export const SignOutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignOut"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_out"}}]}}]} as unknown as DocumentNode<SignOutMutation, SignOutMutationVariables>;
export const TeamDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Team"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"linked_to"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<TeamQuery, TeamQueryVariables>;
export const InviteUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InviteUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"NewUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"invite_user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"invite_url"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<InviteUserMutation, InviteUserMutationVariables>;
export const ReinviteUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReinviteUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reinvite_user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"user_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"invite_url"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<ReinviteUserMutation, ReinviteUserMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserUpdateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"user_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const ScheduleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Schedule"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schedule"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}},{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AppointmentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"duration_min"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"room"}},{"kind":"Field","name":{"kind":"Name","value":"visit_status"}},{"kind":"Field","name":{"kind":"Name","value":"audio_live"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"demo_clock"}},{"kind":"Field","name":{"kind":"Name","value":"checked_in_at"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"visit_status"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"alert_chips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"short"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"pims_notes"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"alert_chips"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"short"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"microchip"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"pims_notes"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"}},{"kind":"Field","name":{"kind":"Name","value":"client_since"}}]}}]}}]} as unknown as DocumentNode<ScheduleQuery, ScheduleQueryVariables>;
export const DaysDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Days"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"days"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"visits"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"failed"}},{"kind":"Field","name":{"kind":"Name","value":"marker"}}]}}]}}]} as unknown as DocumentNode<DaysQuery, DaysQueryVariables>;
export const BriefDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Brief"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brief"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spoken"}},{"kind":"Field","name":{"kind":"Name","value":"sentence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"emphasis"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}}]}},{"kind":"Field","name":{"kind":"Name","value":"suggestions"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"from_yesterday"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OpenItemFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pending_followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"heads_up"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"new_since_yesterday"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"document_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OpenItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OpenItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}}]} as unknown as DocumentNode<BriefQuery, BriefQueryVariables>;
export const EndOfDayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EndOfDay"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"end_of_day"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}},{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spoken"}},{"kind":"Field","name":{"kind":"Name","value":"visits_seen"}},{"kind":"Field","name":{"kind":"Name","value":"rechecks_booked"}},{"kind":"Field","name":{"kind":"Name","value":"recheck_links_sent"}},{"kind":"Field","name":{"kind":"Name","value":"recheck_links_booked"}},{"kind":"Field","name":{"kind":"Name","value":"left_to_do"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OpenItemFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"done_today"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waiting_on_owners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WaitingFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tomorrow"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"visits"}},{"kind":"Field","name":{"kind":"Name","value":"first"}},{"kind":"Field","name":{"kind":"Name","value":"last"}},{"kind":"Field","name":{"kind":"Name","value":"prepare"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OpenItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OpenItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WaitingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WaitingLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"days_waiting"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}}]} as unknown as DocumentNode<EndOfDayQuery, EndOfDayQueryVariables>;
export const PreRoomCardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PreRoomCard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pre_room_card"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointment_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"spoken"}},{"kind":"Field","name":{"kind":"Name","value":"take"}},{"kind":"Field","name":{"kind":"Name","value":"last_note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"by"}},{"kind":"Field","name":{"kind":"Name","value":"other_vet"}},{"kind":"Field","name":{"kind":"Name","value":"gist"}}]}},{"kind":"Field","name":{"kind":"Name","value":"promised"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"remember_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RememberFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"why"}},{"kind":"Field","name":{"kind":"Name","value":"prep"}},{"kind":"Field","name":{"kind":"Name","value":"owner_message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"who"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last_visit_on"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}},{"kind":"Field","name":{"kind":"Name","value":"walk_in"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"who"}},{"kind":"Field","name":{"kind":"Name","value":"mine"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"checked"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"can_do_today"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RememberFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RememberItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"said_at"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"kept_by"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}}]}}]} as unknown as DocumentNode<PreRoomCardQuery, PreRoomCardQueryVariables>;
export const NotesToSignDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NotesToSign"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"notes_to_sign"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"visit_reason"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"bucket"}},{"kind":"Field","name":{"kind":"Name","value":"to_confirm"}},{"kind":"Field","name":{"kind":"Name","value":"followups_undecided"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"waiting_days"}}]}}]}}]} as unknown as DocumentNode<NotesToSignQuery, NotesToSignQueryVariables>;
export const VoiceProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VoiceProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voice_profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"notes_used"}}]}}]}}]} as unknown as DocumentNode<VoiceProfileQuery, VoiceProfileQueryVariables>;
export const PreviousNotesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PreviousNotes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_notes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"sections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}}]}}]} as unknown as DocumentNode<PreviousNotesQuery, PreviousNotesQueryVariables>;
export const SampleTranscriptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SampleTranscript"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appointment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sample_transcript"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointment_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appointment"}}}]}]}}]} as unknown as DocumentNode<SampleTranscriptQuery, SampleTranscriptQueryVariables>;
export const SearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Search"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"q"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"q"},"value":{"kind":"Variable","name":{"kind":"Name","value":"q"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LastVisitFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"next_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"owners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LastVisitFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LastVisit"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]} as unknown as DocumentNode<SearchQuery, SearchQueryVariables>;
export const AskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Ask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssistantInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ask_assistant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reply"}},{"kind":"Field","name":{"kind":"Name","value":"tools_used"}},{"kind":"Field","name":{"kind":"Name","value":"links"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AssistLinkFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AssistLinkFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AssistLinkFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AssistLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"document_id"}}]}}]} as unknown as DocumentNode<AskMutation, AskMutationVariables>;
export const AssistantTurnDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"AssistantTurn"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assistant_turn"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"turn_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}}]} as unknown as DocumentNode<AssistantTurnSubscription, AssistantTurnSubscriptionVariables>;
export const PatientVisitsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientVisits"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"related"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_visits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"related_to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"related"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"related"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"sections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]}}]} as unknown as DocumentNode<PatientVisitsQuery, PatientVisitsQueryVariables>;
export const PatientProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"microchip"}}]}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"previous"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"history"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"note"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"reminders_due"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"due"}}]}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClientCardFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"other_pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LastVisitFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"due"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClientCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClientCard"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"}},{"kind":"Field","name":{"kind":"Name","value":"client_since"}},{"kind":"Field","name":{"kind":"Name","value":"latest_message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LastVisitFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LastVisit"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]} as unknown as DocumentNode<PatientProfileQuery, PatientProfileQueryVariables>;
export const InvoicesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Invoices"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"client_invoices"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"client_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"last_12_months"}},{"kind":"Field","name":{"kind":"Name","value":"last_payment"}},{"kind":"Field","name":{"kind":"Name","value":"counts"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"invoices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"visit"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"paid_by"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"qty"}},{"kind":"Field","name":{"kind":"Name","value":"price"}}]}}]}}]}}]}}]} as unknown as DocumentNode<InvoicesQuery, InvoicesQueryVariables>;
export const HouseholdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Household"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"client_household"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"client_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"book_url"}},{"kind":"Field","name":{"kind":"Name","value":"spend_12m"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClientCardFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}},{"kind":"Field","name":{"kind":"Name","value":"due"}},{"kind":"Field","name":{"kind":"Name","value":"next_due"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"due"}},{"kind":"Field","name":{"kind":"Name","value":"state"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"alert_tags"}},{"kind":"Field","name":{"kind":"Name","value":"spend_12m"}},{"kind":"Field","name":{"kind":"Name","value":"last_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LastVisitFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"today"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"visit_status"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"coming_up"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"direction"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remember"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RememberFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClientCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClientCard"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"}},{"kind":"Field","name":{"kind":"Name","value":"client_since"}},{"kind":"Field","name":{"kind":"Name","value":"latest_message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LastVisitFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LastVisit"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RememberFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RememberItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"said_at"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"kept_by"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}}]}}]} as unknown as DocumentNode<HouseholdQuery, HouseholdQueryVariables>;
export const DocumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Documents"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_documents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DocumentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DocumentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Document"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"uploaded_at"}},{"kind":"Field","name":{"kind":"Name","value":"pages"}},{"kind":"Field","name":{"kind":"Name","value":"content_type"}},{"kind":"Field","name":{"kind":"Name","value":"key_points"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"page"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mock"}}]}}]} as unknown as DocumentNode<DocumentsQuery, DocumentsQueryVariables>;
export const ClientRememberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClientRemember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"client_remember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"client_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RememberFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RememberFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RememberItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"said_at"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"kept_by"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}}]}}]} as unknown as DocumentNode<ClientRememberQuery, ClientRememberQueryVariables>;
export const ForgetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Forget"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"client"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"forget_remember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"client_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"client"}}},{"kind":"Argument","name":{"kind":"Name","value":"item_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item"}}}]}]}}]} as unknown as DocumentNode<ForgetMutation, ForgetMutationVariables>;
export const EncounterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Encounter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EncounterQuery, EncounterQueryVariables>;
export const GroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Group"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"group"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"group_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"group"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<GroupQuery, GroupQueryVariables>;
export const StartEncounterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartEncounter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"NewEncounterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start_encounter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartEncounterMutation, StartEncounterMutationVariables>;
export const AddTranscriptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddTranscript"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"text"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"append"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"add_transcript"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"text"},"value":{"kind":"Variable","name":{"kind":"Name","value":"text"}}},{"kind":"Argument","name":{"kind":"Name","value":"append"},"value":{"kind":"Variable","name":{"kind":"Name","value":"append"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AddTranscriptMutation, AddTranscriptMutationVariables>;
export const DraftNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DraftNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"draft_note"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<DraftNoteMutation, DraftNoteMutationVariables>;
export const DraftProgressDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"DraftProgress"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"draft_progress"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"run_id"}},{"kind":"Field","name":{"kind":"Name","value":"step"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}}]}}]}}]} as unknown as DocumentNode<DraftProgressSubscription, DraftProgressSubscriptionVariables>;
export const UpdatePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PhotoEditInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_photo"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"photo_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photo"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<UpdatePhotoMutation, UpdatePhotoMutationVariables>;
export const DeletePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeletePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_photo"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"photo_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photo"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<DeletePhotoMutation, DeletePhotoMutationVariables>;
export const RestorePhotoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestorePhoto"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"photo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restore_photo"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"photo_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"photo"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<RestorePhotoMutation, RestorePhotoMutationVariables>;
export const SaveNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SoapNoteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"save_note"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<SaveNoteMutation, SaveNoteMutationVariables>;
export const NoteTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NoteTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_types"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"sections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]}}]} as unknown as DocumentNode<NoteTypesQuery, NoteTypesQueryVariables>;
export const SetNoteTypeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetNoteType"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set_note_type"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"note_type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<SetNoteTypeMutation, SetNoteTypeMutationVariables>;
export const AssistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Assist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssistInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"suggestion"}},{"kind":"Field","name":{"kind":"Name","value":"refused"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"unsourced"}},{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sentence"}},{"kind":"Field","name":{"kind":"Name","value":"lines"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}}]}}]} as unknown as DocumentNode<AssistMutation, AssistMutationVariables>;
export const TemplatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Templates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"templates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"note_type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortcut"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"owner"}}]}}]}}]} as unknown as DocumentNode<TemplatesQuery, TemplatesQueryVariables>;
export const FollowUpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FollowUp"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"followup"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowUpActionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"act_on_followup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"followup_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"followup"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<FollowUpMutation, FollowUpMutationVariables>;
export const AddPetToVisitDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddPetToVisit"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patient"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"add_pet_to_visit"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patient"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AddPetToVisitMutation, AddPetToVisitMutationVariables>;
export const SetPlanChecksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPlanChecks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appointment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patient"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lines"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set_plan_checks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointment_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appointment"}}},{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patient"}}},{"kind":"Argument","name":{"kind":"Name","value":"lines"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lines"}}}]}]}}]} as unknown as DocumentNode<SetPlanChecksMutation, SetPlanChecksMutationVariables>;
export const PlanReminderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PlanReminder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reminder"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"action"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"act_on_plan_reminder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"reminder_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reminder"}}},{"kind":"Argument","name":{"kind":"Name","value":"action"},"value":{"kind":"Variable","name":{"kind":"Name","value":"action"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PlanReminderMutation, PlanReminderMutationVariables>;
export const WaitingLinksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WaitingLinks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"waiting_followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WaitingFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WaitingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WaitingLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"days_waiting"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}}]} as unknown as DocumentNode<WaitingLinksQuery, WaitingLinksQueryVariables>;
export const ResendLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"followup"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resend_booking_link"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"followup_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"followup"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WaitingFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WaitingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WaitingLink"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"days_waiting"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}}]} as unknown as DocumentNode<ResendLinkMutation, ResendLinkMutationVariables>;
export const RememberSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RememberSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"remember_suggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"left_out"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"suggestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"transcript_lines"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}},{"kind":"Field","name":{"kind":"Name","value":"kept"}}]}}]}}]}}]} as unknown as DocumentNode<RememberSuggestionsQuery, RememberSuggestionsQueryVariables>;
export const KeepRememberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"KeepRemember"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keep"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keep_remember"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"keep"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keep"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RememberFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RememberFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RememberItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"said_at"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"kept_by"}},{"kind":"Field","name":{"kind":"Name","value":"said_by"}}]}}]} as unknown as DocumentNode<KeepRememberMutation, KeepRememberMutationVariables>;
export const SignNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"by"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"send"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_note"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"signed_by"},"value":{"kind":"Variable","name":{"kind":"Name","value":"by"}}},{"kind":"Argument","name":{"kind":"Name","value":"send"},"value":{"kind":"Variable","name":{"kind":"Name","value":"send"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<SignNoteMutation, SignNoteMutationVariables>;
export const OwnerSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"OwnerSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lang"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"owner_summary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"lang"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lang"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"when_to_call"}},{"kind":"Field","name":{"kind":"Name","value":"translated"}},{"kind":"Field","name":{"kind":"Name","value":"mock"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"logo_url"}}]}},{"kind":"Field","name":{"kind":"Name","value":"visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"when"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"age_text"}},{"kind":"Field","name":{"kind":"Name","value":"for_owner"}},{"kind":"Field","name":{"kind":"Name","value":"medicines"}},{"kind":"Field","name":{"kind":"Name","value":"home_care"}},{"kind":"Field","name":{"kind":"Name","value":"next_visit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]}}]}}]} as unknown as DocumentNode<OwnerSummaryQuery, OwnerSummaryQueryVariables>;
export const ShareDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Share"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"channel"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lang"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"share_summary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"channel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"channel"}}},{"kind":"Argument","name":{"kind":"Name","value":"language"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lang"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"translated"}}]}}]}}]} as unknown as DocumentNode<ShareMutation, ShareMutationVariables>;
export const SetTwoFactorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetTwoFactor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set_two_factor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<SetTwoFactorMutation, SetTwoFactorMutationVariables>;
export const ConnectOAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConnectOAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connect_oauth_account"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}]}]}}]} as unknown as DocumentNode<ConnectOAuthMutation, ConnectOAuthMutationVariables>;
export const SignOutEverywhereDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignOutEverywhere"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_out_everywhere"}}]}}]} as unknown as DocumentNode<SignOutEverywhereMutation, SignOutEverywhereMutationVariables>;
export const SignOutOthersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SignOutOthers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_out_other_sessions"}}]}}]} as unknown as DocumentNode<SignOutOthersMutation, SignOutOthersMutationVariables>;
export const UpdateMyProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMyProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_my_profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<UpdateMyProfileMutation, UpdateMyProfileMutationVariables>;
export const ChangePasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangePassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"next"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"change_password"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"new_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"next"}}},{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}]}]}}]} as unknown as DocumentNode<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const ConnectedAccountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ConnectedAccounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"my_connected_accounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"connected_at"}}]}}]}}]} as unknown as DocumentNode<ConnectedAccountsQuery, ConnectedAccountsQueryVariables>;
export const DisconnectAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DisconnectAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"disconnect_oauth_account"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}]}]}}]} as unknown as DocumentNode<DisconnectAccountMutation, DisconnectAccountMutationVariables>;
export const LettersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Letters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patient"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"letters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patient"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<LettersQuery, LettersQueryVariables>;
export const LetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Letter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<LetterQuery, LetterQueryVariables>;
export const ContactsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Contacts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"q"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contacts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"q"},"value":{"kind":"Variable","name":{"kind":"Name","value":"q"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]} as unknown as DocumentNode<ContactsQuery, ContactsQueryVariables>;
export const CreateLetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLetter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patient"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"encounter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LetterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"draft"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patient"}}},{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"encounter"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"draft"},"value":{"kind":"Variable","name":{"kind":"Name","value":"draft"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<CreateLetterMutation, CreateLetterMutationVariables>;
export const DraftLetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DraftLetter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"draft_letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<DraftLetterMutation, DraftLetterMutationVariables>;
export const UpdateLetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateLetter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LetterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<UpdateLetterMutation, UpdateLetterMutationVariables>;
export const SendLetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendLetter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"channels"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ownerCopy"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"send_letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"channels"},"value":{"kind":"Variable","name":{"kind":"Name","value":"channels"}}},{"kind":"Argument","name":{"kind":"Name","value":"to_email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"owner_copy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ownerCopy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"letter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LetterFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LetterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Letter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"recipient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"note_encounter_ids"}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter_id"}},{"kind":"Field","name":{"kind":"Name","value":"photo_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"document_ids"}},{"kind":"Field","name":{"kind":"Name","value":"invoice_ids"}}]}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"owner_consent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"drafted"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"signer_title"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent_to"}},{"kind":"Field","name":{"kind":"Name","value":"opened_at"}},{"kind":"Field","name":{"kind":"Name","value":"sent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pdf_url"}}]}}]} as unknown as DocumentNode<SendLetterMutation, SendLetterMutationVariables>;
export const DeleteLetterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteLetter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_letter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteLetterMutation, DeleteLetterMutationVariables>;
export const SpeechOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SpeechOptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speech_options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"default_voice"}},{"kind":"Field","name":{"kind":"Name","value":"voices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"gender"}}]}}]}}]}}]} as unknown as DocumentNode<SpeechOptionsQuery, SpeechOptionsQueryVariables>;
export const StartAuthenticatorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartAuthenticator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start_authenticator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"secret"}},{"kind":"Field","name":{"kind":"Name","value":"otpauth_uri"}}]}}]}}]} as unknown as DocumentNode<StartAuthenticatorMutation, StartAuthenticatorMutationVariables>;
export const ConfirmAuthenticatorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmAuthenticator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirm_authenticator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<ConfirmAuthenticatorMutation, ConfirmAuthenticatorMutationVariables>;
export const RemoveAuthenticatorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAuthenticator"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"current"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"remove_authenticator"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"current_password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"current"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<RemoveAuthenticatorMutation, RemoveAuthenticatorMutationVariables>;
export const DoctorsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Doctors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doctors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<DoctorsQuery, DoctorsQueryVariables>;
export const SetUserTwoFactorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetUserTwoFactor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"required"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set_user_two_factor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"user_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"required"},"value":{"kind":"Variable","name":{"kind":"Name","value":"required"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor"}},{"kind":"Field","name":{"kind":"Name","value":"two_factor_required"}},{"kind":"Field","name":{"kind":"Name","value":"authenticator"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<SetUserTwoFactorMutation, SetUserTwoFactorMutationVariables>;
export const LetterheadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Letterhead"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"letterhead"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"logo_url"}},{"kind":"Field","name":{"kind":"Name","value":"pims_name"}}]}}]}}]} as unknown as DocumentNode<LetterheadQuery, LetterheadQueryVariables>;
export const NameSpeakerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"NameSpeaker"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"speaker"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"role"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name_speaker"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"speaker_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"speaker"}}},{"kind":"Argument","name":{"kind":"Name","value":"role"},"value":{"kind":"Variable","name":{"kind":"Name","value":"role"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<NameSpeakerMutation, NameSpeakerMutationVariables>;
export const MarkPrescriptionEnteredDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkPrescriptionEntered"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mark_prescription_entered"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SlotFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Slot"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WriteBackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WriteBackResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"consent_recorded"}},{"kind":"Field","name":{"kind":"Name","value":"appointment_id"}},{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_id"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"transcript"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_id"}},{"kind":"Field","name":{"kind":"Name","value":"speaker_name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"offset_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}},{"kind":"Field","name":{"kind":"Name","value":"pet_sure"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parts_received"}},{"kind":"Field","name":{"kind":"Name","value":"last_part"}},{"kind":"Field","name":{"kind":"Name","value":"first_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_part_at"}},{"kind":"Field","name":{"kind":"Name","value":"audio_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_at"}},{"kind":"Field","name":{"kind":"Name","value":"signed_by"}},{"kind":"Field","name":{"kind":"Name","value":"patient_ids"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"client_id"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}},{"kind":"Field","name":{"kind":"Name","value":"note_type"}},{"kind":"Field","name":{"kind":"Name","value":"group_id"}},{"kind":"Field","name":{"kind":"Name","value":"view"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"pims_items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"synced_at"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_next_try_at"}},{"kind":"Field","name":{"kind":"Name","value":"prescription_task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"done_by"}},{"kind":"Field","name":{"kind":"Name","value":"done_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"can"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"record"}},{"kind":"Field","name":{"kind":"Name","value":"draft"}},{"kind":"Field","name":{"kind":"Name","value":"edit"}},{"kind":"Field","name":{"kind":"Name","value":"approve"}},{"kind":"Field","name":{"kind":"Name","value":"sign"}},{"kind":"Field","name":{"kind":"Name","value":"edit_photos"}},{"kind":"Field","name":{"kind":"Name","value":"remember"}},{"kind":"Field","name":{"kind":"Name","value":"write_letter"}},{"kind":"Field","name":{"kind":"Name","value":"share"}},{"kind":"Field","name":{"kind":"Name","value":"resend"}}]}},{"kind":"Field","name":{"kind":"Name","value":"note"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subjective"}},{"kind":"Field","name":{"kind":"Name","value":"objective"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"client_summary"}},{"kind":"Field","name":{"kind":"Name","value":"vitals"}},{"kind":"Field","name":{"kind":"Name","value":"medications"}},{"kind":"Field","name":{"kind":"Name","value":"vitals_by"}}]}},{"kind":"Field","name":{"kind":"Name","value":"followups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"suggest_letter"}},{"kind":"Field","name":{"kind":"Name","value":"due_in_days"}},{"kind":"Field","name":{"kind":"Name","value":"message_draft"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"booking_mode"}},{"kind":"Field","name":{"kind":"Name","value":"suggested_slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"to_masked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booked_slot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SlotFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"booking_link"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"sent_at"}},{"kind":"Field","name":{"kind":"Name","value":"booked_start"}},{"kind":"Field","name":{"kind":"Name","value":"pets"}}]}},{"kind":"Field","name":{"kind":"Name","value":"remind_unbooked"}},{"kind":"Field","name":{"kind":"Name","value":"reminder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"photos"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"caption"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"segments"}},{"kind":"Field","name":{"kind":"Name","value":"rotation"}},{"kind":"Field","name":{"kind":"Name","value":"in_note"}},{"kind":"Field","name":{"kind":"Name","value":"show_owner"}},{"kind":"Field","name":{"kind":"Name","value":"outline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"box"}},{"kind":"Field","name":{"kind":"Name","value":"polygon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"crop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"x"}},{"kind":"Field","name":{"kind":"Name","value":"y"}},{"kind":"Field","name":{"kind":"Name","value":"w"}},{"kind":"Field","name":{"kind":"Name","value":"h"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"write_back"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WriteBackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"plan_reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<MarkPrescriptionEnteredMutation, MarkPrescriptionEnteredMutationVariables>;
export const SendToPimsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendToPims"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"send_to_pims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}}]}}]}}]} as unknown as DocumentNode<SendToPimsMutation, SendToPimsMutationVariables>;
export const SignPreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SignPreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sign_preview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounter_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pims_name"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pims_id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"patient_name"}},{"kind":"Field","name":{"kind":"Name","value":"owner_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"matches"}},{"kind":"Field","name":{"kind":"Name","value":"mismatch"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"photos"}},{"kind":"Field","name":{"kind":"Name","value":"prescription"}},{"kind":"Field","name":{"kind":"Name","value":"texts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followup_id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]} as unknown as DocumentNode<SignPreviewQuery, SignPreviewQueryVariables>;
export const RecordPanelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RecordPanel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record_panel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patient_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"species"}},{"kind":"Field","name":{"kind":"Name","value":"breed"}},{"kind":"Field","name":{"kind":"Name","value":"age"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pims_patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"pims_client_id"}},{"kind":"Field","name":{"kind":"Name","value":"weight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"previous"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"history"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"reminders_due"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient_id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}},{"kind":"Field","name":{"kind":"Name","value":"due"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recent_visits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"provider_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"phones"}},{"kind":"Field","name":{"kind":"Name","value":"emails"}},{"kind":"Field","name":{"kind":"Name","value":"prefers"}}]}},{"kind":"Field","name":{"kind":"Name","value":"other_pets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mock"}}]}}]}}]} as unknown as DocumentNode<RecordPanelQuery, RecordPanelQueryVariables>;