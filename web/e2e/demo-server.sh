#!/bin/bash
# The demo clinic for end to end tests: its own port and a fresh data folder, and every model,
# texting and practice key blanked so the AI is mocked and nothing leaves the machine.
set -e
cd "$(dirname "$0")/../../server"
export DATA_DIR="${DATA_DIR:-$(mktemp -d)}"
for k in MODEL_API_KEY META_BASE_URL MUSE_MODEL STT_PROVIDER STT_BASE_URL STT_API_KEY STT_MODEL SAM_ENDPOINT SAM_API_KEY SAM_MODEL \
  TELNYX_API_KEY \
  TELNYX_FROM_NUMBER TELNYX_MESSAGING_PROFILE_ID DEMO_SMS_TO BLINQ_SCRIBE_API_TOKEN BLINQ_SCRIBE_PUBLIC_URL BOOKING_URL_TEMPLATE \
  DATABASE_URL TEMPORAL_ADDRESS SMTP_HOST GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET; do
  export "$k="
done
export PRACTICE_ADAPTER=mock SMS_MODE=preview
if command -v uv >/dev/null; then exec uv run uvicorn blinqscribe.main:app --port "${PORT:-8042}"; fi
exec .venv/bin/uvicorn blinqscribe.main:app --port "${PORT:-8042}"
