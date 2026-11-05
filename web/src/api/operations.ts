// Every GraphQL operation the console sends. `pnpm codegen` turns these into typed documents in src/gql.
import { graphql } from "../gql";

export const UserFields = graphql(`
  fragment UserFields on User {
    id
    username
    name
    email
    provider_id
    role
    active
    has_password
    two_factor
    two_factor_required
    authenticator
    created_at
  }
`);

const AppointmentFields = graphql(`
  fragment AppointmentFields on Appointment {
    id
    start
    duration_min
    reason
    type
    status
    provider_id
    provider_name
    room
    visit_status
    audio_live
    encounter_id
    note_type
    started_at
    demo_clock
    checked_in_at
    synced_at
    pets {
      reason
      visit_status
      encounter_id
      patient {
        id
        name
        species
        breed
        age
        alerts
        alert_chips {
          text
          short
        }
        sex
        client_id
        pims_notes
        last_visit {
          date
          reason
        }
        weight {
          value
          unit
        }
      }
    }
    can {
      start
      record
      draft
      edit
      approve
      sign
      edit_photos
      remember
      write_letter
      share
      resend
    }
    patient {
      id
      name
      species
      breed
      age
      alerts
      alert_chips {
        text
        short
      }
      sex
      color
      microchip
      client_id
      pims_notes
      last_visit {
        date
        reason
      }
      weight {
        value
        unit
      }
    }
    client {
      id
      first_name
      last_name
      phones
      emails
      prefers
      reminders
      client_since
    }
  }
`);

const SlotFields = graphql(`
  fragment SlotFields on Slot {
    start
    end
    provider_id
  }
`);
const WriteBackFields = graphql(`
  fragment WriteBackFields on WriteBackResult {
    ok
    status
    detail
    pims_id
    start
    at
  }
`);

export const EncounterFields = graphql(`
  fragment EncounterFields on Encounter {
    id
    consent_recorded
    appointment_id
    patient_id
    provider_id
    provider_name
    source
    status
    transcript
    segments {
      id
      line
      speaker_id
      speaker_name
      role
      offset_seconds
      text
      pets
      pet_sure
    }
    parts_received
    last_part
    first_part_at
    last_part_at
    audio_seconds
    created_at
    signed_at
    signed_by
    patient_ids
    patient_name
    client_id
    owner_name
    note_type
    group_id
    view
    hidden
    pims_items {
      kind
      id
      label
      status
      synced_at
      pims_id
      detail
    }
    pims_next_try_at
    prescription_task {
      text
      medications
      done_by
      done_at
    }
    can {
      start
      record
      draft
      edit
      approve
      sign
      edit_photos
      remember
      write_letter
      share
      resend
    }
    note {
      subjective
      objective
      assessment
      plan
      client_summary
      vitals
      medications
      vitals_by
    }
    followups {
      id
      kind
      reason
      title
      suggest_letter
      due_in_days
      message_draft
      status
      booking_mode
      suggested_slots {
        ...SlotFields
      }
      sms {
        status
        detail
        text
        to_masked
      }
      booked_slot {
        ...SlotFields
      }
      booking {
        ...WriteBackFields
      }
      booking_link {
        url
        from
        to
        expires_at
        status
        sent_at
        booked_start
        pets
      }
      remind_unbooked
      reminder {
        status
        detail
        text
        at
      }
    }
    photos {
      id
      label
      caption
      findings
      segments
      rotation
      in_note
      show_owner
      outline {
        label
        box
        polygon
      }
      crop {
        x
        y
        w
        h
      }
    }
    write_back {
      ...WriteBackFields
    }
    plan_reminders {
      id
      text
      status
    }
  }
`);

