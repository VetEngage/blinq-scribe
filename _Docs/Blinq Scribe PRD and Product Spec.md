# Blinq Scribe: PRD and Product Spec

Oct 29, 2026 · Mayra Vazquez

## Summary

Blinq Scribe lets a veterinarian finish the medical note and the follow ups before leaving the exam room, hands free. The provider wears Meta AI glasses. Blinq Scribe listens to the exam with the owner's consent, takes photos on request, and drafts the SOAP note with Muse Spark. It also turns what the provider says ("recheck in two weeks") into follow ups ready to approve, with real open appointment times from the clinic's PIMS.

Between rooms, a day assistant answers "who's next?" through the glasses speakers.

**What it is not:** Blinq Scribe is a documentation and day assistant, not a clinical advisor. Every clinical word comes from the provider, and nothing reaches an owner or the records without the provider's approval. This keeps it clear of the hackathon's banned "AI that gives medical advice" projects.

It is built for the Meta Global AI Developer Hackathon, Startup track, as a separate open source product. It reads and writes clinic data through one practice adapter that connects to the clinic's PIMS and can reach only that clinic. It writes to the practice system (the signed note, exam photos, the recheck booking, prescriptions) only after the provider signs or approves.

**Status:** working product on the synthetic clinic, with 548 server tests plus web, component library and end to end tests. Real glasses and live PIMS writes come next. Target submission: Sunday Nov 1, deadline Wednesday Nov 4, 9:00 PM EST.

# Part 1: Product requirements

## Problem

Providers lose their evenings to notes, and the follow ups they promise in the room often never get booked.

- **Notes happen after hours.** The exam is 20 to 30 minutes, but the record is written later from memory. Details get lost and the provider works unpaid time.
- **Follow ups fall through the gap.** The provider says "recheck in two weeks" to the owner. That instruction has to travel to the front desk by memory or a sticky note. If nobody books it, the pet does not come back and the clinic loses the visit.
- **Hands are busy.** During an exam the provider is holding the patient. Typing, tapping a tablet or taking a phone photo breaks the exam.
- **Context is scattered.** Alerts like "fractious, use towel wrap" or rising kidney values sit in the PIMS. The provider has to look them up before walking in.

## Users and jobs to be done

The veterinarian is the primary user. Everyone else benefits from what the provider approves.

| User | Job to be done | What Blinq Scribe gives them |
| --- | --- | --- |
| Veterinarian (primary) | Finish the note and follow ups before the next room | Draft SOAP note, vitals, meds and owner summary; follow ups with open times; morning brief and "who's next" |
| Technician | Capture history and vitals without double entry | Vitals and history pulled from what was said in the room |
| Front desk | Book the recheck the provider promised | Approved follow ups with the owner message and booking link ready |
| Practice manager | Fewer lost rechecks, less overtime | Follow up status per visit, audit log |
| VSO operations | Same quality across hundreds of locations | One tool on top of each clinic's PIMS, no per site setup beyond connecting it |
| Pet owner (indirect) | Know what happens next | Plain English visit summary and a link to book the recheck |

## Goals and success metrics

The hackathon goal is a demo that holds up live; the product goal is fewer lost rechecks and less after hours charting.

**Hackathon goals** (reported scoring: impact 30%, use of Meta AI tooling 25%, demo 25%, technical depth 20%)

1. A full visit runs live on real glasses and real Muse Spark, start to signed note, with no errors three times in a row.
2. Deep use of Meta tools: Muse Spark, SAM 3.1, glasses mic, camera and speakers, built with Muse Code.
3. Judges can run it themselves in 2 minutes on synthetic data, no keys needed.
4. A clear startup track disclosure of what existed before Oct 26.

**Product metrics** (for a pilot after the hackathon)

| Metric | Definition | Target |
| --- | --- | --- |
| Recheck booked rate | Rechecks the provider said out loud that end up booked | Set with the pilot baseline |
| Booking link conversion | Booking links sent that end in a booked visit before the link expires | Set with the pilot baseline |
| Note edit rate | Share of the draft the provider changes before signing | Set after first 50 notes |
| Time to signed note | Minutes from visit end to signature | Set with the pilot baseline |
| Follow up approval rate | Drafted follow ups the provider approves, not dismisses | Set after first 50 notes |
| Invented facts | Note statements not supported by the transcript, record or photos | Zero, checked by review |

All changes are reported as percentages against the pilot baseline.

## Scope

The hackathon build covers one provider, one location and one phone platform, end to end.

| In scope (hackathon) | Out of scope (hackathon) | Later |
| --- | --- | --- |
| iPhone companion app for Meta AI glasses | Android app | Android app |
| Consent, record, photo, draft note, edit, sign. The signed note and its photos write back to the PIMS | Writing anything the provider has not signed or approved | More PIMS write types (reminders, patient weight) |
| Follow ups: recheck, owner message, lab callback, callback, task. Approved owner messages texted to one demo phone number | Texting or emailing real owners | Text real owners through the clinic's texting, with opt out |
| Recheck follow ups: a booking link (default) that opens the clinic's online booking with the pet, visit type and provider already picked, so the owner only picks a time. Or Book it now: the provider picks a time and approving books it in the PIMS | Booking without the provider's approval | Automatic reminder when a link isn't used |
| Prescriptions the provider confirms after signing, written to the PIMS (P2) | Choosing a drug or dose for the provider | Refill requests |
| Notes, photos and messages built only from what the provider said | Any clinical advice: diagnosing, picking treatment, reading lab values or photos for a diagnosis | Stays out of scope |
| Morning brief and day assistant. Remember: personal milestones the owner mentioned, staff only, kept only when the provider checks them | Multi provider and multi location views. Anything personal the provider didn't check | Practice manager dashboard |
| Web console for review and as a no glasses fallback | Billing, invoices, charge capture | Charge capture from the plan |
| Synthetic demo clinic | Real patient data in the demo | A VSO pilot on a test location |
| Lens display, only if Ray-Ban Display is on hand | Custom wake word | Hands free voice commands. Fine-tune Muse Glimmer on real signed notes so the clinic's voice runs inside the clinic |

## Requirements

P0 is the demo path and must work live; P1 makes the demo strong; P2 only if time allows. Status reflects the code as of Nov 1: "Built" runs on synthetic data, "In progress" still needs real models, glasses or live PIMS data.

