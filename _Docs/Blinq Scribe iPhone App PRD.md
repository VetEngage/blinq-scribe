# Blinq Scribe iPhone App: PRD and Spec

Oct 29, 2026 · Mayra Vazquez · For Muse Code to build

This document is the brief for the iPhone companion app. The main product PRD is `_Docs/Blinq Scribe PRD and Product Spec.md`. Read both before writing code. Where a screen here follows the web, the main PRD requirement is named in the row.

## Summary

The iPhone app connects Meta AI glasses to the Blinq Scribe server. The provider wears the glasses and keeps the phone in a pocket. The app records the exam through the glasses mic, takes photos on request, speaks short confirmations through the glasses speakers, and asks the day assistant questions. Review, edit and signing stay in the web console.

The app is thin on purpose. All AI work, all practice data and all texting happen on the server. The app only talks to the Blinq Scribe server over HTTPS.

**Practice data (updated Oct 30).** The server reads clinic data from the demo PIMS (the synthetic clinic) or, for a pilot, from the clinic's PIMS. The switch is server side only: the app's API calls, models and screens do not change. The app never holds a PIMS credential. What the app does see:

- `GET /health` returns `practice`: `mock` for the synthetic clinic, or the name of the clinic's PIMS connector. Settings shows it, so the provider knows whether they are on the synthetic clinic or real data.
- With live data, a patient can have no alerts, no breed or no age. Every one of those fields is optional in the app's models and the screens leave the space empty.
- Schedule IDs from a live PIMS are strings that may not look like the synthetic ones. Treat every ID as an opaque string.