const OpenItemFields = graphql(`
  fragment OpenItemFields on OpenItem {
    kind
    text
    owner_name
    encounter_id
    appointment_id
    date
    patient_name
    followup_id
    followup_kind
    reason
    title
    label
    patient_id
    client_id
    detail
  }
`);
const WaitingFields = graphql(`
  fragment WaitingFields on WaitingLink {
    encounter_id
    followup_id
    patient_id
    patient_name
    owner_name
    reason
    title
    url
    sent_at
    days_waiting
    status
    pets
  }
`);
const LastVisitFields = graphql(`
  fragment LastVisitFields on LastVisit {
    date
    reason
    type
  }
`);
const ClientCardFields = graphql(`
  fragment ClientCardFields on ClientCard {
    id
    name
    first_name
    last_name
    phones
    emails
    prefers
    reminders
    client_since
    latest_message {
      at
      text
    }
  }
`);
const RememberFields = graphql(`
  fragment RememberFields on RememberItem {
    id
    client_id
    patient_id
    patient_name
    text
    kind
    date
    said_at
    encounter_id
    expires_at
    kept_by
    said_by
  }
`);
const DocumentFields = graphql(`
  fragment DocumentFields on Document {
    id
    name
    uploaded_at
    pages
    content_type
    key_points {
      text
      page
    }
    mock
  }
`);
void [
  AppointmentFields,
  SlotFields,
  WriteBackFields,
  OpenItemFields,
  WaitingFields,
  LastVisitFields,
  ClientCardFields,
  RememberFields,
  DocumentFields,
];

// ----- signing in -----
export const SignInPayloadFields = graphql(`
  fragment SignInPayloadFields on SignInPayload {
    token
    two_factor_required
    ticket
    two_factor_method
    email_hint
  }
`);
export const AuthStatusQuery = graphql(`
  query AuthStatus {
    auth_status {
      login_required
      options {
        password
        google
        microsoft
        demo
        password_reset
      }
    }
  }
`);
export const MeQuery = graphql(`
  query Me {
    me {
      via
      admin
      role
      provider_id
      permissions
      user {
        ...UserFields
      }
    }
  }
`);
export const SignInMutation = graphql(`
  mutation SignIn($login: String!, $password: String!, $remember: Boolean!) {
    sign_in(login: $login, password: $password, remember: $remember) {
      ...SignInPayloadFields
    }
  }
`);
export const VerifyCodeMutation = graphql(`
  mutation VerifyCode($ticket: String!, $code: String!) {
    verify_sign_in_code(ticket: $ticket, code: $code) {
      ...SignInPayloadFields
    }
  }
`);
export const ResendCodeMutation = graphql(`
  mutation ResendCode($ticket: String!) {
    resend_sign_in_code(ticket: $ticket) {
      ...SignInPayloadFields
    }
  }
`);
export const StartOAuthMutation = graphql(`
  mutation StartOAuth($provider: String!, $remember: Boolean!) {
    start_oauth_sign_in(provider: $provider, remember: $remember)
  }
`);
export const FinishOAuthMutation = graphql(`
  mutation FinishOAuth($code: String!) {
    finish_oauth_sign_in(code: $code) {
      ...SignInPayloadFields
    }
  }
`);
export const FinishOAuthLinkMutation = graphql(`
  mutation FinishOAuthLink($code: String!) {
    finish_oauth_link(code: $code) {
      ...UserFields
    }
  }
`);
export const DemoSignInMutation = graphql(`
  mutation DemoSignIn {
    try_demo_clinic {
      ...SignInPayloadFields
    }
  }
`);
export const RequestResetMutation = graphql(`
  mutation RequestReset($email: String!) {
    request_password_reset(email: $email)
  }
`);
export const ResetPasswordMutation = graphql(`
  mutation ResetPassword($token: String!, $password: String!) {
    reset_password(token: $token, password: $password)
  }
`);
export const InviteInfoQuery = graphql(`
  query InviteInfo($token: String!) {
    invite_info(token: $token) {
      name
      username
    }
  }
`);
export const AcceptInviteMutation = graphql(`
  mutation AcceptInvite($token: String!, $password: String!) {
    accept_invite(token: $token, password: $password) {
      ...SignInPayloadFields
    }
  }
`);
export const SignOutMutation =
  graphql(`
    mutation SignOut {
      sign_out
    }
  `);

