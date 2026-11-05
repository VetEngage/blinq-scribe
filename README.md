# Blinq Scribe

Hands-free AI scribe and day assistant for veterinarians, built on Meta Muse models and Meta AI glasses.

The provider wears the glasses. Blinq Scribe listens to the exam, takes photos when asked, writes the SOAP note, and turns what the provider said ("recheck in two weeks") into ready-to-approve follow ups with real open appointment times. Between rooms, the day assistant answers "who's next?" through the glasses speakers.

Built for the Meta Global AI Developer Hackathon 2026, Startup track. See [DISCLOSURE.md](DISCLOSURE.md) for what existed before the event and what was built during it.

## What it does

| In the room | After the room | Between rooms |
|---|---|---|
| Records with owner consent through the glasses mic | Drafts a SOAP note, vitals, meds and an owner summary | The day's brief read aloud in a natural voice |
| "Capture" saves a first-person photo | SAM 3.1 outlines the area in each photo | Pre-room card: last visit, what you promised, alerts |
| Nothing records until the owner agreed: Start visit asks first | Rechecks get real open slots and a booking link | Follow ups waiting for approval |
| Every transcript line shows who said it | Sign and send the note to the PIMS, or sign only. Referral letters with the note, photos, received records and invoices as one PDF | A colleague's day, view only |

Blinq Scribe is a documentation assistant, not a clinical advisor. It writes down what the provider said and decided; it never diagnoses, picks a treatment or dose, or reads findings for a diagnosis, and the provider reviews and signs every note. Nothing is sent to an owner, a specialist or the PIMS until the provider approves it. Every step is in an audit log.

## How it fits together

```
 Meta AI glasses ──Bluetooth──> iPhone companion app ───HTTPS──┐
 (mic, camera, speakers)        (glasses-ios/)                  │
                                                                v
 Web app (web/, React) ──────────GraphQL──────────────> Blinq Scribe server (server/)
                                                         │   │   │
                     Meta Model API: Muse Spark <────────┘   │   └──> PracticeAdapter
                     SAM 3.1, speech to text   <─────────────┘          ├─ MockAdapter (demo PIMS: synthetic clinic, default)
                                                                         └─ your clinic's PIMS connector (writes after approval)
```

The server is FastAPI with a Strawberry GraphQL API, PostgreSQL (or SQLite for the demo) and Temporal for background work; the web app is React, Vite and TypeScript with Apollo Client. It is the same open source stack the team already uses, written from scratch: no platform code or private packages (see [DISCLOSURE.md](DISCLOSURE.md)).

Blinq Scribe never touches a practice database directly. All clinic data goes through one interface, `PracticeAdapter`. The mock adapter is a demo PIMS that lets anyone run the full product with no credentials. A clinic's own PIMS connector plugs in through the same interface.

## AI models used

| Job | Model | Where it runs | Code |
|---|---|---|---|
| SOAP note, follow up extraction, photo description, referral letter drafts, day assistant tool calls | Muse Spark (`muse-spark-1.1`) | Meta Model API | `server/blinqscribe/llm.py`, `scribe.py`, `assistant.py`, `vision.py`, `referrals.py` |
| Outline wounds, masses, teeth in exam photos | SAM 3.1 | Meta Model API | `server/blinqscribe/vision.py` |
| Speech to text | Muse Voice Transcribe (or an open-weights model you host) | Meta Model API | `server/blinqscribe/stt.py` |
| Read aloud (brief, end of day, pre-room card) | Kokoro-82M, int8 ONNX | On the server's CPU, nothing leaves it | `server/blinqscribe/speech.py`, `speech_g2p.py` |
| Glasses mic, camera, speakers | Meta Wearables Device Access Toolkit | iPhone | `glasses-ios/` |

## Run it in 5 minutes (no keys, no Docker)