**Platform:** iOS 17.2 or later (the toolkit's minimum). Built with Expo (React Native) and TypeScript, the team's usual mobile stack: expo-router, Apollo Client against the server's GraphQL API, and the token in expo-secure-store. The Meta Wearables Device Access Toolkit, the 16 kHz audio chunks and the camera run in an Expo native module written in Swift. The SwiftUI app Muse Code built first is where that Swift code comes from. Android later, with a Kotlin native module.

## Problem

In the exam room the provider's hands are on the patient. Today they stop to type, tap a tablet or hold up a phone for a photo. Each stop breaks the exam and the record suffers. The glasses already have a mic, a camera and speakers on the provider's head. The phone should make them do the work without the provider touching it after the visit starts.

## Users

| User | Job | What the app gives them |
| --- | --- | --- |
| Veterinarian (only user) | Capture the exam without touching a device | Mic, camera and voice replies through the glasses |
| Technician (sometimes) | Start the visit for the provider | Consent and start on the phone screen |

## Goals and success measures

1. A full visit runs from the phone with no errors: start, record, photo, draft, ask. Three times in a row.
2. Audio chunks reach the server within 5 seconds of being cut.
3. Spoken replies come out of the glasses, not the phone, when the glasses are connected.
4. Works with Meta's mock device, so it can be tested without glasses.
5. Judges can build it from the README in one sitting.

## Scope

| In scope | Out of scope |
| --- | --- |
| Settings: server URL, API token, test connection | Long note edits and templates (easier on the web) |
| Today: schedule, morning brief spoken; the same tabs as the web top bar | Writing letters (web only) |
| Start visit with owner consent | Calling Telnyx, the PIMS or Meta Model API directly |
| Record from the glasses mic in 15 second chunks | Local speech to text |
| Photo from the glasses camera, phone camera fallback | Video streaming to the server |
| Draft note, spoken confirmation | Offline mode |
| Ask Blinq by text, and by hold to talk on the composer's mic | Push notifications |
| Lens display card (only if Ray-Ban Display is on hand) | Android |
| Review the note, approve follow ups, sign (Sign only or Sign and send to PIMS), PIMS status, share the summary, End of day | |

## Requirements

P0 must work for the demo. P1 makes it strong. P2 if time allows.

| # | Requirement | Priority |
| --- | --- | --- |
| 1 | Settings screen: server URL (default `http://192.168.1.10:8000`), optional API token. URL in UserDefaults, token in Keychain. "Test connection" calls `GET /health` and shows the result, including the practice data source (`practice`: synthetic clinic or the clinic's PIMS) | P0 |
| 2 | Today screen: `GET /api/brief` and `GET /api/schedule`. List of appointments. "Morning brief" speaks `brief.spoken` | P0 |
| 3 | Pre-room card: tapping an appointment calls `GET /api/appointments/{id}/card` and speaks `card.spoken` | P1 |
| 4 | Start visit: the one green main button at the bottom of Before you walk in (not in the banner) opens a sheet, "Did Jordan agree to recording?" with Owner agreed, start and Not yet. Owner agreed, start posts `/api/encounters` with `consent_recorded: true`, `source: "glasses"`. Recording is impossible before this succeeds (main PRD requirement 70) | P0 |
| 5 | Record: glasses mic over Bluetooth HFP. 16 kHz mono 16-bit PCM, cut into 15 second WAV chunks, each uploaded to `POST /api/encounters/{id}/audio` as multipart. Final partial chunk on stop. Up to 3 retries per chunk, then an on-screen error | P0 |
| 6 | Show which mic is active: glasses or phone | P0 |
| 7 | Photo: capture from the glasses camera through the Meta Wearables Device Access Toolkit, upload to `POST /api/encounters/{id}/photos` with an optional `hint`. Phone camera fallback when the glasses camera is unavailable, and say so on screen | P0 |
| 8 | Draft note: a green main button with Blinq's sparkle and the help line "Stops recording and drafts the note with Blinq" (main PRD requirement 70). `POST /api/encounters/{id}/draft`, then speak "Note drafted with N follow ups. Review it on your phone or the web." | P0 |
| 9 | Ask: the composer's field posts `/api/assistant` and speaks the reply. The screen is requirement 34 | P1 |
| 10 | Hold to talk for Ask on the composer's mic (requirement 34, main PRD requirement 71): hold, speak, release to send, slide left to cancel. The audio goes to the server's short audio speech to text endpoint, which the web session is adding (path and fields to confirm once merged). `SFSpeechRecognizer` stays an option for live captions | P2 |
| 11 | Spoken confirmations through the active audio route: "Visit started", "Recording", "Recording stopped", "Photo saved", "Note drafted" | P0 |
| 12 | Mock device toggle in Settings (debug builds) using the toolkit's MockDeviceKit | P0 |
| 13 | Lens display card on Ray-Ban Display: patient name, reason, one alert from the pre-room card | P2 |
| 14 | Morning brief once a day: the card is one sentence (requirement 35). Got it collapses it to a "Morning brief" row with Show again (remember per day) | P1 |
| 15 | Week strip on Today: 7 days with markers from `GET /api/days` (a neutral selected day, a gray dot = still open, red = failed, a small check = all done). Tap a day: `GET /api/schedule?date=` | P1 |
| 16 | "N left from yesterday" row on Today, from the carried over items in `GET /api/brief`. It opens To do, grouped by action (for example Sign, Resend, Approve), with failed items first in red | P1 |
| 17 | Search screen: `GET /api/search?q=` as you type, pets then owners. Tap a pet: Before you walk in if it's on today's schedule, otherwise its record | P1 |
| 18 | Before you walk in adds: pets in this visit (owner's other pets as chips), note type (from the visit type, changeable), and a patient record snapshot: last 3 visits, owner contact preference and other pets, outside record summaries with page numbers. Invoices stay in the web console | P1 |
| 19 | Review the note (was Note drafted): one note per pet with a switch, the note type, the SOAP sections with things to confirm marked, tap a section to edit it or ask Blinq. Long edits are easier on the web, and both stay in sync | P1 |
| 20 | Ask suggestions: one row of 3 chips with the same height and one line of centered text; if they don't fit, the row scrolls sideways. The first set comes from `suggestions` in `GET /api/brief` (for example What's first?, Miso's results, What needs me?). After each answer, the follow up suggestions replace them. Never a treatment question: "Should I add an antifungal?" is removed from every suggestion list. Clinical questions the provider types come back as "That's your call" plus the facts | P1 |
| 21 | Household screen from an owner in search: call and text buttons, every pet with today's visit or what's due (tap a pet with a visit today: Before you walk in), latest texts, balance. `GET /api/clients/{id}/household` | P1 |
| 22 | Remember on Before you walk in: milestones from past visits the provider chose to keep, under a gray Remember label, never a warning ("Nov 2 is 6 years since Jordan adopted Biscuit"), part of `card.spoken` so the glasses read them before the provider walks in. Note drafted shows "N things to remember" and Follow ups say "Booking link to Jordan"; choosing what to keep and the booking link happen in the console | P1 |
| 23 | Sign in screen: email and password, Continue with Google or Microsoft, a 6 digit code when 2FA is on, and Try the demo clinic in demo mode. The token goes in expo-secure-store. The server address stays in Settings | P1 |
| 24 | Loading states: while recording, a pulsing red dot, level bars that move with the mic and "Sending part N"; after Draft note, the steps until the draft is ready, then Note drafted; on Ask Blinq, typing dots and what it's checking. Respect Reduce Motion | P1 |
| 25 | Connect glasses in Settings: Connect glasses calls the toolkit's `startRegistration()`, which opens the Meta AI app to approve Blinq Scribe; the return link goes to `handleUrl`. Show the status (Not connected, Approve in the Meta AI app, Connected, Approved but glasses not nearby), the glasses' name and battery, Disconnect glasses, and Update glasses software when the toolkit says the firmware is too old. Needs Developer Mode in the Meta AI app until the app is published | P0 |
| 26 | Photo sheets: Capture photo opens a sheet with Glasses or Phone, the live view, the "What is it?" hint and a shutter (saying "capture" works too). Then an edit sheet: the outline (shown as it's made), crop, rotate, Blinq's description, Add to the note, Retake or Use photo. `PATCH /api/encounters/{id}/photos/{photo_id}` saves the changes | P1 |
| 27 | Heard so far: while recording, the newest transcript lines with who said each one (provider, owner, or Speaker 3 until the provider taps Who is this? and picks Tech, Family member or Another provider) | P1 |
| 28 | Tab bar like the web top bar: Today, Search, Ask Blinq, End of day and Settings. It shows on every screen except while recording. Ask Blinq is a tab, not a floating button | P1 |
| 29 | Visit banner on Before you walk in, Recording, Review the note and Signed, the same as the web (main PRD requirement 67): the pet (species icon and name, with breed, sex, age and last weight as one gray line), the appointment (time, length, room, provider and the state as one gray line, such as Checked in 9:24 AM or Signed by Dr. Ana Rivera at 9:28 AM), the owner (name in ink opens the record, phone and how they like to hear from us in gray) and Patient record, the banner's only button; then the reason, cautions and the last visit. Cautions are an amber dot (the web's `caution` amber) with the full plain text on their own line under the reason, and nothing when there are none (no "No alerts"). The banner has no Start visit or Draft note. Patient record opens the pet and owner record as a sheet titled "<Pet>'s patient record" (alerts, weight, what's due, recent visits, owner contact, PIMS ids) without leaving the screen | P1 |
| 30 | Sign on the phone, the same as the web (main PRD requirement 65): the sign card shows who signs and which PIMS record it goes to, then Sign and send to PIMS (default) or Sign only. One tap; a check appears only when the PIMS record doesn't match the appointment. Follow ups are approved or dismissed on the same screen. `POST /api/encounters/{id}/sign` with `send_to_pims` | P1 |
| 31 | Signed screen: the PIMS card (Sending, Synced to PIMS, Not in PIMS yet with Send to PIMS, Couldn't save with Try again), texts to the owner, Share the visit summary (Text a link or Email a PDF) and Next visit. `POST /api/encounters/{id}/send-to-pims`, `POST /api/encounters/{id}/share` | P1 |
| 32 | End of day tab, the same as the web: Before you go first (every open item, the same list and count as To do, with one green action), Blinq's one sentence (play in glasses), Waiting on owners with Resend, and Tomorrow with one row per visit. The To do row is hidden here. `GET /api/end-of-day`, `GET /api/followups/waiting` | P1 |
| 33 | Household and pets, the same as the web (main PRD requirement 69): one list of pets in one box, the whole row opens the pet, with a species tile, the name with its tags, species, breed and age, next due (ink text, never amber) and a chevron; pets with a visit today first, then A to Z. The pet count is only in the header line, and the list title is just "Pets"; no green button. The Patient record sheet shows "N pets" and the names on one line, with Household to see them all | P1 |
| 34 | Ask Blinq screen (main PRD requirement 71). It opens with the brief as Blinq's first message, at the top, under a gray scope line "Your day · Sun Nov 1" ("<Pet>'s visit" when opened from a visit). The brief ends with "Want to hear more?". Then one row of 3 suggestions (requirement 20) and one composer, the text field, which is always the default input, with a mic inside: hold to talk when the field is empty, a send arrow when there is text. Follow ups replace the suggestions above it. There is no separate Hold to talk bar, no separate send button, no "Anything else?" prompt, no Talk button and no "Type instead" swap. Your messages are light gray; Blinq's answers are plain ink, with times and lab values in the mono face. Each answer has a small gray source line ("Kidney panel, received 12:40 AM · Last visit Aug 14"), neutral link chips (Open Miso's visit, Open her record) and new follow up suggestions. An answer is 2 or 3 plain spoken sentences: no markdown, no veterinary shorthand, no "[confirm]" markers, and never a repeat of what is on screen; spoken shorthand is expanded ("6yo" is said as "6 year old"). Listening: holding the mic turns the composer into a voice bar with a purple level meter and live captions, with "Release to send · slide left to cancel" under it. Speaking: the answer fills in as captions while Blinq speaks (spoken words in ink, the rest light gray, the failed item red), with one Stop (the Read aloud button) and nothing duplicated; hold the mic to cut in. A clinical question gets "That's your call" plus the facts Blinq has (for example the cytology findings and the current drug and dose), with links to the note and past visits; the screen never suggests a treatment question. Green is only the mic or send arrow and the selected tab; purple is only Blinq's mark, its closing question and the level meter. Reduce Motion stops the meters. Design reference: the Ask Blinq mockup and its annotated board (`ask-blinq.png`, `ask-blinq-annotated.png`), kept outside the repo | P1 |
| 35 | Today's brief as one sentence (main PRD requirements 36 and 71). The brief card on Today is one sentence with the counts in bold and the failed item in red ("5 visits today. 5 things need you, including 1 text that didn't send. 2 new since yesterday."), ending with "Want to hear more?". Tapping it, or a suggestion, opens Ask Blinq with the brief as the first message. `GET /api/brief` gives the sentence as `sentence` parts with emphasis and the `suggestions`; both are being added by the web session (field names to confirm once merged). The lists `from_yesterday`, `heads_up` and `new_since_yesterday` are not shown as lists; they are what Blinq says when asked | P1 |
| 36 | Declutter rules on every iPhone screen (main PRD requirement 72). One color per meaning: red only for failed or blocked, plus the pulsing recording dot (main PRD requirement 58); amber only for a clinical caution on a patient, as a small amber dot with plain text, never a warning triangle (the same true amber as the web, the `caution` token with a thin darker ring, never the brownish warning text color); green only for the one main action on a screen, plus "done" and the selected tab; purple only for AI; everything else neutral. No warning icons on headings, pills or non-clinical items. Status is plain gray text unless it needs attention, and nothing is shown twice. The next step comes first, with one main button. To do is grouped by action, with failed items first in red (requirement 16). Cautions on the appointment list and the visit banner are a dot with text. Remember is a gray label (requirement 22) | P1 |
| 37 | Two button names (main PRD requirements 70 and 73). Draft note (was Write the note) is the green main button with Blinq's sparkle, with the help line "Stops recording and drafts the note with Blinq". Patient record (was Record) opens the pet and owner sheet, titled "<Pet>'s patient record". Use the same names in every label, spoken line and walkthrough | P1 |
| 38 | Today's schedule as a timeline (main PRD requirement 83): the same thin line and one dot per visit (empty ring not started, green pulsing In visit, purple Draft ready, green check Signed, red only when broken), the green Now line at the clinic's time instead of group labels, and a dashed stretch with "Free until 1:30 PM" for breaks of an hour or more. Status text stays beside each row | P1 |
| 39 | Preview the PDF (main PRD requirement 84). On the Signed screen, Preview PDF opens the same PDF full screen in the system viewer, with English and Spanish at the top and Share (email, print, save to Files) at the bottom. It shows the owner's PDF only, never the full note | P1 | Mockup on web only |

## Server API the app uses

Base URL from Settings. Header `Authorization: Bearer <token>` on every `/api` call when a token is set. All JSON unless noted.

| Method | Path | Request | Response (fields the app uses) |
| --- | --- | --- | --- |
| GET | `/health` | | `ok`, `ai`, `practice`, `stt`, `sam`, `sms` (strings) |
| GET | `/api/schedule?provider_id=` | | Array of appointments: `id`, `start` (ISO datetime), `reason`, `room`, `provider_name`, `patient {id, name, species, breed, alerts []}`, `client {first_name, last_name}` |
| GET | `/api/brief?provider_id=` | | `spoken`, `appointments []`, `pending_followups []`, `from_yesterday []`, `heads_up []`, `new_since_yesterday []` |
| GET | `/api/days?from=&to=` | | Per day: `date`, `visits`, `open_items`, `failed_items` |
| GET | `/api/search?q=` | | `pets [{id, name, species, breed, client, last_visit, next_visit, appointment_id}]`, `owners [{id, name, phone, pets []}]` |
| GET | `/api/patients/{id}/visits` | | Visits newest first: `date`, `type`, `title`, `summary`, `provider` |
| GET | `/api/patients/{id}/documents` | | Documents, received: `title`, `date`, `pages`, `points [{text, page}]`. Letters the clinic sent show as read only; writing them happens in the console |
| GET | `/api/appointments/{id}/card` | | `spoken`, `patient`, `owner`, `reason`, `room`, `alerts []`, `promised []` |
| POST | `/api/encounters` | `{"appointment_id": "...", "patient_ids": ["..."], "note_type": "sick_soap", "consent_recorded": true, "source": "glasses"}` | Encounter: `id`, `status`, `transcript`, `followups []`, `photos []` |
| POST | `/api/encounters/{id}/audio` | multipart: `file` (WAV), `chunk_index` (int) | Encounter |
| POST | `/api/encounters/{id}/photos` | multipart: `file` (JPEG), `hint` (string) | Encounter with the new photo in `photos []` (`caption`, `findings`) |
| POST | `/api/encounters/{id}/draft` | empty body | Encounter with `note` and `followups []` |
| PUT | `/api/encounters/{id}/note` | Section edits | Encounter (refused once signed) |
| POST | `/api/encounters/{id}/followups/{fid}` | `{"status": "approved"|"dismissed", "booking_mode": "link"}` | The follow up |
| POST | `/api/encounters/{id}/sign` | `{"send_to_pims": true}` | Encounter with `write_back` (status, detail, pims\_id) |
| POST | `/api/encounters/{id}/send-to-pims` | empty body | `write_back` |
| POST | `/api/encounters/{id}/share` | `{"channel": "text"|"email", "language": "en"}` | Sent status |
| GET | `/api/end-of-day` | | Seen, unsigned, follow ups waiting, failed texts, notes not in the PIMS, `tomorrow` |
| POST | `/api/assistant` | `{"message": "...", "history": [], "provider_id": ""}` | `reply`, `tools_used []` |

Errors come back as `{"detail": "..."}` with a 4xx status. Show `detail` on screen. `POST /api/encounters` returns 400 if consent is false and 404 if the appointment is unknown.

## Audio details

- `AVAudioSession` category `.playAndRecord`, mode `.voiceChat`, options `.allowBluetooth`. This routes the glasses mic and speakers over Bluetooth HFP.
- Capture with `AVAudioEngine`. Convert the input tap to 16 kHz mono 16-bit PCM with `AVAudioConverter`.
- WAV header: 44 bytes, PCM format 1, 1 channel, 16000 Hz, 16 bits. Chunk = 15 seconds = 480,000 bytes of PCM.
- Speak with `AVSpeechSynthesizer`. It uses the active route, so it comes out of the glasses when connected.
- Keep recording when the screen locks: `UIBackgroundModes` includes `audio`.

## Glasses details

- SDK: Meta Wearables Device Access Toolkit for iOS, Swift package `https://github.com/facebook/meta-wearables-dat-ios`, pinned to an exact version tag.
- Docs: `https://wearables.developer.meta.com/docs/develop/`. Live doc search over MCP (no login): `https://mcp.developer.meta.com/wearables`, tool `search_dat_docs`. Use it for every toolkit call. The SDK is in developer preview and its calls change between versions, so do not write them from memory.
- The app needs an app ID from the Wearables Developer Center. Read it from a build setting `MWDAT_APP_ID`. Never hard code it.
- Opt out of toolkit analytics if the iOS SDK offers it (the Android SDK does through a manifest flag).
- Test with MockDeviceKit before real glasses.

## Screens

**Settings.** Glasses (status, name, battery, Connect glasses or Disconnect glasses, Update glasses software), server URL, API token, Test connection, mock device toggle (debug only), app version.

**Tab bar.** Today, Search, Ask Blinq, End of day, Settings, on every screen except while recording.

**Today.** Glasses pill. Week strip (neutral selected day, gray dot for still open, red for failed, small check for all done). Today's brief card: one sentence with the counts in bold and the failed item in red, ending with "Want to hear more?" (Play in glasses, Got it), or the collapsed row once dismissed (requirement 35). "N left from yesterday" row, which opens To do grouped by action with failed items first in red. Appointment list: time, patient name, reason, a small amber dot for a clinical caution, and status in gray text. Tap an appointment to open Before you walk in and speak the pre-room card.

**Ask Blinq.** The tab with the sparkle, the only green tab when selected (requirement 34). Title, a gray scope line ("Your day · Sun Nov 1"), then the conversation, which starts with the brief as Blinq's first message and ends with "Want to hear more?". Your messages are light gray bubbles on the right; Blinq's answers are ink with a gray source line, outline link chips and new suggestions. At the bottom, one row of 3 suggestions and one composer with a mic inside (hold to talk; a send arrow once there is text). The text field is always the default input, and follow ups replace the suggestions; there is no "Anything else?", Talk button or "Type instead" swap. While you hold the mic the composer becomes a voice bar with a purple level meter and live captions. While Blinq speaks it shows captions and one Stop (the Read aloud button), with nothing duplicated. Design reference: `ask-blinq.png` and `ask-blinq-annotated.png`.

**Search.** Search field, pets and owners as you type, recent searches. Tap an owner: Household.

**Household.** Owner, call and text, every pet with its status, latest texts, balance.

**Visit banner and patient record sheet.** On every visit screen: the pet, the appointment, the owner and Patient record (requirement 29). Pet facts and the state are gray lines, cautions are an amber dot with text, and Patient record is the only button. The sheet is titled "<Pet>'s patient record".

**Before you walk in.** The pre-room card (with Remember), the patient record snapshot (Past visits, Owner, Records), pets in this visit, note type, and Start visit as the one green main button at the bottom of the screen, not in the banner. It says only what's new and doesn't repeat the banner. The screen scrolls.

**Visit.** Patient name and reason. After start: Stop recording, then Draft note (green, with Blinq's sparkle; help line "Stops recording and drafts the note with Blinq") or Keep recording, right under the timer with the active mic shown, Capture photo with an optional hint field, and an Ask field. A small log at the bottom shows each upload and reply.

**Review the note.** Pet switch, SOAP sections with things to confirm, follow ups with Approve and Dismiss, Remember for next time, then the sign card: who signs, which PIMS record, Sign and send to PIMS and Sign only.

**Signed.** PIMS status, texts to the owner, Share the visit summary, Next visit.

**End of day.** Summary, counts, Before you go, Waiting on owners, Tomorrow.

Design reference: the iPhone prototype on the design canvas and the `Blinq Scribe iOS Prototype` folder next to the repo (screenshots plus a README). It is not in the repo.

All labels in simple English. No em dashes anywhere. The declutter rules in requirement 36 apply to every screen.

## Code layout

Today (SwiftUI, built by Muse Code). The Expo app moves to `mobile/` with `app/` for expo-router screens, `src/graphql/` for Apollo and `modules/glasses/` for the Swift native module, which takes `Audio/` and `Glasses/` below.

```
glasses-ios/
  BlinqScribe.xcodeproj
  BlinqScribe/
    BlinqScribeApp.swift
    API/BlinqScribeClient.swift      async/await URLSession, Codable models matching the table above
    API/Models.swift
    Audio/GlassesAudio.swift         session routing, engine tap, 16 kHz WAV chunks, upload queue
    Audio/WavChunker.swift
    Glasses/GlassesCamera.swift      toolkit session and photo capture, MockDeviceKit toggle
    Speech/Speaker.swift             AVSpeechSynthesizer wrapper
    Views/TodayView.swift, VisitView.swift, SettingsView.swift
    Info.plist
  BlinqScribeTests/
    WavChunkerTests.swift            header bytes, 16 kHz mono, chunk size, final partial chunk
    ClientTests.swift                request shapes against a URLProtocol stub
  README.md                          Xcode setup, Apple ID signing, toolkit app ID, server URL, mock device
```

## Info.plist

`NSMicrophoneUsageDescription`, `NSBluetoothAlwaysUsageDescription`, `NSCameraUsageDescription`, `NSSpeechRecognitionUsageDescription`, `UIBackgroundModes` = `audio`, `NSAppTransportSecurity` with `NSAllowsLocalNetworking` = true (laptop on the same Wi-Fi during the demo). Plus whatever the toolkit docs require for the app ID and callback URL scheme.

## Rules

- No secrets in the repo: no API keys, tokens or phone numbers in code, plists or docs.
- The app talks only to the Blinq Scribe server. Never to Telnyx, the PIMS or Meta Model API.
- Do not change the server or its tests unless a test proves an API bug. If you do, `cd server && pytest -q` must pass.
- Delete `glasses-android/` once the iPhone app builds. Update `README.md` and `DISCLOSURE.md` to point to `glasses-ios/`.
- Work on a branch named `ios-app`. Commit in small steps with clear messages. Do not push to `main`.

## Done when

- `xcodebuild -project glasses-ios/BlinqScribe.xcodeproj -scheme BlinqScribe -destination 'platform=iOS Simulator,name=iPhone 16' build test` passes.
- With the server running on the laptop and the mock device on, the app can start a visit, upload at least 2 audio chunks, upload a photo, draft the note, and ask "who's next?".
- `glasses-ios/README.md` lets someone else build and run it.
- `DISCLOSURE.md` lists the iPhone app under "Built during the hackathon" and the Muse Code row says what Muse Code built.

## Risks

| Risk | Fallback |
| --- | --- |
| Toolkit camera calls fail or change | Phone camera through the same upload path |
| Bluetooth mic quality is poor | Phone mic, shown on screen |
| Free Apple ID signing expires after 7 days | Reinstall from Xcode before the demo |
| Simulator has no Bluetooth or glasses | Mock device toggle, phone mic |
| Live PIMS data has empty or missing fields the synthetic clinic always fills | Optional fields in `Models.swift`; a `ClientTests` case decodes an appointment with no alerts, breed or age |