// ----- the team -----
export const TeamQuery = graphql(`
  query Team {
    users {
      ...UserFields
    }
    providers {
      id
      name
      linked_to
    }
  }
`);
export const InviteUserMutation = graphql(`
  mutation InviteUser($input: NewUserInput!) {
    invite_user(input: $input) {
      invite_url
      user {
        ...UserFields
      }
    }
  }
`);
export const ReinviteUserMutation = graphql(`
  mutation ReinviteUser($id: String!) {
    reinvite_user(user_id: $id) {
      invite_url
      user {
        ...UserFields
      }
    }
  }
`);
export const UpdateUserMutation = graphql(`
  mutation UpdateUser($id: String!, $input: UserUpdateInput!) {
    update_user(user_id: $id, input: $input) {
      ...UserFields
    }
  }
`);

// ----- the day -----
export const ScheduleQuery = graphql(`
  query Schedule($date: Date, $provider: String!) {
    schedule(date: $date, provider_id: $provider) {
      ...AppointmentFields
    }
  }
`);
export const DaysQuery = graphql(`
  query Days($from: Date, $to: Date, $provider: String!) {
    days(from: $from, to: $to, provider_id: $provider) {
      date
      visits
      open
      failed
      marker
    }
  }
`);
export const BriefQuery = graphql(`
  query Brief($provider: String!) {
    brief(provider_id: $provider) {
      spoken
      sentence {
        text
        emphasis
        kind
      }
      suggestions
      date
      from_yesterday {
        ...OpenItemFields
      }
      pending_followups {
        encounter_id
        followup_id
        kind
        reason
        title
        patient_id
        patient_name
        appointment_id
      }
      heads_up {
        text
        appointment_id
        patient_id
        patient_name
        time
      }
      new_since_yesterday {
        kind
        text
        at
        patient_name
        mock
        patient_id
        appointment_id
        client_id
        document_id
        detail
      }
    }
  }
`);
export const EndOfDayQuery = graphql(`
  query EndOfDay($date: Date, $provider: String!) {
    end_of_day(date: $date, provider_id: $provider) {
      spoken
      visits_seen
      rechecks_booked
      recheck_links_sent
      recheck_links_booked
      left_to_do {
        ...OpenItemFields
      }
      done_today {
        text
        encounter_id
      }
      waiting_on_owners {
        ...WaitingFields
      }
      tomorrow {
        date
        visits
        first
        last
        prepare {
          text
          appointment_id
          patient_name
        }
      }
    }
  }
`);
export const PreRoomCardQuery = graphql(`
  query PreRoomCard($id: String!) {
    pre_room_card(appointment_id: $id) {
      spoken
      take
      last_note {
        date
        by
        other_vet
        gist
      }
      promised
      medications
      remember_items {
        ...RememberFields
      }
      why
      prep
      owner_message {
        who
        text
        at
      }
      last_visit_on
      weight
      walk_in {
        date
        kind
        who
        mine
        text
        items {
          text
          status
          note
          checked
        }
      }
      can_do_today
    }
  }
`);
export const NotesToSignQuery = graphql(`
  query NotesToSign($provider: String!) {
    notes_to_sign(provider_id: $provider) {
      encounter_id
      appointment_id
      patient_id
      patient_name
      owner_name
      client_id
      provider_id
      provider_name
      date
      time
      visit_reason
      assessment
      status
      bucket
      to_confirm
      followups_undecided
      reason
      waiting_days
    }
  }
`);
export const VoiceProfileQuery = graphql(`
  query VoiceProfile($id: String!) {
    voice_profile(provider_id: $id) {
      source
      notes_used
    }
  }
`);
export const PreviousNotesQuery = graphql(`
  query PreviousNotes($id: String!) {
    patient_notes(patient_id: $id) {
      id
      date
      provider_id
      provider_name
      text
      source
      sections {
        label
        text
      }
    }
  }
`);
export const SampleTranscriptQuery = graphql(`
  query SampleTranscript($appointment: String!) {
    sample_transcript(appointment_id: $appointment)
  }
`);
export const SearchQuery = graphql(`
  query Search($q: String!) {
    search(q: $q) {
      pets {
        id
        name
        species
        breed
        age
        client_id
        owner_name
        last_visit {
          ...LastVisitFields
        }
        next_visit {
          date
          time
          appointment_id
        }
      }
      owners {
        id
        name
        phone
        email
        pets
      }
    }
  }
`);
export const AssistLinkFragment = graphql(`
  fragment AssistLinkFields on AssistLink {
    label
    to
    appointment_id
    encounter_id
    date
    patient_id
    client_id
    document_id
  }
`);
export const AskMutation = graphql(`
  mutation Ask($input: AssistantInput!) {
    ask_assistant(input: $input) {
      reply
      tools_used
      links {
        ...AssistLinkFields
      }
      sources {
        ...AssistLinkFields
      }
      followups
    }
  }
`);
export const AssistantTurnSubscription = graphql(`
  subscription AssistantTurn($id: String!) {
    assistant_turn(turn_id: $id) {
      kind
      text
    }
  }
`);

