// Every server call the console makes goes through `api`. Screens never call fetch or Apollo
// themselves. Everything goes over GraphQL at /graphql, except what GraphQL does not carry well
// from a browser: audio chunk, photo and document uploads (multipart), file downloads and health.
import { ApolloError, type TypedDocumentNode } from "@apollo/client";
import { apollo } from "./apollo";
import { ApiError, signedOut } from "./http";
import * as op from "./operations";
import { rest } from "./rest";
import type {
  Appointment,
  AssistAction,
  AssistResult,
  AssistantActivity,
  AskReply,
  AuthStatus,
  Brief,
  DayMark,
  DraftStep,
  Encounter,
  EndOfDay,
  Household,
  Invite,
  Invoices,
  Letter,
  LetterChannel,
  LetterEdit,
  LetterRecipient,
  LetterSendResult,
  Me,
  NoteType,
  NoteToSign,
  OutsideDoc,
  PastNote,
  PastVisit,
  PhotoEdit,
  ProfileEdit,
  Clinic,
  ConnectedAccount,
  PreRoomCard,
  Profile,
  Provider,
  RecordPanelData,
  RememberItem,
  RememberSuggestions,
  SearchResults,
  ShareResult,
  SignPreview,
  SpeechOptions,
  SignInResult,
  SoapNote,
  Summary,
  Template,
  User,
  VoiceProfile,
  WaitingLink,
} from "./types";