| # | Requirement | Priority | Status |
| --- | --- | --- | --- |
| 1 | A visit starts only after the owner's consent to recording is recorded | P0 | Built |
| 2 | Record from the glasses mic over Bluetooth and upload in 15 second chunks | P0 | In progress |
| 3 | Turn audio into text with a configurable speech model | P0 | In progress |
| 4 | Take a photo from the glasses camera when the provider asks | P1 | Not started |
| 5 | Describe each photo with Muse Spark and outline the area with SAM 3.1 | P1 | In progress |
| 6 | Draft the SOAP note, vitals, medications and an owner summary with Muse Spark | P0 | Built |
| 7 | Mark anything unclear as "\[confirm: ...\]" instead of guessing | P0 | Built |
| 8 | List only the follow ups the provider said out loud | P0 | Built |
| 9 | For a recheck, show the 3 open times closest to the due date, each with a booking link | P0 | Built |
| 10 | The provider edits the note and approves or dismisses each follow up | P0 | Built |
| 11 | Signing locks the note and writes it, with its photos, to the PIMS. If the write fails or the PIMS can't take writes yet, it queues for staff | P0 | In progress. Built against the demo PIMS; live PIMS write needs the clinic's PIMS connection |
| 12 | Every step is written to an audit log | P0 | Built |
| 13 | Morning brief spoken through the glasses speakers | P1 | In progress |
| 14 | Day assistant answers "who's next", "what's waiting" and "find a recheck" using tools | P1 | Built |
| 15 | Read schedule, visit history, notes and open slots from the clinic's PIMS through the practice adapter | P1 | In progress. Built against the demo PIMS; live reads need the clinic's PIMS connection |
| 16 | Runs fully on synthetic data with no keys | P0 | Built |
| 17 | Next patient card on the Ray-Ban Display lens | P2 | Not started |
| 18 | Open weights model option so data can stay in the clinic | P2 | Not started |
| 19 | Approved owner messages are texted, but only to one demo phone number | P1 | Built |
| 20 | Pre-room card: why the patient is here, last visit, what was promised, pending results, spoken as the provider walks in | P1 | Built |
| 21 | Voice profile: new drafts match the style of every note the provider wrote in the last 90 days, synced at onboarding and updated as they sign (style only, never facts). A new provider gets one after 2 notes | P1 | Built |
| 22 | End of day, from the day menu in the top bar: the rail folds to a summary ("All 5 seen · last visit at 1:30 PM", or "3 of 5 seen"), two quiet counts (Notes to sign, Calls and texts), Tomorrow in one line ("Tue Nov 3 · 3 visits, first at 9:00 AM") and Done, folded. The page leads with the greeting, Blinq's one sentence (visits seen, and the rechecks as they happened: "1 recheck link sent, none booked yet"; a link sent is never counted as booked or as none) and a slim progress bar, then Notes left to sign (every unsigned note, any day; "1 to confirm" in Blinq's purple), with the one green action in the pinned bar, "Review and sign N notes" (it opens Ready to sign, or the first note). Then Calls and texts left (a failed text as a red row with Retry, a link not booked with Resend link, a follow up to decide with Review), Front desk and the PIMS (the prescription task with Mark entered, a note to send), Already handled as plain rows, and "That's the day. Everything else can wait until tomorrow." Tomorrow never repeats a pet seen today, so no recheck lands before it is due. The page scrolls; no card scrolls on its own. "Remind me tomorrow" is left out until reminders exist | P1 | Built on server and web |
| 23 | Dose check: flag a stated dose outside the standard range for the patient's weight. A check, not a prescription | P2 | Not started |
| 24 | Hands-free lookup: "what did we give him last time?" answered from visit history | P2 | Not started |
| 25 | Running behind: tell the provider how late they are and offer to alert the front desk | P2 | Partly built on the web: on a heavy day Home says the pace in plain words ("Running about 15 min behind. Free until 1:30 PM."), only from when visits really started in Blinq Scribe, never a guess (requirement 74). Alerting the front desk is not started |
| 26 | Recheck no-shows: spot a missed recheck and draft an owner message | P2 | Not started |
| 27 | PIMS connection for reads: the practice adapter reaches only the pilot clinic, with a credential the clinic's admin can revoke | P1 | In progress. Built against the demo PIMS; live reads need the clinic's PIMS connection |
| 28 | The signed SOAP note and exam photos write back to the PIMS | P1 | Built against the demo PIMS; live PIMS write needs the clinic's PIMS connection |
| 29 | Approved owner messages go out through the clinic's texting, with opt out | P2 | Not started |
| 30 | Approving a recheck with a chosen time books it in the PIMS, with the same rules as online booking | P1 | Built against the demo PIMS; live booking needs the clinic's PIMS connection |
| 31 | After signing, the provider confirms each medication and its PIMS code, then it writes to the PIMS | P2 | Not started |
| 32 | Onboarding sync: pull the last 24 months of medical notes, from every provider, from the PIMS. Run once at onboarding, then nightly. Notes older than 24 months are dropped | P1 | Built (mock). Live reads each seen patient's notes from the PIMS. Where the PIMS doesn't share notes, nothing syncs |
| 33 | Continuity: every provider's earlier notes on the patient in the pre-room card ("Dr. Okafor saw Miso 9 days ago: started amlodipine"), a Previous notes panel, and the draft context as history only | P1 | Built. Where the PIMS doesn't share notes, only notes signed in Blinq Scribe show; earlier visits come from the visit history summaries |
| 34 | Provider accounts: an admin invites each provider with a one-time link and ties the login to their PIMS provider id. Signing records that provider id, so notes, the voice profile and "other provider" labels follow who actually wrote the note | P1 | Built |
| 35 | Demo mode: with no keys every feature works on the synthetic clinic, so judges can try the whole product. Judges add only their own model keys; practice data, texts and voice profiles stay on demo data, and anything simulated says so on screen (see Demo mode) | P0 | Built |
| 36 | Home: one page that changes with the moment. At the top, the brief as one dismissible purple line, facts only, with Hear it and Dismiss (requirement 71). Then the greeting by name and time of day ("Good morning, Dr. Rivera") with "0 of 5 seen" and a slim progress bar; pace ("on time", "10 min behind") only when the PIMS sends check-in times. Then Up next as the hero (the pet, time and room, signalment with weight, owner and reason, a labeled caution, a purple "Why it matters" block of facts on record: the last visit and its medication, a recheck that was due and not booked, care due within 30 days, results in, the owner's latest text quoted; neutral prep chips; quiet links to the last note and the owner's text) beside Follow-ups waiting (the two note buckets as neutral tiles, Ready to sign and Pending, each opening `/notes?bucket=`; then up to 3 follow ups with one action each that works: Resend a failed text, Resend link, Mark entered, Send to the PIMS, Review; then "+N more"). Since yesterday follows as plain rows, each tied to its visit. The pinned bar: "Up next: Biscuit at 9:00 AM · Exam 1", a quiet "Skip to Miso", and the green "Open Biscuit's visit". Everything loads as skeletons shaped like the content, never "No appointments today" or "0 visits" before the schedule is in. `/morning` lands here | P1 | Built (web). iPhone next |
| 37 | Nothing slips between days: every unsigned note, from any day, is in one of two buckets (Ready to sign: drafted, nothing to confirm, every follow up decided; Pending: something to confirm, a follow up to decide, or recorded and not drafted yet, with what is left). Ready to sign notes can be signed several at once on `/notes`: checkboxes and Select all, a confirm that lists each note by pet and date and who signs, Sign and send to the PIMS (default) or Sign only, then each note signed in turn with its own progress and error. Failed texts, links not booked and front desk tasks are in Home's Follow-ups waiting and End of day. The rail is the day: a compact date switcher ("Today, Sun Nov 1" with the day before and after and a Today button between them that brings the provider back from any other day, gray while today is on screen; "5 visits · Dr. Ana Rivera"), one quiet "Needs me · N" toggle (notes to sign, results or texts in since yesterday) and a small filter menu (Cautions, To sign, All), and the visits in groups: In the room, Up next, Later today (the next 4, then "+N more this afternoon"), Done · N folded. Rows are two lines with a read only quick card on hover and focus (requirement 77). No To do box, no week strip, no alert bars in the rail | P1 | Built (web and server). Household rows for multi-pet visits wait for the schedule to carry them |
| 38 | Patient record on the visit, read only, in three tabs. Past visits: search, filter by sick or wellness, expand to the signed note, meds and photos, related visits tagged. Invoices: balance, last 12 months, line items. Client and patient: contact and preferences, other pets, latest owner message, patient details, weight history, reminders due. Not every PIMS supplies a sick or wellness tag, balance, line items or weight history (requirement 42); when it doesn't, the filter uses the visit type text, Invoices lists each invoice's total and whether it's open, and the profile shows the latest weight | P1 | Built (mock). Live shows what the PIMS returns |
| 39 | Note editor without long scrolls: sections size to their text and long ones clamp with Show all; section pills jump to each part and mark anything to confirm with a purple dot; the item itself is marked in purple in the text with Keep and Change; one section edits in place at a time; autosave; sections have no gray boxes; the sign bar stays pinned with the count of things to confirm, written once and in purple | P1 | Built. The purple marks and the single count are In progress (web) |
| 40 | Edit tools in a section: Muse quick actions (Tighten, Bullets or prose, Re-pull from transcript, Show sources, Spanish for the owner summary) return a suggestion the provider accepts or keeps their own. The provider's own templates by `/` shortcut, and dictation. Quick actions never add a finding, diagnosis, drug or dose. Sources are also a quiet Sources control under each section in Review, without opening the editor: each sentence with the transcript lines behind it, and each line a link that opens the transcript at that line and its time ("0:27 · Dr. Ana Rivera"). A sentence with no source is flagged in AI purple. In Review, sources show as a small time chip at the end of each drafted line ("0:27"), which opens the transcript at that line, highlighted; a line with no source says "No source". The vitals line has one chip, from the line that says its numbers. In the section editor, a thing to confirm shows as the same purple chip as in Review ("Confirm: name and dose"), never the raw "[confirm: ...]"; clicking it selects all of it, so typing replaces it | P1 | Built. A suggestion that adds any new word, number, drug or negation is refused. Time chips at the end of each drafted line are Built on the web (deterministic word matching, so they work with the mock AI); they replace the Sources control, so a source shows once |
| 41 | Ask Blinq on the web is a floating chat, closed by default, that keeps the conversation across screens and knows the open patient. Its scope line, voice and docked panel are in requirement 71 | P1 | Built |
| 42 | PIMS record reads for requirement 38: invoices, the patient profile, and the visit type, provider and appointment id on each past visit | P1 | Built against the demo PIMS; live reads need the clinic's PIMS connection |
| 43 | Search pets, owners and phone numbers from the top bar (or Cmd K). Results show the pet, owner, and last and next visit, and open the patient record even with no visit today. Ask Blinq uses the same search ("pull up Biscuit") | P1 | Built on the web (mock). Live searches today's schedule until the PIMS connection supports search |
| 44 | Note types beyond SOAP: sick visit, wellness exam, recheck, surgery report, dental, radiology report, phone call log, progress note. Guessed from the visit type (the practice system's appointment type text), changeable on the visit and on the draft. Each type has its own layout and prompt; the provider's templates can be tied to a type | P1 | Built |
| 45 | Several pets in one visit: add the owner's other pets before starting. The draft splits the visit by pet, one note per pet, each reviewed, signed and written back on its own | P1 | Built. Photos stay with the first pet. A household appointment (requirement 75) starts with every pet booked in it |
| 46 | Custom edit instruction: "Ask Blinq to edit this section" takes the provider's own words ("put the recheck first") and returns a suggestion under the same rules as the quick actions | P1 | Built |
| 47 | Documents, received (tab renamed from Outside records): upload referral letters, outside lab results or old records (PDF or photo) to the patient. Muse Spark lists each document's key points with page numbers. Read only; a line enters the note only when the provider adds it | P1 | Built. Scanned PDFs need a photo of each page |
| 48 | Share the visit summary after signing: text a link (the default, preselected when the owner prefers texts, with no Recommended tag), email a PDF, or print. English or Spanish. Only the For the owner section, medicines, home care, next visit and when to call. The text has no diagnosis, the link asks for the owner's last name and expires in 14 days. In demo mode it only texts the demo number | P1 | Built. Email gives the PDF to send; no email sender yet |
| 49 | Branded PDF: the same summary with the clinic's logo, name, address and phone, for email or printing at checkout. A visit details block at the top: visit date, appointment date and time (AM/PM), each pet's name, species, breed, sex and age, the owner's name, and the provider who saw the pet. The owner's page shows the same details | P1 | Built, without the logo |
| 50 | PIMS reads for search and branding: patient search and the clinic's name, logo, address and phone | P1 | Built against the demo PIMS; live reads need the clinic's PIMS connection |
| 51 | Multi-pet households. The record (from an owner in search, or the household button on the visit) shows every pet with its visit today or what's due, alerts and last visit, the household balance, and recent texts. The record (requirement 66) has a tab per pet; Invoices and Texts are the household's, shown per pet or for all pets. Other pets join a visit on Before the visit. A visit with several pets sends one owner summary with a section per pet. The iPhone app has the same household screen | P1 | Built on the web (mock) with the earlier layout. The new layout is In progress (web). iPhone next |
| 52 | PIMS reads for households: the owner and every pet with status, alerts, last visit and reminders due, and recent texts with the owner | P1 | Built against the demo PIMS; live reads need the clinic's PIMS connection |
| 53 | Booking link follow ups. A recheck or other visit follow up offers Send a booking link (default) or Book it now. The link opens the clinic's online booking with the pet, visit type and provider already picked and only the dates the provider asked for, so the owner just picks a time. It goes out with the other texts when the provider signs, works for 14 days, and is not a booking until the owner books. Signed shows "Not booked yet"; End of day lists links not used after 3 days under Waiting on owners with Resend link; a booked link shows as booked. The owner summary's Next visit becomes Pick a time. Approving a link offers "Remind Jordan if not booked in 3 days", on by default: a link still not booked 3 days after it went out gets one reminder text (the same link, plain words, through the same texting path, so preview and demo modes show it rather than send it), never twice and never once booked or expired. The follow up says "Reminder goes out Nov 4 if not booked", then "Reminder sent Nov 4"; the reminder is audited | P1 | Built. Opened and booked wait on requirement 55; expired comes from the date. The reminder is Built on server (the hourly booking link check on the worker, or in the server without Temporal) and web |
| 54 | Remember: personal milestones from the visit (birthdays, adoption days, graduations, weddings, new babies, moves, trips). After the draft, Blinq lists what the owner mentioned under Remember for next time; the provider checks what to keep. Kept items show on Before you walk in under a gray Remember label, never a warning (web and iPhone, read aloud in the glasses) with when they were said, and in the morning brief when the date is close. Staff only: never in the note, the owner summary, texts or the PIMS. Never kept: anyone's health, money, grief or loss, religion, politics or legal matters. Kept 12 months, changeable from the household page, every change in the audit log | P1 | Built |
| 55 | Booking links from the clinic's online booking: a link with the client, pet, visit type, provider and date window filled in, and its status (opened, booked with the appointment, or expired) | P1 | Not started. Until then the link comes from the booking link template, and "booked" (which stops the reminder in requirement 53) is only known once this is built |
| 56 | Same open source stack as the startup's existing platform (see Tech stack): Python 3.14, FastAPI and Strawberry GraphQL, PostgreSQL with Peewee and Alembic, Temporal; a React, Vite and TypeScript web app with Tailwind, Radix and Apollo; an Expo iPhone app. No platform code or private packages, and clinic data only through the practice adapter | P1 | Built: server and web (Oct 31). Expo app next |
| 57 | Sign in page on the web and the iPhone, laid out like the startup's existing product: email and password, Remember me, Forgot password, Continue with Google, Continue with Microsoft, then a 6 digit code when 2FA is on. Invite only, no sign up. In demo mode, Try the demo clinic signs in as the demo provider | P1 | Built: server and web, with the 6 digit code from an authenticator app (set up in Account with a QR code; an emailed code is the backup). iPhone with the Expo app |
| 58 | Loading states so the provider always knows Blinq is working. Recording, shown in the pinned bar only: a pulsing red dot (the one red that isn't a failure, see requirement 72), a level meter that moves with the mic, the newest words arriving with a cursor, and "Sending part N" while a chunk uploads. Draft note: its steps (transcript, photos, SOAP, follow ups, things to confirm) with a skeleton of the note, then Review the note; the glasses say "Note drafted". Ask Blinq: typing dots and what it's checking ("Reading Biscuit's record"). Animations stop when the device asks for reduced motion. While recording, the pinned bar holds Stop and the green Stop and draft note; upload status shows only when a part fails | P1 | Built: server and web. Recording shows in the pinned bar only: the pulsing red dot, the running time, Stop, and Stop and draft note as the green action. A part that didn't send is a red row with Retry; otherwise uploads stay out of sight. iPhone with the Expo app |
| 59 | Photo capture and edit. Add photo (web) and Capture photo (iPhone) open a capture view: source (glasses, this computer's camera or a file on the web; glasses or phone on the iPhone), the live view, an optional "What is it?" hint, and Take photo or saying "capture". The edit view shows the SAM 3.1 outline while it works, then: adjust outline, crop, rotate, retake, a label, Blinq's description of what's visible (editable, never a diagnosis), Add to the note (on), Show in the owner's summary (off) and Delete. The original photo is always kept. Clicking a photo opens the edit view again | P1 | Built on server and web. iPhone with the Expo app |
| 60 | Account settings for a signed-in provider: profile (name and email; username, role and linked provider read only), change password, two step sign in on or off (locked when an admin requires it), connected Google and Microsoft accounts (connect or disconnect, never leaving no way to sign in), and sign out on all other devices. Every change needs the current password where it matters and is in the audit log. The demo clinic shows a short note instead | P1 | Built on server and web |
| 61 | Documents, sent: create a referral letter, records for another clinic, or a letter for the owner from the Documents tab. Pick the recipient (saved contacts from past letters, or a new name and email), give the reason in your own words, and check what to attach (signed notes, exam photos, outside lab results; invoices only if checked). Blinq drafts the letter on the clinic letterhead from the signed notes and the attached files; the provider edits it, confirms anything marked, and signs. Send: email the specialist one PDF, give it to the owner (texted link and PDF to bring to the specialist), or print, plus an optional copy to the owner. Before records go to another clinic, the provider records that the owner agreed. Sent letters show where they went and whether they were opened; drafts can be finished later. In demo mode emails only go to the demo address | P1 | Built on server and web |
| 62 | Roles: Provider, Front office and Admin (see Roles and permissions). A provider sees their own day first and can open another provider's day view only: schedule, signed notes and documents, never drafts or transcripts, and no starting, editing, approving, sending or signing. Front office and admins see every provider's day and can resend booking links and summaries already approved, but never record, draft, edit or sign. A note is signed only by the provider whose visit it is, as themselves: no typed name, no signing for someone else, and the API token can't sign. The server checks all of this on every request, not just the screen | P0 | Built on server and web. The top bar opens a provider on My day; the open demo acts as the demo clinic's provider |
| 63 | Natural read aloud: the morning brief, Before you walk in and end of day are read in a natural voice (Kokoro-82M, open source, run on the server's CPU), with Stop on every Read aloud. Voices Heart (default) and Bella among six; each provider picks a voice and speed in Account settings. Our own pronunciations for the clinic's names, drugs and veterinary shorthand. Falls back to the browser's best voice when the model isn't downloaded | P1 | Built on server and web (about 13 times faster than real time on a laptop CPU): Stop on every Read aloud, the voice and speed picker in Account, the server voice with the browser's voice as the fallback |
| 64 | Speaker labels on the transcript. Every line shows who said it once Blinq knows: the signed-in provider wearing the glasses and the owner on the appointment, by name and role ("Dr. Ana Rivera · Provider", "Jordan Lee · Owner"), with the time into the visit. Anyone else shows as "Speaker 3" with a one-tap choice right in the row, on that voice's first line: Who is this? Tech, Owner or Other (Owner names them as the appointment's owner); the name then applies to every line from that voice, and Change reopens the choice. When Blinq isn't sure who spoke, the line has no name rather than a guess. Labels show on the live transcript (web and iPhone), in Review, Show sources and Remember's transcript lines; the owner summary never shows them | P1 | Built on server and web. The speech model returns plain text, so a Muse Spark pass names the lines after each audio part. Who is this? is one tap (Tech, Owner, Other) and names every line from that voice; older visits named Family member or Another provider keep those. Review's right column says how many speakers and "Speaker 3 is unnamed · Name them". iPhone with the Expo app |
| 65 | Sign and send to the PIMS in one click. The sign bar shows who is signing and which PIMS record the note goes to (the pet and its PIMS id; click it to open the record), with two buttons: Sign and send to the PIMS (default) and Sign only. No confirm step on the normal path. Blinq checks the PIMS record against today's appointment; only when they don't match (a different owner or pet) does a Check the PIMS record panel stop the send, and then the provider can only sign for now. Sign only locks the note but keeps it out of the PIMS until the provider sends it from the signed note; until then it shows on End of day. The banner's status line says Saved to the PIMS, or N of M saved. The per item status opens from it, and opens on its own, ahead of everything else on the page, when something is Not sent yet or Couldn't save. Each item is Sending, Saved (time and where it landed), Not sent yet (Send to the PIMS) or Couldn't save (retries every 5 minutes, then goes to the front desk after 1 hour; Try again). Not sent yet is plain ink, because it is a step not taken; Couldn't save is red. The prescription is never sendable and is not counted in N of M: signing a note with medications makes a front desk task, "Enter Cefpodoxime for Biscuit in the PIMS", on Home's Follow-ups waiting and End of day from the signature with Mark entered. Front office (and the visit's provider, or an admin) marks it done; who and when are recorded on the visit and in the audit log, and the PIMS card's row goes from "Front desk to enter" to "Entered by Sam Front Desk, 10:42 AM". Screens say "PIMS", not a vendor name, since clinics use different ones. The green action steps forward (decision D1): while anything is left to confirm it names that step ("Fill in ear drop product and duration", "Confirm weight") and goes to it; only then is it Sign and send to the PIMS. It is never greyed out. Sign only is a quiet link, shown once nothing is left to confirm. The server refuses to sign a note with anything left to confirm | P0 | In progress. Built on server and web against the demo clinic's PIMS: Sign only, the not sent status, per item status with retries every 5 minutes and the front desk after 1 hour (pims_sync), and "the PIMS" in every label. The server refuses to sign (409, in plain words) while any "[confirm: ...]" mark is left in any section, the owner's summary, a medicine or a vital; bulk sign leaves those notes in Pending. Not yet: the one-click path; today a confirm panel opens before every sign instead of only when the PIMS record doesn't match. Live sending needs the clinic's PIMS connection (requirement 28) |
| 66 | The record any time, in one component. Every visit page (Before the visit, visit in progress, Review the note, Signed, another provider's day) has two tabs under the banner, Visit and Record. Record shows the household's record: the owner once (name, then one gray line with phone, prefers texts, client since and balance; Text and Book a visit as quiet actions), a tab per pet (species tile, name, "This visit" for the visit's pet or else the breed, and an amber dot for a pet with a caution), then Overview, Past visits, Documents, Invoices and Texts, with "From the PIMS · read only" in gray as the only read only cue. The banner's owner column has a 32 px neutral household button (named and titled "Jordan Lee's household") that opens Record on the banner's pet. Recording, the draft and the pinned bar keep going under either tab. Inside a visit the owner's name is a Title, since the pet is the page's heading; on its own page (`/record/:clientId?pet=&tab=`, from search, To do, a pet's name or a household link) the owner's name is the heading, and there is no pinned bar and nothing green. Nothing in the record can be edited, except that staff can remove a Remember item | P1 | Built on web: the Record tab on every visit page, the household button, and the record page with the old patient and household addresses sending people to it. The Patient record side panel is gone. Overview reads no notes, so opening Record writes no notes-opened audit entry until Past visits is opened. iPhone next |
| 67 | Visit banner on every visit page (Before the visit, visit in progress, Review the note, Signed, another provider's day), on the web and the iPhone. Three blocks: the pet (species icon and name, with breed, sex, age and last weight as one gray line under the name), the appointment (time, length, room, provider and the state as one gray line: Checked in 9:24 AM, Started 9:02 AM, Draft · saved 9:26 AM, or on Signed a green check with Signed by Dr. Ana Rivera at 9:28 AM in place of the provider line, and Saved to the PIMS or N of M saved; once the summary is sent, Summary texted at 9:31 AM; recording shows only in the pinned bar), and the owner (name, a neutral household button that opens the Record tab on this pet, phone and how they like to hear from us in gray). Under the banner, the Visit and Record tabs (requirement 66). A strip below shows the reason for the visit, cautions (an amber dot with the full plain text, on their own line under the reason, and nothing at all when there are none: no green "No alerts") and the last visit. The banner shows state, not actions. Its only button is the household button; Start visit, Draft note and Sign are in the pinned bar (requirement 70). It stays pinned at the top while the page scrolls. Compact, from the outside review: the pet's name (Display) with its status pill only when not the default (In visit, Draft, Signed); the facts line with a weight taken in this visit and its change ("74 lb, up 2 lb since Jul 4"; "25.1 lb, no change since Oct 2"); under it the alert line, only from data: each caution labeled ("Caution: Back care"), the PIMS weight trend when no weight was taken in the visit ("72 lb (Jul 4), up 1.5 lb from Jan"), "Last weighed 18 months ago" when old, and care overdue. The visit column: time, room and length, the reason, and the state. The owner: "Owner · prefers texts", the name, quiet Text and Call, and the household button labeled "Jordan Lee's household". A text to this owner that didn't send is a red row with Retry; resending clears it on Home, End of day and the banner at once. Then the step bar: Record > Draft > Sign > Share > Follow up, with space above it and no divider (a rule over its connector lines read as two lines), 2 px connectors that are green once a step is done and gray before, done steps checked, the current one emphasized, Record with the recorded length. The Visit | Record tabs are at the top of the content card under the banner, not in the banner | P1 | Built on web: the compact banner (status pill when not the default, facts with an in-visit weight and its change, the alert line, visit time, room and length with the reason, owner with Text, Call and the labeled household button), the red failed-text row with Retry, and the step bar. iPhone with the Expo app |
| 68 | Previous notes in one place: the Past visits tab of the record replaces the separate Previous notes panel. Newest first; each note is one collapsed row (date as "Jan 10, 2026", the title, a one line summary, then Sick or Wellness and the provider in gray); the note most related to today's reason is marked in purple and opens by default, with its SOAP sections in two columns under their headings and no boxes, and medicines and photos as small tags. Filters: search, visit type and Related to today; the pet tabs pick the pet, so there is no Pet filter. Inside a visit, that visit's own notes and anything newer never show. A note saved again with the same text is one row, marked "Same note on Oct 28" in gray. The iPhone shows the same rows in the record snapshot and the Patient record sheet | P1 | Built on web. On Before the visit, Previous notes (last 24 months) are one line each ("Sep 1, 2026 · Itchy face · Suspect environmental allergy · Apoquel") and open to the note. Open full note waits for a PIMS link to open |
| 69 | One way to show a household's pets, on the web and the iPhone: the pet tabs of the record. One tab per pet, in the PIMS order, each with a gray species tile, the name, and a gray second line ("This visit" for the visit's pet, else the breed); a pet with a clinical caution has an amber dot after its name, never a warning. The selected pet has a green line along its bottom edge, like every selected tab. The tabs scroll sideways when there are more than fit, so 1 pet and 10 pets work the same. Invoices and Texts are the household's, shown for the selected pet until All pets is on; Texts for a pet are the ones that name it, since the PIMS keeps texts by owner. There is no Owner and pets tab, no separate household page and no Open visit or Add to today's visit button; a pet's visit today is the first row of What's due on its Overview, and opens the visit. Pets join a visit on Before the visit | P1 | Built on web. iPhone next |
| 70 | One green action per page, always in the pinned bar at the bottom right, with a label that says exactly what it does ("Open Biscuit's visit", "Review and sign 3 notes", "Sign 2 notes", "Start visit", "Sign and send to the PIMS", "Next: Miso"), and ⌘↵ (Ctrl+Enter) presses it from anywhere but a dialog, shown as a small kbd hint in the button. Every other action is an outline button or a link. The bar spans the page under the content, so the page always scrolls clear of it. On a visit the states are: Start visit, then ✦ Draft note, then Sign and send to the PIMS, then on Signed the next step (Send to the PIMS, else Send summary, else Next visit); the banner carries none of them and shows the state as gray text (requirement 67). Start visit asks one question, "Did Jordan agree to recording?", with Owner agreed, start and Not yet, and saves the answer with the visit (`consent_recorded`); there is no separate consent switch. Saying "Start visit" to the glasses works too. While recording, Draft note sits in the bar next to the recording status; its help line is "Stops recording and drafts the note with Blinq". On the iPhone, Start visit is the one green button at the bottom of Before you walk in, and Stop recording, Draft note and Keep recording sit right under the timer On a visit (decision D1): Start visit, which asks "Did Jordan agree to recording?" in a small dialog that says what gets recorded (Not yet, and Owner agreed, start, which ⌘↵ also presses); then Start recording, or while recording Stop and draft note (with a plain Stop beside it), or ✦ Draft note; then the stepping primary ("Fill in ..." or "Confirm ..." while anything is left to confirm, with a quiet "Then: Sign and send to the PIMS" line), then Sign and send to the PIMS; on Signed, Send to the PIMS if signed only, then "Text summary to Jordan" (the owner's preferred channel first; the Spanish toggle stays), then "Next: Miso". Pages pad their bottom so nothing hides behind the bar | P0 | Built on web, every page with ⌘↵ and the kbd hint: Home, Notes, End of day, and every visit state (Start visit with the consent question in a small dialog, Start recording or Stop and draft note or ✦ Draft note, the stepping primary, Send to the PIMS, Text summary to Jordan, Next: Miso). A mic for Ask Blinq by voice sits at the left of every visit bar. iPhone with the Expo app |
| 71 | The brief is one line of facts. On the web it is a dismissible purple line at the top of Home: "5 visits today. 3 notes to sign, 1 text that didn't send and 1 recheck link not booked. 2 new since yesterday: Miso's kidney results and a text from Jordan.", the counts in bold (what failed is bold too; red is for the row where it can be fixed), with Hear it and Dismiss. No field, no Talk button, no suggestions in it. The counts are what Home lists: the note buckets and the follow ups. **Ask Blinq** has one way in: a purple pill in the top bar, "✦ Ask Blinq ⌘J" with a mic for press to talk (⌥ Space), opening a panel under the top bar, or docked on the right (the default on visit pages wider than 1280 px). The panel starts with today's brief as Blinq's first message, then one field with a mic inside and 2 or 3 suggestions that follow each answer. **Answers:** plain ink with a source line ("Kidney panel, received 12:40 AM · Last visit Aug 14"), links such as Open Miso's visit and Open her record, and 2 or 3 new suggestions. An answer is 2 or 3 plain spoken sentences: no markdown, no veterinary shorthand, no "[confirm]" markers, never a repeat of what is on screen. A clinical question gets "That's your call" plus the facts Blinq has; suggestions never offer a treatment question. **Voice:** press to talk, never an always-on mic; listening shows a level meter and live captions, speaking shows captions and one Stop. **Shortcuts:** ⌘J opens Ask Blinq, Esc closes the panel or stops Blinq speaking, ⌥ Space talks. On the iPhone the brief is Blinq's first message in Ask Blinq (iPhone PRD requirements 34 and 35) | P1 | Built (web) |
| 72 | Declutter rules for every screen, on the web and the iPhone. One color per meaning: red only for failed or blocked, with one exception, the pulsing recording dot (requirement 58); amber only for a clinical caution on a patient, as a small amber dot with plain text, never a warning triangle; green only for the one main action on a page (in the pinned bar, bottom right, requirement 70), plus "done" and the selected tab's underline; purple only for AI; everything else neutral. An overdue exam or vaccine is not a clinical caution, so next due is ink text with "overdue" or "due soon", never amber; in a pet's What's due, overdue items come first with the word "Overdue" in Body strong ink. A caution's amber dot is 10 px, lined up with its text: a true amber (the `caution` token) with a thin darker ring so it stays crisp on white, never the darker warning text color, which reads as brown. No warning icons on headings, pills or non-clinical items; Remember milestones are a gray label, never a warning. Status is plain gray text unless it needs attention, and nothing is shown twice. The next step comes first, with one main button. A caution always says what it is ("Caution: Towel wrap"). The top bar status pill is neutral, and mock AI shows a flask icon, never a warning. See Screens, Declutter rules | P1 | In progress (web). Visit pages follow it: cautions labeled with the amber dot, things to confirm purple at their field, red only for a failed text or upload, green only for the one action and done steps |
| 73 | Two button names, everywhere (screens, walkthroughs, API notes that describe labels). Draft note (was Write the note): a green main button with Blinq's sparkle, in the pinned bar; its help line is "Stops recording and drafts the note with Blinq". On the web the record is the Record tab beside Visit, under the banner, where it can't be read as audio recording; the iPhone sheet keeps the name Patient record, the PIMS term. Start recording and Stop recording keep their names | P1 | Built on web (Draft note with the sparkle in the pinned bar; the Record tab at the top of the content card). iPhone with the Expo app |
| 74 | A heavy day (20 visits, 24 pets) holds up. The rail: the date switcher says "20 visits · 24 pets" when households make the pets more than the visits; the visits on one line in clock order (requirement 83): Done · N folded at the top of the line, above the Now line, then after now the next 6 and "+N more this afternoon", which opens in place; one Needs me toggle. A household visit is one owner-led row: folded, "2:00 PM · Jordan Lee · 3 pets" and nothing else; open (on screen or in the room), the owner with "x of y signed", the pets' initials stacked with "3 pets", and a row per pet in the same two lines as every row (requirement 77: name, species and age, breed, reason, caution, and In visit, Draft ready or Signed; nothing for not started), joined by a thin guide line. Home on a heavy day: the greeting, one plain sentence with a slim progress bar and up to 3 heads-up chips (the next household, the next caution, the last visit; a caution chip is the amber dot with "Caution: X"), no timeline; Follow-ups waiting capped at 3 plus "+N more". Between visits (nobody in the room, the clinic open, a visit still to come): no row says In visit, and the next visit sits just under the Now line; the sentence is the pace and the free time ("Running about 15 min behind. Free until 1:30 PM."), the pace said only when visits that were due started in Blinq Scribe; Up next as the prep; Quick ones for the gap, up to 3 follow ups the provider can do that fit before the next visit, each with about how long it takes; and one green "Open Smokey's visit". The demo clinic's heavy day is two days after today, read at its own clock (1:15 PM), with "Demo day at 1:15 PM" on Home | P1 | Built on web and server (mock) |
| 75 | A household visit: one appointment for an owner with several pets. The banner leads with the household ("Jordan Lee household · 3 pets in this visit") and the owner card; a tab per pet inside the content card with where its note stands (Signed, Draft, Not started). One shared recording for the room, split by pet: each note line and each transcript line belongs to one pet, and the transcript shows one pet's lines ("7 lines about Kiwi and Mochi hidden") or the whole room. A line Blinq can't place ("one of them" after two pets were named) is put on the first pet it could be about with a purple pet question at the line, "Which pet? Hazel / Mochi", that keeps it there or moves it to the other pet's note; it is a thing to confirm, so the server refuses to sign with it left (409). Mock AI places lines by the names said, the same way every time; the model is asked to mark such a line "[confirm pet: Hazel or Mochi]" in plain words, never guess. The green action steps across the pets (decision D1): "Confirm Hazel" (then "Then: Review Kiwi and Mochi, sign 3 notes"), "Review Kiwi", "Review Mochi", then "Sign 3 notes and send to the PIMS", never greyed out, with ⌘↵ throughout and "Sign Hazel only" as a quiet link. After signing, one text to the owner covers every pet (one summary page), and the summary waits until every pet's note is signed. Autosave keeps the pet tab per visit | P1 | Built on web and server (mock). One booking link for several pets' rechecks: requirement 79. "Reviewed" means the provider saw the whole note: requirement 80 |
| 76 | Last plan checkboxes feed the draft. In Before you walk in the provider ticks lines of the last plan to cover today; the ticks are kept with the visit (its appointment and pet) on the server, so a reload or another computer shows them. Drafting passes the ticked lines to the scribe as "provider asked to cover today". On the draft, each ticked line the visit didn't talk about is a purple item at the Plan, quoted as the provider wrote it, "From your last plan, not covered: <line>", with Add to Plan (the line goes into the Plan as written) and Dismiss. It steps the green action like a thing to confirm ("Check 1 line from your last plan"), never disabled; it is a reminder, so the server never refuses to sign over it. Mock AI decides "covered" by the line's key words in the transcript (what it is about, never how or when), the same way every time; the model is asked for the same check and may only quote the provider's own lines (anything else is dropped). Blinq never adds clinical content about a line | P1 | Built on web and server (mock and model prompt) |
| 77 | Two-line rail rows and the quick card (replaces the one-line 36 px rows). The rail is 360 px wide. Every row, on any day, standard or heavy, and every household pet row: line 1 is the time (AM/PM, quiet gray, tabular), the pet's name (15 px, bold) and its species and age in plain words ("Cat, 3 years", never "3 yrs"), with the status at the right only when it means something; the breed on a small quiet line under the name; line 2 the reason in plain words, wrapping to at most two lines, never cut to one line; and a caution on its own short amber line with the amber dot ("Watch airway", the PIMS's short label), which screen readers hear as "Caution: Watch airway". Anything the PIMS marks as an alert shows there. Rows are about 72 to 96 px. Statuses: In visit (a green dot, pulsing while audio comes in), Draft ready (purple sparkle, it is AI output), Signed (green check), and red only for something broken (a text that didn't send, a PIMS save that failed); Not started shows nothing anywhere in the rail. The rail is a timeline (requirement 83): the visits on one line in clock order with the Now line, no group labels; on a heavy day Done folded at the top and "+N more"; and owner-led household rows. The quick card: hover a row for about 300 ms, or focus it with the keyboard, and a read only card opens to the right with a small pointer; Esc or moving away closes it, it stays open while the pointer is on it, and clicking the row still opens the visit. It shows the pet's initial, name, species, breed, sex, age and weight; the owner with a phone (formatted like the rest of the app); the last visit with its reason; the reason for today; "From PIMS" notes (Fear Free and handling notes, medicines given at home; never the medical note) with "Synced 8:02 AM", the time the schedule was read; the PIMS's alerts in amber, or "No alerts in PIMS"; and "Read only" with one "Open visit" link. No second button, no edit controls, no AI summary. The card is the row's `role="tooltip"`, linked by `aria-describedby`. It reads only what the day's schedule carries (`pims_notes`, `last_visit`, `weight` on the patient, `synced_at` on the appointment), so hovering sends no request. When the rail stacks under the page (1100 px and narrower) and on touch there is no card: a tap opens the visit | P1 | Built on web and server (mock) |
| 78 | Home reads every clinic day as one plain sentence with a slim bar and heads-up chips, not only the heavy day, and between visits (nobody in the room, the clinic open, a visit still to come) on any day, today's 5-visit demo included: the free time, the pace only when visits that were due started in Blinq Scribe, Quick ones for the gap, one green Open visit. Up next says when the pet was checked in ("checked in at 1:04 PM") and the bar who is here ("Nina is in the room", "Smokey is checked in") when the PIMS says. Today's clock can be pinned to a time of day (`localStorage.blinq_clock = "09:45"`) for demo recordings and the end to end tests, so their results never depend on the hour they run | P1 | Built on web (mock check-in times) |
| 79 | One booking link for several pets. When a household visit, or several signed visits for the same owner on the same day, has more than one recheck, the owner gets one text with one booking link for all of them: "Hi Jordan, Dr. Rivera would like to see Hazel and Mochi again. Pick a time for both rechecks with one link: <link>". Never a medical detail. A household's links wait for each other while another pet's recheck is undecided or its note unsigned ("Goes out with Hazel's recheck, so Jordan gets one text with one link"); the 10 minute backstop sends anything still waiting. The follow ups say "One link for Hazel's and Mochi's rechecks"; Home's waiting list has one row for it, retry and resend send the one text again, and the one reminder goes once. `BOOKING_URL_TEMPLATE` is kept: optional, with `{location_id}`, `{service_id}` and `{start}` (the earliest pet's first day), falling back to the built-in demo link, and with no link the text says to call. The demo household has two rechecks (Hazel and Mochi) | P1 | Built on server and web (mock) |
| 80 | A pet's note in a household visit is reviewed only once the provider saw all of it: its end scrolled into view, or every section in view, or the green action pressed on its tab with the end in view. Opening the tab is not enough. The stepping action reviews the note on screen to its end first ("Review Hazel" scrolls to the first part not seen), "Review Kiwi" opens Kiwi's tab at its first part not seen, and pressed again with the end in view marks Kiwi reviewed and steps on. ⌘↵ throughout; reviewed is kept per visit in this browser (autosave) | P1 | Built on web |
| 81 | The busy demo day (two days after today, never pinned, since judges may run the demo on any date) is easy to find and reads as itself: "Busy demo day" in the rail's date switcher and as an item in the day menu; its own brief line from its own record (notes to sign, owner texts that didn't send, follow ups to decide), with Needs me counting the same visits; End of day from the day menu stays on it, with the rail's summary ("9 of 20 seen", then "All 20 seen · 24 pets · last visit at ..."); and every time shown for what happens on it during the demo (started, signed, summary texted, saved, reminder and link dates) reads at the demo clock, not the real one. Today's demo keeps the real clock | P1 | Built on web and server (mock) |
| 82 | Smaller review items: "+ Add a pet (N)" in a household visit's pet tabs after it has started (its note waits as Not started until the draft is redone); the account balance on its own quiet row in the record, out of the owner line; overdue care first in a pet's Overview, each with one action (Add to today's visit inside a visit, else Book); Follow-ups waiting and End of day group one owner's rows under their name, and "+N more" says what they are ("7 recheck links, 5 follow ups to decide"); the Vitals line credits the tech who said them ("Vitals by tech Priya") when the transcript's labels or the provider's Who is this? say so, facts only, in the mock and the model prompt | P1 | Built on web and server (mock and model prompt) |
| 83 | The rail as a timeline. A thin vertical line runs through the rail's dot column, between the time and the pet, joining every visit of the day in clock order, with one dot per visit that says where it stands: an empty gray ring for not started (before or after now, no blame), a green dot pulsing while In visit, a purple dot for Draft ready, a green dot with a check for Signed, and red only for something broken. The dot never works alone: the status text at the right stays as requirement 77 says, and not started still shows nothing. The Now line replaces the group labels on today: a thin green line across the rail at the clinic's current time, with "Now 5:49 PM" in the time column, so earlier visits sit above it and later ones below; before the first visit it sits at the top, after the last at the bottom; other days have no Now line. A break of 60 minutes or more is a dashed stretch of the line with a quiet label ("Free until 1:30 PM", or "Lunch" when the PIMS blocks it). Visits keep their two-line rows, cautions, quick card and selected fill and bar. On a heavy day the done visits fold into one "Done · N" row at the top of the line, above the Now line, and Later today's "+N more this afternoon" stays, so the rail never grows past a screen. Household visits are one dot, with the pets' rows on the existing guide line. Needs me filters the rows and the line joins the dots that are left. Screen readers: the rail is a list, the dots and line are hidden, the statuses are text, and the Now line is a separator read as "Now, 5:49 PM". The iPhone's Today list uses the same line, dots and Now line | P1 | Built on web; iPhone not yet. Lunch is not built: the schedule carries no PIMS block-offs, so every break of 60 minutes or more says "Free until". A heavy day is one with more than 12 visits; a standard day folds nothing, so Done stays in clock order on the line. A visit with something broken stays out of Done so its red dot shows. Changes the grouping in requirements 74 and 77: In the room, Up next and Later today are places on the line, not labels |
| 84 | Preview the PDF before it goes out. Preview PDF on the signed note opens a dialog over the visit (not a new tab): the PDF on a Letter page exactly as the owner gets it, with page thumbnails at the left and Previous and Next under the page. The page is requirement 49: the clinic letterhead, the visit details block, then each pet in the visit's order with What we found (the For the owner text), Medicines, Home care, the photo with its outline, and Next visit, then a When to call box, and a footer with the provider, the clinic phone and Page N of M. An English and Spanish switch at the top changes the PDF only; the dialog stays in the staff's language. A panel at the right lists what the owner gets (a check for each section that has content, and how many photos) and what is never in it (the full note, staff notes and Remember), with one line: to change the words, edit For the owner before signing; signed notes are locked. At the bottom: Letter size and the page count, Download, Print, and Email to the owner's address as the main button (Text a link stays in the share panel). Close or Escape returns to the signed note. Screen readers: the dialog is labeled "Visit summary PDF", focus starts on the page, and the page is the real PDF text, not an image | P1 | Mockup on the canvas (W4c PDF preview). Not built: Preview PDF opens the PDF in a new tab today. The PDF comes from `GET /api/encounters/{id}/summary.pdf?lang=` (requirement 49) |

## Non-functional requirements

The provider stays in control: the AI drafts, people approve, and nothing leaves Blinq Scribe without a signature or an approval.

| Area | Requirement |
| --- | --- |
| Consent | No recording without the owner's consent flag. Start visit asks "Did the owner agree to recording?" and only Owner agreed, start begins the visit; the consent is logged with the visit |
| Human in the loop | Notes are drafts until signed. Signed notes are locked. Follow ups are drafts until approved. Nothing is written to the PIMS until the provider signs (note, photos, prescriptions) or approves (recheck booking). In the hackathon build, approved messages go only to one demo phone number, never to real owners |
| Accuracy | The scribe uses only the transcript, the patient record and photo findings. It never invents vitals, doses or diagnoses |
| Privacy | Demo data is synthetic. Glasses SDK analytics are turned off. Audio and photos are stored only on the Blinq Scribe server |
| Access | Each provider signs in with their own account, tied to their PIMS provider; admins manage the team; an API token for the glasses app and scripts. Passwords hashed, sessions expire after 14 days, invites are one-time. PIMS access uses a service credential: no person behind it, limited to the pilot clinic, revocable by the clinic's admin, never a user or admin login |
| Writes | Every write is idempotent per visit or follow up, so a retry never doubles a note or a booking. Write tests run only against the demo PIMS or a test clinic |
| Audit | Every start, upload, draft, edit, approval and signature is logged with time and actor |
| Separation | Separate repo from the startup's platform. No platform code copied in. All clinic data goes through the practice adapter, and a test fails if the platform's name or a private package appears in shared code |
| Compliance scope | The repo is a prototype outside the company's SOC 2 scope while it uses synthetic data. It comes back into scope before any real patient data, including the onboarding sync, which stores up to 24 months of medical notes on the Blinq Scribe server. Until then, live sync runs only against a test clinic |
| Latency | The draft is ready within 30 seconds of Draft note. Assistant answers within 5 seconds. Both are targets to confirm on real Muse Spark |
| Reliability | Every Meta model has a mock fallback, so the demo and tests never depend on a live endpoint |

## Risks and open questions

The biggest risk is the glasses camera code, because the SDK is in developer preview; the fallback is the phone camera through the web console.

| Risk | Fallback |
| --- | --- |
| Glasses camera SDK calls change or fail | Phone camera in the web console uses the same upload path |
| Meta Model API rejects our structured output format | Built in fallback to plain JSON mode. Muse Code's first task tests this |
| No Meta speech model at the event | Any OpenAI compatible speech endpoint, or an open weights model on partner GPU credits |
| SAM 3.1 endpoint format differs | Only the request mapping in vision.py changes. Mock outline until then |
| Bluetooth mic audio is poor in a loud clinic | Record the demo in a quiet room. Phone mic fallback |
| Writes hit real PIMS data | A test clinic only; the PIMS credential cannot reach any other clinic. Idempotent writes. Any failed write queues for staff |
| The clinic's PIMS can't take a note or attachment write | Signed notes stay "Queued for staff"; the recheck can still be booked through a booking link |
| Org review rule blocks pushes to main | Work on a dev branch. Org owner excludes this repo from the ruleset and Vanta |
| Solo builder, 4 build days | Feature freeze Saturday night. Monday to Wednesday are buffer only |
| Judges read it as AI giving medical advice, a banned project type | Clinical guardrails in every prompt (see AI behavior). The pitch and demo lead with "every clinical word comes from the provider" and show the provider approving and signing |
| The photo feature looks like a simple image analyzer, another banned type | Show photos only as part of the note: capture, outline, saved to the record. Never as a standalone feature |
| Demo shows real practice data we don't have the rights to use | Demo runs on the synthetic clinic. Live PIMS data stays on a test clinic and out of the recording |
| Remember stores something personal the owner wouldn't want kept | The provider checks every item; health, money, grief, religion, politics and legal matters are never suggested; staff only; deleted after 12 months; any item can be removed from the household page |
| Judges can't tell new work from what the startup already had | The demo shows only what was built during the event. `DISCLOSURE.md` lists everything that existed before, including the design system |

**Open questions**

- [ ] Which speech model does the event offer? (SAM 3.1 is `sam-3.1` on Meta Model API.)
- [ ] Do we have Ray-Ban Display glasses, or only audio and camera glasses?
- [ ] What do the official rules say about who may contribute to a solo entry?
- [ ] Which phone number receives the demo texts? (Provider: Telnyx)

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| Nov 1, 2026 | The demo draft gives the same outcome as the real product: written clinical notes for the shipped samples and a clean fallback for any other transcript | Judges with no keys should see a note a provider would sign, not the transcript pasted into the sections |
| Nov 1, 2026 | Light, Dark and System theme in the account menu | Providers work in dim exam rooms and at night. System follows the device |
| Nov 1, 2026 | The PIMS name comes from the PIMS connection as data; every user-facing label says "the PIMS", never a vendor name | One product for every practice system. Until the connection supplies it, the adapter returns no name |
| Nov 1, 2026 | Heart is the default read-aloud voice | It was already the default, and the user confirmed it. Each provider can pick another voice and speed in Account |
| Nov 1, 2026 | Keep the /ui gallery instead of Storybook | The gallery already shows every component and color token, in light and dark, so there is no second tool to keep current |
| Nov 1, 2026 | No "reassign visit" for now | Not needed for the demo. On a visit with no provider, the provider who starts it owns it (see Roles and permissions) |
| Nov 1, 2026 | Design elements live in the shared `packages/ui` and `packages/tokens`, each shown in the /ui gallery | Every screen uses the same pieces. Screens may not use raw buttons, inputs or selects |
| Nov 1, 2026 | Declutter rules for every screen, web and iPhone (requirement 72): one color per meaning (red failed or blocked, with one exception, the pulsing recording dot of requirement 58; amber a clinical caution dot; green the one main action and done; purple AI; everything else neutral); no warning icons on non-clinical items; status is gray text unless it needs attention; the next step comes first with one main button | Colors and warnings were everywhere, so nothing stood out. When a color means one thing, the provider can trust it and find the next step fast |
| Nov 1, 2026 | The week strip shows a neutral selected day, a gray dot for still open, red for failed and a small check for all done. This replaces "amber dot = still open" | Open is normal, not a caution, so it should not use the clinical caution color |
| Nov 1, 2026 | Write the note becomes Draft note, and the Record button becomes Patient record (requirement 73) | Draft note says what Blinq does. Patient record is the PIMS term, and "Record" clashed with audio recording |
| Nov 1, 2026 | The morning brief is one sentence that ends with "Want to hear more?", and the conversation continues inside the brief card (requirements 36 and 71). The three lists stay in `GET /api/brief` | Three columns were more than a provider reads between rooms. One sentence lets the provider choose what to hear more about |
| Nov 1, 2026 | Ask Blinq never suggests a question it would answer with "That's your call". "Should I add an antifungal?" is removed from every suggestion list | A suggestion is a promise. Blinq informs and the provider decides, so it never offers a treatment question |
| Nov 1, 2026 | One green main action per visit state, in the pinned bar only: Start visit, then ✦ Draft note, then Sign and send to the PIMS, then on Signed Send to the PIMS, Send summary and Next visit. The banner carries none of them and shows the state as gray text (requirements 67 and 70) | Each action was shown twice, and a screen could have three green buttons. One place and one color means the next step is always where the provider looks |
| Nov 1, 2026 | Visit banner: pet facts as one gray line, cautions as an amber dot plus text, the state as one gray line, no green "No alerts". Before you walk in doesn't repeat the banner. Review writes "to confirm" once, in purple | The same facts showed up in chips in the schedule, the banner and Before you walk in. Said once, they are read once |
| Nov 1, 2026 | Signed shows one status line, and the per item PIMS list stays collapsed unless something isn't saved. The prescription always reads "Front desk enters it" and is never sendable | Saved is the normal case, so item by item rows matter only when something isn't saved. Not sent yet is a step not taken, so it is plain ink, and red stays for Couldn't save |
| Nov 1, 2026 | End of day hides the To do card. Before you go is the same list and count across all open items, with one green action, then Blinq's one sentence and Tomorrow with one row per visit. `GET /api/end-of-day` returns every open item | To do and Before you go were the same list, and the two counts disagreed |
| Nov 1, 2026 | Household: next due is ink text with "overdue" or "due soon", never amber. The pet count is only in the header line, and the list title is just "Pets". No green button, and no Coming up | Most next due dates were amber, so nothing stood out. Nothing on the page is the provider's next step, and Coming up repeated next due |
| Nov 1, 2026 | Ask Blinq: the text field is always the default input, with the mic inside it. Follow ups replace the suggestions above it. No "Anything else?", Talk or "Type instead". One Stop (the Read aloud button) while speaking. The launcher is one pill, "✦ Ask Blinq" with a mic. Answers are 2 or 3 plain spoken sentences (requirement 71) | Swapping input modes added buttons that repeated each other. Short plain answers are easier to hear and don't repeat the screen |
| Nov 1, 2026 | Trust pass: a recheck link sent is counted as sent, not booked; each weekday has its own demo visits; demo texts sit at clock times on earlier days; to confirm items are marked in place in purple; sources are a quiet control under each section that jumps to the transcript; Who is this? is one tap; the prescription is a tracked front desk task; an unbooked link gets one reminder; toasts sit under the top bar | A provider trusts what they can check. Each of these was a place where the screen said something that wasn't quite what happened, or hid the thing to check |
| Nov 1, 2026 | Days and times are the clinic's: `CLINIC_TZ` sets the server's zone, so a server in UTC never puts an evening visit on the next day or a 14 day recheck a day late | A container runs in UTC; the clinic doesn't |
| Nov 2, 2026 | Numbers are Poppins with tabular figures (`font-num`), the rail's time column included: no mono anywhere | In mono, "lb" reads like "1b" and numbers inside prose jump out. Tabular figures keep columns aligned without a second family |
| Nov 2, 2026 | The rail follows the outside design review: 36 px rows on one grid (time, dot, name, status), sentence case group labels, a quiet fill and green bar on the visit on screen, "+N more" as a plain link in the name column, Done at the foot. Five rail type roles cover its 15, 12.5 and 11 px text; its tertiary gray is `textQuiet` (#6e6e6e), since the review's #8a8a8a fails AA. A caution keeps its label on a second line under the name | The rail is denser than any card. Fixed rail roles keep it from growing its own sizes, and a caution's label stays readable without a tooltip |
| Nov 2, 2026 | One green action per page, always in the pinned bar at the bottom right, with a specific label, and ⌘↵ presses it (requirement 70) | A fixed place and a label that says what it sends means the provider never hunts for the next step |
| Nov 2, 2026 | Home replaces Morning and To do: one purple brief line (Hear it, Dismiss), Up next with facts-only Why it matters, Follow-ups waiting with the two note buckets (Ready to sign, Pending) and one action per row. The rail is the day only, with a date switcher and one Needs me toggle; the week strip, the To do box and the top bar's Morning brief and End of day buttons are removed. End of day moves into the day menu ("Dr. Ana Rivera's day") | To do and the schedule were the same mental list. The buckets cover every unsigned note on any day, so nothing slips, and bulk signing is offered only for notes with nothing left to confirm or decide |
| Nov 2, 2026 | Ask Blinq has one way in: the top bar's purple pill with its mic. The floating launcher and the brief's own field and Talk button are gone | Four ways to talk to Blinq on one screen read as clutter |
| Nov 2, 2026 | Cautions are an amber dot with their label ("Caution: Towel wrap"), never a triangle or an amber tag. Things to confirm stay purple. The brief and Why it matters are facts only | A bare dot is safety information nobody can decode; a guess or a suggested check is advice Blinq doesn't give |
| Nov 2, 2026 | Demo days after today have their own visits (`week_ahead`), none of them pets on today's schedule; earlier weekdays seed two drafts ready to sign for pets not on today's schedule | Tomorrow repeating today's pets put Biscuit's recheck before it was due, and an empty Ready to sign bucket showed nothing |
| Nov 2, 2026 | D1: the green action steps forward and is never disabled. While anything is left to confirm, it names that step ("Fill in ear drop product and duration") and goes to it; a quiet "Then: ..." line says what follows; Sign only is a quiet link. The server refuses to sign with any "[confirm: ...]" left (409) | The provider always sees what's next instead of wondering why a button is grey, and a client bug can never sign an unchecked note |
| Nov 2, 2026 | D2: a reload, a crash or signing back in comes back to the same visit, tab, pet, scroll, open section and unsaved edits (kept in this browser per person for a day, restored only over the same server note). After a session timeout, signing, sending to the PIMS and texting wait for signing back in, which returns to the page; the recording kept from the timeout goes only to the same person | A provider who loses a half-reviewed note once stops trusting the scribe. Writing to the record and reaching the owner always need a session |
| Nov 2, 2026 | Before you walk in is dated facts, newest first (the owner's text, results in, the last plan as checkboxes quoted in plain words, older visits about the same problem) and never interprets or suggests: "Plan to check" became "From your last plan". The weight shows once: in the banner facts when taken in the visit, else as the trend on the alert line | Facts the provider can verify earn trust; a suggested check or a guess ("likely relapse") is the provider's call, not Blinq's |
| Nov 2, 2026 | The caution dot is a true amber (`caution` token, with a thin darker ring), not the warning text color. Selected tabs and pet cards are marked by a green underline instead of an ink outline. The step bar has no divider above it | The old dot read as brown and the ink outlines competed with the content; one green mark for "selected" is easy to find |
| Nov 2, 2026 | Notes reach back 24 months: the PIMS sync, the patient's notes and Previous notes on Before the visit. Voice profiles still learn from the last 90 days | A provider walking in needs last year's visits too; writing style should follow how they write now |
| Nov 4, 2026 | The rail becomes a timeline: a thin line and a dot per visit, the Now line at the clinic's time instead of group labels, dashed breaks of an hour or more, Done folded at the top on heavy days (requirement 83) | Group labels said where a visit sat in the list, not in the day: at 5:49 PM a 9:00 AM visit no one started still read "Up next". A line with the Now marker shows the day at a glance, keeps the visits in clock order and lets the dot carry progress next to the status text |
| Nov 2, 2026 | Rail rows are two lines in a 360 px rail, with a read only quick card on hover (about 300 ms) and keyboard focus (requirement 77). This replaces the one-line 36 px rows and the "Not started" pill everywhere in the rail. Statuses only when they mean something: In visit (green dot), Draft ready (purple), Signed (green check), red only for something broken. A caution is its own short amber line under the reason. The card shows the PIMS's own notes (a new `pims_notes` field through the adapter, REST and GraphQL), the last visit, the weight and when the schedule was read, all from the schedule, so hovering sends no request | Rows like "9:00 AM Rocket · Paw la… Not started" were too compact to help: a provider wants the pet's name, species and age first, then the reason in full. The rest belongs one hover away, read only, so the rail stays a list and the card never competes with the visit page |
| Nov 1, 2026 | Type and layout follow seven roles, three weights and six spacing steps (see Type and layout rules below). Facts are label/value rows, lists are list rows, and a lint rule enforces the rest | One screen used about nine text sizes and four weights, headings had no fixed sizes, and the same facts showed up in three layouts. Fixed roles make every screen read the same way |


### Type and layout rules

Every piece of text has exactly one role. A role sets size, line height and weight; color comes from meaning (ink, gray, red failed, green done, purple AI, an amber dot for a caution).

| Role | Size and line | Weight | Class | Use for |
| --- | --- | --- | --- | --- |
| Display | 24/32 | 600 | `text-display` | The one page subject: the pet in the visit banner, the page title. One per page |
| Title | 16/24 | 600 | `text-title` | Card, dialog and sheet titles |
| Section | 13/20 | 600 | `text-section` | Subheadings inside a card |
| Body | 14/20 | 400 | `text-body` | All reading text, values and notes |
| Body strong | 14/20 | 500 | `text-body-strong` | List row titles, buttons, tabs, chips, links |
| Meta | 13/18 | 400, gray | `text-meta` | Anything secondary: dates, who and where, facts lines, the label above a value |
| Label | 11/16 | 500, caps, gray | `text-label` | Column labels and table headers only |
| Rail title | 15/20 | 600 | `text-rail-title` | The day at the top of the left rail |
| Rail meta | 12.5/16 | 400, gray | `text-rail-meta` | The day's counts under the rail's title |
| Rail time | 12.5/16 | 500, quiet gray | `text-rail-time` | The rail's time column, the Needs me label and "+N more" |
| Rail group | 11/16 | 500, quiet gray | `text-rail-group` | The rail's group labels, in sentence case |
| Rail tag | 11/16 | 600 | `text-rail-tag` | The rail's statuses (In visit, Draft ready, Signed), the pets' initials and the Now line |
| Rail name | 15/20 | 600 | `text-rail-name` | A rail row's pet or owner, the first thing a provider reads |
| Rail sub | 12/16 | 400, quiet gray | `text-rail-sub` | The small line under a rail row's name (the breed), and the quick card's sync time and "Read only" |
| Rail reason | 13/18 | 400 | `text-rail-reason` | A rail row's reason (up to two lines) and the quick card's text |
| Rail caution | 12.5/16 | 500 | `text-rail-caution` | A caution's short amber line under a rail row's reason, with `text-warning` |
| Number | its line's size and weight | its line's | `font-num` | Times, money, measurements, IDs, phone numbers, timers. Poppins with tabular figures everywhere, the rail's time column too: no mono. Dates stay as text |

- **Three weights:** 400, 500 and 600. 300 and 700 are not used, and a primary button is 500 like every other control.
- **Spacing:** 4, 8, 12, 16, 24 and 32 px, nothing between. Cards have 16 padding and 16 from head to body, sections in a card sit 24 apart, list rows have 12 above and below.
- **Shared blocks in `packages/ui`:** `LabelValueGrid` and `LabelValue` (a Meta label above a Body value, the one way to show a fact), `ListRow` (an icon or a time, a Body strong title, a Meta line, a chevron), `FactsLine` (one Meta line joined with " · "), `Num`, `Card.Section`, and `Caution`, which takes the role of its line. Times never break between the time and AM or PM.
- **Tables:** every table is `DataTable` from `packages/ui`: a real `<table>`, Label headers, compact rows (8 above and below), zebra rows on `surface-muted`, 12 px cell padding. Money and counts are `num` columns, right-aligned with `font-num`. Status is its own column, plain text. Child rows (an invoice's line items) sit in the parent's columns, amounts under the total. On a phone the table scrolls inside its box, never the page.
- **Rail roles:** the nine `text-rail-*` roles are the left rail's only (`packages/ui` Rail.tsx with its quick card, and the left column), from the outside design review and the two-line rows of Nov 2. Its 20 px inset and the 12 px gap after its 60 px time column are the `railInset` and `railGap` size tokens; the rail is `columnLeft`, 360 px.
- **Tokens:** `packages/tokens` defines the roles and generates each one as a Tailwind utility in `theme.css`. The design system's other sizes stay in the tokens for reference but never reach the screens. Body and Meta lines are whole pixels (20 and 18) so rows sit on the 4 px grid.
- **Lint guard:** an ESLint rule in `packages/tokens` (`blinq/type-roles`, on in the web app and `packages/ui`) fails on retired type classes, hand set weights, mono, inline font styles and spacing between the six steps. A test fails if `web/src/styles/app.css` sets any type of its own.

#### Buttons

- **One component:** `Button`, `IconButton`, `ToolButton` and `MainAction` from `packages/ui`. A screen passes `icon` and `iconEnd`, never an `<Icon>` child, and no class that changes the gap or an icon's size.
- **One icon:** Material Symbols Rounded, weight 400, outlined, at the default 18 px in every button size (sm 32, md 40, lg 48) and in toolbar tools. `iconClassName` sets a color only, and it colors both icons.
- **Leading or trailing:** a leading icon says what the action does (send, print, check, sign). A trailing icon says where it goes (`chevron_right`, `arrow_forward`, `expand_more`). Most buttons have none. A menu trigger may have both (the day menu: `calendar_today`, then `expand_more`).
- **Spacing:** 8 px between icon, label and hint (the button's own gap).
- **Shortcut hint:** only on `MainAction`, after the label. ⌘ and ↵ are icons from the same font (`keyboard_command_key`, `keyboard_return`) at the same 18 px and weight as the leading icon; "Ctrl" is text in the label's role. A 20 px tall tint (`on-primary` at 15%), no border, centered on the label.
- **One green action per page,** the `MainAction` in the pinned bar (requirement 70). Every other action is an outline button or a link.

# Part 2: Product spec

## User flows

*(Drawing in the live doc.)* Flow: Morning brief (glasses) > Start visit (owner consents) > Record the exam (audio, photos on cue) > Draft note (Muse Spark drafts) > Review the note > Follow ups (approve or dismiss) > Sign the note (locked) > Staff queue (rechecks to book). Between rooms, "who is next" loops back to the next visit.

Recording starts only after the owner agrees, and nothing reaches the owner or the PIMS until the provider approves or signs. The morning brief runs once a day; the loop from "Between rooms" repeats for every visit.

## System architecture

*(Drawing in the live doc.)* Meta AI glasses (mic, camera, speakers) connect over Bluetooth to the iPhone app, which sends audio and photos over HTTPS to the Blinq Scribe server. The web console also talks to the server. Inside the server: scribe pipeline, day assistant, audit log and media, and the practice adapter. The server calls Meta Model API (Muse Spark, SAM 3.1, speech to text). The practice adapter reads from either the synthetic clinic (the demo PIMS, default) or the clinic's PIMS, limited to that clinic. Writes go out through the same adapter, only after the provider signs or approves.

All clinic data passes through the practice adapter, so the same server runs on the synthetic clinic for judges and on a clinic's PIMS for a pilot. The server is Python 3.14 (FastAPI with Strawberry GraphQL) on PostgreSQL, with Temporal for background work (see Tech stack). Demo mode runs on SQLite. It ships as Docker containers.

## Tech stack

Blinq Scribe uses the same open source stack as the startup's existing platform, so it could move into it later without a rewrite. It never imports platform code or private packages.

| Layer | Blinq Scribe |
| --- | --- |
| Server | Python 3.14, FastAPI |
| API | GraphQL first with Strawberry, `snake_case` fields. REST only for webhooks, OAuth callbacks, health, audio chunk uploads and the owner's summary page |
| Database | PostgreSQL 18, Peewee async models, Alembic migrations. Demo mode and tests run on SQLite |
| Background work | Temporal: texts after signing, booking link checks, the onboarding and nightly note sync, Remember expiry |
| Sign in and roles | Bearer tokens, Blinq Scribe's own accounts, Google and Microsoft sign in, 2FA codes. Roles enforced with Casbin (our own policy file) |
| AI | OpenAI SDK pointed at Meta Model API (Muse Spark, SAM 3.1, Muse Voice Transcribe). Structured replies use a strict schema with one retry. Read aloud uses Kokoro-82M (open source) on ONNX Runtime with our own pronunciation table |
| Texts and email | Telnyx; SMTP with Jinja2 templates. Texts are preview only in demo mode; email is for sign in (reset links, 2FA codes) and logs instead of sending when SMTP isn't set |
| Python tooling | uv, ruff (88 characters), mypy strict, pytest |
| Web app | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Radix UI, Apollo Client 3, React Router 7, React Hook Form with Zod, Zustand, i18next, graphql-ws for subscriptions and GraphQL Code Generator for typed operations. pnpm 10 and Turborepo, Node 22. Its own components on Radix and Tailwind with the design system's colors and type: shared component library `@blinq-scribe/ui` and design tokens `@blinq-scribe/tokens` in `packages/`, with a gallery at `/ui` (demo and development only); screens may not use raw buttons, inputs or selects |
| Web tests | Vitest with Testing Library, Playwright with axe, ESLint with typescript-eslint and react-hooks |
| Mobile app | Expo (React Native) with TypeScript, expo-router, Apollo Client, the token in expo-secure-store. The Meta Wearables Device Access Toolkit runs as an Expo native module written in Swift |
| Monitoring | Planned for a pilot. The audit log covers the demo |
| Deploy | Docker Compose for judges (server, Postgres, Temporal). AWS ECS Fargate for a pilot |

**Clinic data:** the console and the iPhone app only talk to Blinq Scribe's own GraphQL API. Its resolvers read the clinic through the practice adapter: the synthetic clinic (the demo PIMS) in demo mode, or the clinic's PIMS connector. The PIMS credential and the model key stay on the server. Until a connector can write, a signed note is queued for staff.

**What stays separate:** its own public repo; clinic data only through the practice adapter; no platform code, schema or private packages. Blinq Scribe sets its own lint and TypeScript rules in its own config.

**Moving the build to this stack** (requirement 56)

| Part | Today | Moves to | Status |
| --- | --- | --- | --- |
| Server tooling | Python, pip | Python 3.14, uv, ruff, mypy strict | Done |
| API | FastAPI REST | Strawberry GraphQL on the same FastAPI app, with `draft_progress` and `assistant_turn` subscriptions. REST stays for health, audio uploads, the owner page, OAuth callbacks, webhooks and the SwiftUI app until the Expo app ships | Done |
| Storage | SQLite with JSON rows | Peewee models and Alembic migrations on PostgreSQL 18. SQLite stays for demo mode and tests | Done |
| Background work | In the request | Temporal workflows, run in-process when Temporal isn't set | Done |
| Web console | One HTML file | React and Vite app in `web/` with Apollo Client, pnpm and Turborepo | Done |
| iPhone app | SwiftUI app built by Muse Code | Expo app in `mobile/`. The Swift glasses code (audio chunks, camera, mock device) becomes its native module, so that work carries over | Not started |
| Sign in | Email and password, invites | Adds Remember me, Forgot password, Google, Microsoft and 2FA codes (requirement 57) | Done |
| Deploy | uvicorn on one machine | Docker Compose (server, Postgres, Temporal, worker). The demo still runs as one command without Docker | Done |

Order: server tooling, then GraphQL and Postgres, then the web console, then the Expo app. The synthetic clinic, the tests and demo mode keep working at every step.

## Meta models and tools

Muse Spark does the thinking; SAM 3.1, the glasses and Muse Code each cover one more part of the job.

| Tool | Job in Blinq Scribe | Where in the code | Status |
| --- | --- | --- | --- |
| Muse Spark (`muse-spark-1.1`) via Meta Model API | Writes the SOAP note and follow ups, describes photos, runs the day assistant's tool calls | `llm.py`, `scribe.py`, `vision.py`, `assistant.py` | Wired, mock until the key is in `.env` |
| SAM 3.1 (`sam-3.1`) via Meta Model API | Outlines the wound, mass or tooth in each exam photo | `vision.py` | Wired, mock until `SAM_ENDPOINT` and the key are in `.env` |
| Muse Voice Transcribe (`muse-voice-transcribe-1.0`) via Meta Model API | Turns glasses and computer audio (16 kHz WAV, 15 second chunks) into the transcript | `stt.py` | Wired, on with the same key as Muse Spark; open-weights models pluggable |
| Meta Wearables Device Access Toolkit | Glasses camera; mic and speakers over Bluetooth | `glasses-ios/` (moves to an Expo native module in `mobile/`) | Swift glasses code built; Expo app next (Android later) |
| Open weights model (P2) | Runs the scribe inside the clinic for data that must not leave | Same OpenAI compatible client | Not started |
| Muse Code | Writes the remaining code from Oct 30 | Whole repo | Connected with the business key |

Meta Model API is OpenAI compatible: base URL `https://api.meta.ai/v1`, bearer `MODEL_API_KEY`.

## Data model

One Encounter holds everything about a visit; practice data (appointments, patients, owners) is read through the adapter and never stored.

| Object | Key fields | Notes |
| --- | --- | --- |
| Encounter | id, appointment\_id, patient\_id, consent\_recorded, source (glasses, web, upload), status (recording, draft\_ready, signed), transcript, signed\_by, signed\_at, write\_back (status: not\_sent, sending, written, failed, queued; attempts; last\_error; written\_at; pims\_record\_id) | Stored as JSON plus indexed columns (group, patient, appointment, visit day), on PostgreSQL or SQLite |
| SoapNote | subjective, objective, assessment, plan, vitals, medications, client\_summary | client\_summary is for the owner, in plain English |
| FollowUp | id, kind (recheck, client\_update, callback, lab\_result, task), reason, due\_in\_days, message\_draft, suggested\_slots, status (draft, approved, dismissed), booking\_mode (link, book), booking\_link (url, from, to, expires\_at, status: sent, opened, booked, expired), booked\_slot, booking | A recheck carries up to 3 slots. Link is the default; Book it now with a chosen time books it, and `booking` holds the PIMS result (written or queued for staff) |
| RememberItem | id, client\_id, patient\_id, text, kind (birthday, adoption, graduation, wedding, baby, move, trip, other), date (only if the owner said one), said\_at, encounter\_id, transcript\_lines, kept\_by, expires\_at | Staff only. Stored in Blinq Scribe, never written to the PIMS. Deleted after 12 months |
| Slot | start, end, provider\_id, service\_id, booking\_url | From the adapter |
| Photo | id, path, caption, findings, segments (label, score, box), taken\_at | Files stored per encounter |
| Letter | id, patient\_id, kind (referral, records, owner), recipient (name, clinic, email), reason, attachments, body, owner\_consent, status (draft, sent, opened), signed\_by, signed\_at, sent\_to | The provider's reason is kept word for word. A signed letter is locked |
| Audit entry | time, actor (provider, device, ai), action, encounter\_id, detail | Append only |
| Appointment, Patient, Client | Read from the adapter. An approved recheck creates a new Appointment in the PIMS | Patient carries alerts such as "use towel wrap", and for the rail's quick card `pims_notes` (short notes the PIMS keeps: Fear Free, handling, medicines at home; never a medical note; empty when the PIMS has no such field), `last_visit` (date, reason) and `weight` (the newest). Appointment carries `synced_at`, when the schedule was read from the PIMS |

## API

The glasses app and the web console call the same endpoints. The API is GraphQL first (Strawberry, `snake_case` fields). The table names each operation by its REST path for easy reading; in GraphQL each one is a query or mutation of the same name. REST stays only for health, audio chunk uploads, the owner's summary page, OAuth callbacks and Telnyx webhooks. Providers sign in with their own account (see requirement 34); `BLINQ_SCRIBE_API_TOKEN` is the admin and service key. With neither, the console is an open demo.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Which models and data source are live or mock |
| GET | `/api/schedule` | One day's appointments (`?date=`, default today), optional provider filter, each with its status |
| GET | `/api/days` | Week strip: per day from `?from=` to `?to=`, the visit count, open items and failed items |
| GET | `/api/brief` | Morning brief: the text to speak, the one sentence as `sentence` parts with emphasis, `suggestions`, plus `from_yesterday`, `heads_up` and `new_since_yesterday` lists. The lists are what Blinq says when asked. `sentence` and `suggestions` serve requirement 71 |
| GET | `/api/notes/unsigned` | Every note not signed yet, any day, newest first, in its bucket: `ready` (drafted, nothing to confirm, every follow up decided) or `pending`, with `to_confirm`, `followups_undecided`, `reason` ("1 thing to confirm", "Not drafted yet") and `waiting_days`. GraphQL `notes_to_sign`. Home's buckets, the Notes page and End of day read it |
| GET | `/api/end-of-day` | End of day list: visits seen, unsigned notes, follow ups waiting, rechecks booked, anything queued for staff, failed texts, and `tomorrow` (visit count, time range, what to prepare). `left_to_do` returns every open item, including earlier days, not only today's, so Before you go matches To do |
| GET | `/api/patients/{id}/notes` | Earlier notes on the patient from every provider, last 24 months |
| GET | `/api/clients/{id}/household` | The record's owner header, pet tabs, Texts and Remember: owner, every pet with status, alerts, last visit and what's due, balance and spend per pet, recent texts |
| GET | `/api/search` | `?q=` pet name, owner name, email or phone digits (no patient id yet). Pets and owners with last and next visit |
| GET, POST | `/api/patients/{id}/documents` | Documents, received: upload a PDF or photo, get back its key points with page numbers. List and open them |
| GET, POST | `/api/patients/{id}/letters` | Documents, sent: list letters, or start one with `{kind: referral|records|owner, recipient, reason, attachments}`. Returns Blinq's draft |
| PUT | `/api/letters/{id}` | Save edits to a draft letter, the recipient, the attachments and `owner_consent` |
| POST | `/api/letters/{id}/send` | Sign and send: `{channels: [email, owner_text, owner_email, print], to_email, owner_copy}`. Refused while anything is marked to confirm, or without `owner_consent` for another clinic |
| GET | `/api/letters/{id}.pdf` | The letter on the clinic letterhead with its attachments, as one PDF |
| GET | `/api/note-types` | The note types and their sections |
| GET | `/api/patients/{id}/visits` | Patient record, Past visits: visits newest first with type, provider and a one line summary (`?type=sick|wellness`, `?q=` to search). Each expands to its signed note, meds and photos |
| GET | `/api/patients/{id}/profile` | Patient record, Client and patient: patient details and alerts, latest weight (history when the PIMS has it), vaccines due, the client's contact preferences, other pets and latest message |
| GET | `/api/patients/{id}/panel` | The visit banner's pet facts, cautions and last visit, in one read: the pet, alerts, weight, what's due, recent visits (one line each, never note text), owner contact, other pets and the PIMS ids. Reading it writes no notes-opened audit entry |
| GET | `/api/clients/{id}/invoices` | Patient record, Invoices: last 12 months, each invoice with its total and whether it's open. Balance, last payment, line items and payment type come when the PIMS has them. Never a card number |
| POST | `/api/auth/login`, `/api/auth/invite/accept` | Sign in, or set a password from an invite link |
| GET, POST, PATCH | `/api/admin/users`, `/api/admin/providers` | Team: invite people, link each to a provider, turn them off (admins) |
| POST | `/api/admin/onboard` | Sync the last N days (default 90) of notes from the practice system. Also `python -m blinqscribe.onboard --days 90` |
| GET | `/api/providers/{id}/voice` | The provider's voice profile: format, length and abbreviations per SOAP section, from their last signed notes |
| POST | `/api/assistant` | Ask the day assistant. The reply is 2 or 3 plain spoken sentences (see Day assistant rules), with `links` (to the visit or record), `sources` (the source line) and `followups` (2 or 3 suggested next questions). `showing` tells it what the screen already shows, so answers don't repeat it |
| POST | `/api/speech/listen` | One short WAV clip (2 MB at most, 20 a minute per person) to text for a voice question, press to talk on the web and hold to talk on the iPhone. Returns `text` and `via` (`model`, or `mock` in the demo clinic without keys) |
| SUBSCRIBE | `draft_progress(encounter_id)`, `assistant_turn(turn_id)` | GraphQL subscriptions over graphql-ws. Each step of writing the note as it happens, and what Blinq is checking before its answer. They drive the loading states in requirement 58 |
| POST | `/api/encounters` | Start a visit with `patient_ids` (one or more pets) and `note_type`. Refused without `consent_recorded: true` |
| POST | `/api/encounters/{id}/audio` | Upload one audio chunk, returns the updated transcript |
| POST | `/api/encounters/{id}/transcript` | Add to or replace the transcript |
| PATCH, DELETE | `/api/encounters/{id}/photos/{photo_id}` | Edit a photo: `{label, caption, outline, crop, rotation, in_note, show_owner}`, or delete it. The original image is kept until the visit is signed |
| POST | `/api/encounters/{id}/photos` | Upload a photo, returns caption, findings and outlines |
| POST | `/api/encounters/{id}/draft` | Draft the note and plan follow ups |
| PUT | `/api/encounters/{id}/note` | Save the provider's edits (autosaved per section). Refused once signed |
| POST | `/api/encounters/{id}/assist` | Edit tool on one section: `{section, action, text}`, action is `tighten`, `bullets`, `prose`, `repull`, `sources`, `translate_es` or `custom` (with `instruction`). Returns `{suggestion, sources}` and saves nothing until the provider accepts it |
| GET, POST, PUT | `/api/templates` | The provider's and the clinic's saved phrases: `{name, shortcut, text}`, inserted with `/shortcut` |
| POST | `/api/encounters/{id}/speakers/{speaker_id}` | Who is this?: `{role: tech|owner|other, name}` (and the older `family`, `other_vet`) names every line from that voice. Only the visit's provider, never the API token |
| GET | `/api/encounters/{id}/sign-preview` | The sign confirm panel: pet and owner with their PIMS ids checked against the visit's appointment, what goes (note, photos, prescription) and the texts that follow |
| POST | `/api/encounters/{id}/followups/{fid}` | Approve or dismiss one follow up, with `booking_mode: link|book`. Link (default) sends a booking link after signing; book with a chosen time books it. `remind_unbooked` (default true) sends one reminder 3 days after the link if it isn't booked |
| POST | `/api/encounters/{id}/prescription/entered` | The front desk entered the prescription in the PIMS: records who and when on the visit's `prescription_task` and in the audit log. Front office, admins, and the visit's own provider. GraphQL: `mark_prescription_entered` |
| GET | `/api/followups/waiting` | Booking links not booked yet, with status, for End of day's Waiting on owners. `POST /api/followups/{fid}/resend` sends the link again |
| GET, POST, DELETE | `/api/encounters/{id}/remember`, `/api/clients/{id}/remember` | Remember suggestions for this visit (the provider checks what to keep), and the kept items for a household |
| POST | `/api/encounters/{id}/sign` | Sign and lock the note. `send` (default true) also writes the note and photos to the PIMS (queued for staff if the write fails) |
| POST | `/api/encounters/{id}/send-to-pims` | Send a signed note that was signed only, or try a failed send again |
| POST | `/api/encounters/{id}/share` | Share the owner summary: `{channel: text|email|print, language: en|es}`. Only after signing |
| GET | `/api/encounters/{id}/summary.pdf` | The branded PDF, `?lang=en|es` |
| GET | `/s/{token}` | The owner's summary page. Public, asks for the owner's last name, expires in 14 days |
| GET | `/api/encounters/{id}/audit` | Audit log for the visit |

## Screens

The provider can review and sign on the web or the iPhone; both follow the same flow (visit banner, review, sign, PIMS status, share). The web is better for long edits, letters and the team pages; the glasses are for capture and quick answers.

**Web console** (laptop or tablet, two columns, stacks on a phone). Design reference: the web prototype on the canvas, kept outside the repo.

Everywhere: times are 12-hour with AM and PM ("9:00 AM"), phone numbers read "(217) 555-0142", dropdowns use the shared Select, every card has the same border and shadow, and the main column fills the page width. The theme is Light, Dark or System (follows the device), chosen in the account menu and saved per browser. Every screen says "the PIMS", never a vendor name.

**Declutter rules** (requirement 72). They apply to every screen on the web and the iPhone.

- **One color per meaning.** Red only for failed or blocked, with one exception: the pulsing recording dot (requirement 58). Amber only for a clinical caution on a patient, as a small amber dot with plain text, never a warning triangle. Green only for the one main action on a screen (on a visit, in the pinned bar only), plus "done" and the selected tab's underline. Purple only for AI. Everything else is neutral. An overdue exam or vaccine is not a clinical caution, so next due is ink text with "overdue" or "due soon", never amber; in a pet's What's due, overdue items come first with the word "Overdue" in Body strong ink. A caution's amber dot is 10 px, lined up with its text: a true amber (the `caution` token) with a thin darker ring, never the darker warning text color, which reads as brown. Selected tabs (Visit | Record, the record's pet and section tabs, a household's pet tabs) are marked by a green underline, the one use of green besides the main action and done.
- **No warning icons** on headings, pills or non-clinical items. Remember milestones are a gray label, never a warning.
- **Status is plain gray text** unless it needs attention. Nothing is shown twice.
- **The next step comes first,** with one main button.
- **Names:** Draft note, and the Record tab (requirement 73).

- **Sign in:** Blinq Scribe name, email and password, Remember me, Forgot password, Continue with Google or Microsoft, then the 2FA code. Invite only. Try the demo clinic in demo mode.
- **Top bar:** the name (home), search (pets, owners, phone; ⌘K; Recent patients when the field is empty, the last 5 records opened in this browser, else today's patients), the purple **Ask Blinq** pill with its mic (⌘J, ⌥ Space), toasts as a small pill inside the bar (never over the page), one neutral clinic pill, the day menu and the initials menu. The day menu is labeled by name, "Dr. Ana Rivera's day" (never "My day"), and holds whose day (the other providers marked View only, All providers for front office and admins) plus Today and End of day. There is no Morning brief or End of day button. Under 900 px the clinic moves into the initials menu and the controls keep their words; nothing is an unlabeled icon. The open demo acts as the demo clinic's provider and marks no one View only. The status pill is neutral and reads like "Muse Spark · demo clinic", with a check when live; Mock AI shows a flask icon, never a warning. Only a server that isn't ok shows in red. The initials menu holds Account, Theme (Light, Dark, System), texting mode, Team and Sign out.
- **Left rail:** flush to the top bar, the day and its visits only (requirement 37): a date switcher (day before, Today, day after), one quiet Needs me toggle with a small filter menu, then In the room, Up next, Later today ("+N more this afternoon") and Done · N folded. 360 px wide, two lines a visit (requirement 77): the time, the pet's name with species and age and a status only when it means something (In visit, Draft ready, Signed; red only for something broken; never Not started), the breed, the reason wrapping to two lines, and a caution on its own short amber line with the dot. The whole row opens the visit; hovering it (about 300 ms) or focusing it opens a read only quick card to its right with the PIMS's notes and alerts. Times and counts use Poppins with tabular figures, like every number in the app; no mono. No To do box, no week strip, no alert bars. A household visit is one owner-led row, open with a row per pet only when it is on screen or in the room (requirement 74). On End of day the rail folds to the day's summary (requirement 22).
- **Home (requirements 36 and 71):** the brief line, the greeting with the day's progress, Up next with Why it matters beside Follow-ups waiting (the two note buckets, then follow ups with one action each), Since yesterday, and the pinned bar with the one green action, "Open Biscuit's visit" (⌘↵). Dismiss hides the brief for the day.
- **Notes (requirement 37):** `/notes?bucket=ready|pending`. Ready to sign: checkboxes and Select all, columns Pet, Visit, Assessment and Waiting, and the green "Sign N notes" in the pinned bar; the confirm lists each note by pet and date, "Signed as Dr. Ana Rivera", Sign and send to the PIMS (default) or Sign only, and each note signs in turn with its own result. Pending: what's left on each note (Waiting, not Age); a row opens the note, and there is no bulk action.
- **Before the visit:** Before you walk in as a dated timeline, newest first, from the PIMS and texts with Read aloud: the owner's latest text quoted, results that came in, the last visit's plan as "From your last plan" checkboxes in plain words ("Apoquel 16 mg by mouth twice a day for 14 days, then once a day", "Recheck in 4 weeks" with "Was due Sep 28, not booked" in bold ink with an icon, and "30 tablets dispensed Aug 31, none since" from the invoices), then older visits about the same problem; "Can do today: Rabies vaccine due Nov 21" for care due within 30 days; then Remember. It never interprets or suggests. Pets: the visit's pets, other pets only with a reason on record ("+ Waffles · visit today at 1:30 PM", "+ Kiwi · wellness exam overdue") and one menu for the rest, so each pet shows once: "+ 2 more pets" beside the chips, or "+ Add a pet from Jordan's household (4)" when no pet has a reason, with the note type. Previous notes (last 24 months), one line each. The timeline's dots are small filled gray points, so they never read as checkboxes; each last-plan checkbox is centered on the first line of its text, and clicking the text ticks it.
- **Start visit (requirement 70):** the green Start visit is in the pinned bar only, with the note type and room as context. It asks "Did Jordan agree to recording?" in a small dialog, with one line on what gets recorded and that the provider signs the note: Not yet, and Owner agreed, start, the same height (en.ts `visit.ownerAgreed`, the one wording everywhere). ⌘↵ asks, ⌘↵ again agrees, Esc is Not yet. The answer is saved as consent_recorded.
- **Everywhere on a visit:** the compact banner (requirement 67): the pet with its status pill only when not the default, the facts line and the alert line, the visit's time, room, length and reason, the owner with Text, Call and the labeled household button, a red row with Retry for a text to the owner that didn't send, and the step bar Record > Draft > Sign > Share > Follow up. Under it, one content card with Visit | Record at its top; its parts are plain sections with dividers, and only things you act on (a follow up, a confirm item) are boxes. The pinned bar has a mic for Ask Blinq by voice on the left and the one green action on the right.
- **Visit in progress:** the state is gray text in the banner ("Started 9:02 AM"). The pinned bar: while recording, the pulsing red dot, where it records and the running time, Stop, and the green Stop and draft note; stopped, "Recording ended · 0:42" and ✦ Draft note; with nothing recorded yet, Start recording. Upload status shows only when a part fails, as a red row with Retry.
- **Review the note:** the note header "Draft note · Drafted by Blinq" with the note type; vitals on one line with a source chip; SOAP as plain sections with dividers, Blinq's text with a 2 px purple rule on the left and a time chip ("0:27") at the end of each line that opens the transcript at that line, shown when the provider points at the line or tabs to it (always shown on touch screens), while "No source" always shows; a thing to confirm in purple at its field with Confirm and Edit; Edit opens the section in place with the mark as a purple chip (typing over it replaces it); For the owner says "Out of sync with Plan · Update" when Plan changed after it was written. A right column: Before you walk in in short, the owner's latest message, and the transcript in one line ("0:42 recorded · 3 speakers", "Speaker 3 is unnamed · Name them"). Follow ups to approve, Remember, and Transcript and photos below. The pinned bar: "1 thing to confirm · Plan", "Then: ...", Sign only (once nothing is left), and the stepping green action (decision D1). Every edit autosaves and is kept in this browser until saved (decision D2).
- **Signed:** the banner holds the one status line: a green check, "Signed by Dr. Ana Rivera at 9:28 AM" and "Saved to the PIMS" (or "N of M saved"), then "Summary texted" with the time once it is sent. The per item PIMS list (Sending, Saved with the time, Not sent yet with Send to the PIMS, or Couldn't save with Try again) is collapsed behind it, and opens on its own, first on the page, when something isn't saved. Not sent yet is plain ink and Couldn't save is red. The prescription is never sendable: its row is the front desk's task, "Front desk to enter" with Mark entered, then "Entered by Sam Front Desk, 10:42 AM". Then, in order: Share the visit summary until it is sent (Text a link, Email a PDF or Print, in English or Spanish, with previews of the owner's page and the PDF; the picked channel has a neutral outline and no Recommended tag); one Follow ups list (a green check and one gray line each); and the signed note, read only with no Edit and no Locked tag, collapsed until nothing is left to do. A pinned bar holds the single next step: Send to the PIMS, else Send summary, else "Next: Miso at 9:30 AM" with Open visit. The pinned bar's green action: Send to the PIMS when signed only, then "Text summary to Jordan" (or Email summary, or Print summary, the owner's way first), then "Next: Miso" with "Miso at 9:30 AM" beside it. The step bar moves to Share, then Follow up while a follow up waits.
- **End of day (requirement 22):** the rail as the day's summary; the greeting, Blinq's one sentence with Read aloud and a slim progress bar; Notes left to sign with the green "Review and sign N notes" in the pinned bar; Calls and texts left (the failed text the only red, with Retry; Resend link); Front desk and the PIMS; Already handled; and the closing line.
- **Create a letter:** from Documents. The letter type, recipient, reason and attachments on the left; Blinq's draft on the clinic letterhead on the right; then Send it: Email the specialist, Give it to the owner, or Print, and Sign and send.
- **The record (requirements 66, 68 and 69):** one component in two places, the Record tab of a visit and its own page at `/record/:clientId?pet=:patientId&tab=overview|visits|documents|invoices|texts`, opened from search, To do, a pet's name or a household link (the old `household/:clientId` and `patient/:patientId` addresses land here). On its own page it fills the width beside the left column, the owner's name is the page's heading, and there is no pinned bar and nothing green. Top to bottom: the owner once (name, then phone, prefers texts, client since and balance on one gray line; Text and Book a visit as quiet actions, Book a visit only when the clinic has a booking link); a tab per pet (requirement 69); then Overview, Past visits, Documents, Invoices and Texts, with "From the PIMS · read only" in gray on the right. Overview: the pet's facts line; Cautions, only when there is one; What's due as rows (a visit today first, which opens it, then reminders with their due date); Weight, the latest as a number with a small trend; Details (Patient ID and microchip as numbers); and Remember, staff only, where staff can remove an item. Past visits as in requirement 68. Documents: letters sent from the clinic, with Referral, Records and Letter for the owner, then documents received, with upload and Blinq's summary. Invoices: the balance, last 12 months and last payment, then a table (column headers in small caps) whose rows open to their line items. Texts: who and when in gray, then the text, newest first.
- **Account:** from the account menu in the top bar: profile, password, two step sign in, connected Google and Microsoft accounts, and sign out on other devices.
- **Ask Blinq (requirement 71):** one way in, the purple pill in the top bar, "✦ Ask Blinq ⌘J" with a divider and a mic for press to talk. It opens a panel under the top bar (or docked on the right), and the pill stays, pressed, while it is open. It knows the open patient. The panel has a scope line ("Your day", "<Pet>'s visit"), New conversation, and expand to a docked right panel, which is the default on visit pages wider than 1280 px. The text field is always the default input, with the mic inside it, and follow up suggestions replace the suggestions above it; there is no "Anything else?", Talk button or "Type instead" swap. Each answer is 2 or 3 plain spoken sentences with a source line, links and 2 or 3 follow up suggestions. Voice is press to talk with the mic inside the text field: listening (level meter and live captions) and speaking (captions). While Blinq speaks there is one Stop, the Read aloud button, and nothing is duplicated. Shortcuts: ⌘J opens it, Esc closes it or stops Blinq speaking, ⌥ Space talks. While it works it shows typing dots and what it's checking.

**Glasses companion app** (iPhone, stays in a pocket)

- Sign in: the same choices as the web.
- Today: week strip, today's brief as one sentence ending with "Want to hear more?" (Got it to hide), items left from earlier days grouped by action, schedule, search.
- Before you walk in: the pre-room card with Remember, a patient record snapshot (past visits, owner, documents), pets in this visit, note type, and Start visit as the one green main button at the bottom of the screen, not in the banner.
- Tab bar like the web top bar: Today, Search, Ask Blinq, End of day, Settings (hidden while recording).
- The visit banner and Patient record on every visit screen, the same as the web (pet facts and state as gray lines, cautions as a dot with text, Patient record the only button).
- Start or Stop recording, Capture photo, Draft note, then Review the note (one note per pet), Sign and send to PIMS or Sign only, the PIMS status and Share the visit summary, the same as the web. Long edits are easier on the web.
- End of day, the same as the web.
- Ask Blinq (iPhone PRD requirement 34): the brief as Blinq's first message under a "Your day" scope line, one row of 3 suggestions, one composer with a mic inside (the text field is the default input; hold to talk when empty, send when typing), answers with a source line, links and new suggestions that replace the row. No "Anything else?" or Talk swap, and one Stop while Blinq speaks. Answers are 2 or 3 plain spoken sentences. Clinical questions get "That's your call" plus the facts, and suggestions never offer a treatment question.
- Every action is confirmed by voice through the glasses speakers ("Visit started", "Photo saved", "Note drafted with 2 follow ups").

**Lens display** (P2, Ray-Ban Display only)

- One card between rooms: next patient, reason for visit, one alert.

## Roles and permissions

Everyone signs in as themselves, and what they can do follows their role. The screen hides what a person can't do, and the server refuses it anyway.

| | Provider | Front office | Admin |
| --- | --- | --- | --- |
| Whose day opens first | Their own | All providers | All providers (their own if they are also a provider) |
| Day menu in the top bar | Their own day by name ("Dr. Ana Rivera's day"), then other providers marked View only | Every provider, or All providers | Every provider, or All providers |
| Another provider's schedule and signed notes, past visits, documents | View only | Schedule, visit status and the owner summary | Same as front office |
| Another provider's draft, transcript or audio | No ("Draft in progress" only) | No | No |
| Start a visit, record, add photos, write and edit the note | Their own visits | No | No (unless also a provider, for their own visits) |
| Approve or dismiss follow ups, Remember | Their own visits | No | No |
| Sign a note | Only their own visits, as themselves | Never | Never |
| Share the summary, create and send letters | Their own visits | Resend what a provider already approved | Same as front office |
| Booking links waiting on owners | Their own | Resend for any provider | Resend for any provider |
| Ask Blinq | Answers only from what they can see | Same | Same |
| Team, invites, providers, require two step sign in | No | No | Yes |

- **Whose visit it is:** the provider on the appointment (the provider, or the room column on practices that schedule by column). Signing records that provider's login and PIMS provider.
- **A provider who is also an admin** has one login with both: their own visits plus the Team page.
- **The iPhone app signs in as the provider**, so it acts only for that provider's visits. The shared API token is for scripts and setup: it can never sign or edit a note.
- **Audit:** opening another provider's notes is logged with who and when.
- **Visits with no provider:** on practices that book by room with no column provider, the provider who starts the visit owns it from then on; nobody signed in can change a visit that has no owning provider.
- **Letters:** a letter from a visit belongs to that visit's provider; a letter started from the record belongs to the provider who started it. A letter with no owning provider can't be changed.
- **Demo mode:** with nobody invited, the open demo keeps every feature so judges can try the whole product. Try the demo clinic signs in as the demo provider, so the rules show.
- **Two step sign in:** a 6 digit code from an authenticator app. An emailed code is the backup for someone without one.


## AI behavior and guardrails

The AI may draft and suggest, but it may not invent, send or book. Sending and booking happen only when the provider approves.

The AI is never a clinical advisor. It writes down and organizes what the provider decided. It never diagnoses, picks a treatment or dose, or interprets findings. The hackathon rules ban projects that "generate and give medical advice," and the tests check that these rules stay in the prompts.

**Scribe rules** (in `prompts.py`)

- Use only facts from the transcript, the patient record and photo findings.
- Never invent vitals, doses or diagnoses. Write "\[confirm: ...\]" when something is unclear. Inside the mark, plain words with no slashes ("\[confirm: name and dose\]", never "name/dose"); the server rewrites any slash list it gets. A note with any mark left is never signed (decision D1).
- Before you walk in is facts on record only, dated and quoted: the owner's text, results in, the provider's own last plan in plain words, older visits about the same problem, what was dispensed, care due. It never interprets ("likely relapse") and never suggests a check.
- Keep the provider's own wording for diagnoses and drug names.
- List only follow ups the provider said out loud. "Two weeks" becomes 14 days.
- The owner summary is short, plain English, no jargon, no blame. It only repeats care instructions the provider gave.
- Voice profile: drafts match the provider's format (bullets or prose), a length ceiling and abbreviations, learned from every note they wrote in the last 90 days (synced at onboarding, plus notes signed in Blinq Scribe). Only these style rules reach the model, never the notes, so no other patient's facts can leak in. Notes by other providers never shape this provider's style.
- Previous notes: the last 3 notes on the patient, from any provider, go to the model as history only. It never charts an earlier vital, finding or dose as today's, and credits what it uses ("started amlodipine 9 days ago, Dr. Okafor").

**Speaker rules**

- Name only the provider wearing the glasses and the owner on the appointment. Everyone else is a speaker number until the provider names them.
- Never guess. A line Blinq can't place has no name.
- A name the provider picks applies to every line from that voice in the visit, and is never reused on another visit.
- Owner lines feed Remember and the history; the provider's lines feed the exam, plan and follow ups. A line with no name is used only for facts the provider repeats or confirms.

**Photo rules**

- Describe only what is visible: where, size, color, texture, discharge. Never diagnose.

**Day assistant rules**

- Never suggest a diagnosis, treatment, drug or dose, and never interpret findings or lab values.
- Clinical questions get "That's your call. I can pull up the record or past notes," then the facts the tools can give.
- Suggested questions are about the schedule, results, records and history. Blinq never suggests a question it would answer with "That's your call", such as whether to add a treatment.
- The brief and Up next's "Why it matters" are facts on record only: what was seen, written, due, booked or sent, and when ("Recheck was due Sep 28, not booked", the owner's text quoted). Never a check to do ("Plan to check"), never a reading of what it means ("likely relapse").
- Each answer says where it came from in a short source line (what was read and when).
- Answers are 2 or 3 plain spoken sentences: no markdown, no veterinary shorthand, no "[confirm]" markers, and never a repeat of what is already on screen.
- Spoken shorthand is expanded: "6yo" is said as "6 year old".
- Owner messages only repeat what the provider already decided.

**Edit tool rules** (Muse quick actions in the note editor)

- Tighten, Bullets and Prose only reword or reformat the provider's text. Every fact, number and drug stays as written.
- Re-pull from transcript redrafts one section from the transcript, under the scribe rules above.
- Show sources links each sentence to the transcript lines behind it, and each line opens the transcript at that line and its time. It is also a quiet Sources control under each section in Review. A sentence with no source is flagged for the provider.
- Spanish translates the owner summary only, and keeps doses and dates exactly.
- Every result is a suggestion: Use this or Keep mine. Nothing changes the note until the provider accepts it.
- Templates are written by the provider or clinic. The AI never writes or edits a template.
- A custom instruction follows the same rules. If it asks for something new ("add a diagnosis"), Blinq says it can only reword what's there.

**Documents rules (received)**

- Summaries only restate what the document says, each point with its page number. No interpretation, no advice.
- Nothing from an outside record enters the note unless the provider adds the line.

**Letter rules (sent)**

- Draft only from the signed notes, the files the provider attached and the provider's reason. The reason stays in the provider's words.
- Never add a finding, diagnosis, recommendation or dose that isn't in those sources. Mark anything unclear as "[confirm: ...]".
- Credit outside sources ("Your Feb 18 letter noted...") and never present them as this clinic's findings.
- Nothing is sent until the provider signs. Invoices are never attached unless the provider checks them.

**Remember rules**

- Suggest only personal milestones and life events the owner said in the room: birthdays, adoption days, graduations, weddings, new babies, moves, trips, new jobs, new pets. Each with the transcript lines behind it.
- Never suggest anyone's health, money, grief or loss, religion, politics or legal matters, even if the owner brought it up. Say how many were left out, not what they were.
- Use the owner's words. Never guess a date, age or name the owner didn't say.
- Nothing is kept until the provider checks it. Kept items are staff only: they never reach the note, the scribe's context, the owner summary, texts or the PIMS.
- On Before you walk in, show what was said and when ("said Jun 24"), never a suggested line to say.

**Owner summary rules**

- Built only from the signed note's For the owner section, medicines, home care and next visit. A visit with several pets sends one summary with a section per pet.
- A photo appears only when the provider turned on Show in the owner's summary for it.
- The text message says only that a summary is ready, with the link. No diagnosis or medicine in the text itself.
- Spanish keeps every dose, date and time exactly as in English.
- A booking link not yet booked shows as Pick a time, never as a booked date.

**Day assistant tools** (read only, at most 6 steps per question)

| Tool | Returns |
| --- | --- |
| `get_schedule` | The day's appointments with alerts |
| `get_patient_brief` | Owner, alerts and the last 3 visits for one appointment |
| `list_pending_followups` | Follow ups still waiting for approval |
| `find_recheck_slots` | Open times around N days after a visit |

**How quality is checked**

1. Unit tests run the whole flow on the sample visit with mock AI.
2. A smoke script runs the same visit on real Muse Spark (Muse Code's first task).
3. Before submitting, review 5 sample visits by hand: every vital, dose and follow up must trace back to the transcript.
4. The edit rate and invented facts metrics carry this into a pilot.

## PIMS connection

Blinq Scribe reads from and writes to the clinic's PIMS through one practice adapter (`server/blinqscribe/adapters/base.py`). The demo runs on the built-in demo PIMS, a synthetic clinic. A clinic's own PIMS connector implements the same interface. Writes happen only after the provider signs or approves.

- **Access:** a service credential with no person behind it, limited to the pilot clinic and revocable by the clinic's admin. It stays on the server.
- **What it reads:** the day's schedule (patient, owner, provider, room, alerts), visit history (last 12 months, with the visit type, the provider and the appointment id), each patient's medical notes (last 24 months, every provider), open recheck slots for a service and species, search, the patient profile, invoices, the household and recent texts, and the clinic's name and contact.
- **PIMS that don't share notes:** schedule, visit history and open slots work as usual, but notes are empty. A provider there starts with no voice profile and learns one from the first 2 notes signed in Blinq Scribe; the Previous notes panel shows only notes signed in Blinq Scribe.
- **Booking links (requirements 53 and 55):** the link comes from the booking link template with the slot's date. The booking page is the clinic's own online booking, not hackathon work.
- **Write back:** the signed note, photos and the approved recheck booking, then prescriptions and texts. Built against the demo PIMS; live PIMS write needs the clinic's PIMS connection. Until then, a signed note is queued for staff to add to the PIMS.
- **What a PIMS may not take:** reminders, patient weight and texts. Vitals go in the note's Objective section; owner texts stay on Telnyx (demo).
- **Swap out:** the same adapter interface fits any practice system. The synthetic clinic adapter is the default.

## Demo mode

Judges must be able to use the product themselves, so demo mode is the default. Demo mode fixes the data, not the features: every flow works end to end on the synthetic clinic, including recording, Muse Spark writing the note, approving follow ups, signing and saving, and Meta glasses through the iPhone app. With an empty `.env` the AI is mocked so it runs anywhere. A judge who wants the real models copies `.env.example` to `.env` and adds their own model keys; the practice data, texts and voice profiles stay on demo data.

**What is real and what is simulated**

| Feature | With your own model settings | Demo mode (no keys) |
| --- | --- | --- |
| Note drafting, morning brief, Ask Blinq, photo reading | Muse Spark, with `MODEL_API_KEY` | Mock AI that gives the same outcome as the real product: a written clinical note for each shipped sample visit (matched on the transcript and the pet, so a sample is never charted on another pet). Any other transcript is rewritten into note wording, or marked "[confirm: ...]" when it can't be |
| Recording | Muse Voice Transcribe on the recorded audio, with `MODEL_API_KEY` | Each recorded chunk plays in the next part of the sample visit, so the transcript fills as you record. "Load sample visit" pastes it all at once |
| Photo outlines | SAM 3.1, once `SAM_ENDPOINT` is set | A mock outline |
| Schedule, patients, visit history, open recheck times | Synthetic clinic | Synthetic clinic (6 visits today, 2 providers). The Lee household has 5 pets (three dogs, a cockatiel and a rabbit). Two days after today is a heavy day (20 visits, 24 pets, the Lee and Garcia households booked as one visit each), read at its own clock, 1:15 PM, between visits |
| Previous notes and voice profiles | Synthetic clinic notes, synced at startup like a real onboarding | Same |
| Saving the signed note and booking the recheck | Written to the mock practice system | Same |
| Owner texts | Preview (Telnyx demo number optional) | Preview: nothing is sent; the screen shows the exact text the owner would get |

**Flagged on screen**

- The header shows "Mock AI" (with a flask icon, not a warning) or "Muse Spark ready", "Demo clinic", and "Texts preview only".
- An approved text shows "Demo mode: the text the owner would get" with the message.
- The voice profile line says where the style came from. When a provider's notes can be synced, it reads "learned from N of their notes in the PIMS". This is the real flow: at onboarding Blinq Scribe syncs the last 24 months of notes and the profile learns from the last 90 days of them. Both demo providers have synced notes, so judges see learned profiles. If a provider's notes can't be synced (fewer than 2 notes, or the sync didn't run), demo mode falls back to a default note style, tagged "Demo default". A live practice never gets the default: a provider there has no profile until 2 of their own notes are synced or signed. Where the PIMS doesn't share notes, nothing syncs, so the profile always comes from notes signed in Blinq Scribe.

**For the demo video**

1. The synthetic clinic is what a practice looks like after onboarding: the notes sync has already run, so each provider's voice profile and every provider's earlier notes are ready on the first visit.
2. With no key, recording plays a scripted visit; with `MODEL_API_KEY`, Muse Voice Transcribe hears the real conversation. Everything after the transcript (draft, review, approvals, signing) is the same code path as live.
3. Saving to the practice system and booking the recheck go to the mock practice system. With a live PIMS connected, a signed note is queued for staff until the connector can write, so the video should not show it reaching a live PIMS.
4. Texts are shown, not sent, so no owner is ever texted from a demo.

## Release plan and demo

*(Drawing in the live doc.)* Oct 26 hackathon opens. Oct 29 foundation, repo, PRD. Oct 30 real models, glasses. Oct 31 PIMS connection, assistant, feature freeze. Nov 1 bug bash, demo, docs, submit. Nov 2 to 4 buffer, fixes only. Nov 4 deadline 9 PM EST.

Feature freeze is Saturday Oct 31 at night. Day by day tasks live in `PLAN.md` in the repo.

**Demo rules** (from the hackathon rules)

- Show only what was built during the event. The PIMS appears only as the data source.
- Use the synthetic clinic. No real patients, owners or practice data on screen.
- Every clinical statement on screen comes from the provider. Show the provider editing, approving and signing.

**Demo script (3 minutes)**

1. **0:00 The problem.** Providers chart after hours, and promised rechecks get lost. Blinq Scribe writes down what the provider decides. It never decides for them.
2. **0:20 Morning brief** in the glasses: 6 visits, Miso needs a towel wrap.
3. **0:40 In the room.** Start the visit with consent, talk through the exam, say "capture" on the ear. SAM 3.1 outlines the area.
4. **1:30 The note.** SOAP, vitals, meds and owner summary. Edit one line.
5. **2:00 The loop closes.** "Recheck in two weeks" became three open times and a booking link. Approve it.
6. **2:30 Between rooms.** "Who's next?" answered through the glasses.
7. **2:50 Built on** Muse Spark, SAM 3.1 and Meta glasses, with Muse Code. Open source, shown on a synthetic clinic. It connects to a clinic's PIMS through one adapter.

## Appendix

**Startup track disclosure** (full version in `DISCLOSURE.md`)

| Pre-existing before Oct 26 | Built during the event |
| --- | --- |
| The startup's existing platform (private, not in the repo) | Everything in this repo: server, scribe, assistant, adapters, web console, iPhone app, tests, docs |
| Earlier internal scribe requirement docs (no code reused) | A read only connection for Blinq Scribe in the private platform (not in the repo) |

Coding tools: Claude for the Oct 29 scaffold, Muse Code from Oct 30. Solo entry.

**Glossary**

| Term | Meaning |
| --- | --- |
| SOAP note | Subjective, Objective, Assessment, Plan: the standard medical note |
| PIMS | Practice information management system, the clinic's record system |
| Recheck | A follow up visit to see if a problem is resolved |
| DAT | Meta Wearables Device Access Toolkit, the glasses SDK |
| SAM 3.1 | Meta's model that outlines objects in an image |
| VSO | Veterinary Service Organization, a group of clinics |