// ----- the patient record -----
export const PatientVisitsQuery = graphql(`
  query PatientVisits($id: String!, $related: String!) {
    patient_visits(patient_id: $id, related_to: $related) {
      id
      date
      appointment_id
      type
      kind
      reason
      provider_name
      summary
      related
      note
      sections {
        label
        text
      }
      medications
      photos {
        id
        caption
        url
      }
    }
  }
`);
export const PatientProfileQuery = graphql(`
  query PatientProfile($id: String!) {
    patient_profile(patient_id: $id) {
      mock
      patient {
        id
        name
        species
        breed
        age
        sex
        alerts
        color
        microchip
      }
      weight {
        latest {
          date
          value
          unit
        }
        previous {
          date
          value
          unit
        }
        history {
          date
          value
          unit
          note
        }
      }
      reminders_due {
        patient_id
        patient_name
        text
        due
      }
      client {
        ...ClientCardFields
      }
      other_pets {
        id
        name
        species
        breed
        age
        sex
        alerts
        last_visit {
          ...LastVisitFields
        }
        due
      }
    }
  }
`);
export const InvoicesQuery = graphql(`
  query Invoices($id: String!) {
    client_invoices(client_id: $id) {
      balance
      last_12_months
      last_payment
      counts
      mock
      invoices {
        id
        date
        patient_id
        patient_name
        visit
        provider_name
        total
        status
        paid_by
        items {
          name
          qty
          price
        }
      }
    }
  }
`);
export const HouseholdQuery = graphql(`
  query Household($id: String!) {
    client_household(client_id: $id) {
      balance
      book_url
      spend_12m
      mock
      client {
        ...ClientCardFields
      }
      pets {
        id
        name
        species
        breed
        age
        sex
        alerts
        due
        next_due {
          text
          due
          state
        }
        tags
        alert_tags
        spend_12m
        last_visit {
          ...LastVisitFields
        }
        today {
          appointment_id
          time
          reason
          visit_status
          encounter_id
        }
      }
      coming_up {
        date
        text
        patient_name
      }
      messages {
        at
        direction
        text
      }
      remember {
        ...RememberFields
      }
    }
  }
`);
export const DocumentsQuery = graphql(`
  query Documents($id: String!) {
    patient_documents(patient_id: $id) {
      ...DocumentFields
    }
  }
`);
export const ClientRememberQuery = graphql(`
  query ClientRemember($id: String!) {
    client_remember(client_id: $id) {
      ...RememberFields
    }
  }
`);
export const ForgetMutation = graphql(`
  mutation Forget($client: String!, $item: String!) {
    forget_remember(client_id: $client, item_id: $item)
  }
`);

