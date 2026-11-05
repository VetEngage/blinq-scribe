# Build plan: submit Sunday Nov 1, buffer to Nov 4

Hard deadline: **Wednesday Nov 4, 9:00 PM EST**. Target: **submit Sunday Nov 1 night**. Monday to Wednesday are buffer only, no new features.

## Thursday Oct 29: foundation (done today)

- [x] Repo scaffold, server, mock clinic, tests passing
- [x] Scribe pipeline, follow ups with open slots, day assistant, web console
- [x] First PIMS adapter (read only), Android companion skeleton (shelved: switching to iPhone)
- [x] Repo created (private until submission), first commit Oct 29
- [x] Renamed to Blinq Scribe (PR #1)
- [x] Muse Code connected with the business API key
- [ ] Org owner: exclude this repo from the "Require a pull request" ruleset, and remove it from Vanta's GitHub app access. Record why it is out of scope
- [ ] Merge PR #1 once the rule is lifted
- [x] Cloned to `Meta Hackthon/VE-Blinq-Scribe-dev` on the Mac, working on the `dev` branch until then
- [ ] Put the Blinq Scribe key in `.env` as `MODEL_API_KEY` (separate key from Muse Code's)
- [ ] Register the app in the Wearables Developer Center, get the app ID
- [x] Speech model: Muse Voice Transcribe (`muse-voice-transcribe-1.0`) on the Meta Model API, on with `MODEL_API_KEY`
- [ ] Confirm the SAM 3.1 endpoint the event offers

## Friday Oct 30: real models + glasses

Use Muse Code for the build work from here on (run `muse` only inside `~/VE-Blinq-Scribe`).

- [ ] First Muse Code task: `scripts/smoke_muse.py` runs the sample visit on real Muse Spark and fixes the structured output fallback if needed
- [ ] Run the sample visit on real Muse Spark. Tune `prompts.py` until the note needs almost no edits
- [ ] Set `STT_PROVIDER=openai_compatible`, test with a recorded mock exam
- [x] Wire SAM 3.1 in `vision.py` (`sam-3.1` on Meta Model API). Live test once the key is in `.env`
- [ ] iPhone app in Swift (`glasses-ios/`): Xcode project, add the Meta Wearables DAT package
- [ ] iPhone: glasses mic over Bluetooth into `/audio` chunks, replies spoken through the glasses
- [ ] iPhone: DAT photo capture (MockDeviceKit first, then real glasses)

## Saturday Oct 31: PIMS connection + assistant. FEATURE FREEZE at end of day

- [x] Practice adapter: one interface (`adapters/base.py`) with the demo PIMS behind it (`mock.py`). A clinic's PIMS connector plugs in through the same interface. `README.md`, `.env.example` and `DISCLOSURE.md` match
- [ ] Run the 90 day onboarding sync against a live PIMS: `python -m blinqscribe.onboard --days 90`
- [ ] Write back: signed note and photos to the PIMS, approved recheck booked. Prescriptions only if time allows. Built against the demo PIMS; live PIMS write needs the clinic's PIMS connection. If it slips past feature freeze, signed notes stay "Queued for staff"
- [ ] Day assistant on real Muse Spark: "who's next", "what's waiting", "find a recheck"
- [ ] Approved owner messages text the demo phone number (`SMS_MODE=demo`, `DEMO_SMS_TO`)
- [x] Pre-room card spoken as the provider walks in (what was promised last time, alerts)
- [x] Voice profile: drafts match the provider's last signed notes (style only)
- [x] Onboarding sync of 90 days of notes (voice profiles on day one, history from every provider)
- [x] End of day list: unsigned notes, follow ups waiting, visits seen, rechecks approved
- [ ] Morning brief spoken through the glasses
- [ ] If you own Ray-Ban Display: next patient card on the lens (skip otherwise)

## Sunday Nov 1: ship

- [ ] Bug bash on the full flow, 3 times in a row with no errors
- [ ] `docker compose up` works on a clean machine
- [ ] README screenshots, DISCLOSURE.md reviewed
- [ ] DISCLOSURE.md: replace the Muse Code row with what Muse Code actually built, remove the "update before submitting" note
- [ ] Check no secrets in the repo: no `.env`, no `server/private/`, no keys in history
- [ ] Record the 3 minute demo (script below)
- [ ] Make the repo public
- [ ] **Submit**

## Monday Nov 2 to Wednesday Nov 4: buffer

Only fixes. Resubmit if the platform allows edits.

## Scope cuts (decided)

- One phone platform: iPhone. Android later.
- Owner texts go to ONE demo phone number only, never to real owners.
- PIMS write back only after the provider signs or approves: note, photos, recheck booking (prescriptions if time). The provider stays in control. Demo PIMS only for the hackathon.
- Lens display only if the hardware is already on hand.
- Web console is the review screen and the no-glasses fallback for judges.

## If you have two people

- Person A: server, prompts, PIMS adapter, demo video.
- Person B: iPhone app and glasses from Friday morning.

## Demo script (3 minutes)

1. **(0:00) The problem.** Providers spend hours after close writing notes. Follow ups get lost.
2. **(0:20) Morning brief** spoken in the glasses: 5 visits, Miso needs a towel wrap.
3. **(0:40) In the room.** Start visit with consent. Talk through the exam. Say "capture" on the ear. SAM outlines the area.
4. **(1:30) The note.** SOAP, vitals, meds, owner summary. Edit one line.
5. **(2:00) The loop closes.** "Recheck in two weeks" became three real open times and a booking link. Approve.
6. **(2:30) Between rooms.** "Who's next?" through the glasses.
7. **(2:50) Built on** Muse Spark, SAM 3.1, Meta glasses. Open source. Runs on a synthetic clinic or a live PIMS.
