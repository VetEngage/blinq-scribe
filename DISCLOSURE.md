# Startup track disclosure: what existed before vs what was built during the hackathon

Event: Meta Global AI Developer Hackathon (Meta x Cerebral Valley), October 26 to November 4, 2026.
Team: VetEngage

## Pre-existing (before October 26, 2026)

None of this code is in this repository.

- **VetEngage platform** (private, closed source): online booking, client messaging and connections to practice systems (PIMS).
- **Its design system** (colors, type, spacing and icon rules): the iPhone app and web console follow it, in light and dark. No design system files are in this repo, and the demo does not present the look as hackathon work. The fonts and icons it uses are open source (Poppins under the SIL Open Font License, Material Symbols under Apache 2.0).
- **Its choice of open source stack** (no code): FastAPI, Strawberry GraphQL, PostgreSQL with Peewee and Alembic, Temporal, React, Vite, TypeScript, Tailwind, Radix and Apollo. Only the choice of libraries and their config levels was followed. Every file here was written for Blinq Scribe; no platform code, schema, component, private package or env var name is in this repo, and a test (`server/tests/test_public_repo.py`) fails if one appears.
- **Product research** (documents only, no code): earlier internal requirement docs on AI scribing for veterinary clinics. No code from those efforts was reused.

## Built during the hackathon (October 26 to November 4, 2026)

Everything in this repository. This public repository is one snapshot of the code at submission (Nov 4, 2026). The full commit history, every commit inside the event window, is kept in our private repository because it names private partners; we can share it with the judges on request.