// ----- a visit -----
export const EncounterQuery = graphql(`
  query Encounter($id: String!) {
    encounter(encounter_id: $id) {
      ...EncounterFields
    }
  }
`);
export const GroupQuery = graphql(`
  query Group($group: String!) {
    encounters(group_id: $group) {
      ...EncounterFields
    }
  }
`);
export const StartEncounterMutation = graphql(`
  mutation StartEncounter($input: NewEncounterInput!) {
    start_encounter(input: $input) {
      ...EncounterFields
    }
  }
`);
export const AddTranscriptMutation = graphql(`
  mutation AddTranscript($id: String!, $text: String!, $append: Boolean!) {
    add_transcript(encounter_id: $id, text: $text, append: $append) {
      ...EncounterFields
    }
  }
`);
export const DraftNoteMutation = graphql(`
  mutation DraftNote($id: String!) {
    draft_note(encounter_id: $id) {
      ...EncounterFields
    }
  }
`);
export const DraftProgressSubscription = graphql(`
  subscription DraftProgress($id: String!) {
    draft_progress(encounter_id: $id) {
      run_id
      step
      state
      detail
      patient_name
    }
  }
`);
export const UpdatePhotoMutation = graphql(`
  mutation UpdatePhoto($id: String!, $photo: String!, $input: PhotoEditInput!) {
    update_photo(encounter_id: $id, photo_id: $photo, input: $input) {
      ...EncounterFields
    }
  }
`);
export const DeletePhotoMutation = graphql(`
  mutation DeletePhoto($id: String!, $photo: String!) {
    delete_photo(encounter_id: $id, photo_id: $photo) {
      ...EncounterFields
    }
  }
`);
export const RestorePhotoMutation = graphql(`
  mutation RestorePhoto($id: String!, $photo: String!) {
    restore_photo(encounter_id: $id, photo_id: $photo) {
      ...EncounterFields
    }
  }
`);
export const SaveNoteMutation = graphql(`
  mutation SaveNote($id: String!, $note: SoapNoteInput!) {
    save_note(encounter_id: $id, note: $note) {
      ...EncounterFields
    }
  }
`);
export const NoteTypesQuery = graphql(`
  query NoteTypes {
    note_types {
      id
      name
      sections {
        key
        label
      }
    }
  }
`);
export const SetNoteTypeMutation = graphql(`
  mutation SetNoteType($id: String!, $type: String!) {
    set_note_type(encounter_id: $id, note_type: $type) {
      ...EncounterFields
    }
  }
`);
export const AssistMutation = graphql(`
  mutation Assist($id: String!, $input: AssistInput!) {
    assist(encounter_id: $id, input: $input) {
      suggestion
      refused
      mock
      unsourced
      sources {
        sentence
        lines
        text
      }
    }
  }
`);
export const TemplatesQuery = graphql(`
  query Templates($type: String!) {
    templates(note_type: $type) {
      id
      name
      shortcut
      text
      note_type
      owner
    }
  }
`);
export const FollowUpMutation = graphql(`
  mutation FollowUp($id: String!, $followup: String!, $input: FollowUpActionInput!) {
    act_on_followup(encounter_id: $id, followup_id: $followup, input: $input) {
      ...EncounterFields
    }
  }
`);
export const AddPetToVisitMutation = graphql(`
  mutation AddPetToVisit($id: String!, $patient: String!) {
    add_pet_to_visit(encounter_id: $id, patient_id: $patient) {
      ...EncounterFields
    }
  }
`);
export const SetPlanChecksMutation = graphql(`
  mutation SetPlanChecks($appointment: String!, $patient: String!, $lines: [String!]!) {
    set_plan_checks(appointment_id: $appointment, patient_id: $patient, lines: $lines)
  }
`);
export const PlanReminderMutation = graphql(`
  mutation PlanReminder($id: String!, $reminder: String!, $action: String!) {
    act_on_plan_reminder(encounter_id: $id, reminder_id: $reminder, action: $action) {
      ...EncounterFields
    }
  }
`);
export const WaitingLinksQuery = graphql(`
  query WaitingLinks {
    waiting_followups {
      ...WaitingFields
    }
  }
`);
export const ResendLinkMutation = graphql(`
  mutation ResendLink($followup: String!) {
    resend_booking_link(followup_id: $followup) {
      ...WaitingFields
    }
  }
`);
export const RememberSuggestionsQuery = graphql(`
  query RememberSuggestions($id: String!) {
    remember_suggestions(encounter_id: $id) {
      left_out
      mock
      suggestions {
        id
        text
        kind
        date
        transcript_lines
        said_by
        kept
      }
    }
  }
`);
export const KeepRememberMutation = graphql(`
  mutation KeepRemember($id: String!, $keep: [String!]!) {
    keep_remember(encounter_id: $id, keep: $keep) {
      ...RememberFields
    }
  }
`);
export const SignNoteMutation = graphql(`
  mutation SignNote($id: String!, $by: String!, $send: Boolean!) {
    sign_note(encounter_id: $id, signed_by: $by, send: $send) {
      encounter {
        ...EncounterFields
      }
    }
  }
`);
export const OwnerSummaryQuery = graphql(`
  query OwnerSummary($id: String!, $lang: String!) {
    owner_summary(encounter_id: $id, lang: $lang) {
      language
      when_to_call
      translated
      mock
      clinic {
        name
        address
        phone
        logo_url
      }
      visit {
        date
        start
        when
        provider_name
      }
      owner_name
      pets {
        patient_id
        name
        species
        breed
        sex
        age
        age_text
        for_owner
        medicines
        home_care
        next_visit {
          kind
          text
          url
        }
      }
    }
  }
`);
export const ShareMutation = graphql(`
  mutation Share($id: String!, $channel: String!, $lang: String!) {
    share_summary(encounter_id: $id, channel: $channel, language: $lang) {
      channel
      language
      status
      detail
      text
      url
      expires_at
      translated
    }
  }
`);