export interface FollowUpBody {
  action: "approve" | "dismiss" | "retry_text" | "book";
  message_draft: string | null;
  slot_start: string | null;
  booking_mode?: "link" | "book";
  /** With a booking link: one reminder text if it isn't booked 3 days after it went out. */
  remind_unbooked?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskContext {
  appointment_id: string;
  patient_id: string;
  /** The appointment the screen already shows (Morning's Up next card). */
  showing?: string;
}

/** GraphQL errors carry the REST status in extensions, so screens handle both the same way. */
function asApiError(err: unknown, anonymous: boolean): Error {
  if (err instanceof ApolloError) {
    const first = err.graphQLErrors[0];
    const status = Number(
      first?.extensions?.status ?? (err.networkError as { statusCode?: number } | null)?.statusCode ?? 0,
    );
    if (status === 401 && !anonymous) signedOut();
    return new ApiError(first?.message ?? err.networkError?.message ?? err.message, status);
  }
  return err instanceof Error ? err : new Error(String(err));
}

// The console's own types mirror the schema; results are read through them at this one boundary.
type Vars = Record<string, unknown>;
async function query<R, V>(
  doc: TypedDocumentNode<R, V>,
  variables: V,
  pick: (r: R) => unknown,
  anonymous = false,
): Promise<unknown> {
  try {
    const r = await apollo.query<R, V & Vars>({
      query: doc as TypedDocumentNode<R, V & Vars>,
      variables: variables as V & Vars,
      fetchPolicy: "no-cache",
    });
    return pick(r.data);
  } catch (err) {
    throw asApiError(err, anonymous);
  }
}
async function mutate<R, V>(
  doc: TypedDocumentNode<R, V>,
  variables: V,
  pick: (r: R) => unknown,
  anonymous = false,
): Promise<unknown> {
  try {
    const r = await apollo.mutate<R, V & Vars>({
      mutation: doc as TypedDocumentNode<R, V & Vars>,
      variables: variables as V & Vars,
    });
    if (!r.data) throw new ApiError("No answer from the server", 0);
    return pick(r.data);
  } catch (err) {
    throw asApiError(err, anonymous);
  }
}

type Payload = {
  token?: string | null;
  two_factor_required: boolean;
  ticket?: string | null;
  two_factor_method?: string | null;
  email_hint?: string | null;
};
const signInResult = (p: Payload): SignInResult =>
  p.token
    ? { kind: "signed_in", token: p.token }
    : {
        kind: "code_needed",
        challenge: p.ticket ?? "",
        sent_to: p.email_hint ?? "",
        method: p.two_factor_method === "app" ? "app" : "email",
      };
const tokenOf = (p: Payload): string => {
  if (!p.token) throw new ApiError("Sign in didn't finish. Try again.", 0);
  return p.token;
};

const noteInput = (n: SoapNote) => ({
  subjective: n.subjective,
  objective: n.objective,
  assessment: n.assessment,
  plan: n.plan,
  client_summary: n.client_summary,
  vitals: n.vitals ?? {},
  medications: n.medications ?? [],
  vitals_by: n.vitals_by ?? "",
});

/** Listen to a subscription; returns a stop function. A run that ends early is listened to again once. */
function listen<R, V>(doc: TypedDocumentNode<R, V>, variables: V, onData: (r: R) => void, retryOnEnd: () => boolean) {
  let sub: { unsubscribe: () => void } | null = null;
  let stopped = false;
  let retried = false;
  const start = () => {
    sub = apollo
      .subscribe<R, V & Vars>({ query: doc as TypedDocumentNode<R, V & Vars>, variables: variables as V & Vars })
      .subscribe({
        next: (r) => {
          if (r.data && !stopped) onData(r.data);
        },
        error: () => undefined, // progress is a nicety: the answer still comes from the mutation
        complete: () => {
          if (!stopped && !retried && retryOnEnd()) {
            retried = true;
            setTimeout(() => {
              if (!stopped) start();
            }, 150);
          }
        },
      });
  };
  start();
  return () => {
    stopped = true;
    sub?.unsubscribe();
  };
}

const turnId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const api = {
  ...rest,

  // signing in
  authStatus: () =>
    query(
      op.AuthStatusQuery,
      {},
      (r): AuthStatus => ({
        login_required: r.auth_status.login_required,
        ...r.auth_status.options,
      }),
      true,
    ) as Promise<AuthStatus>,
  me: () => query(op.MeQuery, {}, (r) => r.me) as Promise<Me>,
  signIn: (login: string, password: string, remember: boolean) =>
    mutate(
      op.SignInMutation,
      { login, password, remember },
      (r) => signInResult(r.sign_in),
      true,
    ) as Promise<SignInResult>,
  verifyCode: (ticket: string, code: string) =>
    mutate(op.VerifyCodeMutation, { ticket, code }, (r) => tokenOf(r.verify_sign_in_code), true) as Promise<string>,
  resendCode: (ticket: string) =>
    mutate(
      op.ResendCodeMutation,
      { ticket },
      (r) => signInResult(r.resend_sign_in_code),
      true,
    ) as Promise<SignInResult>,
  startOAuth: (provider: "google" | "microsoft", remember: boolean) =>
    mutate(op.StartOAuthMutation, { provider, remember }, (r) => r.start_oauth_sign_in, true) as Promise<string>,
  finishOAuth: (code: string) =>
    mutate(
      op.FinishOAuthMutation,
      { code },
      (r) => signInResult(r.finish_oauth_sign_in),
      true,
    ) as Promise<SignInResult>,
  /** Signed in: finish connecting Google or Microsoft from the one-time #oauth_link code. */
  finishOAuthLink: (code: string) =>
    mutate(op.FinishOAuthLinkMutation, { code }, (r) => r.finish_oauth_link) as Promise<User>,
  demoSignIn: () => mutate(op.DemoSignInMutation, {}, (r) => tokenOf(r.try_demo_clinic), true) as Promise<string>,
  forgotPassword: (email: string) =>
    mutate(op.RequestResetMutation, { email }, (r) => r.request_password_reset, true) as Promise<boolean>,
  resetPassword: (token: string, password: string) =>
    mutate(op.ResetPasswordMutation, { token, password }, (r) => r.reset_password, true) as Promise<boolean>,
  inviteInfo: (token: string) =>
    query(op.InviteInfoQuery, { token }, (r) => r.invite_info, true) as Promise<{ name: string; username: string }>,
  acceptInvite: (token: string, password: string) =>
    mutate(op.AcceptInviteMutation, { token, password }, (r) => tokenOf(r.accept_invite), true) as Promise<string>,
  logout: () => mutate(op.SignOutMutation, {}, (r) => r.sign_out, true) as Promise<boolean>,

  // your account
  setTwoFactor: (enabled: boolean) =>
    mutate(op.SetTwoFactorMutation, { enabled }, (r) => r.set_two_factor) as Promise<User>,
  /** Ends every session of yours, this one too. */
  /** Set up an authenticator app: what to add to it. Nothing changes until confirmAuthenticator. */
  startAuthenticator: (current: string) =>
    mutate(op.StartAuthenticatorMutation, { current }, (r) => r.start_authenticator) as Promise<{
      secret: string;
      otpauth_uri: string;
    }>,
  confirmAuthenticator: (code: string) =>
    mutate(op.ConfirmAuthenticatorMutation, { code }, (r) => r.confirm_authenticator) as Promise<User>,
  removeAuthenticator: (current: string) =>
    mutate(op.RemoveAuthenticatorMutation, { current }, (r) => r.remove_authenticator) as Promise<User>,
  signOutEverywhere: () => mutate(op.SignOutEverywhereMutation, {}, (r) => r.sign_out_everywhere) as Promise<boolean>,
  /** Ends every other session of yours and keeps this one. */
  signOutOthers: () => mutate(op.SignOutOthersMutation, {}, (r) => r.sign_out_other_sessions) as Promise<boolean>,
  /** Send only what changed; a new email needs the current password. */
  updateMyProfile: (edit: ProfileEdit) =>
    mutate(
      op.UpdateMyProfileMutation,
      { name: edit.name ?? null, email: edit.email ?? null, current: edit.current_password ?? "" },
      (r) => r.update_my_profile,
    ) as Promise<User>,
  /** An account with no password yet sends "" as the current one (allowed shortly after signing in). */
  changePassword: (current: string, next: string) =>
    mutate(op.ChangePasswordMutation, { next, current }, (r) => r.change_password) as Promise<boolean>,
  connectedAccounts: () =>
    query(op.ConnectedAccountsQuery, {}, (r) => r.my_connected_accounts) as Promise<ConnectedAccount[]>,
  /** With a password, it's the proof; without one, "" and the server wants a recent sign in. */
  connectAccount: (provider: "google" | "microsoft", currentPassword = "") =>
    mutate(
      op.ConnectOAuthMutation,
      { provider, current: currentPassword },
      (r) => r.connect_oauth_account,
    ) as Promise<string>,
  disconnectAccount: (provider: "google" | "microsoft", currentPassword = "") =>
    mutate(
      op.DisconnectAccountMutation,
      { provider, current: currentPassword },
      (r) => r.disconnect_oauth_account,
    ) as Promise<boolean>,

  // the team
  team: () =>
    query(op.TeamQuery, {}, (r) => ({ users: r.users, providers: r.providers })) as Promise<{
      users: User[];
      providers: Provider[];
    }>,
  addUser: (input: { name: string; username: string; email: string; role: string; provider_id: string }) =>
    mutate(op.InviteUserMutation, { input }, (r) => r.invite_user) as Promise<Invite>,
  /** Require (or stop requiring) two step sign in for someone. Admins. */
  setUserTwoFactor: (id: string, required: boolean) =>
    mutate(op.SetUserTwoFactorMutation, { id, required }, (r) => r.set_user_two_factor) as Promise<User>,
  reinvite: (id: string) => mutate(op.ReinviteUserMutation, { id }, (r) => r.reinvite_user) as Promise<Invite>,
  updateUser: (id: string, input: { active?: boolean; role?: string }) =>
    mutate(op.UpdateUserMutation, { id, input }, (r) => r.update_user) as Promise<User>,

  // the day
  // Today leaves the date off so the server decides what today is.
  schedule: (provider = "", date = "") =>
    query(op.ScheduleQuery, { provider, date: date || null }, (r) => r.schedule) as Promise<Appointment[]>,
  days: (from: string, to: string, provider = "") =>
    query(op.DaysQuery, { from, to, provider }, (r) => r.days) as Promise<DayMark[]>,
  brief: (provider = "") => query(op.BriefQuery, { provider }, (r) => r.brief) as Promise<Brief>,
  endOfDay: (provider = "", date = "") =>
    query(op.EndOfDayQuery, { provider, date: date || null }, (r) => r.end_of_day) as Promise<EndOfDay>,
  notesToSign: (provider = "") =>
    query(op.NotesToSignQuery, { provider }, (r) => r.notes_to_sign) as Promise<NoteToSign[]>,
  preRoomCard: (id: string) => query(op.PreRoomCardQuery, { id }, (r) => r.pre_room_card) as Promise<PreRoomCard>,
  voiceProfile: (id: string) =>
    query(op.VoiceProfileQuery, { id }, (r) => r.voice_profile) as Promise<VoiceProfile | null>,
  previousNotes: (id: string) => query(op.PreviousNotesQuery, { id }, (r) => r.patient_notes) as Promise<PastNote[]>,
  /** The demo's sample visit, told about this appointment's pet, owner and vet. */
  sampleTranscript: (appointmentId = "") =>
    query(op.SampleTranscriptQuery, { appointment: appointmentId }, (r) => ({ text: r.sample_transcript })) as Promise<{
      text: string;
    }>,
  search: (q: string) => query(op.SearchQuery, { q }, (r) => r.search) as Promise<SearchResults>,

  /** Ask Blinq. `onActivity` hears what it is checking while it works (the assistant_turn subscription). */
  async ask(
    message: string,
    history: ChatTurn[],
    providerId: string,
    context: AskContext,
    onActivity?: (a: AssistantActivity) => void,
  ): Promise<AskReply> {
    const id = turnId();
    let answered = false;
    const stop = onActivity
      ? listen(
          op.AssistantTurnSubscription,
          { id },
          (r) => {
            const turn = r.assistant_turn;
            if (turn.kind === "checking") onActivity({ checking: turn.text, done: false });
            else onActivity({ checking: "", done: true, reply: turn.text });
          },
          () => !answered,
        )
      : () => {};
    try {
      return (await mutate(
        op.AskMutation,
        {
          input: {
            message,
            history,
            provider_id: providerId,
            appointment_id: context.appointment_id,
            patient_id: context.patient_id,
            showing: context.showing ?? "",
            turn_id: id,
          },
        },
        (r) => r.ask_assistant,
      )) as AskReply;
    } finally {
      answered = true;
      stop();
    }
  },

  // the patient record (read only)
  patientVisits: (id: string, related = "") =>
    query(op.PatientVisitsQuery, { id, related }, (r) => r.patient_visits) as Promise<PastVisit[]>,
  /** The record beside a visit: reads no notes, the same for every role. */
  recordPanel: (patientId: string) =>
    query(op.RecordPanelQuery, { id: patientId }, (r) => r.record_panel) as Promise<RecordPanelData>,
  patientProfile: (id: string) => query(op.PatientProfileQuery, { id }, (r) => r.patient_profile) as Promise<Profile>,
  invoices: (id: string) => query(op.InvoicesQuery, { id }, (r) => r.client_invoices) as Promise<Invoices>,
  household: (id: string) => query(op.HouseholdQuery, { id }, (r) => r.client_household) as Promise<Household>,
  documents: (id: string) => query(op.DocumentsQuery, { id }, (r) => r.patient_documents) as Promise<OutsideDoc[]>,
  clientRemember: (id: string) =>
    query(op.ClientRememberQuery, { id }, (r) => r.client_remember) as Promise<RememberItem[]>,
  forget: (client: string, item: string) =>
    mutate(op.ForgetMutation, { client, item }, (r) => r.forget_remember) as Promise<boolean>,

  doctors: () => query(op.DoctorsQuery, {}, (r) => r.doctors) as Promise<{ id: string; name: string }[]>,
  speechOptions: () => query(op.SpeechOptionsQuery, {}, (r) => r.speech_options) as Promise<SpeechOptions>,

  // letters from the clinic (Documents, sent)
  letterhead: () => query(op.LetterheadQuery, {}, (r) => r.letterhead) as Promise<Clinic>,
  letters: (patient: string) => query(op.LettersQuery, { patient }, (r) => r.letters) as Promise<Letter[]>,
  letter: (id: string) => query(op.LetterQuery, { id }, (r) => r.letter) as Promise<Letter>,
  contacts: (q = "") => query(op.ContactsQuery, { q }, (r) => r.contacts) as Promise<LetterRecipient[]>,
  /** Starts a letter; with `draft`, Blinq writes it in the same step (an AI step: sent alone). */
  createLetter: (from: { patient?: string; encounter?: string }, input: LetterEdit, draft: boolean) =>
    mutate(
      op.CreateLetterMutation,
      { patient: from.patient ?? "", encounter: from.encounter ?? "", input, draft },
      (r) => r.create_letter,
    ) as Promise<Letter>,
  // An AI step: sent on its own, never in the same request as another one.
  draftLetter: (id: string) => mutate(op.DraftLetterMutation, { id }, (r) => r.draft_letter) as Promise<Letter>,
  updateLetter: (id: string, input: LetterEdit) =>
    mutate(op.UpdateLetterMutation, { id, input }, (r) => r.update_letter) as Promise<Letter>,
  /** Signs and sends in one step. */
  sendLetter: (id: string, channels: LetterChannel[], to = "", ownerCopy = false) =>
    mutate(op.SendLetterMutation, { id, channels, to, ownerCopy }, (r) => r.send_letter) as Promise<{
      letter: Letter;
      results: LetterSendResult[];
    }>,
  deleteLetter: (id: string) => mutate(op.DeleteLetterMutation, { id }, (r) => r.delete_letter) as Promise<boolean>,
  letterPdfUrl: (id: string) => rest.letterPdfUrl(id),
  /** Press to talk: one short WAV clip of a question, as text, and who heard it ("model" or "mock"). */
  listen: (clip: Blob) => rest.listen(clip),

  /** Send a signed note to the PIMS again (it failed, or waits for staff), then read the visit fresh. */
  /** Who is this?: a role (and an optional name) for every line from that speaker. */
  nameSpeaker: (encounterId: string, speakerId: string, role: "tech" | "owner" | "other", name: string) =>
    mutate(
      op.NameSpeakerMutation,
      { id: encounterId, speaker: speakerId, role, name },
      (r) => r.name_speaker,
    ) as Promise<Encounter>,
  /** The front desk entered the prescription in the PIMS: who and when are recorded. */
  markPrescriptionEntered: (encounterId: string) =>
    mutate(
      op.MarkPrescriptionEnteredMutation,
      { id: encounterId },
      (r) => r.mark_prescription_entered,
    ) as Promise<Encounter>,
  sendToPims: async (encounterId: string): Promise<Encounter> => {
    await mutate(op.SendToPimsMutation, { id: encounterId }, (r) => r.send_to_pims);
    return query(op.EncounterQuery, { id: encounterId }, (r) => r.encounter) as Promise<Encounter>;
  },

  // a visit
  encounter: (id: string) => query(op.EncounterQuery, { id }, (r) => r.encounter) as Promise<Encounter>,
  group: (group: string) => query(op.GroupQuery, { group }, (r) => r.encounters) as Promise<Encounter[]>,
  startVisit: (appointmentId: string, extra: { patient_ids: string[]; note_type: string }) =>
    mutate(
      op.StartEncounterMutation,
      // The visit opens first; Start recording asks the owner and saves their yes (rest.recordConsent).
      { input: { appointment_id: appointmentId, consent_recorded: false, source: "web", ...extra } },
      (r) => r.start_encounter,
    ) as Promise<Encounter>,
  saveTranscript: (id: string, text: string) =>
    mutate(op.AddTranscriptMutation, { id, text, append: false }, (r) => r.add_transcript) as Promise<Encounter>,

  /** Write the note. `onStep` hears each step as the server works (the draft_progress subscription). */
  async draft(id: string, onStep?: (s: DraftStep) => void): Promise<Encounter> {
    let answered = false;
    const stop = onStep
      ? listen(
          op.DraftProgressSubscription,
          { id },
          (r) => {
            const p = r.draft_progress;
            if (p.step === "done" || p.step === "error") return;
            onStep({
              step: p.step,
              label: "",
              detail: p.detail,
              patient_name: p.patient_name,
              state: p.state === "done" ? "done" : p.state === "failed" ? "failed" : "running",
            });
          },
          () => !answered,
        )
      : () => {};
    try {
      return (await mutate(op.DraftNoteMutation, { id }, (r) => r.draft_note)) as Encounter;
    } finally {
      answered = true;
      stop();
    }
  },
  // Photo edits (requirement 59): metadata only, the original image is always kept.
  updatePhoto: (id: string, photo: string, input: PhotoEdit) =>
    mutate(op.UpdatePhotoMutation, { id, photo, input }, (r) => r.update_photo) as Promise<Encounter>,
  deletePhoto: (id: string, photo: string) =>
    mutate(op.DeletePhotoMutation, { id, photo }, (r) => r.delete_photo) as Promise<Encounter>,
  /** Undo a delete: deleted photos are kept until the visit is signed. */
  restorePhoto: (id: string, photo: string) =>
    mutate(op.RestorePhotoMutation, { id, photo }, (r) => r.restore_photo) as Promise<Encounter>,
  saveNote: (id: string, note: SoapNote) =>
    mutate(op.SaveNoteMutation, { id, note: noteInput(note) }, (r) => r.save_note) as Promise<Encounter>,
  noteTypes: () => query(op.NoteTypesQuery, {}, (r) => r.note_types) as Promise<NoteType[]>,
  setNoteType: (id: string, type: string) =>
    mutate(op.SetNoteTypeMutation, { id, type }, (r) => r.set_note_type) as Promise<Encounter>,
  assist: (id: string, input: { section: string; action: AssistAction; text: string; instruction: string }) =>
    mutate(op.AssistMutation, { id, input }, (r) => r.assist) as Promise<AssistResult>,
  templates: (type = "") => query(op.TemplatesQuery, { type }, (r) => r.templates) as Promise<Template[]>,
  followUp: (id: string, followup: string, b: FollowUpBody) =>
    mutate(
      op.FollowUpMutation,
      {
        id,
        followup,
        input: {
          action: b.action,
          message_draft: b.message_draft,
          slot_start: b.slot_start,
          booking_mode: b.booking_mode ?? null,
          remind_unbooked: b.remind_unbooked ?? null,
        },
      },
      (r) => r.act_on_followup,
    ) as Promise<Encounter>,
  /** Another of the owner's pets joins the visit already started (the pet tabs' Add a pet). */
  addPetToVisit: (encounterId: string, patientId: string) =>
    mutate(
      op.AddPetToVisitMutation,
      { id: encounterId, patient: patientId },
      (r) => r.add_pet_to_visit,
    ) as Promise<Encounter>,
  /** Keep the last plan's lines ticked for this pet before the visit: asked to cover today. */
  setPlanChecks: (appointmentId: string, patientId: string, lines: string[]) =>
    mutate(
      op.SetPlanChecksMutation,
      { appointment: appointmentId, patient: patientId, lines },
      (r) => r.set_plan_checks,
    ) as Promise<string[]>,
  /** A last plan line the visit didn't cover: put in the Plan ("added") or dismissed. */
  planReminder: (id: string, reminder: string, action: "added" | "dismissed") =>
    mutate(op.PlanReminderMutation, { id, reminder, action }, (r) => r.act_on_plan_reminder) as Promise<Encounter>,
  /** Booking links sent and not booked yet: a vet's own visits, everyone's for the front office. */
  waiting: () => query(op.WaitingLinksQuery, {}, (r) => r.waiting_followups) as Promise<WaitingLink[]>,
  resend: (followup: string) =>
    mutate(op.ResendLinkMutation, { followup }, (r) => r.resend_booking_link) as Promise<WaitingLink>,
  remember: (id: string) =>
    query(op.RememberSuggestionsQuery, { id }, (r) => r.remember_suggestions) as Promise<RememberSuggestions>,
  keepRemember: (id: string, keep: string[]) =>
    mutate(op.KeepRememberMutation, { id, keep }, (r) => r.keep_remember) as Promise<RememberItem[]>,
  /** Sign and send to the PIMS (`send`), or sign only: locked, sent later from the signed note. */
  sign: (id: string, by: string, send = true) =>
    mutate(op.SignNoteMutation, { id, by, send }, (r) => r.sign_note.encounter) as Promise<Encounter>,
  signPreview: (id: string) => query(op.SignPreviewQuery, { id }, (r) => r.sign_preview) as Promise<SignPreview>,
  summary: (id: string, lang: string) =>
    query(op.OwnerSummaryQuery, { id, lang }, (r) => r.owner_summary) as Promise<Summary>,
  share: (id: string, channel: string, lang: string) =>
    mutate(op.ShareMutation, { id, channel, lang }, (r) => r.share_summary) as Promise<ShareResult>,
};

export type Api = typeof api;
export { ApiError, onSignedOut } from "./http";
