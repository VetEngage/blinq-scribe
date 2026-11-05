/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment UserFields on User {\n    id\n    username\n    name\n    email\n    provider_id\n    role\n    active\n    has_password\n    two_factor\n    two_factor_required\n    authenticator\n    created_at\n  }\n": typeof types.UserFieldsFragmentDoc,
    "\n  fragment AppointmentFields on Appointment {\n    id\n    start\n    duration_min\n    reason\n    type\n    status\n    provider_id\n    provider_name\n    room\n    visit_status\n    audio_live\n    encounter_id\n    note_type\n    started_at\n    demo_clock\n    checked_in_at\n    synced_at\n    pets {\n      reason\n      visit_status\n      encounter_id\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        alerts\n        alert_chips {\n          text\n          short\n        }\n        sex\n        client_id\n        pims_notes\n        last_visit {\n          date\n          reason\n        }\n        weight {\n          value\n          unit\n        }\n      }\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    patient {\n      id\n      name\n      species\n      breed\n      age\n      alerts\n      alert_chips {\n        text\n        short\n      }\n      sex\n      color\n      microchip\n      client_id\n      pims_notes\n      last_visit {\n        date\n        reason\n      }\n      weight {\n        value\n        unit\n      }\n    }\n    client {\n      id\n      first_name\n      last_name\n      phones\n      emails\n      prefers\n      reminders\n      client_since\n    }\n  }\n": typeof types.AppointmentFieldsFragmentDoc,
    "\n  fragment SlotFields on Slot {\n    start\n    end\n    provider_id\n  }\n": typeof types.SlotFieldsFragmentDoc,
    "\n  fragment WriteBackFields on WriteBackResult {\n    ok\n    status\n    detail\n    pims_id\n    start\n    at\n  }\n": typeof types.WriteBackFieldsFragmentDoc,
    "\n  fragment EncounterFields on Encounter {\n    id\n    consent_recorded\n    appointment_id\n    patient_id\n    provider_id\n    provider_name\n    source\n    status\n    transcript\n    segments {\n      id\n      line\n      speaker_id\n      speaker_name\n      role\n      offset_seconds\n      text\n      pets\n      pet_sure\n    }\n    parts_received\n    last_part\n    first_part_at\n    last_part_at\n    audio_seconds\n    created_at\n    signed_at\n    signed_by\n    patient_ids\n    patient_name\n    client_id\n    owner_name\n    note_type\n    group_id\n    view\n    hidden\n    pims_items {\n      kind\n      id\n      label\n      status\n      synced_at\n      pims_id\n      detail\n    }\n    pims_next_try_at\n    prescription_task {\n      text\n      medications\n      done_by\n      done_at\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    note {\n      subjective\n      objective\n      assessment\n      plan\n      client_summary\n      vitals\n      medications\n      vitals_by\n    }\n    followups {\n      id\n      kind\n      reason\n      title\n      suggest_letter\n      due_in_days\n      message_draft\n      status\n      booking_mode\n      suggested_slots {\n        ...SlotFields\n      }\n      sms {\n        status\n        detail\n        text\n        to_masked\n      }\n      booked_slot {\n        ...SlotFields\n      }\n      booking {\n        ...WriteBackFields\n      }\n      booking_link {\n        url\n        from\n        to\n        expires_at\n        status\n        sent_at\n        booked_start\n        pets\n      }\n      remind_unbooked\n      reminder {\n        status\n        detail\n        text\n        at\n      }\n    }\n    photos {\n      id\n      label\n      caption\n      findings\n      segments\n      rotation\n      in_note\n      show_owner\n      outline {\n        label\n        box\n        polygon\n      }\n      crop {\n        x\n        y\n        w\n        h\n      }\n    }\n    write_back {\n      ...WriteBackFields\n    }\n    plan_reminders {\n      id\n      text\n      status\n    }\n  }\n": typeof types.EncounterFieldsFragmentDoc,
    "\n  fragment OpenItemFields on OpenItem {\n    kind\n    text\n    owner_name\n    encounter_id\n    appointment_id\n    date\n    patient_name\n    followup_id\n    followup_kind\n    reason\n    title\n    label\n    patient_id\n    client_id\n    detail\n  }\n": typeof types.OpenItemFieldsFragmentDoc,
    "\n  fragment WaitingFields on WaitingLink {\n    encounter_id\n    followup_id\n    patient_id\n    patient_name\n    owner_name\n    reason\n    title\n    url\n    sent_at\n    days_waiting\n    status\n    pets\n  }\n": typeof types.WaitingFieldsFragmentDoc,
    "\n  fragment LastVisitFields on LastVisit {\n    date\n    reason\n    type\n  }\n": typeof types.LastVisitFieldsFragmentDoc,
    "\n  fragment ClientCardFields on ClientCard {\n    id\n    name\n    first_name\n    last_name\n    phones\n    emails\n    prefers\n    reminders\n    client_since\n    latest_message {\n      at\n      text\n    }\n  }\n": typeof types.ClientCardFieldsFragmentDoc,
    "\n  fragment RememberFields on RememberItem {\n    id\n    client_id\n    patient_id\n    patient_name\n    text\n    kind\n    date\n    said_at\n    encounter_id\n    expires_at\n    kept_by\n    said_by\n  }\n": typeof types.RememberFieldsFragmentDoc,
    "\n  fragment DocumentFields on Document {\n    id\n    name\n    uploaded_at\n    pages\n    content_type\n    key_points {\n      text\n      page\n    }\n    mock\n  }\n": typeof types.DocumentFieldsFragmentDoc,
    "\n  fragment SignInPayloadFields on SignInPayload {\n    token\n    two_factor_required\n    ticket\n    two_factor_method\n    email_hint\n  }\n": typeof types.SignInPayloadFieldsFragmentDoc,
    "\n  query AuthStatus {\n    auth_status {\n      login_required\n      options {\n        password\n        google\n        microsoft\n        demo\n        password_reset\n      }\n    }\n  }\n": typeof types.AuthStatusDocument,
    "\n  query Me {\n    me {\n      via\n      admin\n      role\n      provider_id\n      permissions\n      user {\n        ...UserFields\n      }\n    }\n  }\n": typeof types.MeDocument,
    "\n  mutation SignIn($login: String!, $password: String!, $remember: Boolean!) {\n    sign_in(login: $login, password: $password, remember: $remember) {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.SignInDocument,
    "\n  mutation VerifyCode($ticket: String!, $code: String!) {\n    verify_sign_in_code(ticket: $ticket, code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.VerifyCodeDocument,
    "\n  mutation ResendCode($ticket: String!) {\n    resend_sign_in_code(ticket: $ticket) {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.ResendCodeDocument,
    "\n  mutation StartOAuth($provider: String!, $remember: Boolean!) {\n    start_oauth_sign_in(provider: $provider, remember: $remember)\n  }\n": typeof types.StartOAuthDocument,
    "\n  mutation FinishOAuth($code: String!) {\n    finish_oauth_sign_in(code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.FinishOAuthDocument,
    "\n  mutation FinishOAuthLink($code: String!) {\n    finish_oauth_link(code: $code) {\n      ...UserFields\n    }\n  }\n": typeof types.FinishOAuthLinkDocument,
    "\n  mutation DemoSignIn {\n    try_demo_clinic {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.DemoSignInDocument,
    "\n  mutation RequestReset($email: String!) {\n    request_password_reset(email: $email)\n  }\n": typeof types.RequestResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    reset_password(token: $token, password: $password)\n  }\n": typeof types.ResetPasswordDocument,
    "\n  query InviteInfo($token: String!) {\n    invite_info(token: $token) {\n      name\n      username\n    }\n  }\n": typeof types.InviteInfoDocument,
    "\n  mutation AcceptInvite($token: String!, $password: String!) {\n    accept_invite(token: $token, password: $password) {\n      ...SignInPayloadFields\n    }\n  }\n": typeof types.AcceptInviteDocument,
    "\n    mutation SignOut {\n      sign_out\n    }\n  ": typeof types.SignOutDocument,
    "\n  query Team {\n    users {\n      ...UserFields\n    }\n    providers {\n      id\n      name\n      linked_to\n    }\n  }\n": typeof types.TeamDocument,
    "\n  mutation InviteUser($input: NewUserInput!) {\n    invite_user(input: $input) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n": typeof types.InviteUserDocument,
    "\n  mutation ReinviteUser($id: String!) {\n    reinvite_user(user_id: $id) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n": typeof types.ReinviteUserDocument,
    "\n  mutation UpdateUser($id: String!, $input: UserUpdateInput!) {\n    update_user(user_id: $id, input: $input) {\n      ...UserFields\n    }\n  }\n": typeof types.UpdateUserDocument,
    "\n  query Schedule($date: Date, $provider: String!) {\n    schedule(date: $date, provider_id: $provider) {\n      ...AppointmentFields\n    }\n  }\n": typeof types.ScheduleDocument,
    "\n  query Days($from: Date, $to: Date, $provider: String!) {\n    days(from: $from, to: $to, provider_id: $provider) {\n      date\n      visits\n      open\n      failed\n      marker\n    }\n  }\n": typeof types.DaysDocument,
    "\n  query Brief($provider: String!) {\n    brief(provider_id: $provider) {\n      spoken\n      sentence {\n        text\n        emphasis\n        kind\n      }\n      suggestions\n      date\n      from_yesterday {\n        ...OpenItemFields\n      }\n      pending_followups {\n        encounter_id\n        followup_id\n        kind\n        reason\n        title\n        patient_id\n        patient_name\n        appointment_id\n      }\n      heads_up {\n        text\n        appointment_id\n        patient_id\n        patient_name\n        time\n      }\n      new_since_yesterday {\n        kind\n        text\n        at\n        patient_name\n        mock\n        patient_id\n        appointment_id\n        client_id\n        document_id\n        detail\n      }\n    }\n  }\n": typeof types.BriefDocument,
    "\n  query EndOfDay($date: Date, $provider: String!) {\n    end_of_day(date: $date, provider_id: $provider) {\n      spoken\n      visits_seen\n      rechecks_booked\n      recheck_links_sent\n      recheck_links_booked\n      left_to_do {\n        ...OpenItemFields\n      }\n      done_today {\n        text\n        encounter_id\n      }\n      waiting_on_owners {\n        ...WaitingFields\n      }\n      tomorrow {\n        date\n        visits\n        first\n        last\n        prepare {\n          text\n          appointment_id\n          patient_name\n        }\n      }\n    }\n  }\n": typeof types.EndOfDayDocument,
    "\n  query PreRoomCard($id: String!) {\n    pre_room_card(appointment_id: $id) {\n      spoken\n      take\n      last_note {\n        date\n        by\n        other_vet\n        gist\n      }\n      promised\n      medications\n      remember_items {\n        ...RememberFields\n      }\n      why\n      prep\n      owner_message {\n        who\n        text\n        at\n      }\n      last_visit_on\n      weight\n      walk_in {\n        date\n        kind\n        who\n        mine\n        text\n        items {\n          text\n          status\n          note\n          checked\n        }\n      }\n      can_do_today\n    }\n  }\n": typeof types.PreRoomCardDocument,
    "\n  query NotesToSign($provider: String!) {\n    notes_to_sign(provider_id: $provider) {\n      encounter_id\n      appointment_id\n      patient_id\n      patient_name\n      owner_name\n      client_id\n      provider_id\n      provider_name\n      date\n      time\n      visit_reason\n      assessment\n      status\n      bucket\n      to_confirm\n      followups_undecided\n      reason\n      waiting_days\n    }\n  }\n": typeof types.NotesToSignDocument,
    "\n  query VoiceProfile($id: String!) {\n    voice_profile(provider_id: $id) {\n      source\n      notes_used\n    }\n  }\n": typeof types.VoiceProfileDocument,
    "\n  query PreviousNotes($id: String!) {\n    patient_notes(patient_id: $id) {\n      id\n      date\n      provider_id\n      provider_name\n      text\n      source\n      sections {\n        label\n        text\n      }\n    }\n  }\n": typeof types.PreviousNotesDocument,
    "\n  query SampleTranscript($appointment: String!) {\n    sample_transcript(appointment_id: $appointment)\n  }\n": typeof types.SampleTranscriptDocument,
    "\n  query Search($q: String!) {\n    search(q: $q) {\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        client_id\n        owner_name\n        last_visit {\n          ...LastVisitFields\n        }\n        next_visit {\n          date\n          time\n          appointment_id\n        }\n      }\n      owners {\n        id\n        name\n        phone\n        email\n        pets\n      }\n    }\n  }\n": typeof types.SearchDocument,
    "\n  fragment AssistLinkFields on AssistLink {\n    label\n    to\n    appointment_id\n    encounter_id\n    date\n    patient_id\n    client_id\n    document_id\n  }\n": typeof types.AssistLinkFieldsFragmentDoc,
    "\n  mutation Ask($input: AssistantInput!) {\n    ask_assistant(input: $input) {\n      reply\n      tools_used\n      links {\n        ...AssistLinkFields\n      }\n      sources {\n        ...AssistLinkFields\n      }\n      followups\n    }\n  }\n": typeof types.AskDocument,
    "\n  subscription AssistantTurn($id: String!) {\n    assistant_turn(turn_id: $id) {\n      kind\n      text\n    }\n  }\n": typeof types.AssistantTurnDocument,
    "\n  query PatientVisits($id: String!, $related: String!) {\n    patient_visits(patient_id: $id, related_to: $related) {\n      id\n      date\n      appointment_id\n      type\n      kind\n      reason\n      provider_name\n      summary\n      related\n      note\n      sections {\n        label\n        text\n      }\n      medications\n      photos {\n        id\n        caption\n        url\n      }\n    }\n  }\n": typeof types.PatientVisitsDocument,
    "\n  query PatientProfile($id: String!) {\n    patient_profile(patient_id: $id) {\n      mock\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        color\n        microchip\n      }\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n          note\n        }\n      }\n      reminders_due {\n        patient_id\n        patient_name\n        text\n        due\n      }\n      client {\n        ...ClientCardFields\n      }\n      other_pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        last_visit {\n          ...LastVisitFields\n        }\n        due\n      }\n    }\n  }\n": typeof types.PatientProfileDocument,
    "\n  query Invoices($id: String!) {\n    client_invoices(client_id: $id) {\n      balance\n      last_12_months\n      last_payment\n      counts\n      mock\n      invoices {\n        id\n        date\n        patient_id\n        patient_name\n        visit\n        provider_name\n        total\n        status\n        paid_by\n        items {\n          name\n          qty\n          price\n        }\n      }\n    }\n  }\n": typeof types.InvoicesDocument,
    "\n  query Household($id: String!) {\n    client_household(client_id: $id) {\n      balance\n      book_url\n      spend_12m\n      mock\n      client {\n        ...ClientCardFields\n      }\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        due\n        next_due {\n          text\n          due\n          state\n        }\n        tags\n        alert_tags\n        spend_12m\n        last_visit {\n          ...LastVisitFields\n        }\n        today {\n          appointment_id\n          time\n          reason\n          visit_status\n          encounter_id\n        }\n      }\n      coming_up {\n        date\n        text\n        patient_name\n      }\n      messages {\n        at\n        direction\n        text\n      }\n      remember {\n        ...RememberFields\n      }\n    }\n  }\n": typeof types.HouseholdDocument,
    "\n  query Documents($id: String!) {\n    patient_documents(patient_id: $id) {\n      ...DocumentFields\n    }\n  }\n": typeof types.DocumentsDocument,
    "\n  query ClientRemember($id: String!) {\n    client_remember(client_id: $id) {\n      ...RememberFields\n    }\n  }\n": typeof types.ClientRememberDocument,
    "\n  mutation Forget($client: String!, $item: String!) {\n    forget_remember(client_id: $client, item_id: $item)\n  }\n": typeof types.ForgetDocument,
    "\n  query Encounter($id: String!) {\n    encounter(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": typeof types.EncounterDocument,
    "\n  query Group($group: String!) {\n    encounters(group_id: $group) {\n      ...EncounterFields\n    }\n  }\n": typeof types.GroupDocument,
    "\n  mutation StartEncounter($input: NewEncounterInput!) {\n    start_encounter(input: $input) {\n      ...EncounterFields\n    }\n  }\n": typeof types.StartEncounterDocument,
    "\n  mutation AddTranscript($id: String!, $text: String!, $append: Boolean!) {\n    add_transcript(encounter_id: $id, text: $text, append: $append) {\n      ...EncounterFields\n    }\n  }\n": typeof types.AddTranscriptDocument,
    "\n  mutation DraftNote($id: String!) {\n    draft_note(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": typeof types.DraftNoteDocument,
    "\n  subscription DraftProgress($id: String!) {\n    draft_progress(encounter_id: $id) {\n      run_id\n      step\n      state\n      detail\n      patient_name\n    }\n  }\n": typeof types.DraftProgressDocument,
    "\n  mutation UpdatePhoto($id: String!, $photo: String!, $input: PhotoEditInput!) {\n    update_photo(encounter_id: $id, photo_id: $photo, input: $input) {\n      ...EncounterFields\n    }\n  }\n": typeof types.UpdatePhotoDocument,
    "\n  mutation DeletePhoto($id: String!, $photo: String!) {\n    delete_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n": typeof types.DeletePhotoDocument,
    "\n  mutation RestorePhoto($id: String!, $photo: String!) {\n    restore_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n": typeof types.RestorePhotoDocument,
    "\n  mutation SaveNote($id: String!, $note: SoapNoteInput!) {\n    save_note(encounter_id: $id, note: $note) {\n      ...EncounterFields\n    }\n  }\n": typeof types.SaveNoteDocument,
    "\n  query NoteTypes {\n    note_types {\n      id\n      name\n      sections {\n        key\n        label\n      }\n    }\n  }\n": typeof types.NoteTypesDocument,
    "\n  mutation SetNoteType($id: String!, $type: String!) {\n    set_note_type(encounter_id: $id, note_type: $type) {\n      ...EncounterFields\n    }\n  }\n": typeof types.SetNoteTypeDocument,
    "\n  mutation Assist($id: String!, $input: AssistInput!) {\n    assist(encounter_id: $id, input: $input) {\n      suggestion\n      refused\n      mock\n      unsourced\n      sources {\n        sentence\n        lines\n        text\n      }\n    }\n  }\n": typeof types.AssistDocument,
    "\n  query Templates($type: String!) {\n    templates(note_type: $type) {\n      id\n      name\n      shortcut\n      text\n      note_type\n      owner\n    }\n  }\n": typeof types.TemplatesDocument,
    "\n  mutation FollowUp($id: String!, $followup: String!, $input: FollowUpActionInput!) {\n    act_on_followup(encounter_id: $id, followup_id: $followup, input: $input) {\n      ...EncounterFields\n    }\n  }\n": typeof types.FollowUpDocument,
    "\n  mutation AddPetToVisit($id: String!, $patient: String!) {\n    add_pet_to_visit(encounter_id: $id, patient_id: $patient) {\n      ...EncounterFields\n    }\n  }\n": typeof types.AddPetToVisitDocument,
    "\n  mutation SetPlanChecks($appointment: String!, $patient: String!, $lines: [String!]!) {\n    set_plan_checks(appointment_id: $appointment, patient_id: $patient, lines: $lines)\n  }\n": typeof types.SetPlanChecksDocument,
    "\n  mutation PlanReminder($id: String!, $reminder: String!, $action: String!) {\n    act_on_plan_reminder(encounter_id: $id, reminder_id: $reminder, action: $action) {\n      ...EncounterFields\n    }\n  }\n": typeof types.PlanReminderDocument,
    "\n  query WaitingLinks {\n    waiting_followups {\n      ...WaitingFields\n    }\n  }\n": typeof types.WaitingLinksDocument,
    "\n  mutation ResendLink($followup: String!) {\n    resend_booking_link(followup_id: $followup) {\n      ...WaitingFields\n    }\n  }\n": typeof types.ResendLinkDocument,
    "\n  query RememberSuggestions($id: String!) {\n    remember_suggestions(encounter_id: $id) {\n      left_out\n      mock\n      suggestions {\n        id\n        text\n        kind\n        date\n        transcript_lines\n        said_by\n        kept\n      }\n    }\n  }\n": typeof types.RememberSuggestionsDocument,
    "\n  mutation KeepRemember($id: String!, $keep: [String!]!) {\n    keep_remember(encounter_id: $id, keep: $keep) {\n      ...RememberFields\n    }\n  }\n": typeof types.KeepRememberDocument,
    "\n  mutation SignNote($id: String!, $by: String!, $send: Boolean!) {\n    sign_note(encounter_id: $id, signed_by: $by, send: $send) {\n      encounter {\n        ...EncounterFields\n      }\n    }\n  }\n": typeof types.SignNoteDocument,
    "\n  query OwnerSummary($id: String!, $lang: String!) {\n    owner_summary(encounter_id: $id, lang: $lang) {\n      language\n      when_to_call\n      translated\n      mock\n      clinic {\n        name\n        address\n        phone\n        logo_url\n      }\n      visit {\n        date\n        start\n        when\n        provider_name\n      }\n      owner_name\n      pets {\n        patient_id\n        name\n        species\n        breed\n        sex\n        age\n        age_text\n        for_owner\n        medicines\n        home_care\n        next_visit {\n          kind\n          text\n          url\n        }\n      }\n    }\n  }\n": typeof types.OwnerSummaryDocument,
    "\n  mutation Share($id: String!, $channel: String!, $lang: String!) {\n    share_summary(encounter_id: $id, channel: $channel, language: $lang) {\n      channel\n      language\n      status\n      detail\n      text\n      url\n      expires_at\n      translated\n    }\n  }\n": typeof types.ShareDocument,
    "\n  mutation SetTwoFactor($enabled: Boolean!) {\n    set_two_factor(enabled: $enabled) {\n      ...UserFields\n    }\n  }\n": typeof types.SetTwoFactorDocument,
    "\n  mutation ConnectOAuth($provider: String!, $current: String!) {\n    connect_oauth_account(provider: $provider, current_password: $current)\n  }\n": typeof types.ConnectOAuthDocument,
    "\n  mutation SignOutEverywhere {\n    sign_out_everywhere\n  }\n": typeof types.SignOutEverywhereDocument,
    "\n  mutation SignOutOthers {\n    sign_out_other_sessions\n  }\n": typeof types.SignOutOthersDocument,
    "\n  mutation UpdateMyProfile($name: String, $email: String, $current: String!) {\n    update_my_profile(name: $name, email: $email, current_password: $current) {\n      ...UserFields\n    }\n  }\n": typeof types.UpdateMyProfileDocument,
    "\n  mutation ChangePassword($next: String!, $current: String!) {\n    change_password(new_password: $next, current_password: $current)\n  }\n": typeof types.ChangePasswordDocument,
    "\n  query ConnectedAccounts {\n    my_connected_accounts {\n      provider\n      email\n      connected_at\n    }\n  }\n": typeof types.ConnectedAccountsDocument,
    "\n  mutation DisconnectAccount($provider: String!, $current: String!) {\n    disconnect_oauth_account(provider: $provider, current_password: $current)\n  }\n": typeof types.DisconnectAccountDocument,
    "\n  fragment LetterFields on Letter {\n    id\n    patient_id\n    patient_name\n    encounter_id\n    kind\n    recipient {\n      name\n      clinic\n      email\n    }\n    reason\n    urgency\n    attachments {\n      note_encounter_ids\n      photos {\n        encounter_id\n        photo_id\n      }\n      document_ids\n      invoice_ids\n    }\n    body\n    owner_consent\n    status\n    drafted\n    created_at\n    updated_at\n    signed_by\n    signer_title\n    signed_at\n    sent_to\n    opened_at\n    sent {\n      channel\n      to_masked\n      at\n      status\n      detail\n    }\n    pdf_url\n  }\n": typeof types.LetterFieldsFragmentDoc,
    "\n  query Letters($patient: String!) {\n    letters(patient_id: $patient) {\n      ...LetterFields\n    }\n  }\n": typeof types.LettersDocument,
    "\n  query Letter($id: String!) {\n    letter(id: $id) {\n      ...LetterFields\n    }\n  }\n": typeof types.LetterDocument,
    "\n  query Contacts($q: String!) {\n    contacts(q: $q) {\n      name\n      clinic\n      email\n    }\n  }\n": typeof types.ContactsDocument,
    "\n  mutation CreateLetter($patient: String!, $encounter: String!, $input: LetterInput, $draft: Boolean!) {\n    create_letter(patient_id: $patient, encounter_id: $encounter, input: $input, draft: $draft) {\n      ...LetterFields\n    }\n  }\n": typeof types.CreateLetterDocument,
    "\n  mutation DraftLetter($id: String!) {\n    draft_letter(id: $id) {\n      ...LetterFields\n    }\n  }\n": typeof types.DraftLetterDocument,
    "\n  mutation UpdateLetter($id: String!, $input: LetterInput!) {\n    update_letter(id: $id, input: $input) {\n      ...LetterFields\n    }\n  }\n": typeof types.UpdateLetterDocument,
    "\n  mutation SendLetter($id: String!, $channels: [String!]!, $to: String!, $ownerCopy: Boolean!) {\n    send_letter(id: $id, channels: $channels, to_email: $to, owner_copy: $ownerCopy) {\n      letter {\n        ...LetterFields\n      }\n      results {\n        channel\n        status\n        detail\n        to\n        subject\n        body\n        text\n        url\n        pdf_url\n        expires_at\n      }\n    }\n  }\n": typeof types.SendLetterDocument,
    "\n  mutation DeleteLetter($id: String!) {\n    delete_letter(id: $id)\n  }\n": typeof types.DeleteLetterDocument,
    "\n  query SpeechOptions {\n    speech_options {\n      available\n      default_voice\n      voices {\n        id\n        name\n        language\n        gender\n      }\n    }\n  }\n": typeof types.SpeechOptionsDocument,
    "\n  mutation StartAuthenticator($current: String!) {\n    start_authenticator(current_password: $current) {\n      secret\n      otpauth_uri\n    }\n  }\n": typeof types.StartAuthenticatorDocument,
    "\n  mutation ConfirmAuthenticator($code: String!) {\n    confirm_authenticator(code: $code) {\n      ...UserFields\n    }\n  }\n": typeof types.ConfirmAuthenticatorDocument,
    "\n  mutation RemoveAuthenticator($current: String!) {\n    remove_authenticator(current_password: $current) {\n      ...UserFields\n    }\n  }\n": typeof types.RemoveAuthenticatorDocument,
    "\n  query Doctors {\n    doctors {\n      id\n      name\n    }\n  }\n": typeof types.DoctorsDocument,
    "\n  mutation SetUserTwoFactor($id: String!, $required: Boolean!) {\n    set_user_two_factor(user_id: $id, required: $required) {\n      ...UserFields\n    }\n  }\n": typeof types.SetUserTwoFactorDocument,
    "\n  query Letterhead {\n    letterhead {\n      name\n      address\n      phone\n      logo_url\n      pims_name\n    }\n  }\n": typeof types.LetterheadDocument,
    "\n  mutation NameSpeaker($id: String!, $speaker: String!, $role: String!, $name: String!) {\n    name_speaker(encounter_id: $id, speaker_id: $speaker, role: $role, name: $name) {\n      ...EncounterFields\n    }\n  }\n": typeof types.NameSpeakerDocument,
    "\n  mutation MarkPrescriptionEntered($id: String!) {\n    mark_prescription_entered(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": typeof types.MarkPrescriptionEnteredDocument,
    "\n  mutation SendToPims($id: String!) {\n    send_to_pims(encounter_id: $id) {\n      ok\n      status\n      detail\n      pims_id\n    }\n  }\n": typeof types.SendToPimsDocument,
    "\n  query SignPreview($id: String!) {\n    sign_preview(encounter_id: $id) {\n      pims_name\n      patient {\n        name\n        pims_id\n      }\n      owner {\n        name\n        pims_id\n      }\n      appointment {\n        id\n        start\n        patient_name\n        owner_name\n      }\n      matches\n      mismatch\n      note\n      photos\n      prescription\n      texts {\n        followup_id\n        kind\n        reason\n        message\n      }\n    }\n  }\n": typeof types.SignPreviewDocument,
    "\n  query RecordPanel($id: String!) {\n    record_panel(patient_id: $id) {\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n      }\n      pims_patient_id\n      pims_client_id\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n        }\n      }\n      reminders_due {\n        patient_id\n        text\n        due\n      }\n      recent_visits {\n        id\n        date\n        kind\n        type\n        reason\n        provider_name\n      }\n      client {\n        id\n        name\n        first_name\n        last_name\n        phones\n        emails\n        prefers\n      }\n      other_pets {\n        id\n        name\n      }\n      mock\n    }\n  }\n": typeof types.RecordPanelDocument,
};
const documents: Documents = {
    "\n  fragment UserFields on User {\n    id\n    username\n    name\n    email\n    provider_id\n    role\n    active\n    has_password\n    two_factor\n    two_factor_required\n    authenticator\n    created_at\n  }\n": types.UserFieldsFragmentDoc,
    "\n  fragment AppointmentFields on Appointment {\n    id\n    start\n    duration_min\n    reason\n    type\n    status\n    provider_id\n    provider_name\n    room\n    visit_status\n    audio_live\n    encounter_id\n    note_type\n    started_at\n    demo_clock\n    checked_in_at\n    synced_at\n    pets {\n      reason\n      visit_status\n      encounter_id\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        alerts\n        alert_chips {\n          text\n          short\n        }\n        sex\n        client_id\n        pims_notes\n        last_visit {\n          date\n          reason\n        }\n        weight {\n          value\n          unit\n        }\n      }\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    patient {\n      id\n      name\n      species\n      breed\n      age\n      alerts\n      alert_chips {\n        text\n        short\n      }\n      sex\n      color\n      microchip\n      client_id\n      pims_notes\n      last_visit {\n        date\n        reason\n      }\n      weight {\n        value\n        unit\n      }\n    }\n    client {\n      id\n      first_name\n      last_name\n      phones\n      emails\n      prefers\n      reminders\n      client_since\n    }\n  }\n": types.AppointmentFieldsFragmentDoc,
    "\n  fragment SlotFields on Slot {\n    start\n    end\n    provider_id\n  }\n": types.SlotFieldsFragmentDoc,
    "\n  fragment WriteBackFields on WriteBackResult {\n    ok\n    status\n    detail\n    pims_id\n    start\n    at\n  }\n": types.WriteBackFieldsFragmentDoc,
    "\n  fragment EncounterFields on Encounter {\n    id\n    consent_recorded\n    appointment_id\n    patient_id\n    provider_id\n    provider_name\n    source\n    status\n    transcript\n    segments {\n      id\n      line\n      speaker_id\n      speaker_name\n      role\n      offset_seconds\n      text\n      pets\n      pet_sure\n    }\n    parts_received\n    last_part\n    first_part_at\n    last_part_at\n    audio_seconds\n    created_at\n    signed_at\n    signed_by\n    patient_ids\n    patient_name\n    client_id\n    owner_name\n    note_type\n    group_id\n    view\n    hidden\n    pims_items {\n      kind\n      id\n      label\n      status\n      synced_at\n      pims_id\n      detail\n    }\n    pims_next_try_at\n    prescription_task {\n      text\n      medications\n      done_by\n      done_at\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    note {\n      subjective\n      objective\n      assessment\n      plan\n      client_summary\n      vitals\n      medications\n      vitals_by\n    }\n    followups {\n      id\n      kind\n      reason\n      title\n      suggest_letter\n      due_in_days\n      message_draft\n      status\n      booking_mode\n      suggested_slots {\n        ...SlotFields\n      }\n      sms {\n        status\n        detail\n        text\n        to_masked\n      }\n      booked_slot {\n        ...SlotFields\n      }\n      booking {\n        ...WriteBackFields\n      }\n      booking_link {\n        url\n        from\n        to\n        expires_at\n        status\n        sent_at\n        booked_start\n        pets\n      }\n      remind_unbooked\n      reminder {\n        status\n        detail\n        text\n        at\n      }\n    }\n    photos {\n      id\n      label\n      caption\n      findings\n      segments\n      rotation\n      in_note\n      show_owner\n      outline {\n        label\n        box\n        polygon\n      }\n      crop {\n        x\n        y\n        w\n        h\n      }\n    }\n    write_back {\n      ...WriteBackFields\n    }\n    plan_reminders {\n      id\n      text\n      status\n    }\n  }\n": types.EncounterFieldsFragmentDoc,
    "\n  fragment OpenItemFields on OpenItem {\n    kind\n    text\n    owner_name\n    encounter_id\n    appointment_id\n    date\n    patient_name\n    followup_id\n    followup_kind\n    reason\n    title\n    label\n    patient_id\n    client_id\n    detail\n  }\n": types.OpenItemFieldsFragmentDoc,
    "\n  fragment WaitingFields on WaitingLink {\n    encounter_id\n    followup_id\n    patient_id\n    patient_name\n    owner_name\n    reason\n    title\n    url\n    sent_at\n    days_waiting\n    status\n    pets\n  }\n": types.WaitingFieldsFragmentDoc,
    "\n  fragment LastVisitFields on LastVisit {\n    date\n    reason\n    type\n  }\n": types.LastVisitFieldsFragmentDoc,
    "\n  fragment ClientCardFields on ClientCard {\n    id\n    name\n    first_name\n    last_name\n    phones\n    emails\n    prefers\n    reminders\n    client_since\n    latest_message {\n      at\n      text\n    }\n  }\n": types.ClientCardFieldsFragmentDoc,
    "\n  fragment RememberFields on RememberItem {\n    id\n    client_id\n    patient_id\n    patient_name\n    text\n    kind\n    date\n    said_at\n    encounter_id\n    expires_at\n    kept_by\n    said_by\n  }\n": types.RememberFieldsFragmentDoc,
    "\n  fragment DocumentFields on Document {\n    id\n    name\n    uploaded_at\n    pages\n    content_type\n    key_points {\n      text\n      page\n    }\n    mock\n  }\n": types.DocumentFieldsFragmentDoc,
    "\n  fragment SignInPayloadFields on SignInPayload {\n    token\n    two_factor_required\n    ticket\n    two_factor_method\n    email_hint\n  }\n": types.SignInPayloadFieldsFragmentDoc,
    "\n  query AuthStatus {\n    auth_status {\n      login_required\n      options {\n        password\n        google\n        microsoft\n        demo\n        password_reset\n      }\n    }\n  }\n": types.AuthStatusDocument,
    "\n  query Me {\n    me {\n      via\n      admin\n      role\n      provider_id\n      permissions\n      user {\n        ...UserFields\n      }\n    }\n  }\n": types.MeDocument,
    "\n  mutation SignIn($login: String!, $password: String!, $remember: Boolean!) {\n    sign_in(login: $login, password: $password, remember: $remember) {\n      ...SignInPayloadFields\n    }\n  }\n": types.SignInDocument,
    "\n  mutation VerifyCode($ticket: String!, $code: String!) {\n    verify_sign_in_code(ticket: $ticket, code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n": types.VerifyCodeDocument,
    "\n  mutation ResendCode($ticket: String!) {\n    resend_sign_in_code(ticket: $ticket) {\n      ...SignInPayloadFields\n    }\n  }\n": types.ResendCodeDocument,
    "\n  mutation StartOAuth($provider: String!, $remember: Boolean!) {\n    start_oauth_sign_in(provider: $provider, remember: $remember)\n  }\n": types.StartOAuthDocument,
    "\n  mutation FinishOAuth($code: String!) {\n    finish_oauth_sign_in(code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n": types.FinishOAuthDocument,
    "\n  mutation FinishOAuthLink($code: String!) {\n    finish_oauth_link(code: $code) {\n      ...UserFields\n    }\n  }\n": types.FinishOAuthLinkDocument,
    "\n  mutation DemoSignIn {\n    try_demo_clinic {\n      ...SignInPayloadFields\n    }\n  }\n": types.DemoSignInDocument,
    "\n  mutation RequestReset($email: String!) {\n    request_password_reset(email: $email)\n  }\n": types.RequestResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    reset_password(token: $token, password: $password)\n  }\n": types.ResetPasswordDocument,
    "\n  query InviteInfo($token: String!) {\n    invite_info(token: $token) {\n      name\n      username\n    }\n  }\n": types.InviteInfoDocument,
    "\n  mutation AcceptInvite($token: String!, $password: String!) {\n    accept_invite(token: $token, password: $password) {\n      ...SignInPayloadFields\n    }\n  }\n": types.AcceptInviteDocument,
    "\n    mutation SignOut {\n      sign_out\n    }\n  ": types.SignOutDocument,
    "\n  query Team {\n    users {\n      ...UserFields\n    }\n    providers {\n      id\n      name\n      linked_to\n    }\n  }\n": types.TeamDocument,
    "\n  mutation InviteUser($input: NewUserInput!) {\n    invite_user(input: $input) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n": types.InviteUserDocument,
    "\n  mutation ReinviteUser($id: String!) {\n    reinvite_user(user_id: $id) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n": types.ReinviteUserDocument,
    "\n  mutation UpdateUser($id: String!, $input: UserUpdateInput!) {\n    update_user(user_id: $id, input: $input) {\n      ...UserFields\n    }\n  }\n": types.UpdateUserDocument,
    "\n  query Schedule($date: Date, $provider: String!) {\n    schedule(date: $date, provider_id: $provider) {\n      ...AppointmentFields\n    }\n  }\n": types.ScheduleDocument,
    "\n  query Days($from: Date, $to: Date, $provider: String!) {\n    days(from: $from, to: $to, provider_id: $provider) {\n      date\n      visits\n      open\n      failed\n      marker\n    }\n  }\n": types.DaysDocument,
    "\n  query Brief($provider: String!) {\n    brief(provider_id: $provider) {\n      spoken\n      sentence {\n        text\n        emphasis\n        kind\n      }\n      suggestions\n      date\n      from_yesterday {\n        ...OpenItemFields\n      }\n      pending_followups {\n        encounter_id\n        followup_id\n        kind\n        reason\n        title\n        patient_id\n        patient_name\n        appointment_id\n      }\n      heads_up {\n        text\n        appointment_id\n        patient_id\n        patient_name\n        time\n      }\n      new_since_yesterday {\n        kind\n        text\n        at\n        patient_name\n        mock\n        patient_id\n        appointment_id\n        client_id\n        document_id\n        detail\n      }\n    }\n  }\n": types.BriefDocument,
    "\n  query EndOfDay($date: Date, $provider: String!) {\n    end_of_day(date: $date, provider_id: $provider) {\n      spoken\n      visits_seen\n      rechecks_booked\n      recheck_links_sent\n      recheck_links_booked\n      left_to_do {\n        ...OpenItemFields\n      }\n      done_today {\n        text\n        encounter_id\n      }\n      waiting_on_owners {\n        ...WaitingFields\n      }\n      tomorrow {\n        date\n        visits\n        first\n        last\n        prepare {\n          text\n          appointment_id\n          patient_name\n        }\n      }\n    }\n  }\n": types.EndOfDayDocument,
    "\n  query PreRoomCard($id: String!) {\n    pre_room_card(appointment_id: $id) {\n      spoken\n      take\n      last_note {\n        date\n        by\n        other_vet\n        gist\n      }\n      promised\n      medications\n      remember_items {\n        ...RememberFields\n      }\n      why\n      prep\n      owner_message {\n        who\n        text\n        at\n      }\n      last_visit_on\n      weight\n      walk_in {\n        date\n        kind\n        who\n        mine\n        text\n        items {\n          text\n          status\n          note\n          checked\n        }\n      }\n      can_do_today\n    }\n  }\n": types.PreRoomCardDocument,
    "\n  query NotesToSign($provider: String!) {\n    notes_to_sign(provider_id: $provider) {\n      encounter_id\n      appointment_id\n      patient_id\n      patient_name\n      owner_name\n      client_id\n      provider_id\n      provider_name\n      date\n      time\n      visit_reason\n      assessment\n      status\n      bucket\n      to_confirm\n      followups_undecided\n      reason\n      waiting_days\n    }\n  }\n": types.NotesToSignDocument,
    "\n  query VoiceProfile($id: String!) {\n    voice_profile(provider_id: $id) {\n      source\n      notes_used\n    }\n  }\n": types.VoiceProfileDocument,
    "\n  query PreviousNotes($id: String!) {\n    patient_notes(patient_id: $id) {\n      id\n      date\n      provider_id\n      provider_name\n      text\n      source\n      sections {\n        label\n        text\n      }\n    }\n  }\n": types.PreviousNotesDocument,
    "\n  query SampleTranscript($appointment: String!) {\n    sample_transcript(appointment_id: $appointment)\n  }\n": types.SampleTranscriptDocument,
    "\n  query Search($q: String!) {\n    search(q: $q) {\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        client_id\n        owner_name\n        last_visit {\n          ...LastVisitFields\n        }\n        next_visit {\n          date\n          time\n          appointment_id\n        }\n      }\n      owners {\n        id\n        name\n        phone\n        email\n        pets\n      }\n    }\n  }\n": types.SearchDocument,
    "\n  fragment AssistLinkFields on AssistLink {\n    label\n    to\n    appointment_id\n    encounter_id\n    date\n    patient_id\n    client_id\n    document_id\n  }\n": types.AssistLinkFieldsFragmentDoc,
    "\n  mutation Ask($input: AssistantInput!) {\n    ask_assistant(input: $input) {\n      reply\n      tools_used\n      links {\n        ...AssistLinkFields\n      }\n      sources {\n        ...AssistLinkFields\n      }\n      followups\n    }\n  }\n": types.AskDocument,
    "\n  subscription AssistantTurn($id: String!) {\n    assistant_turn(turn_id: $id) {\n      kind\n      text\n    }\n  }\n": types.AssistantTurnDocument,
    "\n  query PatientVisits($id: String!, $related: String!) {\n    patient_visits(patient_id: $id, related_to: $related) {\n      id\n      date\n      appointment_id\n      type\n      kind\n      reason\n      provider_name\n      summary\n      related\n      note\n      sections {\n        label\n        text\n      }\n      medications\n      photos {\n        id\n        caption\n        url\n      }\n    }\n  }\n": types.PatientVisitsDocument,
    "\n  query PatientProfile($id: String!) {\n    patient_profile(patient_id: $id) {\n      mock\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        color\n        microchip\n      }\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n          note\n        }\n      }\n      reminders_due {\n        patient_id\n        patient_name\n        text\n        due\n      }\n      client {\n        ...ClientCardFields\n      }\n      other_pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        last_visit {\n          ...LastVisitFields\n        }\n        due\n      }\n    }\n  }\n": types.PatientProfileDocument,
    "\n  query Invoices($id: String!) {\n    client_invoices(client_id: $id) {\n      balance\n      last_12_months\n      last_payment\n      counts\n      mock\n      invoices {\n        id\n        date\n        patient_id\n        patient_name\n        visit\n        provider_name\n        total\n        status\n        paid_by\n        items {\n          name\n          qty\n          price\n        }\n      }\n    }\n  }\n": types.InvoicesDocument,
    "\n  query Household($id: String!) {\n    client_household(client_id: $id) {\n      balance\n      book_url\n      spend_12m\n      mock\n      client {\n        ...ClientCardFields\n      }\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        due\n        next_due {\n          text\n          due\n          state\n        }\n        tags\n        alert_tags\n        spend_12m\n        last_visit {\n          ...LastVisitFields\n        }\n        today {\n          appointment_id\n          time\n          reason\n          visit_status\n          encounter_id\n        }\n      }\n      coming_up {\n        date\n        text\n        patient_name\n      }\n      messages {\n        at\n        direction\n        text\n      }\n      remember {\n        ...RememberFields\n      }\n    }\n  }\n": types.HouseholdDocument,
    "\n  query Documents($id: String!) {\n    patient_documents(patient_id: $id) {\n      ...DocumentFields\n    }\n  }\n": types.DocumentsDocument,
    "\n  query ClientRemember($id: String!) {\n    client_remember(client_id: $id) {\n      ...RememberFields\n    }\n  }\n": types.ClientRememberDocument,
    "\n  mutation Forget($client: String!, $item: String!) {\n    forget_remember(client_id: $client, item_id: $item)\n  }\n": types.ForgetDocument,
    "\n  query Encounter($id: String!) {\n    encounter(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": types.EncounterDocument,
    "\n  query Group($group: String!) {\n    encounters(group_id: $group) {\n      ...EncounterFields\n    }\n  }\n": types.GroupDocument,
    "\n  mutation StartEncounter($input: NewEncounterInput!) {\n    start_encounter(input: $input) {\n      ...EncounterFields\n    }\n  }\n": types.StartEncounterDocument,
    "\n  mutation AddTranscript($id: String!, $text: String!, $append: Boolean!) {\n    add_transcript(encounter_id: $id, text: $text, append: $append) {\n      ...EncounterFields\n    }\n  }\n": types.AddTranscriptDocument,
    "\n  mutation DraftNote($id: String!) {\n    draft_note(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": types.DraftNoteDocument,
    "\n  subscription DraftProgress($id: String!) {\n    draft_progress(encounter_id: $id) {\n      run_id\n      step\n      state\n      detail\n      patient_name\n    }\n  }\n": types.DraftProgressDocument,
    "\n  mutation UpdatePhoto($id: String!, $photo: String!, $input: PhotoEditInput!) {\n    update_photo(encounter_id: $id, photo_id: $photo, input: $input) {\n      ...EncounterFields\n    }\n  }\n": types.UpdatePhotoDocument,
    "\n  mutation DeletePhoto($id: String!, $photo: String!) {\n    delete_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n": types.DeletePhotoDocument,
    "\n  mutation RestorePhoto($id: String!, $photo: String!) {\n    restore_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n": types.RestorePhotoDocument,
    "\n  mutation SaveNote($id: String!, $note: SoapNoteInput!) {\n    save_note(encounter_id: $id, note: $note) {\n      ...EncounterFields\n    }\n  }\n": types.SaveNoteDocument,
    "\n  query NoteTypes {\n    note_types {\n      id\n      name\n      sections {\n        key\n        label\n      }\n    }\n  }\n": types.NoteTypesDocument,
    "\n  mutation SetNoteType($id: String!, $type: String!) {\n    set_note_type(encounter_id: $id, note_type: $type) {\n      ...EncounterFields\n    }\n  }\n": types.SetNoteTypeDocument,
    "\n  mutation Assist($id: String!, $input: AssistInput!) {\n    assist(encounter_id: $id, input: $input) {\n      suggestion\n      refused\n      mock\n      unsourced\n      sources {\n        sentence\n        lines\n        text\n      }\n    }\n  }\n": types.AssistDocument,
    "\n  query Templates($type: String!) {\n    templates(note_type: $type) {\n      id\n      name\n      shortcut\n      text\n      note_type\n      owner\n    }\n  }\n": types.TemplatesDocument,
    "\n  mutation FollowUp($id: String!, $followup: String!, $input: FollowUpActionInput!) {\n    act_on_followup(encounter_id: $id, followup_id: $followup, input: $input) {\n      ...EncounterFields\n    }\n  }\n": types.FollowUpDocument,
    "\n  mutation AddPetToVisit($id: String!, $patient: String!) {\n    add_pet_to_visit(encounter_id: $id, patient_id: $patient) {\n      ...EncounterFields\n    }\n  }\n": types.AddPetToVisitDocument,
    "\n  mutation SetPlanChecks($appointment: String!, $patient: String!, $lines: [String!]!) {\n    set_plan_checks(appointment_id: $appointment, patient_id: $patient, lines: $lines)\n  }\n": types.SetPlanChecksDocument,
    "\n  mutation PlanReminder($id: String!, $reminder: String!, $action: String!) {\n    act_on_plan_reminder(encounter_id: $id, reminder_id: $reminder, action: $action) {\n      ...EncounterFields\n    }\n  }\n": types.PlanReminderDocument,
    "\n  query WaitingLinks {\n    waiting_followups {\n      ...WaitingFields\n    }\n  }\n": types.WaitingLinksDocument,
    "\n  mutation ResendLink($followup: String!) {\n    resend_booking_link(followup_id: $followup) {\n      ...WaitingFields\n    }\n  }\n": types.ResendLinkDocument,
    "\n  query RememberSuggestions($id: String!) {\n    remember_suggestions(encounter_id: $id) {\n      left_out\n      mock\n      suggestions {\n        id\n        text\n        kind\n        date\n        transcript_lines\n        said_by\n        kept\n      }\n    }\n  }\n": types.RememberSuggestionsDocument,
    "\n  mutation KeepRemember($id: String!, $keep: [String!]!) {\n    keep_remember(encounter_id: $id, keep: $keep) {\n      ...RememberFields\n    }\n  }\n": types.KeepRememberDocument,
    "\n  mutation SignNote($id: String!, $by: String!, $send: Boolean!) {\n    sign_note(encounter_id: $id, signed_by: $by, send: $send) {\n      encounter {\n        ...EncounterFields\n      }\n    }\n  }\n": types.SignNoteDocument,
    "\n  query OwnerSummary($id: String!, $lang: String!) {\n    owner_summary(encounter_id: $id, lang: $lang) {\n      language\n      when_to_call\n      translated\n      mock\n      clinic {\n        name\n        address\n        phone\n        logo_url\n      }\n      visit {\n        date\n        start\n        when\n        provider_name\n      }\n      owner_name\n      pets {\n        patient_id\n        name\n        species\n        breed\n        sex\n        age\n        age_text\n        for_owner\n        medicines\n        home_care\n        next_visit {\n          kind\n          text\n          url\n        }\n      }\n    }\n  }\n": types.OwnerSummaryDocument,
    "\n  mutation Share($id: String!, $channel: String!, $lang: String!) {\n    share_summary(encounter_id: $id, channel: $channel, language: $lang) {\n      channel\n      language\n      status\n      detail\n      text\n      url\n      expires_at\n      translated\n    }\n  }\n": types.ShareDocument,
    "\n  mutation SetTwoFactor($enabled: Boolean!) {\n    set_two_factor(enabled: $enabled) {\n      ...UserFields\n    }\n  }\n": types.SetTwoFactorDocument,
    "\n  mutation ConnectOAuth($provider: String!, $current: String!) {\n    connect_oauth_account(provider: $provider, current_password: $current)\n  }\n": types.ConnectOAuthDocument,
    "\n  mutation SignOutEverywhere {\n    sign_out_everywhere\n  }\n": types.SignOutEverywhereDocument,
    "\n  mutation SignOutOthers {\n    sign_out_other_sessions\n  }\n": types.SignOutOthersDocument,
    "\n  mutation UpdateMyProfile($name: String, $email: String, $current: String!) {\n    update_my_profile(name: $name, email: $email, current_password: $current) {\n      ...UserFields\n    }\n  }\n": types.UpdateMyProfileDocument,
    "\n  mutation ChangePassword($next: String!, $current: String!) {\n    change_password(new_password: $next, current_password: $current)\n  }\n": types.ChangePasswordDocument,
    "\n  query ConnectedAccounts {\n    my_connected_accounts {\n      provider\n      email\n      connected_at\n    }\n  }\n": types.ConnectedAccountsDocument,
    "\n  mutation DisconnectAccount($provider: String!, $current: String!) {\n    disconnect_oauth_account(provider: $provider, current_password: $current)\n  }\n": types.DisconnectAccountDocument,
    "\n  fragment LetterFields on Letter {\n    id\n    patient_id\n    patient_name\n    encounter_id\n    kind\n    recipient {\n      name\n      clinic\n      email\n    }\n    reason\n    urgency\n    attachments {\n      note_encounter_ids\n      photos {\n        encounter_id\n        photo_id\n      }\n      document_ids\n      invoice_ids\n    }\n    body\n    owner_consent\n    status\n    drafted\n    created_at\n    updated_at\n    signed_by\n    signer_title\n    signed_at\n    sent_to\n    opened_at\n    sent {\n      channel\n      to_masked\n      at\n      status\n      detail\n    }\n    pdf_url\n  }\n": types.LetterFieldsFragmentDoc,
    "\n  query Letters($patient: String!) {\n    letters(patient_id: $patient) {\n      ...LetterFields\n    }\n  }\n": types.LettersDocument,
    "\n  query Letter($id: String!) {\n    letter(id: $id) {\n      ...LetterFields\n    }\n  }\n": types.LetterDocument,
    "\n  query Contacts($q: String!) {\n    contacts(q: $q) {\n      name\n      clinic\n      email\n    }\n  }\n": types.ContactsDocument,
    "\n  mutation CreateLetter($patient: String!, $encounter: String!, $input: LetterInput, $draft: Boolean!) {\n    create_letter(patient_id: $patient, encounter_id: $encounter, input: $input, draft: $draft) {\n      ...LetterFields\n    }\n  }\n": types.CreateLetterDocument,
    "\n  mutation DraftLetter($id: String!) {\n    draft_letter(id: $id) {\n      ...LetterFields\n    }\n  }\n": types.DraftLetterDocument,
    "\n  mutation UpdateLetter($id: String!, $input: LetterInput!) {\n    update_letter(id: $id, input: $input) {\n      ...LetterFields\n    }\n  }\n": types.UpdateLetterDocument,
    "\n  mutation SendLetter($id: String!, $channels: [String!]!, $to: String!, $ownerCopy: Boolean!) {\n    send_letter(id: $id, channels: $channels, to_email: $to, owner_copy: $ownerCopy) {\n      letter {\n        ...LetterFields\n      }\n      results {\n        channel\n        status\n        detail\n        to\n        subject\n        body\n        text\n        url\n        pdf_url\n        expires_at\n      }\n    }\n  }\n": types.SendLetterDocument,
    "\n  mutation DeleteLetter($id: String!) {\n    delete_letter(id: $id)\n  }\n": types.DeleteLetterDocument,
    "\n  query SpeechOptions {\n    speech_options {\n      available\n      default_voice\n      voices {\n        id\n        name\n        language\n        gender\n      }\n    }\n  }\n": types.SpeechOptionsDocument,
    "\n  mutation StartAuthenticator($current: String!) {\n    start_authenticator(current_password: $current) {\n      secret\n      otpauth_uri\n    }\n  }\n": types.StartAuthenticatorDocument,
    "\n  mutation ConfirmAuthenticator($code: String!) {\n    confirm_authenticator(code: $code) {\n      ...UserFields\n    }\n  }\n": types.ConfirmAuthenticatorDocument,
    "\n  mutation RemoveAuthenticator($current: String!) {\n    remove_authenticator(current_password: $current) {\n      ...UserFields\n    }\n  }\n": types.RemoveAuthenticatorDocument,
    "\n  query Doctors {\n    doctors {\n      id\n      name\n    }\n  }\n": types.DoctorsDocument,
    "\n  mutation SetUserTwoFactor($id: String!, $required: Boolean!) {\n    set_user_two_factor(user_id: $id, required: $required) {\n      ...UserFields\n    }\n  }\n": types.SetUserTwoFactorDocument,
    "\n  query Letterhead {\n    letterhead {\n      name\n      address\n      phone\n      logo_url\n      pims_name\n    }\n  }\n": types.LetterheadDocument,
    "\n  mutation NameSpeaker($id: String!, $speaker: String!, $role: String!, $name: String!) {\n    name_speaker(encounter_id: $id, speaker_id: $speaker, role: $role, name: $name) {\n      ...EncounterFields\n    }\n  }\n": types.NameSpeakerDocument,
    "\n  mutation MarkPrescriptionEntered($id: String!) {\n    mark_prescription_entered(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n": types.MarkPrescriptionEnteredDocument,
    "\n  mutation SendToPims($id: String!) {\n    send_to_pims(encounter_id: $id) {\n      ok\n      status\n      detail\n      pims_id\n    }\n  }\n": types.SendToPimsDocument,
    "\n  query SignPreview($id: String!) {\n    sign_preview(encounter_id: $id) {\n      pims_name\n      patient {\n        name\n        pims_id\n      }\n      owner {\n        name\n        pims_id\n      }\n      appointment {\n        id\n        start\n        patient_name\n        owner_name\n      }\n      matches\n      mismatch\n      note\n      photos\n      prescription\n      texts {\n        followup_id\n        kind\n        reason\n        message\n      }\n    }\n  }\n": types.SignPreviewDocument,
    "\n  query RecordPanel($id: String!) {\n    record_panel(patient_id: $id) {\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n      }\n      pims_patient_id\n      pims_client_id\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n        }\n      }\n      reminders_due {\n        patient_id\n        text\n        due\n      }\n      recent_visits {\n        id\n        date\n        kind\n        type\n        reason\n        provider_name\n      }\n      client {\n        id\n        name\n        first_name\n        last_name\n        phones\n        emails\n        prefers\n      }\n      other_pets {\n        id\n        name\n      }\n      mock\n    }\n  }\n": types.RecordPanelDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment UserFields on User {\n    id\n    username\n    name\n    email\n    provider_id\n    role\n    active\n    has_password\n    two_factor\n    two_factor_required\n    authenticator\n    created_at\n  }\n"): (typeof documents)["\n  fragment UserFields on User {\n    id\n    username\n    name\n    email\n    provider_id\n    role\n    active\n    has_password\n    two_factor\n    two_factor_required\n    authenticator\n    created_at\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AppointmentFields on Appointment {\n    id\n    start\n    duration_min\n    reason\n    type\n    status\n    provider_id\n    provider_name\n    room\n    visit_status\n    audio_live\n    encounter_id\n    note_type\n    started_at\n    demo_clock\n    checked_in_at\n    synced_at\n    pets {\n      reason\n      visit_status\n      encounter_id\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        alerts\n        alert_chips {\n          text\n          short\n        }\n        sex\n        client_id\n        pims_notes\n        last_visit {\n          date\n          reason\n        }\n        weight {\n          value\n          unit\n        }\n      }\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    patient {\n      id\n      name\n      species\n      breed\n      age\n      alerts\n      alert_chips {\n        text\n        short\n      }\n      sex\n      color\n      microchip\n      client_id\n      pims_notes\n      last_visit {\n        date\n        reason\n      }\n      weight {\n        value\n        unit\n      }\n    }\n    client {\n      id\n      first_name\n      last_name\n      phones\n      emails\n      prefers\n      reminders\n      client_since\n    }\n  }\n"): (typeof documents)["\n  fragment AppointmentFields on Appointment {\n    id\n    start\n    duration_min\n    reason\n    type\n    status\n    provider_id\n    provider_name\n    room\n    visit_status\n    audio_live\n    encounter_id\n    note_type\n    started_at\n    demo_clock\n    checked_in_at\n    synced_at\n    pets {\n      reason\n      visit_status\n      encounter_id\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        alerts\n        alert_chips {\n          text\n          short\n        }\n        sex\n        client_id\n        pims_notes\n        last_visit {\n          date\n          reason\n        }\n        weight {\n          value\n          unit\n        }\n      }\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    patient {\n      id\n      name\n      species\n      breed\n      age\n      alerts\n      alert_chips {\n        text\n        short\n      }\n      sex\n      color\n      microchip\n      client_id\n      pims_notes\n      last_visit {\n        date\n        reason\n      }\n      weight {\n        value\n        unit\n      }\n    }\n    client {\n      id\n      first_name\n      last_name\n      phones\n      emails\n      prefers\n      reminders\n      client_since\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SlotFields on Slot {\n    start\n    end\n    provider_id\n  }\n"): (typeof documents)["\n  fragment SlotFields on Slot {\n    start\n    end\n    provider_id\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment WriteBackFields on WriteBackResult {\n    ok\n    status\n    detail\n    pims_id\n    start\n    at\n  }\n"): (typeof documents)["\n  fragment WriteBackFields on WriteBackResult {\n    ok\n    status\n    detail\n    pims_id\n    start\n    at\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment EncounterFields on Encounter {\n    id\n    consent_recorded\n    appointment_id\n    patient_id\n    provider_id\n    provider_name\n    source\n    status\n    transcript\n    segments {\n      id\n      line\n      speaker_id\n      speaker_name\n      role\n      offset_seconds\n      text\n      pets\n      pet_sure\n    }\n    parts_received\n    last_part\n    first_part_at\n    last_part_at\n    audio_seconds\n    created_at\n    signed_at\n    signed_by\n    patient_ids\n    patient_name\n    client_id\n    owner_name\n    note_type\n    group_id\n    view\n    hidden\n    pims_items {\n      kind\n      id\n      label\n      status\n      synced_at\n      pims_id\n      detail\n    }\n    pims_next_try_at\n    prescription_task {\n      text\n      medications\n      done_by\n      done_at\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    note {\n      subjective\n      objective\n      assessment\n      plan\n      client_summary\n      vitals\n      medications\n      vitals_by\n    }\n    followups {\n      id\n      kind\n      reason\n      title\n      suggest_letter\n      due_in_days\n      message_draft\n      status\n      booking_mode\n      suggested_slots {\n        ...SlotFields\n      }\n      sms {\n        status\n        detail\n        text\n        to_masked\n      }\n      booked_slot {\n        ...SlotFields\n      }\n      booking {\n        ...WriteBackFields\n      }\n      booking_link {\n        url\n        from\n        to\n        expires_at\n        status\n        sent_at\n        booked_start\n        pets\n      }\n      remind_unbooked\n      reminder {\n        status\n        detail\n        text\n        at\n      }\n    }\n    photos {\n      id\n      label\n      caption\n      findings\n      segments\n      rotation\n      in_note\n      show_owner\n      outline {\n        label\n        box\n        polygon\n      }\n      crop {\n        x\n        y\n        w\n        h\n      }\n    }\n    write_back {\n      ...WriteBackFields\n    }\n    plan_reminders {\n      id\n      text\n      status\n    }\n  }\n"): (typeof documents)["\n  fragment EncounterFields on Encounter {\n    id\n    consent_recorded\n    appointment_id\n    patient_id\n    provider_id\n    provider_name\n    source\n    status\n    transcript\n    segments {\n      id\n      line\n      speaker_id\n      speaker_name\n      role\n      offset_seconds\n      text\n      pets\n      pet_sure\n    }\n    parts_received\n    last_part\n    first_part_at\n    last_part_at\n    audio_seconds\n    created_at\n    signed_at\n    signed_by\n    patient_ids\n    patient_name\n    client_id\n    owner_name\n    note_type\n    group_id\n    view\n    hidden\n    pims_items {\n      kind\n      id\n      label\n      status\n      synced_at\n      pims_id\n      detail\n    }\n    pims_next_try_at\n    prescription_task {\n      text\n      medications\n      done_by\n      done_at\n    }\n    can {\n      start\n      record\n      draft\n      edit\n      approve\n      sign\n      edit_photos\n      remember\n      write_letter\n      share\n      resend\n    }\n    note {\n      subjective\n      objective\n      assessment\n      plan\n      client_summary\n      vitals\n      medications\n      vitals_by\n    }\n    followups {\n      id\n      kind\n      reason\n      title\n      suggest_letter\n      due_in_days\n      message_draft\n      status\n      booking_mode\n      suggested_slots {\n        ...SlotFields\n      }\n      sms {\n        status\n        detail\n        text\n        to_masked\n      }\n      booked_slot {\n        ...SlotFields\n      }\n      booking {\n        ...WriteBackFields\n      }\n      booking_link {\n        url\n        from\n        to\n        expires_at\n        status\n        sent_at\n        booked_start\n        pets\n      }\n      remind_unbooked\n      reminder {\n        status\n        detail\n        text\n        at\n      }\n    }\n    photos {\n      id\n      label\n      caption\n      findings\n      segments\n      rotation\n      in_note\n      show_owner\n      outline {\n        label\n        box\n        polygon\n      }\n      crop {\n        x\n        y\n        w\n        h\n      }\n    }\n    write_back {\n      ...WriteBackFields\n    }\n    plan_reminders {\n      id\n      text\n      status\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment OpenItemFields on OpenItem {\n    kind\n    text\n    owner_name\n    encounter_id\n    appointment_id\n    date\n    patient_name\n    followup_id\n    followup_kind\n    reason\n    title\n    label\n    patient_id\n    client_id\n    detail\n  }\n"): (typeof documents)["\n  fragment OpenItemFields on OpenItem {\n    kind\n    text\n    owner_name\n    encounter_id\n    appointment_id\n    date\n    patient_name\n    followup_id\n    followup_kind\n    reason\n    title\n    label\n    patient_id\n    client_id\n    detail\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment WaitingFields on WaitingLink {\n    encounter_id\n    followup_id\n    patient_id\n    patient_name\n    owner_name\n    reason\n    title\n    url\n    sent_at\n    days_waiting\n    status\n    pets\n  }\n"): (typeof documents)["\n  fragment WaitingFields on WaitingLink {\n    encounter_id\n    followup_id\n    patient_id\n    patient_name\n    owner_name\n    reason\n    title\n    url\n    sent_at\n    days_waiting\n    status\n    pets\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment LastVisitFields on LastVisit {\n    date\n    reason\n    type\n  }\n"): (typeof documents)["\n  fragment LastVisitFields on LastVisit {\n    date\n    reason\n    type\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ClientCardFields on ClientCard {\n    id\n    name\n    first_name\n    last_name\n    phones\n    emails\n    prefers\n    reminders\n    client_since\n    latest_message {\n      at\n      text\n    }\n  }\n"): (typeof documents)["\n  fragment ClientCardFields on ClientCard {\n    id\n    name\n    first_name\n    last_name\n    phones\n    emails\n    prefers\n    reminders\n    client_since\n    latest_message {\n      at\n      text\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment RememberFields on RememberItem {\n    id\n    client_id\n    patient_id\n    patient_name\n    text\n    kind\n    date\n    said_at\n    encounter_id\n    expires_at\n    kept_by\n    said_by\n  }\n"): (typeof documents)["\n  fragment RememberFields on RememberItem {\n    id\n    client_id\n    patient_id\n    patient_name\n    text\n    kind\n    date\n    said_at\n    encounter_id\n    expires_at\n    kept_by\n    said_by\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment DocumentFields on Document {\n    id\n    name\n    uploaded_at\n    pages\n    content_type\n    key_points {\n      text\n      page\n    }\n    mock\n  }\n"): (typeof documents)["\n  fragment DocumentFields on Document {\n    id\n    name\n    uploaded_at\n    pages\n    content_type\n    key_points {\n      text\n      page\n    }\n    mock\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SignInPayloadFields on SignInPayload {\n    token\n    two_factor_required\n    ticket\n    two_factor_method\n    email_hint\n  }\n"): (typeof documents)["\n  fragment SignInPayloadFields on SignInPayload {\n    token\n    two_factor_required\n    ticket\n    two_factor_method\n    email_hint\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AuthStatus {\n    auth_status {\n      login_required\n      options {\n        password\n        google\n        microsoft\n        demo\n        password_reset\n      }\n    }\n  }\n"): (typeof documents)["\n  query AuthStatus {\n    auth_status {\n      login_required\n      options {\n        password\n        google\n        microsoft\n        demo\n        password_reset\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      via\n      admin\n      role\n      provider_id\n      permissions\n      user {\n        ...UserFields\n      }\n    }\n  }\n"): (typeof documents)["\n  query Me {\n    me {\n      via\n      admin\n      role\n      provider_id\n      permissions\n      user {\n        ...UserFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignIn($login: String!, $password: String!, $remember: Boolean!) {\n    sign_in(login: $login, password: $password, remember: $remember) {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation SignIn($login: String!, $password: String!, $remember: Boolean!) {\n    sign_in(login: $login, password: $password, remember: $remember) {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyCode($ticket: String!, $code: String!) {\n    verify_sign_in_code(ticket: $ticket, code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation VerifyCode($ticket: String!, $code: String!) {\n    verify_sign_in_code(ticket: $ticket, code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResendCode($ticket: String!) {\n    resend_sign_in_code(ticket: $ticket) {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation ResendCode($ticket: String!) {\n    resend_sign_in_code(ticket: $ticket) {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartOAuth($provider: String!, $remember: Boolean!) {\n    start_oauth_sign_in(provider: $provider, remember: $remember)\n  }\n"): (typeof documents)["\n  mutation StartOAuth($provider: String!, $remember: Boolean!) {\n    start_oauth_sign_in(provider: $provider, remember: $remember)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FinishOAuth($code: String!) {\n    finish_oauth_sign_in(code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation FinishOAuth($code: String!) {\n    finish_oauth_sign_in(code: $code) {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FinishOAuthLink($code: String!) {\n    finish_oauth_link(code: $code) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation FinishOAuthLink($code: String!) {\n    finish_oauth_link(code: $code) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DemoSignIn {\n    try_demo_clinic {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation DemoSignIn {\n    try_demo_clinic {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestReset($email: String!) {\n    request_password_reset(email: $email)\n  }\n"): (typeof documents)["\n  mutation RequestReset($email: String!) {\n    request_password_reset(email: $email)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetPassword($token: String!, $password: String!) {\n    reset_password(token: $token, password: $password)\n  }\n"): (typeof documents)["\n  mutation ResetPassword($token: String!, $password: String!) {\n    reset_password(token: $token, password: $password)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query InviteInfo($token: String!) {\n    invite_info(token: $token) {\n      name\n      username\n    }\n  }\n"): (typeof documents)["\n  query InviteInfo($token: String!) {\n    invite_info(token: $token) {\n      name\n      username\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AcceptInvite($token: String!, $password: String!) {\n    accept_invite(token: $token, password: $password) {\n      ...SignInPayloadFields\n    }\n  }\n"): (typeof documents)["\n  mutation AcceptInvite($token: String!, $password: String!) {\n    accept_invite(token: $token, password: $password) {\n      ...SignInPayloadFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation SignOut {\n      sign_out\n    }\n  "): (typeof documents)["\n    mutation SignOut {\n      sign_out\n    }\n  "];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Team {\n    users {\n      ...UserFields\n    }\n    providers {\n      id\n      name\n      linked_to\n    }\n  }\n"): (typeof documents)["\n  query Team {\n    users {\n      ...UserFields\n    }\n    providers {\n      id\n      name\n      linked_to\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InviteUser($input: NewUserInput!) {\n    invite_user(input: $input) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation InviteUser($input: NewUserInput!) {\n    invite_user(input: $input) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReinviteUser($id: String!) {\n    reinvite_user(user_id: $id) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ReinviteUser($id: String!) {\n    reinvite_user(user_id: $id) {\n      invite_url\n      user {\n        ...UserFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateUser($id: String!, $input: UserUpdateInput!) {\n    update_user(user_id: $id, input: $input) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateUser($id: String!, $input: UserUpdateInput!) {\n    update_user(user_id: $id, input: $input) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Schedule($date: Date, $provider: String!) {\n    schedule(date: $date, provider_id: $provider) {\n      ...AppointmentFields\n    }\n  }\n"): (typeof documents)["\n  query Schedule($date: Date, $provider: String!) {\n    schedule(date: $date, provider_id: $provider) {\n      ...AppointmentFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Days($from: Date, $to: Date, $provider: String!) {\n    days(from: $from, to: $to, provider_id: $provider) {\n      date\n      visits\n      open\n      failed\n      marker\n    }\n  }\n"): (typeof documents)["\n  query Days($from: Date, $to: Date, $provider: String!) {\n    days(from: $from, to: $to, provider_id: $provider) {\n      date\n      visits\n      open\n      failed\n      marker\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Brief($provider: String!) {\n    brief(provider_id: $provider) {\n      spoken\n      sentence {\n        text\n        emphasis\n        kind\n      }\n      suggestions\n      date\n      from_yesterday {\n        ...OpenItemFields\n      }\n      pending_followups {\n        encounter_id\n        followup_id\n        kind\n        reason\n        title\n        patient_id\n        patient_name\n        appointment_id\n      }\n      heads_up {\n        text\n        appointment_id\n        patient_id\n        patient_name\n        time\n      }\n      new_since_yesterday {\n        kind\n        text\n        at\n        patient_name\n        mock\n        patient_id\n        appointment_id\n        client_id\n        document_id\n        detail\n      }\n    }\n  }\n"): (typeof documents)["\n  query Brief($provider: String!) {\n    brief(provider_id: $provider) {\n      spoken\n      sentence {\n        text\n        emphasis\n        kind\n      }\n      suggestions\n      date\n      from_yesterday {\n        ...OpenItemFields\n      }\n      pending_followups {\n        encounter_id\n        followup_id\n        kind\n        reason\n        title\n        patient_id\n        patient_name\n        appointment_id\n      }\n      heads_up {\n        text\n        appointment_id\n        patient_id\n        patient_name\n        time\n      }\n      new_since_yesterday {\n        kind\n        text\n        at\n        patient_name\n        mock\n        patient_id\n        appointment_id\n        client_id\n        document_id\n        detail\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EndOfDay($date: Date, $provider: String!) {\n    end_of_day(date: $date, provider_id: $provider) {\n      spoken\n      visits_seen\n      rechecks_booked\n      recheck_links_sent\n      recheck_links_booked\n      left_to_do {\n        ...OpenItemFields\n      }\n      done_today {\n        text\n        encounter_id\n      }\n      waiting_on_owners {\n        ...WaitingFields\n      }\n      tomorrow {\n        date\n        visits\n        first\n        last\n        prepare {\n          text\n          appointment_id\n          patient_name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query EndOfDay($date: Date, $provider: String!) {\n    end_of_day(date: $date, provider_id: $provider) {\n      spoken\n      visits_seen\n      rechecks_booked\n      recheck_links_sent\n      recheck_links_booked\n      left_to_do {\n        ...OpenItemFields\n      }\n      done_today {\n        text\n        encounter_id\n      }\n      waiting_on_owners {\n        ...WaitingFields\n      }\n      tomorrow {\n        date\n        visits\n        first\n        last\n        prepare {\n          text\n          appointment_id\n          patient_name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PreRoomCard($id: String!) {\n    pre_room_card(appointment_id: $id) {\n      spoken\n      take\n      last_note {\n        date\n        by\n        other_vet\n        gist\n      }\n      promised\n      medications\n      remember_items {\n        ...RememberFields\n      }\n      why\n      prep\n      owner_message {\n        who\n        text\n        at\n      }\n      last_visit_on\n      weight\n      walk_in {\n        date\n        kind\n        who\n        mine\n        text\n        items {\n          text\n          status\n          note\n          checked\n        }\n      }\n      can_do_today\n    }\n  }\n"): (typeof documents)["\n  query PreRoomCard($id: String!) {\n    pre_room_card(appointment_id: $id) {\n      spoken\n      take\n      last_note {\n        date\n        by\n        other_vet\n        gist\n      }\n      promised\n      medications\n      remember_items {\n        ...RememberFields\n      }\n      why\n      prep\n      owner_message {\n        who\n        text\n        at\n      }\n      last_visit_on\n      weight\n      walk_in {\n        date\n        kind\n        who\n        mine\n        text\n        items {\n          text\n          status\n          note\n          checked\n        }\n      }\n      can_do_today\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NotesToSign($provider: String!) {\n    notes_to_sign(provider_id: $provider) {\n      encounter_id\n      appointment_id\n      patient_id\n      patient_name\n      owner_name\n      client_id\n      provider_id\n      provider_name\n      date\n      time\n      visit_reason\n      assessment\n      status\n      bucket\n      to_confirm\n      followups_undecided\n      reason\n      waiting_days\n    }\n  }\n"): (typeof documents)["\n  query NotesToSign($provider: String!) {\n    notes_to_sign(provider_id: $provider) {\n      encounter_id\n      appointment_id\n      patient_id\n      patient_name\n      owner_name\n      client_id\n      provider_id\n      provider_name\n      date\n      time\n      visit_reason\n      assessment\n      status\n      bucket\n      to_confirm\n      followups_undecided\n      reason\n      waiting_days\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VoiceProfile($id: String!) {\n    voice_profile(provider_id: $id) {\n      source\n      notes_used\n    }\n  }\n"): (typeof documents)["\n  query VoiceProfile($id: String!) {\n    voice_profile(provider_id: $id) {\n      source\n      notes_used\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PreviousNotes($id: String!) {\n    patient_notes(patient_id: $id) {\n      id\n      date\n      provider_id\n      provider_name\n      text\n      source\n      sections {\n        label\n        text\n      }\n    }\n  }\n"): (typeof documents)["\n  query PreviousNotes($id: String!) {\n    patient_notes(patient_id: $id) {\n      id\n      date\n      provider_id\n      provider_name\n      text\n      source\n      sections {\n        label\n        text\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SampleTranscript($appointment: String!) {\n    sample_transcript(appointment_id: $appointment)\n  }\n"): (typeof documents)["\n  query SampleTranscript($appointment: String!) {\n    sample_transcript(appointment_id: $appointment)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Search($q: String!) {\n    search(q: $q) {\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        client_id\n        owner_name\n        last_visit {\n          ...LastVisitFields\n        }\n        next_visit {\n          date\n          time\n          appointment_id\n        }\n      }\n      owners {\n        id\n        name\n        phone\n        email\n        pets\n      }\n    }\n  }\n"): (typeof documents)["\n  query Search($q: String!) {\n    search(q: $q) {\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        client_id\n        owner_name\n        last_visit {\n          ...LastVisitFields\n        }\n        next_visit {\n          date\n          time\n          appointment_id\n        }\n      }\n      owners {\n        id\n        name\n        phone\n        email\n        pets\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AssistLinkFields on AssistLink {\n    label\n    to\n    appointment_id\n    encounter_id\n    date\n    patient_id\n    client_id\n    document_id\n  }\n"): (typeof documents)["\n  fragment AssistLinkFields on AssistLink {\n    label\n    to\n    appointment_id\n    encounter_id\n    date\n    patient_id\n    client_id\n    document_id\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Ask($input: AssistantInput!) {\n    ask_assistant(input: $input) {\n      reply\n      tools_used\n      links {\n        ...AssistLinkFields\n      }\n      sources {\n        ...AssistLinkFields\n      }\n      followups\n    }\n  }\n"): (typeof documents)["\n  mutation Ask($input: AssistantInput!) {\n    ask_assistant(input: $input) {\n      reply\n      tools_used\n      links {\n        ...AssistLinkFields\n      }\n      sources {\n        ...AssistLinkFields\n      }\n      followups\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription AssistantTurn($id: String!) {\n    assistant_turn(turn_id: $id) {\n      kind\n      text\n    }\n  }\n"): (typeof documents)["\n  subscription AssistantTurn($id: String!) {\n    assistant_turn(turn_id: $id) {\n      kind\n      text\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PatientVisits($id: String!, $related: String!) {\n    patient_visits(patient_id: $id, related_to: $related) {\n      id\n      date\n      appointment_id\n      type\n      kind\n      reason\n      provider_name\n      summary\n      related\n      note\n      sections {\n        label\n        text\n      }\n      medications\n      photos {\n        id\n        caption\n        url\n      }\n    }\n  }\n"): (typeof documents)["\n  query PatientVisits($id: String!, $related: String!) {\n    patient_visits(patient_id: $id, related_to: $related) {\n      id\n      date\n      appointment_id\n      type\n      kind\n      reason\n      provider_name\n      summary\n      related\n      note\n      sections {\n        label\n        text\n      }\n      medications\n      photos {\n        id\n        caption\n        url\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PatientProfile($id: String!) {\n    patient_profile(patient_id: $id) {\n      mock\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        color\n        microchip\n      }\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n          note\n        }\n      }\n      reminders_due {\n        patient_id\n        patient_name\n        text\n        due\n      }\n      client {\n        ...ClientCardFields\n      }\n      other_pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        last_visit {\n          ...LastVisitFields\n        }\n        due\n      }\n    }\n  }\n"): (typeof documents)["\n  query PatientProfile($id: String!) {\n    patient_profile(patient_id: $id) {\n      mock\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        color\n        microchip\n      }\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n          note\n        }\n      }\n      reminders_due {\n        patient_id\n        patient_name\n        text\n        due\n      }\n      client {\n        ...ClientCardFields\n      }\n      other_pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        last_visit {\n          ...LastVisitFields\n        }\n        due\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Invoices($id: String!) {\n    client_invoices(client_id: $id) {\n      balance\n      last_12_months\n      last_payment\n      counts\n      mock\n      invoices {\n        id\n        date\n        patient_id\n        patient_name\n        visit\n        provider_name\n        total\n        status\n        paid_by\n        items {\n          name\n          qty\n          price\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Invoices($id: String!) {\n    client_invoices(client_id: $id) {\n      balance\n      last_12_months\n      last_payment\n      counts\n      mock\n      invoices {\n        id\n        date\n        patient_id\n        patient_name\n        visit\n        provider_name\n        total\n        status\n        paid_by\n        items {\n          name\n          qty\n          price\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Household($id: String!) {\n    client_household(client_id: $id) {\n      balance\n      book_url\n      spend_12m\n      mock\n      client {\n        ...ClientCardFields\n      }\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        due\n        next_due {\n          text\n          due\n          state\n        }\n        tags\n        alert_tags\n        spend_12m\n        last_visit {\n          ...LastVisitFields\n        }\n        today {\n          appointment_id\n          time\n          reason\n          visit_status\n          encounter_id\n        }\n      }\n      coming_up {\n        date\n        text\n        patient_name\n      }\n      messages {\n        at\n        direction\n        text\n      }\n      remember {\n        ...RememberFields\n      }\n    }\n  }\n"): (typeof documents)["\n  query Household($id: String!) {\n    client_household(client_id: $id) {\n      balance\n      book_url\n      spend_12m\n      mock\n      client {\n        ...ClientCardFields\n      }\n      pets {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n        due\n        next_due {\n          text\n          due\n          state\n        }\n        tags\n        alert_tags\n        spend_12m\n        last_visit {\n          ...LastVisitFields\n        }\n        today {\n          appointment_id\n          time\n          reason\n          visit_status\n          encounter_id\n        }\n      }\n      coming_up {\n        date\n        text\n        patient_name\n      }\n      messages {\n        at\n        direction\n        text\n      }\n      remember {\n        ...RememberFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Documents($id: String!) {\n    patient_documents(patient_id: $id) {\n      ...DocumentFields\n    }\n  }\n"): (typeof documents)["\n  query Documents($id: String!) {\n    patient_documents(patient_id: $id) {\n      ...DocumentFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ClientRemember($id: String!) {\n    client_remember(client_id: $id) {\n      ...RememberFields\n    }\n  }\n"): (typeof documents)["\n  query ClientRemember($id: String!) {\n    client_remember(client_id: $id) {\n      ...RememberFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Forget($client: String!, $item: String!) {\n    forget_remember(client_id: $client, item_id: $item)\n  }\n"): (typeof documents)["\n  mutation Forget($client: String!, $item: String!) {\n    forget_remember(client_id: $client, item_id: $item)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Encounter($id: String!) {\n    encounter(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  query Encounter($id: String!) {\n    encounter(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Group($group: String!) {\n    encounters(group_id: $group) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  query Group($group: String!) {\n    encounters(group_id: $group) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartEncounter($input: NewEncounterInput!) {\n    start_encounter(input: $input) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation StartEncounter($input: NewEncounterInput!) {\n    start_encounter(input: $input) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddTranscript($id: String!, $text: String!, $append: Boolean!) {\n    add_transcript(encounter_id: $id, text: $text, append: $append) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation AddTranscript($id: String!, $text: String!, $append: Boolean!) {\n    add_transcript(encounter_id: $id, text: $text, append: $append) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DraftNote($id: String!) {\n    draft_note(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation DraftNote($id: String!) {\n    draft_note(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription DraftProgress($id: String!) {\n    draft_progress(encounter_id: $id) {\n      run_id\n      step\n      state\n      detail\n      patient_name\n    }\n  }\n"): (typeof documents)["\n  subscription DraftProgress($id: String!) {\n    draft_progress(encounter_id: $id) {\n      run_id\n      step\n      state\n      detail\n      patient_name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdatePhoto($id: String!, $photo: String!, $input: PhotoEditInput!) {\n    update_photo(encounter_id: $id, photo_id: $photo, input: $input) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation UpdatePhoto($id: String!, $photo: String!, $input: PhotoEditInput!) {\n    update_photo(encounter_id: $id, photo_id: $photo, input: $input) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeletePhoto($id: String!, $photo: String!) {\n    delete_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation DeletePhoto($id: String!, $photo: String!) {\n    delete_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RestorePhoto($id: String!, $photo: String!) {\n    restore_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation RestorePhoto($id: String!, $photo: String!) {\n    restore_photo(encounter_id: $id, photo_id: $photo) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveNote($id: String!, $note: SoapNoteInput!) {\n    save_note(encounter_id: $id, note: $note) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation SaveNote($id: String!, $note: SoapNoteInput!) {\n    save_note(encounter_id: $id, note: $note) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NoteTypes {\n    note_types {\n      id\n      name\n      sections {\n        key\n        label\n      }\n    }\n  }\n"): (typeof documents)["\n  query NoteTypes {\n    note_types {\n      id\n      name\n      sections {\n        key\n        label\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetNoteType($id: String!, $type: String!) {\n    set_note_type(encounter_id: $id, note_type: $type) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation SetNoteType($id: String!, $type: String!) {\n    set_note_type(encounter_id: $id, note_type: $type) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Assist($id: String!, $input: AssistInput!) {\n    assist(encounter_id: $id, input: $input) {\n      suggestion\n      refused\n      mock\n      unsourced\n      sources {\n        sentence\n        lines\n        text\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation Assist($id: String!, $input: AssistInput!) {\n    assist(encounter_id: $id, input: $input) {\n      suggestion\n      refused\n      mock\n      unsourced\n      sources {\n        sentence\n        lines\n        text\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Templates($type: String!) {\n    templates(note_type: $type) {\n      id\n      name\n      shortcut\n      text\n      note_type\n      owner\n    }\n  }\n"): (typeof documents)["\n  query Templates($type: String!) {\n    templates(note_type: $type) {\n      id\n      name\n      shortcut\n      text\n      note_type\n      owner\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FollowUp($id: String!, $followup: String!, $input: FollowUpActionInput!) {\n    act_on_followup(encounter_id: $id, followup_id: $followup, input: $input) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation FollowUp($id: String!, $followup: String!, $input: FollowUpActionInput!) {\n    act_on_followup(encounter_id: $id, followup_id: $followup, input: $input) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddPetToVisit($id: String!, $patient: String!) {\n    add_pet_to_visit(encounter_id: $id, patient_id: $patient) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation AddPetToVisit($id: String!, $patient: String!) {\n    add_pet_to_visit(encounter_id: $id, patient_id: $patient) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetPlanChecks($appointment: String!, $patient: String!, $lines: [String!]!) {\n    set_plan_checks(appointment_id: $appointment, patient_id: $patient, lines: $lines)\n  }\n"): (typeof documents)["\n  mutation SetPlanChecks($appointment: String!, $patient: String!, $lines: [String!]!) {\n    set_plan_checks(appointment_id: $appointment, patient_id: $patient, lines: $lines)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PlanReminder($id: String!, $reminder: String!, $action: String!) {\n    act_on_plan_reminder(encounter_id: $id, reminder_id: $reminder, action: $action) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation PlanReminder($id: String!, $reminder: String!, $action: String!) {\n    act_on_plan_reminder(encounter_id: $id, reminder_id: $reminder, action: $action) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query WaitingLinks {\n    waiting_followups {\n      ...WaitingFields\n    }\n  }\n"): (typeof documents)["\n  query WaitingLinks {\n    waiting_followups {\n      ...WaitingFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResendLink($followup: String!) {\n    resend_booking_link(followup_id: $followup) {\n      ...WaitingFields\n    }\n  }\n"): (typeof documents)["\n  mutation ResendLink($followup: String!) {\n    resend_booking_link(followup_id: $followup) {\n      ...WaitingFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RememberSuggestions($id: String!) {\n    remember_suggestions(encounter_id: $id) {\n      left_out\n      mock\n      suggestions {\n        id\n        text\n        kind\n        date\n        transcript_lines\n        said_by\n        kept\n      }\n    }\n  }\n"): (typeof documents)["\n  query RememberSuggestions($id: String!) {\n    remember_suggestions(encounter_id: $id) {\n      left_out\n      mock\n      suggestions {\n        id\n        text\n        kind\n        date\n        transcript_lines\n        said_by\n        kept\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation KeepRemember($id: String!, $keep: [String!]!) {\n    keep_remember(encounter_id: $id, keep: $keep) {\n      ...RememberFields\n    }\n  }\n"): (typeof documents)["\n  mutation KeepRemember($id: String!, $keep: [String!]!) {\n    keep_remember(encounter_id: $id, keep: $keep) {\n      ...RememberFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignNote($id: String!, $by: String!, $send: Boolean!) {\n    sign_note(encounter_id: $id, signed_by: $by, send: $send) {\n      encounter {\n        ...EncounterFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SignNote($id: String!, $by: String!, $send: Boolean!) {\n    sign_note(encounter_id: $id, signed_by: $by, send: $send) {\n      encounter {\n        ...EncounterFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query OwnerSummary($id: String!, $lang: String!) {\n    owner_summary(encounter_id: $id, lang: $lang) {\n      language\n      when_to_call\n      translated\n      mock\n      clinic {\n        name\n        address\n        phone\n        logo_url\n      }\n      visit {\n        date\n        start\n        when\n        provider_name\n      }\n      owner_name\n      pets {\n        patient_id\n        name\n        species\n        breed\n        sex\n        age\n        age_text\n        for_owner\n        medicines\n        home_care\n        next_visit {\n          kind\n          text\n          url\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query OwnerSummary($id: String!, $lang: String!) {\n    owner_summary(encounter_id: $id, lang: $lang) {\n      language\n      when_to_call\n      translated\n      mock\n      clinic {\n        name\n        address\n        phone\n        logo_url\n      }\n      visit {\n        date\n        start\n        when\n        provider_name\n      }\n      owner_name\n      pets {\n        patient_id\n        name\n        species\n        breed\n        sex\n        age\n        age_text\n        for_owner\n        medicines\n        home_care\n        next_visit {\n          kind\n          text\n          url\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Share($id: String!, $channel: String!, $lang: String!) {\n    share_summary(encounter_id: $id, channel: $channel, language: $lang) {\n      channel\n      language\n      status\n      detail\n      text\n      url\n      expires_at\n      translated\n    }\n  }\n"): (typeof documents)["\n  mutation Share($id: String!, $channel: String!, $lang: String!) {\n    share_summary(encounter_id: $id, channel: $channel, language: $lang) {\n      channel\n      language\n      status\n      detail\n      text\n      url\n      expires_at\n      translated\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetTwoFactor($enabled: Boolean!) {\n    set_two_factor(enabled: $enabled) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation SetTwoFactor($enabled: Boolean!) {\n    set_two_factor(enabled: $enabled) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConnectOAuth($provider: String!, $current: String!) {\n    connect_oauth_account(provider: $provider, current_password: $current)\n  }\n"): (typeof documents)["\n  mutation ConnectOAuth($provider: String!, $current: String!) {\n    connect_oauth_account(provider: $provider, current_password: $current)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignOutEverywhere {\n    sign_out_everywhere\n  }\n"): (typeof documents)["\n  mutation SignOutEverywhere {\n    sign_out_everywhere\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignOutOthers {\n    sign_out_other_sessions\n  }\n"): (typeof documents)["\n  mutation SignOutOthers {\n    sign_out_other_sessions\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateMyProfile($name: String, $email: String, $current: String!) {\n    update_my_profile(name: $name, email: $email, current_password: $current) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateMyProfile($name: String, $email: String, $current: String!) {\n    update_my_profile(name: $name, email: $email, current_password: $current) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangePassword($next: String!, $current: String!) {\n    change_password(new_password: $next, current_password: $current)\n  }\n"): (typeof documents)["\n  mutation ChangePassword($next: String!, $current: String!) {\n    change_password(new_password: $next, current_password: $current)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ConnectedAccounts {\n    my_connected_accounts {\n      provider\n      email\n      connected_at\n    }\n  }\n"): (typeof documents)["\n  query ConnectedAccounts {\n    my_connected_accounts {\n      provider\n      email\n      connected_at\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DisconnectAccount($provider: String!, $current: String!) {\n    disconnect_oauth_account(provider: $provider, current_password: $current)\n  }\n"): (typeof documents)["\n  mutation DisconnectAccount($provider: String!, $current: String!) {\n    disconnect_oauth_account(provider: $provider, current_password: $current)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment LetterFields on Letter {\n    id\n    patient_id\n    patient_name\n    encounter_id\n    kind\n    recipient {\n      name\n      clinic\n      email\n    }\n    reason\n    urgency\n    attachments {\n      note_encounter_ids\n      photos {\n        encounter_id\n        photo_id\n      }\n      document_ids\n      invoice_ids\n    }\n    body\n    owner_consent\n    status\n    drafted\n    created_at\n    updated_at\n    signed_by\n    signer_title\n    signed_at\n    sent_to\n    opened_at\n    sent {\n      channel\n      to_masked\n      at\n      status\n      detail\n    }\n    pdf_url\n  }\n"): (typeof documents)["\n  fragment LetterFields on Letter {\n    id\n    patient_id\n    patient_name\n    encounter_id\n    kind\n    recipient {\n      name\n      clinic\n      email\n    }\n    reason\n    urgency\n    attachments {\n      note_encounter_ids\n      photos {\n        encounter_id\n        photo_id\n      }\n      document_ids\n      invoice_ids\n    }\n    body\n    owner_consent\n    status\n    drafted\n    created_at\n    updated_at\n    signed_by\n    signer_title\n    signed_at\n    sent_to\n    opened_at\n    sent {\n      channel\n      to_masked\n      at\n      status\n      detail\n    }\n    pdf_url\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Letters($patient: String!) {\n    letters(patient_id: $patient) {\n      ...LetterFields\n    }\n  }\n"): (typeof documents)["\n  query Letters($patient: String!) {\n    letters(patient_id: $patient) {\n      ...LetterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Letter($id: String!) {\n    letter(id: $id) {\n      ...LetterFields\n    }\n  }\n"): (typeof documents)["\n  query Letter($id: String!) {\n    letter(id: $id) {\n      ...LetterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Contacts($q: String!) {\n    contacts(q: $q) {\n      name\n      clinic\n      email\n    }\n  }\n"): (typeof documents)["\n  query Contacts($q: String!) {\n    contacts(q: $q) {\n      name\n      clinic\n      email\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateLetter($patient: String!, $encounter: String!, $input: LetterInput, $draft: Boolean!) {\n    create_letter(patient_id: $patient, encounter_id: $encounter, input: $input, draft: $draft) {\n      ...LetterFields\n    }\n  }\n"): (typeof documents)["\n  mutation CreateLetter($patient: String!, $encounter: String!, $input: LetterInput, $draft: Boolean!) {\n    create_letter(patient_id: $patient, encounter_id: $encounter, input: $input, draft: $draft) {\n      ...LetterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DraftLetter($id: String!) {\n    draft_letter(id: $id) {\n      ...LetterFields\n    }\n  }\n"): (typeof documents)["\n  mutation DraftLetter($id: String!) {\n    draft_letter(id: $id) {\n      ...LetterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateLetter($id: String!, $input: LetterInput!) {\n    update_letter(id: $id, input: $input) {\n      ...LetterFields\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateLetter($id: String!, $input: LetterInput!) {\n    update_letter(id: $id, input: $input) {\n      ...LetterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendLetter($id: String!, $channels: [String!]!, $to: String!, $ownerCopy: Boolean!) {\n    send_letter(id: $id, channels: $channels, to_email: $to, owner_copy: $ownerCopy) {\n      letter {\n        ...LetterFields\n      }\n      results {\n        channel\n        status\n        detail\n        to\n        subject\n        body\n        text\n        url\n        pdf_url\n        expires_at\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SendLetter($id: String!, $channels: [String!]!, $to: String!, $ownerCopy: Boolean!) {\n    send_letter(id: $id, channels: $channels, to_email: $to, owner_copy: $ownerCopy) {\n      letter {\n        ...LetterFields\n      }\n      results {\n        channel\n        status\n        detail\n        to\n        subject\n        body\n        text\n        url\n        pdf_url\n        expires_at\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteLetter($id: String!) {\n    delete_letter(id: $id)\n  }\n"): (typeof documents)["\n  mutation DeleteLetter($id: String!) {\n    delete_letter(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SpeechOptions {\n    speech_options {\n      available\n      default_voice\n      voices {\n        id\n        name\n        language\n        gender\n      }\n    }\n  }\n"): (typeof documents)["\n  query SpeechOptions {\n    speech_options {\n      available\n      default_voice\n      voices {\n        id\n        name\n        language\n        gender\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartAuthenticator($current: String!) {\n    start_authenticator(current_password: $current) {\n      secret\n      otpauth_uri\n    }\n  }\n"): (typeof documents)["\n  mutation StartAuthenticator($current: String!) {\n    start_authenticator(current_password: $current) {\n      secret\n      otpauth_uri\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConfirmAuthenticator($code: String!) {\n    confirm_authenticator(code: $code) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation ConfirmAuthenticator($code: String!) {\n    confirm_authenticator(code: $code) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveAuthenticator($current: String!) {\n    remove_authenticator(current_password: $current) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveAuthenticator($current: String!) {\n    remove_authenticator(current_password: $current) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Doctors {\n    doctors {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query Doctors {\n    doctors {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetUserTwoFactor($id: String!, $required: Boolean!) {\n    set_user_two_factor(user_id: $id, required: $required) {\n      ...UserFields\n    }\n  }\n"): (typeof documents)["\n  mutation SetUserTwoFactor($id: String!, $required: Boolean!) {\n    set_user_two_factor(user_id: $id, required: $required) {\n      ...UserFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Letterhead {\n    letterhead {\n      name\n      address\n      phone\n      logo_url\n      pims_name\n    }\n  }\n"): (typeof documents)["\n  query Letterhead {\n    letterhead {\n      name\n      address\n      phone\n      logo_url\n      pims_name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation NameSpeaker($id: String!, $speaker: String!, $role: String!, $name: String!) {\n    name_speaker(encounter_id: $id, speaker_id: $speaker, role: $role, name: $name) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation NameSpeaker($id: String!, $speaker: String!, $role: String!, $name: String!) {\n    name_speaker(encounter_id: $id, speaker_id: $speaker, role: $role, name: $name) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarkPrescriptionEntered($id: String!) {\n    mark_prescription_entered(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"): (typeof documents)["\n  mutation MarkPrescriptionEntered($id: String!) {\n    mark_prescription_entered(encounter_id: $id) {\n      ...EncounterFields\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendToPims($id: String!) {\n    send_to_pims(encounter_id: $id) {\n      ok\n      status\n      detail\n      pims_id\n    }\n  }\n"): (typeof documents)["\n  mutation SendToPims($id: String!) {\n    send_to_pims(encounter_id: $id) {\n      ok\n      status\n      detail\n      pims_id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SignPreview($id: String!) {\n    sign_preview(encounter_id: $id) {\n      pims_name\n      patient {\n        name\n        pims_id\n      }\n      owner {\n        name\n        pims_id\n      }\n      appointment {\n        id\n        start\n        patient_name\n        owner_name\n      }\n      matches\n      mismatch\n      note\n      photos\n      prescription\n      texts {\n        followup_id\n        kind\n        reason\n        message\n      }\n    }\n  }\n"): (typeof documents)["\n  query SignPreview($id: String!) {\n    sign_preview(encounter_id: $id) {\n      pims_name\n      patient {\n        name\n        pims_id\n      }\n      owner {\n        name\n        pims_id\n      }\n      appointment {\n        id\n        start\n        patient_name\n        owner_name\n      }\n      matches\n      mismatch\n      note\n      photos\n      prescription\n      texts {\n        followup_id\n        kind\n        reason\n        message\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecordPanel($id: String!) {\n    record_panel(patient_id: $id) {\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n      }\n      pims_patient_id\n      pims_client_id\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n        }\n      }\n      reminders_due {\n        patient_id\n        text\n        due\n      }\n      recent_visits {\n        id\n        date\n        kind\n        type\n        reason\n        provider_name\n      }\n      client {\n        id\n        name\n        first_name\n        last_name\n        phones\n        emails\n        prefers\n      }\n      other_pets {\n        id\n        name\n      }\n      mock\n    }\n  }\n"): (typeof documents)["\n  query RecordPanel($id: String!) {\n    record_panel(patient_id: $id) {\n      patient {\n        id\n        name\n        species\n        breed\n        age\n        sex\n        alerts\n      }\n      pims_patient_id\n      pims_client_id\n      weight {\n        latest {\n          date\n          value\n          unit\n        }\n        previous {\n          date\n          value\n          unit\n        }\n        history {\n          date\n          value\n          unit\n        }\n      }\n      reminders_due {\n        patient_id\n        text\n        due\n      }\n      recent_visits {\n        id\n        date\n        kind\n        type\n        reason\n        provider_name\n      }\n      client {\n        id\n        name\n        first_name\n        last_name\n        phones\n        emails\n        prefers\n      }\n      other_pets {\n        id\n        name\n      }\n      mock\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;