// ----- your account -----
export const SetTwoFactorMutation = graphql(`
  mutation SetTwoFactor($enabled: Boolean!) {
    set_two_factor(enabled: $enabled) {
      ...UserFields
    }
  }
`);
export const ConnectOAuthMutation = graphql(`
  mutation ConnectOAuth($provider: String!, $current: String!) {
    connect_oauth_account(provider: $provider, current_password: $current)
  }
`);
export const SignOutEverywhereMutation = graphql(`
  mutation SignOutEverywhere {
    sign_out_everywhere
  }
`);
export const SignOutOthersMutation = graphql(`
  mutation SignOutOthers {
    sign_out_other_sessions
  }
`);
export const UpdateMyProfileMutation = graphql(`
  mutation UpdateMyProfile($name: String, $email: String, $current: String!) {
    update_my_profile(name: $name, email: $email, current_password: $current) {
      ...UserFields
    }
  }
`);
export const ChangePasswordMutation = graphql(`
  mutation ChangePassword($next: String!, $current: String!) {
    change_password(new_password: $next, current_password: $current)
  }
`);
export const ConnectedAccountsQuery = graphql(`
  query ConnectedAccounts {
    my_connected_accounts {
      provider
      email
      connected_at
    }
  }
`);
export const DisconnectAccountMutation = graphql(`
  mutation DisconnectAccount($provider: String!, $current: String!) {
    disconnect_oauth_account(provider: $provider, current_password: $current)
  }
`);