| Area | Files |
|---|---|
| Server and REST API, audit log | `server/blinqscribe/api.py`, `config.py`, `schemas.py`, `main.py` |
| GraphQL API (Strawberry): every operation, plus the `draft_progress` and `assistant_turn` subscriptions | `server/blinqscribe/gql/`, `events.py`, `web/schema.graphql` |
| Storage: Peewee models, Alembic migrations, PostgreSQL or SQLite | `server/blinqscribe/db.py`, `store.py`, `server/migrations/`, `server/alembic.ini` |
| Background work on Temporal, with an in-process fallback | `server/blinqscribe/jobs.py`, `workflows.py`, `worker.py` |
| Sign in and account settings: accounts, invites, Remember me, password reset, two step sign in with an authenticator app or emailed codes, Google and Microsoft sign in, change password and email, connected accounts, sign out on other devices | `server/blinqscribe/accounts.py`, `signin.py`, `oidc.py`, `mailer.py`, `auth_routes.py`, `gql/auth.py`, `templates/email/`, `web/src/screens/account/` |
| Roles and permissions: provider, front office, admin, a provider who manages the team; view only colleague days; checked by the server on every request | `server/blinqscribe/permissions.py`, `server/blinqscribe/policy/`, `web/src/screens/` |
| Referral letters: referral, records and owner letters, Muse Spark drafts that can't add a dose, owner consent, sign and send by email, text or print, opened status | `server/blinqscribe/referrals.py`, `letters_routes.py`, `gql/referrals.py`, `templates/email/referral_letter.*`, `web/src/screens/record/` |
| Letter PDF: the letter on the clinic letterhead, then the signed note, exam photos with their outline, invoices and received records (each marked as a received document) as one PDF; photos downscaled in every PDF | `server/blinqscribe/letter_pdf.py`, `pdf.py`, `images.py` |
| Read aloud: Kokoro-82M on the server's CPU, our own text to phoneme step with a pronunciation table for veterinary words and the demo clinic's names, model download with SHA-256 checks, voice picker | `server/blinqscribe/speech.py`, `speech_g2p.py`, `speech_routes.py`, `pronunciations.json`, `web/src/lib/speech.ts` |
| Component library: design tokens (light and dark) and React components on Radix and Tailwind, with the `/ui` gallery showing each one in both themes. Includes SpeciesTile, LabelValueGrid, ListRow, FactsLine, CountTitle, ActionBar, ConfirmPopover, SpeakerRow, RecordingPill and StatusPill | `packages/tokens/`, `packages/ui/`, `web/src/screens/Gallery.tsx` |
| Light, Dark and System theme: dark color set, saved choice, set before first paint | `packages/tokens/`, `web/src/state/theme.ts`, `web/public/theme-init.js` |
| Muse Spark client | `server/blinqscribe/llm.py`, `prompts.py` |
| Scribe pipeline (transcript to note and follow ups), note types, several pets per visit. Vitals are fixed fields and every short AI field has a length and garbled text check, so a reply that runs on is asked for again, then replaced by a plain fallback | `server/blinqscribe/scribe.py`, `note_types.py`, `llm.py` |
| Demo drafts: a written clinical note for each shipped sample visit, and a rewrite into note wording (or `[confirm: ...]`) for any other transcript | `server/data/sample_drafts.json`, `server/blinqscribe/scribe.py` |
| Speaker labels: a Muse Spark pass names the provider, the owner or Speaker N after each audio part; Who is this? names the rest | `server/blinqscribe/speakers.py`, `speaker_routes.py`, `web/src/screens/visit/SpeakerLines.tsx` |
| Sign and send to the PIMS, Sign only, the confirm panel, per-item PIMS status, retries every 5 minutes then the front desk after 1 hour | `server/blinqscribe/pims_sync.py`, `api.py`, `web/src/screens/visit/SignConfirm.tsx`, `PimsStatus.tsx` |
| The record: one component for the Record tab on every visit page and its own page at `/record/:clientId` (owner, pet tabs, Overview, Past visits, Documents, Invoices, Texts; read only) | `server/blinqscribe/record_routes.py`, `web/src/screens/record/RecordView.tsx`, `web/src/screens/visit/visitTabs.tsx` |
| A household's pets as the record's pet tabs, with Invoices and Texts per pet or for all pets | `server/blinqscribe/record.py`, `web/src/screens/record/RecordView.tsx`, `web/src/screens/record/HouseholdPanels.tsx` |
| Phone number formatting on every screen, PDF, text and Ask Blinq reply | `server/blinqscribe/phone.py`, `packages/ui/src/phone.ts` |
| Edit tools that only reword, templates | `server/blinqscribe/editor.py`, `visit_routes.py` |
| Recheck planning with live open slots, booking links | `server/blinqscribe/scribe.py` (`plan_followups`), `booking_links.py` |
| Remember (personal milestones, staff only) | `server/blinqscribe/remember.py` |
| Owner summary: text link, owner page, branded PDF | `server/blinqscribe/share.py`, `pdf.py` |
| Patient record, household, search, outside records, week strip, brief and end of day | `server/blinqscribe/record.py`, `record_routes.py`, `documents.py`, `day.py` |
| Photo description and SAM 3.1 outlines | `server/blinqscribe/vision.py` |
| Photo capture and edit: camera, file or glasses source, adjustable outline, crop, rotate, label, delete with undo; phone photo orientation; photos in the owner summary and PDF | `server/blinqscribe/photos.py`, `images.py`, `web/src/screens/visit/` (photo dialog and view), `web/src/lib/photoGeometry.ts`, `web/src/lib/speech.ts` |
| Speech to text layer (Muse Voice Transcribe) | `server/blinqscribe/stt.py` |
| Demo owner texts through Telnyx | `server/blinqscribe/sms.py` |
| Day assistant (tool calling agent) | `server/blinqscribe/assistant.py` |
| Voice profiles and the 90 day note sync | `server/blinqscribe/voice.py`, `notes.py`, `onboard.py` |
| Practice adapter interface, synthetic clinic and its earlier demo days | `server/blinqscribe/adapters/base.py`, `mock.py`, `demo_seed.py`, `server/data/` |
| Web app (React, Vite, TypeScript, Tailwind, Radix, Apollo): every console screen, sign in, loading states, the browser recorder | `web/src/`, `web/e2e/`, root `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| First web console (single HTML file, Oct 29 to 31), replaced by the web app; in the git history | `web/console.html` (removed) |
| iPhone glasses companion app | `glasses-ios/` |
| Tests, Docker, docs | `server/tests/`, `Dockerfile`, `docker-compose.yml`, `*.md` |

Also built during the event, in the private platform and not in this repo: a read only connection for Blinq Scribe. Nothing in this repo needs it; everything here runs on the demo PIMS.

## AI models used

| Model | Job | Where it runs |
|---|---|---|
| Muse Spark (`muse-spark-1.1`) | SOAP note, follow ups, photo descriptions, referral letter drafts, speaker labels, morning brief, Ask Blinq tool calls | Meta Model API |
| Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | Speech to text for glasses and browser recordings | Meta Model API |
| SAM 3.1 (`sam-3.1`) | Outlines wounds, masses and teeth in exam photos | Meta Model API |
| Kokoro-82M v1.0 (Apache 2.0), int8 ONNX export | Natural read-aloud voice for the brief, end of day and pre-room card | On the server's CPU, with ONNX Runtime. Downloaded, not in this repo |

## What demo mode simulates

| Part | In demo mode |
|---|---|
| Clinic data | A synthetic clinic: 6 visits, 2 providers, 5 owners, notes, open times. The Lee household has 5 pets. No real practice, patients or owners |
| AI | Mocked until `MODEL_API_KEY` is set; flagged "Mock AI" on screen, and mock letter drafts are flagged. The sample visits come with written clinical notes, so the demo draft gives the same outcome as the real product |
| Recording | Plays the sample visit into the transcript until a model key is set |
| Photo outlines | A mock outline until `SAM_ENDPOINT` is set |
| Signing, sending to the PIMS and booking | Saved to the demo clinic's PIMS. Screens say "the PIMS", never a vendor name |
| Texts and emails | Shown, not sent, unless demo texts or emails are set up, and then only to one phone and one inbox |
| Two step sign in codes | Printed in the server terminal instead of emailed |
| Read aloud | Real (Kokoro on the CPU) when downloaded, else the browser's voice |

## Third party and open source used

Licenses are checked against the installed package metadata (uv for Python, pnpm for the web app).

| Component | License | Use |
|---|---|---|
| Meta Model API (Muse Spark, Muse Voice Transcribe, SAM 3.1) | Meta terms | Hosted models |
| Meta Wearables Device Access Toolkit for iOS | Meta Wearables Developer Terms | Glasses camera, mic and session on iPhone |
| FastAPI, Pydantic, Starlette, Uvicorn, python-multipart | MIT / MIT / BSD-3-Clause / BSD-3-Clause / Apache 2.0 | Server |
| Uvicorn's standard extras: uvloop, httptools, watchfiles, websockets, python-dotenv, PyYAML, click, h11 | MIT / MIT / MIT / BSD-3-Clause / BSD-3-Clause / MIT / BSD-3-Clause / MIT | Faster server loop, auto reload, websockets for subscriptions |
| httpx, httpx2 | BSD-3-Clause | HTTP client (httpx2 is httpx's successor, used by the OpenAI SDK and Authlib) |
| OpenAI Python SDK | Apache 2.0 | Client for the OpenAI-compatible Meta Model API |
| Strawberry GraphQL (with graphql-core, python-dateutil, six) | MIT / Apache 2.0 / BSD-3-Clause | GraphQL API and subscriptions |
| Peewee, peewee-async | MIT | Database models |
| pycasbin (`casbin`), simpleeval | Apache 2.0 / MIT | Role rules for permissions |
| pyotp | MIT | Two step sign in codes from an authenticator app |
| Pillow | MIT-CMU (HPND) | Makes photos small for PDFs |
| pypdf | BSD-3-Clause | Merges received PDF records into the letter PDF |
| ONNX Runtime (`onnxruntime`), with flatbuffers, protobuf, packaging | MIT / Apache 2.0 / BSD-3-Clause / Apache 2.0 or BSD-2-Clause | Runs the Kokoro voice model on the CPU |
| NumPy | BSD-3-Clause (with bundled 0BSD, MIT, Zlib, CC0 parts) | Audio arrays |
| misaki (data files only), with addict and regex | Apache 2.0 / MIT / Apache 2.0 | English pronunciation dictionaries for the read-aloud voice. No espeak-ng and no GPL code: kokoro-onnx, phonemizer and misaki's English extra were left out because they pull in espeak-ng (GPL-3.0) |
| Kokoro-82M v1.0 model and voices (onnx-community ONNX export) | Apache 2.0 | The read-aloud voice, downloaded at setup |
| aiopg, aiosqlite | BSD-2-Clause / MIT | Async database drivers |
| psycopg2-binary | LGPL-3.0 with linking exception | PostgreSQL driver |
| Alembic, SQLAlchemy | MIT | Database migrations |
| PostgreSQL 18 (Docker image) | PostgreSQL License | Database for the Docker setup |
| Temporal Python SDK, Temporal dev server (Docker image) | MIT | Background work and schedules |
| Authlib, joserfc | BSD-3-Clause | Google and Microsoft sign in (OpenID Connect), ID token checks |
| Jinja2, MarkupSafe | BSD-3-Clause | Email templates |
| cryptography, cffi, pycparser | Apache 2.0 or BSD-3-Clause / MIT-0 / BSD-3-Clause | Installed by Authlib and joserfc for token signature checks |
| certifi | MPL 2.0 | Certificate list for HTTPS. Used unmodified |
| anyio, sniffio, idna, httpcore, httpcore2, jiter, annotated-types, pydantic-core, typing-extensions, typing-inspection, truststore, tzdata, opentelemetry-api, nexus-rpc, async-timeout, cross-web | MIT / MIT or Apache 2.0 / BSD-3-Clause / BSD-3-Clause / BSD-3-Clause / MIT / MIT / MIT / PSF-2.0 / MIT / MIT / Apache 2.0 / Apache 2.0 / MIT / Apache 2.0 / MIT | Installed by FastAPI, httpx, the OpenAI SDK, Pydantic and the Temporal SDK |
| aiosmtplib | MIT | Sending email over SMTP |
| pytest, anyio, pluggy, iniconfig, Pygments | MIT / MIT / MIT / MIT / BSD-2-Clause | Server tests |
| uv, Ruff | MIT / Apache 2.0 | Python packaging, lint and format |
| mypy, mypy-extensions, pathspec, types-peewee, types-psycopg2, types-Authlib, types-protobuf | MIT / MIT / MPL 2.0 / Apache 2.0 / Apache 2.0 / Apache 2.0 / Apache 2.0 | Type checks (dev only). pathspec is used unmodified |
| React, React DOM | MIT | Web app |
| Vite, @vitejs/plugin-react | MIT | Web build and dev server |
| TypeScript, typescript-eslint, ESLint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint-config-prettier | Apache 2.0 / MIT | Web language and lint |
| Tailwind CSS | MIT | Web styling |
| Radix UI | MIT | Accessible web components (dialogs, menus, tabs, selects) |
| clsx, tailwind-merge, cmdk | MIT | Component library class names and the searchable select |
| uqr | MIT | The authenticator setup QR code |
| Apollo Client, graphql, graphql-ws, GraphQL Code Generator | MIT | GraphQL in the web app |
| React Router, React Hook Form, @hookform/resolvers, Zod, Zustand, i18next, react-i18next | MIT | Web routing, forms, validation, state and text |
| Vitest, Testing Library (react, user-event, jest-dom), jsdom | MIT | Web and component library unit tests |
| Playwright | Apache 2.0 | Web end to end tests |
| axe-core (via @axe-core/playwright, and directly in the component library tests) | MPL 2.0 | Accessibility checks in tests (dev only). Used unmodified |
| pnpm, Turborepo, Prettier, @tailwindcss/vite, globals, @eslint/js, @graphql-typed-document-node/core, @types/* | MIT | Web packages, build tasks, formatting, build and lint config, type definitions |
| Poppins, Material Symbols Rounded (Google Fonts) | SIL Open Font License 1.1 / Apache 2.0 | Web fonts and icons |
| Telnyx Messaging API | Telnyx terms | Demo texts to one phone number |

## Coding tools

We used AI coding agents during the event. The team reviewed and tested all code. The AI models inside the product (Muse Spark, Muse Voice Transcribe, SAM 3.1) only draft: the provider edits, approves and signs everything that reaches an owner or the PIMS.

| When | Tool | What it built |
|---|---|---|
| Oct 29 | Claude (Anthropic) | First scaffold: server, scribe pipeline, day assistant, adapters, web console, glasses app skeleton. Rename to Blinq Scribe. SAM 3.1 wiring in `vision.py`, end of day list, PIMS write back in the docs. |
| Oct 30 | Claude (Anthropic) | On the private platform side, not in this repo: the read only connection for Blinq Scribe, with tests. In this repo: the practice adapter design in the docs. |
| Oct 30 onward | Muse Code (Meta) | Built the iPhone companion app in glasses-ios/: SwiftUI Today, Visit and Settings screens, Blinq Scribe API client, 16 kHz WAV chunk recording over Bluetooth HFP with upload retries, glasses camera capture through the Meta Wearables Device Access Toolkit with phone camera fallback, spoken confirmations, push to talk, MockDeviceKit toggle, unit tests and the glasses-ios README. |
| Oct 30 to 31 | Claude (Anthropic) | In this repo: demo mode, Muse Voice Transcribe recording, the patient record, household, search, outside records, week strip, note types, several pets per visit, edit tools, templates, booking links, Remember and the owner summary (server and the first web console). Then the move to the startup's usual open source stack: uv, Ruff and mypy, the Strawberry GraphQL API, Peewee and Alembic storage, Temporal jobs, the new sign in, and the React web app. |
| Oct 31 to Nov 1 | Claude (Anthropic) | In this repo: roles and permissions, account settings, two step sign in with an authenticator app, referral letters and the letter PDF, the Kokoro read-aloud voice with its pronunciation table, photo capture and edit, and the component library. Then, on Nov 1: the Light, Dark and System theme; speaker labels on the transcript; sign and send to the PIMS with sync status; the redesigned visit page and top bar; the record as one component, the Record tab on every visit page and its own page, replacing the Record side panel, the household page and the Owner and pets tab; the new shared components (action bar, pressable list rows, confirm popover, speaker row, recording and status pills); demo drafts that read like real notes; phone number formatting; "the PIMS" wording on every screen; and guards against runaway or garbled model replies. |

The table above says which phase built what; the private commit history shows it commit by commit.