You need [uv](https://docs.astral.sh/uv/) (it installs Python 3.14 for you), [Node 22](https://nodejs.org/) and pnpm 10 (`corepack enable` turns it on). No Docker, database or keys.

```bash
# 1. Build the web app (from the repo root)
pnpm install
pnpm build

# 2. Start the server, which serves the web app and the API
cd server
uv sync
uv run uvicorn blinqscribe.main:app --reload
# open http://localhost:8000
```

If port 8000 is busy, add `--port 8010` to the `uvicorn` command and open http://localhost:8010 instead. The web app is served by the same server from `web/dist`, so run `pnpm build` again after you change the web app.

Optional, for the natural read-aloud voice (about 95 MB, downloaded once, each file checked by SHA-256):

```bash
cd server
uv run python -m blinqscribe.speech download   # into server/var/models
uv run python -m blinqscribe.speech check      # says whether it is installed
```

Six voices come with it: Heart (the default), Bella, Michael and Fenrir (US English), and Emma and George (UK English). Each vet picks a voice and speed under Account. Without the download, the app reads aloud with the browser's own voice. Nothing else changes.

## A judge's walkthrough

Everything below works on a fresh run with no keys. Times and names come from the synthetic clinic.

1. **Sign in.** Open http://localhost:8000. With nobody invited, the app opens straight into the demo clinic. On the sign in page, the "Judging or just looking?" card has **Try the demo clinic**, which signs you in as the demo vet, Dr. Ana Rivera, so the vet's rules show.
2. **Home.** The demo opens on Dr. Ana Rivera's day. At the top, one purple brief line says what is left, in facts ("5 visits today. 3 notes to sign, 1 text that didn't send and 1 recheck link not booked."), with **Hear it** and **Dismiss**. Up next shows Biscuit with **Why it matters** (the last visit, care due soon and Jordan's text, quoted) and prep chips; beside it, **Follow-ups waiting** has the two note buckets, **Ready to sign** and **Pending**, then each follow up with one action (**Resend** the text that didn't send, **Resend link**). The page has one green action, in the bar at the bottom: **Open Biscuit's visit** (⌘↵ or Ctrl+Enter presses it). The rail on the left is today's visits in groups (Up next, Later today, Done), two lines a visit (the pet's name, species and age, the breed, the reason, and a caution's short amber line; hover or focus a row for a read only quick card with the PIMS's notes), a thin green **Now** line between what's gone by and what's to come, and one quiet **Needs me** toggle. Every clinic day reads as one plain sentence with a slim bar ("0 of 5 seen."). Between visits (nobody in the room, the clinic open, a visit still to come) Home becomes the gap: "Free until 10:00 AM.", the pace only when visits really started late, and **Quick ones for the gap** in place of Follow-ups waiting. To see it at any hour, pin today's clock: in the browser console, `localStorage.blinq_clock = "09:45"`, then reload (remove it for the real clock).
3. **Sign the ready notes.** **Ready to sign** opens `/notes?bucket=ready`: two notes from earlier days, both picked. **Sign 2 notes** lists each by pet and date, says who signs, and offers **Sign and send to the PIMS** (the default) or **Sign only**; each note signs in turn with its own result. **Pending** lists the notes with something left (a thing to confirm, a follow up to decide) and opens each one.
4. **Start a visit.** Open Biscuit's visit. The banner is compact: Biscuit's facts, an alert line (his weight trend from the PIMS), the visit, Jordan with Text, Call and **Jordan Lee's household**, a red row for the text to Jordan that didn't send (**Retry** clears it on Home and End of day too), and the step bar Record > Draft > Sign > Share > Follow up. **Before you walk in** is dated facts, newest first: Jordan's text, "From your last plan" as checkboxes in plain words with "Was due Sep 28, not booked" and "30 tablets dispensed Aug 31, none since", and the earlier ear infection. Tick a line you want to cover today: the tick is kept with the visit on the server (reload, it's still ticked) and goes to the draft as "asked to cover today". Press **Start visit** in the bar at the bottom (or ⌘↵). The bar itself asks "Did Jordan agree to recording?" Press **Owner agreed, start** (⌘↵ again). **Not yet** (or Esc) keeps the visit from starting, and nothing records until the owner agreed.
5. **Record.** Press **Record on this computer** (each recorded chunk plays the next part of the sample visit into the transcript) or **Load sample visit** to paste it all at once. The pinned bar shows the pulsing red dot, where it records and for how long, **Stop**, and the green **Stop and draft note** (after you stop, "Recording ended" with how much audio there is), and each transcript line shows who said it with its time. A speaker Blinq can't place shows as "Speaker 3" with one tap right in the row: **Tech**, **Owner** or **Other** names every line from that voice.
6. **Add a photo (optional).** **Add photo**, then **Upload from device**. Adjust the outline, crop, rotate and label it. The original file is never changed.
7. **Draft the note.** Press **Draft note** and watch each step. With no keys, the demo draft reads like the note a provider would sign, the same as the real product. Review the SOAP note: each line Blinq drafted ends with a time chip (0:27); click it to jump to that line in the transcript. Anything to confirm is purple right at its field, with **Confirm** and **Edit**. The green action names that step ("Fill in ear drop product and duration") and goes to it; it is never greyed out, and only once nothing is left does it become **Sign and send to the PIMS** (the server refuses to sign a note with anything left to confirm). **Edit** shows the thing to confirm as a purple chip in the editor, selected, so typing replaces it. Change the Plan and For the owner says "Out of sync with Plan · Update". A ticked line from the last plan that the visit never talked about shows in purple at the Plan, in your own words: "From your last plan, not covered: Apoquel 16 mg by mouth twice a day for 14 days, then once a day", with **Add to Plan** and **Dismiss**. It steps the green action like a thing to confirm ("Check 1 line from your last plan"), but it is a reminder: signing never waits on it. Blinq adds nothing of its own about it. The right column has the last plan, Jordan's message and the transcript in one line. Reload at any point: the same tab, pet, open section and unsaved edit come back. Matches your style shows the provider's voice profile, and every section is editable. Ask Blinq can reword a section, never invent.
8. **Approve the follow ups.** The 14 day recheck comes with three real open times and a booking link, with "Remind Jordan if not booked in 3 days" on. Approve it, then approve the owner message: demo mode shows "Demo mode: the text the owner would get". The follow up then says when the one reminder goes out if Jordan doesn't book.
9. **Sign.** The sign bar offers **Sign and send to the PIMS** and a quiet **Sign only** link, each behind a confirm panel that shows the pet and owner with their PIMS ids, what goes and the texts that follow. **Record** under the banner (or the household button beside Jordan's name) opens the record without leaving the visit, and recording and the draft keep going. Signed notes are locked, the signed note shows where the note and photos stand in the PIMS, and booking links queued before signing go out now. Blinq doesn't send prescriptions: signing makes a front desk task, "Enter Cefpodoxime for Biscuit in the PIMS", on Home's Follow-ups waiting and End of day with **Mark entered**, and the PIMS card shows who entered it and when. Sign only keeps the note out of the PIMS until you press **Send to the PIMS**.
10. **Share the owner summary.** The green action is **Text summary to Jordan** (his preferred channel first; pick email or print on the card, and English or Spanish). Once it's sent, it becomes **Next: Miso**. **Preview PDF** shows the branded PDF. The owner's page asks for their last name (Lee) before it opens.
11. **Write a referral letter.** From **Record**, then **Documents** (or **Create referral letter** on a follow up), pick Referral to a specialist, a recipient, the reason in your words, how soon, and what goes along: the signed note, exam photos, received records, invoices. Blinq drafts the letter and marks anything unsure as [confirm]. **Preview PDF** shows one PDF: the letter on the clinic letterhead, then each attachment as pages. **Sign and send**: demo mode shows the email or text that would go out.
12. **View a colleague's day.** In **Dr. Ana Rivera's day** in the top bar, pick Dr. Sam Okafor (marked View only when you are signed in as the demo vet). A banner offers **Back to my day**. You can read his schedule and signed notes, but not start, edit, approve or sign anything.
13. **Read aloud and pick a voice.** The brief line on Home has **Hear it**, with Stop. Under Account, **Voice** picks the voice and speed, with a preview. With the Kokoro files downloaded you get the natural voice, otherwise the browser's.
14. **Open the Lee household.** Search for Jordan Lee, or press the household button on the visit. The record shows Jordan once, then a tab for each of the 5 pets (Biscuit, Waffles, Hazel, Kiwi and Mochi; Waffles has an amber dot for her caution), then Overview, Past visits, Documents, Invoices and Texts. On its own page it lives at `/record/cli-1?pet=pat-6`, with the pet and tab in the address.
15. **Switch the theme.** In the initials menu in the top bar, **Theme** offers Light, Dark and System.
16. **Ask Blinq** between rooms, from the purple pill in the top bar (⌘J) or its mic (press to talk): "who's next?" or "what did I promise Biscuit's owner?". It answers only from what the signed-in person can see.
17. **End of day.** In **Dr. Ana Rivera's day**, pick **End of day**. The rail folds to a summary (how many seen, notes to sign, calls and texts, tomorrow in one line). The page leads with **Notes left to sign** and one green **Review and sign 3 notes**, then **Calls and texts left** (the failed text in red with **Retry**, the unbooked link with **Resend link**), the front desk's prescription task, what's already handled, and, once every visit is seen, "That's the day. Everything else can wait until tomorrow." Tomorrow never repeats today's pets, so no recheck lands before it is due.

18. **A heavy day.** In **Dr. Ana Rivera's day**, pick **Busy demo day** (or press the day after twice in the rail). That day is always two days after today and the rail's date switcher marks it "Busy demo day": "20 visits · 24 pets", read at its own clock ("Demo day at 1:15 PM" on Home, and the Now line at 1:15 PM), between visits. Its own brief says what needs you on that day ("Text to Ben didn't send."), and **Needs me** counts the same visits. Every time Blinq shows for what you do on that day (started, signed, texted, saved) reads at the demo clock too. Nobody is in the room, so the rail starts at Up next; Later today shows the next four and "+5 more this afternoon", which opens in place; Done · 9 stays folded. The Lee and Garcia households are one row each, "Jordan Lee · 3 pets". Home says the day in one plain sentence from the record, "Running about 15 min behind. Free until 1:30 PM.", with a slim bar and three heads-up chips, Quick ones for the gap (follow ups that fit before the next visit, each with about how long it takes), and one green **Open Smokey's visit**: Up next says "checked in at 1:04 PM" and the bar "Nina is in the room". Follow-ups waiting groups one owner's rows under their name, and its "+N more" says what they are ("7 recheck links, 5 follow ups to decide"). **End of day** from the day menu stays on the busy day: "9 of 20 seen" in the rail until every visit is seen, then "All 20 seen · 24 pets".
19. **A household visit.** Press **Jordan Lee** in the rail: the row opens with "0 of 3 signed" and a row per pet. The banner is the Jordan Lee household with the owner card, and Hazel, Kiwi and Mochi are all in the visit. Start it, **Load sample visit** (one recording for the room) and **Draft note**: one note per pet, a tab each with its status, and the transcript split by pet (**Whole room** shows every line). Owner said "One of them had a runny nose this morning" right after naming Hazel and Mochi, so Blinq doesn't guess: the line is on Hazel's note with a purple "Which pet? Hazel / Mochi", to keep there or **Move to Mochi** (the server won't sign with it left). The green action steps forward and is never greyed out: **Confirm Hazel** ("Then: Review Kiwi and Mochi, sign 3 notes"), **Review Kiwi**, **Review Mochi**, then **Sign 3 notes and send to the PIMS** (⌘↵ each time). Opening a tab isn't reviewing a note: a pet is reviewed once you've seen all of its note (its end scrolled into view, or every section), so **Review Hazel** first takes Hazel's note to its end, and **Review Kiwi** opens Kiwi's tab at its first part not seen; pressed again with the end in view, it steps on. **+ Add a pet (2)** in the pet tabs adds another of Jordan's pets once the visit has started. Signed, one text to Jordan covers all three pets. Hazel and Mochi each have a recheck: approve one and it waits ("Goes out with Hazel's recheck, so Jordan gets one text with one link"); approve the other and one text goes, with one booking link for both: "One link for Hazel's and Mochi's rechecks". The text names the pets and the link, never a medical detail. Reload or come back from the rail: the visit opens on the pet tab you were on.

To see the full role rules, invite yourself as an admin (Team), then add a vet and a front office person and sign in as each.

### What demo mode simulates

Demo mode fixes the data, not the features: the clinic is synthetic, so nothing touches a real practice. With no keys the AI is mocked, so it runs anywhere. Copy `.env.example` to `.env` and add your model keys to see Muse Spark write the note, real speech to text on what you record, and SAM 3.1 outlines on photos. Meta glasses work in demo mode too: run the iPhone app ([glasses-ios/README.md](glasses-ios/README.md)), point it at this server, and the glasses mic and camera feed the same visit.

| Feature | Demo mode |
| --- | --- |
| Note drafting, brief, Ask Blinq, photo reading, letter drafts | Mock AI until you add `MODEL_API_KEY` (Muse Spark). The sample visits come with written clinical notes, matched on the transcript and the pet. Any other transcript is rewritten into note wording, or marked `[confirm: ...]`. Mock letter drafts are flagged |
| "Record on this computer" | Plays the sample visit into the transcript, one part per recorded chunk, until you add `MODEL_API_KEY` (Muse Voice Transcribe) |
| Photo outlines | Mock outline until you set `SAM_ENDPOINT`. Either way you can adjust it, crop, rotate and label the photo |
| Read aloud | Kokoro on the server's CPU once downloaded, else the browser's voice. Never a cloud service |
| Schedule, patients, open recheck times | Synthetic clinic: 6 visits today, 2 providers. The Lee household has 5 pets (three dogs, a cockatiel and a Holland Lop rabbit). Two days after today is a heavy day: 20 visits and 24 pets, with the Lee and Garcia households booked as one visit each, shown as it stands at 1:15 PM |
| Previous notes, voice profiles | Synced from the synthetic clinic at startup, the way a real practice is onboarded |
| Signing, sending to the PIMS and booking the recheck | Saved to the demo clinic's PIMS. The screens say "the PIMS", never a vendor name |
| Owner texts | Preview only: you see the exact text, nothing is sent |
| Letter and summary emails | Preview only: you see the exact email. With SMTP and `DEMO_EMAIL_TO` set, they go only to that one inbox |
| Two step sign in codes | Printed in the server terminal as `Demo mode: sign in code for <username> is 123456`, never emailed |

Anything simulated is flagged on screen: the Mock AI, Demo clinic and Texts preview only pills in the top bar, "Demo data" tags on synthetic records, "Demo mode: the text the owner would get" under an approved text, and the voice profile line ("Demo default" when a provider's notes can't be synced). More in the PRD, under Demo mode.

Already have a `.env` from an older copy? Leave `SMS_MODE` and `STT_PROVIDER` blank (or set `SMS_MODE=preview`), so you get text previews and your model key turns on Muse Voice Transcribe.

### Or with Docker (PostgreSQL and Temporal)

```bash
docker compose up --build
# open http://localhost:8000   (Temporal UI: http://localhost:8233)
```

This builds the web app and runs the server, a background worker, PostgreSQL 18 and Temporal. A one-shot `speech-model` service downloads the Kokoro voice into a volume on first start; until it is there, or if it can't be downloaded, the app uses the browser's voice. To bake the voice into the image instead, build with `docker build --build-arg SPEECH_MODEL=1 .`. Your `.env` (optional) still supplies model keys; compose sets the database and Temporal addresses itself.

Without Docker the app runs on SQLite in `server/var` and does its background work inside the server, so the demo behaves the same either way. To use your own PostgreSQL and Temporal without Docker, set `DATABASE_URL` and `TEMPORAL_ADDRESS` in `.env` and also run the worker: `cd server && uv run python -m blinqscribe.worker`. The worker keeps three schedules: the note sync every night at 3:00 AM, the booking link check every hour, and Remember expiry every day at 3:30 AM.

## Settings

Copy `.env.example` to `.env` (git-ignored) and fill in only what you need. Every setting is optional; with the file untouched, everything runs as the demo.

| Setting | Default | What it does |
| --- | --- | --- |
| `MODEL_API_KEY` | blank (mock AI) | Meta Model API key: turns on Muse Spark and Muse Voice Transcribe |
| `META_BASE_URL`, `MUSE_MODEL` | `https://api.meta.ai/v1`, `muse-spark-1.1` | Where Muse Spark is and which model |
| `STT_PROVIDER`, `STT_BASE_URL`, `STT_API_KEY`, `STT_MODEL` | blank (Muse Voice Transcribe with a key, else mock) | Speech to text. `openai_compatible` plus a URL and model uses an open-weights model you host |
| `SAM_ENDPOINT`, `SAM_API_KEY`, `SAM_MODEL` | blank (mock outline), `sam-3.1` | SAM 3.1 outlines on exam photos |
| `PRACTICE_ADAPTER` | `mock` | `mock` is the built-in demo PIMS (the synthetic clinic). A clinic's PIMS connector plugs in through `PracticeAdapter` (see below) |
| `BOOKING_URL_TEMPLATE` | an example.com link | The booking link texted for a recheck, with `{location_id}`, `{service_id}` and `{start}`. Several pets of one owner seen the same day with a recheck each get one text with one link for all (its first day is the earliest pet's) |
| `CLINIC_TZ` | blank (the server's own zone) | The clinic's time zone, like `America/Chicago`, for every day and time on screen. Set it when the server runs in another zone (a container runs in UTC) |
| `SMS_MODE` | `preview` | `preview` shows texts, `off` hides them, `demo` texts only `DEMO_SMS_TO` through Telnyx |
| `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`, `TELNYX_MESSAGING_PROFILE_ID`, `DEMO_SMS_TO` | blank | Demo texts to one phone (see Demo texts) |
| `DEMO_EMAIL_TO` | blank | In demo mode, letter and summary emails go only to this one inbox (needs SMTP). Blank shows the email instead |
| `BLINQ_SCRIBE_API_TOKEN` | blank | Admin and service key for scripts and setup. Setting it, or inviting the first person, turns sign in on |
| `BLINQ_SCRIBE_PUBLIC_URL` | blank | The address people use. Invite, reset and owner links and sign in redirects are built only from it |
| `GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_SECRET`, `GOOGLE_SIGN_IN_DOMAINS` | blank (button hidden) | Continue with Google |
| `MICROSOFT_SIGN_IN_CLIENT_ID`, `MICROSOFT_SIGN_IN_SECRET`, `MICROSOFT_SIGN_IN_TENANT` | blank (button hidden) | Continue with Microsoft |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_SECURITY`, `EMAIL_FROM` | blank (nothing is emailed), port 587, `starttls` | Email for reset links, backup sign in codes and letters |
| `DATA_DIR` | `./var` | Where SQLite, photos and documents are kept |
| `DATABASE_URL` | blank (SQLite in `DATA_DIR`) | PostgreSQL, like `postgresql://blinq:blinq@localhost:5432/blinq_scribe` |
| `TEMPORAL_ADDRESS` | blank (background work in the server) | A Temporal server, like `localhost:7233`. Then also run the worker |
| `TTS_PROVIDER` | blank (Kokoro when downloaded, else the browser) | `browser` always uses the browser's voice |
| `TTS_VOICE` | `af_heart` | Default voice: af_heart, af_bella, am_michael, am_fenrir (US); bf_emma, bm_george (UK) |
| `MODELS_DIR` | blank (`server/var/models`) | Where the Kokoro files go |
| `PIMS_NAME` | blank | The name of the clinic's PIMS, kept as data when the practice data doesn't say it. Screens and messages still say "the PIMS", never a vendor name |

### Turn on the real models

```bash
MODEL_API_KEY=...                     # Meta Model API key: Muse Spark and Muse Voice Transcribe
SAM_ENDPOINT=https://api.meta.ai/v1   # SAM 3.1 outlines on exam photos
```

One key turns on Muse Spark (`muse-spark-1.1`) for the note, brief, Ask Blinq, photo reading and letter drafts, and Muse Voice Transcribe (`muse-voice-transcribe-1.0`) for recording. Audio is sent as 16 kHz mono WAV in 15 second chunks, from the glasses app and from "Record on this computer" alike.

### Demo texts and emails (optional)

By default nothing is sent: the app shows the text or email that would go out. Approved owner messages can instead be texted through Telnyx, locked to one demo phone:

```bash
SMS_MODE=demo
TELNYX_API_KEY=...
TELNYX_FROM_NUMBER=+15551234567
DEMO_SMS_TO=+15557654321
```

In this mode every approved recheck or owner message goes to `DEMO_SMS_TO`, whoever the owner is. Owner phone numbers are never read. Any other mode is refused at startup. In the same way, with SMTP set, `DEMO_EMAIL_TO` receives every letter or summary email that demo mode would send.

## Roles

Everyone signs in as themselves, and what they can do follows their role. The screen hides what a person can't do, and the server refuses it anyway.

| | Provider | Front office | Admin | Provider who manages the team |
| --- | --- | --- | --- | --- |
| Whose day opens first | Their own | All providers | All providers | Their own |
| Another provider's schedule, signed notes, past visits, documents | View only | Schedule, visit status, owner summary | Same as front office | View only |
| Another provider's draft, transcript or audio | No ("Draft in progress") | No | No | No |
| Start, record, photos, write, edit, approve follow ups, Remember | Their own visits | No | No | Their own visits |
| Sign a note | Their own visits, as themselves | Never | Never | Their own visits, as themselves |
| Share the summary, send letters, resend booking links | Their own visits | Any provider's, once the provider approved or signed | Same as front office | Their own, and any provider's once approved or signed |
| Mark a prescription entered in the PIMS | Their own visits | Any provider's | Any provider's | Their own, and any provider's |
| Ask Blinq | Answers only from what they can see | Same | Same | Same |
| Team: invite, set roles, require two step sign in | No | No | Yes | Yes |

Two more ways in:

| | What it can do |
| --- | --- |
| API token (`BLINQ_SCRIBE_API_TOKEN`) | Scripts and setup, like creating the first admin. It can never draft, edit or sign a note |
| Open demo (nobody invited yet) | Every feature, so judges can try the whole product. Signing asks for the provider's name. Only the computer running Blinq Scribe can create the first account |

- **Whose visit it is:** the provider on the appointment (or the room column's provider on practices that schedule by column), else the provider who starts it. A visit with no owning provider can't be changed by anyone signed in.
- **A provider who manages the team** is one login: an admin linked to their own provider record in the PIMS ("Provider · Manages the team" on the Team page).
- **The iPhone app signs in as the provider,** so it acts only for that provider's visits. The shared API token is for scripts and setup; it can never draft, edit or sign a note.
- **Audit:** opening another provider's notes is logged with who and when, and refused actions are in the visit's audit log.
- **Open demo:** with nobody invited, every feature stays on for judges. Try the demo clinic signs in as the demo provider, so the provider's rules show.

## Provider accounts and sign in

Each provider signs in as themselves, and each login is tied to one provider in the PIMS. Signing records their PIMS provider id (so a covering provider's note is credited to them), the console opens on their own day, and the audit log names them.

1. An admin opens **Team**, adds the person (name, username, role, and for a provider, which provider they are in the PIMS) and copies the one-time invite link. It expires in 7 days.
2. The person opens the link, sets a password, and is signed in.
3. Turning someone off signs them out everywhere and frees their PIMS provider record to be linked to someone else.

With no accounts and no `BLINQ_SCRIBE_API_TOKEN`, the app is an open demo. The first person you invite turns sign in on, so invite yourself as an admin first, from the computer running Blinq Scribe (or with the API token): until then nobody else on the network can create accounts. Behind a reverse proxy, create the first admin with the API token. Sign in pauses after 5 wrong passwords in 15 minutes.

| Option | What it needs |
| --- | --- |
| Remember me | Nothing: 30 day sessions instead of 12 hours |
| Two step sign in with an authenticator app | Nothing: set it up under Account (password, then the setup key or QR code, then a code from the app). An emailed code is the backup |
| Two step sign in by email only | SMTP. In demo mode the code is printed in the server terminal |
| Forgot password | SMTP and `BLINQ_SCRIBE_PUBLIC_URL` |
| Continue with Google | `GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_SECRET`, `BLINQ_SCRIBE_PUBLIC_URL`; redirect URI `<public URL>/api/auth/oauth/google/callback` |
| Continue with Microsoft | `MICROSOFT_SIGN_IN_CLIENT_ID`, `MICROSOFT_SIGN_IN_SECRET`, `BLINQ_SCRIBE_PUBLIC_URL`; redirect URI `<public URL>/api/auth/oauth/microsoft/callback` |

**Account settings** (account menu, Account): name and email, password, two step sign in (authenticator app or email), connected Google and Microsoft accounts, the read-aloud voice and speed, and sign out on all other devices. Email, password and connected account changes need the current password. The demo clinic's shared account can't change its sign in; to try an authenticator app, invite yourself.

Sign in is invite only: Google and Microsoft sign in only someone already invited, with a verified email. Behind a reverse proxy or load balancer, run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>` so the limits see real addresses.

## Theme

The account menu (your initials, top right) has **Theme**: Light, Dark or System. System follows the device and is the default. The choice is saved per browser, and a small script (`web/public/theme-init.js`) sets it before the page paints, so there is no flash of the wrong theme. The letter preview stays white, like paper. The dark colors are tokens in `packages/tokens/`, and each text color pair is tested for a contrast of at least 4.5:1.

## Component library and the /ui gallery

Design elements live in two shared packages, not in each screen:

- `packages/tokens/` holds the colors (light and dark), type, spacing, shadows, sizes and durations as one typed source. `pnpm build` writes the CSS.
- `packages/ui/` holds the React components, built on Radix and Tailwind with token classes only.

Every component is shown in the **/ui gallery**, in light and dark side by side: run `pnpm dev` and open http://localhost:5173/ui, or open `/ui` on the demo clinic. We use this gallery instead of Storybook. Screens may not use a raw button, input, select, textarea or dialog; ESLint fails on one.

Pieces added for the record and visit pages:

| Component | What it is |
|---|---|
| `SpeciesTile` | Dog, cat, bird, rabbit or other, read from the PIMS's own words ("Canine", "Avian", "Lagomorph"), on the record's pet tabs |
| `LabelValueGrid`, `LabelValue` | A gray label above its value, in 2 or 3 columns, skipping empty ones. The one way to show a fact |
| `ListRow` | A list row: an icon or a time, a title, a gray line under it, and a chevron when it opens something. With `onClick` the whole row is one button (a visit today in What's due) |
| `DateSwitcher`, `RailGroup`, `RailRow`, `RailStatus`, `RailNow`, `RailMore` | The left rail, 360 px: the day with prev and next, groups with no counts, and two lines a visit, about 72 to 96 px (the time in Poppins with tabular figures, 60 px; the pet's name with species and age, "Cat, 3 years"; the breed under it; the reason in plain words wrapping to two lines; a caution on its own short amber line with the dot). `RailStatus` shows only what means something: In visit (green dot), Draft ready (purple sparkle), Signed (green check), red only for something broken; never Not started. The thin green "Now · 1:15 PM" line, and "+4 more this afternoon" or "Done · 2" |
| `RailCard` | A rail row's read only quick card, on hover (about 300 ms) or keyboard focus, to the right of the row with a small pointer: the pet's facts with weight, the owner and phone, the last visit, the reason, "From PIMS" notes with the sync time, alerts in amber or "No alerts in PIMS", and one "Open visit" link. The row's `role="tooltip"`; Esc closes it; never on touch |
| `RailPill` | A status pill (Signed, Draft, In progress): the visit banner's |
| `RailHousehold`, `RailPetRow`, `PetInitials` | A household visit in the rail, owner-led: folded to "Jordan Lee 3 pets", open (on screen or in the room) with "1 of 3 signed", the pets' initials stacked, and a two-line row per pet with its own status and quick card, joined by a thin guide line |
| `BucketTile` | A neutral tile that opens a list of notes, with its count (Ready to sign 2 · Oldest 7 days) |
| `MainAction` | The page's one green action, with a ⌘↵ hint; ⌘↵ (Ctrl+Enter) presses it from anywhere but a dialog |
| `StepBar` | Where a visit stands: Record > Draft > Sign > Share > Follow up, done steps checked, the current one emphasized, Record with the recorded length |
| `SourceChip` | The time chip at the end of a drafted line ("0:27"): opens the transcript at that line |
| `ConfirmMark` | A thing to confirm in words ("Confirm: name and dose"), purple, the same in the note and the editor; never the raw bracket |
| `FactsLine`, `Num` | One gray line of facts joined with " · ", and numbers (times, weights, IDs) in the number font, never wrapping |
| `CountTitle` | A heading with its count ("Pets 5") |
| `ActionBar` | The bar pinned to the bottom of the page for the next step, edge to edge, with the one green action on the right. The page always scrolls clear of it, and it stacks on narrow screens |
| `ConfirmPopover` | One question tied to its button ("Did Jordan agree to recording?"). Focus starts on the cancel button, and Escape or a click outside never confirms |
| `SpeakerRow` | A transcript line: initials, name and role, time into the visit, and a dashed avatar for an unknown speaker |
| `RecordingPill` | Where Blinq records, how long, and a level meter that holds still under reduced motion |
| `StatusPill` | Ok, warning, error or pending, with an icon as a second cue besides color |

## Develop and test

| What | Command |
| --- | --- |
| Server tests | `cd server && uv run pytest -q` |
| Server lint, format, types | `cd server && uv run ruff check && uv run ruff format --check && uv run mypy` |
| Web build, tests, lint, types | `pnpm build && pnpm test && pnpm lint && pnpm typecheck` (repo root) |
| Web end to end (Playwright with axe) | `cd web && pnpm exec playwright install chromium` once, then `pnpm e2e`. It starts its own demo servers on ports 8042, 8044 and 8045 with every key blank |
| Web dev server with hot reload | `pnpm dev`, then open http://localhost:5173 (proxies the API to a server on port 8000) |
| Component gallery (every library component and color token, in light and dark) | `pnpm dev`, then open http://localhost:5173/ui (also `/ui` on the demo clinic) |
| GraphQL explorer | open http://localhost:8000/graphql (open demo only; off with an API token or a real practice) |
| Regenerate the GraphQL schema for the web app | `cd server && uv run python -m blinqscribe.gql.sdl` (a test fails if it is stale) |
| Regenerate typed GraphQL documents | `cd web && pnpm codegen` (`pnpm build` runs it too) |
| Database migrations by hand | `cd server && uv run alembic upgrade head` (the server also runs them on start) |
| New migration | `cd server && uv run alembic revision -m "what changes"` |
| Tests on PostgreSQL | `DATABASE_URL=postgresql://.../throwaway uv run pytest -q` (empties its tables first; use a database you can throw away) |
| Temporal workflow test | Runs when the `temporal` CLI is installed (`brew install temporal`), else it is skipped |
| Read-aloud voice files | `cd server && uv run python -m blinqscribe.speech download` (or `check`) |

**Checks before a commit:** the server tests, Ruff, Ruff format and mypy strict; the web build, tests, lint (zero warnings) and type check; and the end to end run. `server/tests/test_public_repo.py` fails if a private package, the platform's name in code, or a private partner name appears in the repo. ESLint fails on a raw `<button>`, `<input>`, `<select>`, `<textarea>` or `<dialog>` in screens (use the component library) and on a 24-hour time format (every time on screen is 12-hour with AM or PM).

**Adding a component:** write it in `packages/ui/src/components/` using token classes only, export it from `packages/ui/src/index.ts`, add a test with `expectAccessible()` to `components.test.tsx`, and show each variant in `web/src/screens/Gallery.tsx`. A new token goes in `packages/tokens/src/index.ts`; `pnpm build` regenerates the CSS.

Build the iPhone app: see [glasses-ios/README.md](glasses-ios/README.md). It covers Xcode setup, Apple ID signing, the toolkit app ID, the server URL and the mock device.

## Onboard a practice

```bash
uv run python -m blinqscribe.onboard --days 90     # from server/, or POST /api/admin/onboard
```

Pulls the last 24 months of medical notes from every vet, so each vet's voice profile is ready on day one and the pre-room card can say what another vet did last time. With Temporal it also runs every night at 3:00 AM; notes older than 24 months are dropped. Voice profiles learn from the last 90 days only. The synthetic clinic onboards itself at startup.

## Connect a PIMS (optional)

The demo runs on the built-in demo PIMS (`PRACTICE_ADAPTER=mock`). A clinic's PIMS connects by implementing `PracticeAdapter` in `server/blinqscribe/adapters/base.py`: the day's schedule, visit history, each patient's medical notes, open recheck slots, search, the patient profile, invoices, the clinic's name and contact, and the write back. Add the connector to `build_adapter` in `server/blinqscribe/adapters/__init__.py` under its own `PRACTICE_ADAPTER` value. Any other value stops the server at startup, so a typo never falls back to demo data.

It writes only after the provider acts: signing writes the note and photos to the PIMS, and approving a recheck books it. This is built against the demo PIMS; a live PIMS write needs the clinic's PIMS connection. Until a connector can write, signed notes and approved rechecks are queued for staff.

## API

The web app talks to one GraphQL endpoint, `/graphql` (Strawberry, `snake_case` fields, `Authorization: Bearer <token>`). Every operation below is a query or mutation of the same name; open `/graphql` in a browser to try them. Two subscriptions over websockets drive the loading states: `draft_progress(encounter_id)` (each step of writing the note) and `assistant_turn(turn_id)` (what Ask Blinq is checking). The schema the web app is built against is `web/schema.graphql`.

Requests to `/graphql` must be `application/json` (so another website can't post a mutation from a form), with at most 15 aliases, depth 10 and one AI step (`draft_note`, `ask_assistant` or `assist`) per request.

REST stays for health, audio chunk uploads from the glasses, files (photos, documents, PDFs, read-aloud clips), the owner's pages, OAuth callbacks, and the current iPhone app:

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Which AI, practice data, speech to text, outlines, texts and read-aloud voice are on |
| GET | `/api/schedule` | Appointments for a day |
| GET | `/api/brief` | Morning brief (text to speak) |
| GET | `/api/end-of-day` | End of day list (text to speak) |
| GET | `/api/notes/unsigned` | Every note not signed yet, any day, in its bucket: `ready` or `pending` with what is left (GraphQL `notes_to_sign`) |
| GET | `/api/providers/{id}/voice` | The provider's voice profile, from their notes |
| GET | `/api/patients/{id}/notes` | Earlier notes on the patient, every provider |
| POST | `/api/admin/onboard` | Sync the last 24 months of notes |
| GET | `/api/appointments/{id}/card` | Pre-room card: patient, last visit, what was promised, alerts. Each last plan line says if it is `checked` |
| PUT | `/api/appointments/{id}/plan-checks` | Keep the last plan's lines the provider ticked for a pet before the visit, `{patient_id, lines}` (GraphQL `set_plan_checks`). The draft gets them as asked to cover today |
| POST | `/api/encounters` | Start a visit. Requires `consent_recorded: true` |
| POST | `/api/encounters/{id}/audio` | Upload an audio chunk from the glasses (16 kHz WAV) |
| POST | `/api/encounters/{id}/transcript` | Add or replace transcript text (not once signed) |
| POST | `/api/encounters/{id}/photos` | Upload a photo (JPEG or PNG, up to 50 megapixels), get description and outlines (not once signed) |
| PATCH, DELETE | `/api/encounters/{id}/photos/{photo_id}` | Edit a photo (label, description, outline, crop, rotation, Add to the note, Show in the owner's summary) or delete it. `POST .../restore` undoes a delete. The original image is never changed, and deleted photos are kept until the visit is signed |
| POST | `/api/encounters/{id}/draft` | Write the note and plan follow ups. A ticked last plan line the visit didn't cover comes back in `plan_reminders`, quoted |
| POST | `/api/encounters/{id}/plan-reminders/{rid}` | `{action: added|dismissed}` for a last plan line not covered (GraphQL `act_on_plan_reminder`). Never blocks signing |
| POST | `/api/encounters/{id}/pets` | Add another of the owner's pets to a visit already started, `{patient_id}` (GraphQL `add_pet_to_visit`) |
| PUT | `/api/encounters/{id}/note` | Save the provider's edits |
| POST | `/api/encounters/{id}/followups/{fid}` | Approve or dismiss a follow up |
| GET | `/api/encounters/{id}/sign-preview` | The sign confirm panel: pet and owner with their PIMS ids, what goes, and the texts that follow |
| POST | `/api/encounters/{id}/sign` | Sign. `send` (default true) also sends the note and photos to the PIMS; `false` is Sign only, sent later. Refused (409) while any `[confirm: ...]` is left in the note. The signed note shows each item's PIMS status. A failed save retries every 5 minutes and goes to the front desk after 1 hour |
| POST | `/api/encounters/{id}/speakers/{speaker_id}` | Who is this?: `{role: tech|owner|other, name}` names every line from that voice (the visit's provider only) |
| POST | `/api/encounters/{id}/prescription/entered` | The front desk entered the prescription in the PIMS: who and when, audited |
| GET | `/api/patients/{id}/panel` | The visit banner's pet facts, cautions and last visit in one read: pet, alerts, weight, what's due, recent visits, owner contact, other pets and PIMS ids. Read only |
| GET | `/api/encounters/{id}/audit` | Audit log |
| GET, POST | `/api/patients/{id}/letters` | A pet's letters, or create one |
| PUT | `/api/letters/{id}` | Edit a draft letter |
| POST | `/api/letters/{id}/send` | Sign and send: email, owner text, owner email, print, owner copy |
| GET | `/api/letters/{id}.pdf` | The letter on the clinic letterhead with its attachments, as one PDF |
| POST | `/api/speech` | Read text aloud: `{text, voice}` gives a WAV clip (503 when the voice isn't installed) |
| GET | `/api/speech/voices` | The voices, the default one, and whether the natural voice is on |
| POST | `/api/assistant` | Ask the day assistant |

## Safety and privacy

- Recording cannot start without the owner's consent flag. Start visit asks "Did the owner agree to recording?" and only Owner agreed, start begins the visit. The camera and microphone stop whenever you leave the visit or sign out.
- A signed note is locked: no more audio, transcript, photos or edits.
- A photo reaches the owner's summary only when the provider turns on Show in the owner's summary for it, and never with its outline or the longer description.
- Texts go out only after the provider approves, and only to one demo number. A follow up can't be texted twice.
- Records or a referral go to another clinic only after the provider records that the owner agreed.
- The AI drafts. The provider edits, approves and signs. The scribe prompt forbids inventing vitals, doses or diagnoses and marks gaps as `[confirm: ...]`; a letter draft can't add a dose the sources don't have.
- Audit log for every start, upload, draft, edit, approval, signature, letter and opened colleague's note.
- Read aloud runs on the server's own CPU. Clips are cached in memory only, never written to disk, because the text has patient names.
- PDFs downscale photos, and every received record in a letter is clearly marked as a received document.
- Glasses SDK analytics are opted out in the iPhone app Info.plist.
- All demo data is synthetic.
- Sign in: passwords hashed, session tokens stored only as hashes, codes and password resets single use and rate limited, Google and Microsoft sign in only for an invited person with a verified email, and every emailed or redirect link built only from `BLINQ_SCRIBE_PUBLIC_URL`.
- The web app's page sends a Content Security Policy (its own files and Google Fonts only) and can't be framed.
- With Temporal on and unreachable, signing still works: the texts go from the server and the hourly check sends anything left waiting.

## License

MIT. See [LICENSE](LICENSE).