// Letters from the clinic (Documents, sent).
export const LetterFieldsFragment = graphql(`
  fragment LetterFields on Letter {
    id
    patient_id
    patient_name
    encounter_id
    kind
    recipient {
      name
      clinic
      email
    }
    reason
    urgency
    attachments {
      note_encounter_ids
      photos {
        encounter_id
        photo_id
      }
      document_ids
      invoice_ids
    }
    body
    owner_consent
    status
    drafted
    created_at
    updated_at
    signed_by
    signer_title
    signed_at
    sent_to
    opened_at
    sent {
      channel
      to_masked
      at
      status
      detail
    }
    pdf_url
  }
`);
export const LettersQuery = graphql(`
  query Letters($patient: String!) {
    letters(patient_id: $patient) {
      ...LetterFields
    }
  }
`);
export const LetterQuery = graphql(`
  query Letter($id: String!) {
    letter(id: $id) {
      ...LetterFields
    }
  }
`);
export const ContactsQuery = graphql(`
  query Contacts($q: String!) {
    contacts(q: $q) {
      name
      clinic
      email
    }
  }
`);
export const CreateLetterMutation = graphql(`
  mutation CreateLetter($patient: String!, $encounter: String!, $input: LetterInput, $draft: Boolean!) {
    create_letter(patient_id: $patient, encounter_id: $encounter, input: $input, draft: $draft) {
      ...LetterFields
    }
  }
`);
export const DraftLetterMutation = graphql(`
  mutation DraftLetter($id: String!) {
    draft_letter(id: $id) {
      ...LetterFields
    }
  }
`);
export const UpdateLetterMutation = graphql(`
  mutation UpdateLetter($id: String!, $input: LetterInput!) {
    update_letter(id: $id, input: $input) {
      ...LetterFields
    }
  }
`);
export const SendLetterMutation = graphql(`
  mutation SendLetter($id: String!, $channels: [String!]!, $to: String!, $ownerCopy: Boolean!) {
    send_letter(id: $id, channels: $channels, to_email: $to, owner_copy: $ownerCopy) {
      letter {
        ...LetterFields
      }
      results {
        channel
        status
        detail
        to
        subject
        body
        text
        url
        pdf_url
        expires_at
      }
    }
  }
`);
export const DeleteLetterMutation = graphql(`
  mutation DeleteLetter($id: String!) {
    delete_letter(id: $id)
  }
`);
export const SpeechOptionsQuery = graphql(`
  query SpeechOptions {
    speech_options {
      available
      default_voice
      voices {
        id
        name
        language
        gender
      }
    }
  }
`);
export const StartAuthenticatorMutation = graphql(`
  mutation StartAuthenticator($current: String!) {
    start_authenticator(current_password: $current) {
      secret
      otpauth_uri
    }
  }
`);
export const ConfirmAuthenticatorMutation = graphql(`
  mutation ConfirmAuthenticator($code: String!) {
    confirm_authenticator(code: $code) {
      ...UserFields
    }
  }
`);
export const RemoveAuthenticatorMutation = graphql(`
  mutation RemoveAuthenticator($current: String!) {
    remove_authenticator(current_password: $current) {
      ...UserFields
    }
  }
`);
export const DoctorsQuery = graphql(`
  query Doctors {
    doctors {
      id
      name
    }
  }
`);
export const SetUserTwoFactorMutation = graphql(`
  mutation SetUserTwoFactor($id: String!, $required: Boolean!) {
    set_user_two_factor(user_id: $id, required: $required) {
      ...UserFields
    }
  }
`);
export const LetterheadQuery = graphql(`
  query Letterhead {
    letterhead {
      name
      address
      phone
      logo_url
      pims_name
    }
  }
`);
export const NameSpeakerMutation = graphql(`
  mutation NameSpeaker($id: String!, $speaker: String!, $role: String!, $name: String!) {
    name_speaker(encounter_id: $id, speaker_id: $speaker, role: $role, name: $name) {
      ...EncounterFields
    }
  }
`);
export const MarkPrescriptionEnteredMutation = graphql(`
  mutation MarkPrescriptionEntered($id: String!) {
    mark_prescription_entered(encounter_id: $id) {
      ...EncounterFields
    }
  }
`);
export const SendToPimsMutation = graphql(`
  mutation SendToPims($id: String!) {
    send_to_pims(encounter_id: $id) {
      ok
      status
      detail
      pims_id
    }
  }
`);
export const SignPreviewQuery = graphql(`
  query SignPreview($id: String!) {
    sign_preview(encounter_id: $id) {
      pims_name
      patient {
        name
        pims_id
      }
      owner {
        name
        pims_id
      }
      appointment {
        id
        start
        patient_name
        owner_name
      }
      matches
      mismatch
      note
      photos
      prescription
      texts {
        followup_id
        kind
        reason
        message
      }
    }
  }
`);
export const RecordPanelQuery = graphql(`
  query RecordPanel($id: String!) {
    record_panel(patient_id: $id) {
      patient {
        id
        name
        species
        breed
        age
        sex
        alerts
      }
      pims_patient_id
      pims_client_id
      weight {
        latest {
          date
          value
          unit
        }
        previous {
          date
          value
          unit
        }
        history {
          date
          value
          unit
        }
      }
      reminders_due {
        patient_id
        text
        due
      }
      recent_visits {
        id
        date
        kind
        type
        reason
        provider_name
      }
      client {
        id
        name
        first_name
        last_name
        phones
        emails
        prefers
      }
      other_pets {
        id
        name
      }
      mock
    }
  }
`);
