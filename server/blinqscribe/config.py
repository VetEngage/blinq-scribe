"""Settings, read once from environment variables (see .env.example)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

_INLINE_COMMENT = re.compile(r"\s+#.*$")


def parse_env_value(value: str) -> str:
    """`KEY=value  # note` gives `value`; quotes are removed, and a # inside quotes is
    kept."""
    value = value.strip()
    if value[:1] in ("'", '"') and value[0] in value[1:]:
        return value[1 : value.index(value[0], 1)]
    return "" if value.startswith("#") else _INLINE_COMMENT.sub("", value)


def load_dotenv() -> None:
    """Read KEY=VALUE lines from ./.env or ../.env. Real env vars win."""
    for path in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if path.is_file():
            for line in path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), parse_env_value(value))
            return


def _env(name: str, default: str = "") -> str:
    # A blank value means "use the default", so `SMS_MODE=` in a copied .env still
    # works.
    return os.environ.get(name, "").strip() or default


@dataclass(frozen=True)
class Settings:
    # Meta Model API (OpenAI compatible)
    model_api_key: str = field(default_factory=lambda: _env("MODEL_API_KEY"))
    meta_base_url: str = field(
        default_factory=lambda: _env("META_BASE_URL", "https://api.meta.ai/v1")
    )
    muse_model: str = field(
        default_factory=lambda: _env("MUSE_MODEL", "muse-spark-1.1")
    )

    # Speech to text. "meta": Muse Voice Transcribe on the Meta Model API, the default
    # once MODEL_API_KEY
    # is set. "mock" hears nothing (the demo clinic plays the sample visit).
    # "openai_compatible" posts audio
    # to any /audio/transcriptions endpoint (an open-weights speech model you host on
    # Baseten, Modal...).
    stt_provider: str = field(
        default_factory=lambda: _env(
            "STT_PROVIDER",
            "meta" if (_env("STT_API_KEY") or _env("MODEL_API_KEY")) else "mock",
        ).lower()
    )
    stt_base_url: str = field(
        default_factory=lambda: _env("STT_BASE_URL", "https://api.meta.ai/v1")
    )
    stt_api_key: str = field(
        default_factory=lambda: _env("STT_API_KEY") or _env("MODEL_API_KEY")
    )
    stt_model: str = field(default_factory=lambda: _env("STT_MODEL", ""))

    # SAM 3.1 segmentation: base URL of a Responses API that serves it
    # (https://api.meta.ai/v1 for Meta Model API). Empty = mock.
    sam_endpoint: str = field(default_factory=lambda: _env("SAM_ENDPOINT"))
    sam_model: str = field(default_factory=lambda: _env("SAM_MODEL", "sam-3.1"))
    sam_api_key: str = field(
        default_factory=lambda: _env("SAM_API_KEY") or _env("MODEL_API_KEY")
    )

    # Practice data source. "mock" is the built-in demo PIMS (a synthetic clinic). A
    # clinic's PIMS connector plugs in through adapters.base.PracticeAdapter.
    practice_adapter: str = field(
        default_factory=lambda: _env("PRACTICE_ADAPTER", "mock")
    )
    # Blank means no booking link (texts then leave out the "Book:" line), so it is read
    # without _env's fallback.
    booking_url_template: str = field(
        default_factory=lambda: os.environ.get(
            "BOOKING_URL_TEMPLATE",
            "https://example.com/book?location={location_id}&service={service_id}&start={start}",
        ).strip()
    )

    # Owner texts. "preview" (default) sends nothing and shows the vet the text that
    # would go out.
    # "off" sends nothing. "demo" sends every approved message to DEMO_SMS_TO only,
    # never a real owner.
    sms_mode: str = field(default_factory=lambda: _env("SMS_MODE", "preview").lower())
    telnyx_api_key: str = field(default_factory=lambda: _env("TELNYX_API_KEY"))
    telnyx_from: str = field(default_factory=lambda: _env("TELNYX_FROM_NUMBER"))
    telnyx_messaging_profile_id: str = field(
        default_factory=lambda: _env("TELNYX_MESSAGING_PROFILE_ID")
    )
    demo_sms_to: str = field(default_factory=lambda: _env("DEMO_SMS_TO"))
    # The one inbox that gets demo emails (referral letters), like DEMO_SMS_TO. Blank
    # = demo mode shows the email instead of sending it.
    demo_email_to: str = field(default_factory=lambda: _env("DEMO_EMAIL_TO"))

    data_dir: Path = field(default_factory=lambda: Path(_env("DATA_DIR", "./var")))
    # postgresql://user:password@host:5432/name. Empty = SQLite in DATA_DIR (demo and
    # tests).
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL"))
    # host:port of a Temporal server. Empty = background work runs in the server.
    temporal_address: str = field(default_factory=lambda: _env("TEMPORAL_ADDRESS"))
    # The practice system's real name when the practice data doesn't say it. Kept as
    # data only; screens and messages always say "the PIMS".
    pims_name: str = field(default_factory=lambda: _env("PIMS_NAME"))
    # The clinic's time zone (IANA, e.g. America/Chicago): the days and times every
    # screen shows. Blank = the server's own zone.
    clinic_tz: str = field(default_factory=lambda: _env("CLINIC_TZ"))
    # Read aloud. Blank = Kokoro when its files are in MODELS_DIR (see speech.py),
    # else the browser's voice. "browser" always uses the browser's voice.
    tts_provider: str = field(default_factory=lambda: _env("TTS_PROVIDER").lower())
    tts_voice: str = field(default_factory=lambda: _env("TTS_VOICE", "af_heart"))
    models_dir: Path = field(
        default_factory=lambda: Path(_env("MODELS_DIR", "./var/models"))
    )
    api_token: str = field(default_factory=lambda: _env("BLINQ_SCRIBE_API_TOKEN"))
    # Where people open the console, for invite links. Empty = the address the admin
    # used.
    public_url: str = field(default_factory=lambda: _env("BLINQ_SCRIBE_PUBLIC_URL"))

    # Continue with Google / Microsoft: each shows on the sign in page only when its
    # client id and secret are set.
    google_sign_in_client_id: str = field(
        default_factory=lambda: _env("GOOGLE_SIGN_IN_CLIENT_ID")
    )
    google_sign_in_secret: str = field(
        default_factory=lambda: _env("GOOGLE_SIGN_IN_SECRET")
    )
    # Optional: only Google Workspace accounts from these domains (comma separated).
    google_sign_in_domains: str = field(
        default_factory=lambda: _env("GOOGLE_SIGN_IN_DOMAINS")
    )
    microsoft_sign_in_client_id: str = field(
        default_factory=lambda: _env("MICROSOFT_SIGN_IN_CLIENT_ID")
    )
    microsoft_sign_in_secret: str = field(
        default_factory=lambda: _env("MICROSOFT_SIGN_IN_SECRET")
    )
    # The practice's Microsoft tenant id, or "common" for any Microsoft account.
    microsoft_sign_in_tenant: str = field(
        default_factory=lambda: _env("MICROSOFT_SIGN_IN_TENANT", "common")
    )

    # Email (password reset links, 2FA codes). No host = written to the log only.
    email_smtp_host: str = field(default_factory=lambda: _env("EMAIL_SMTP_HOST"))
    email_smtp_port: int = field(
        default_factory=lambda: int(_env("EMAIL_SMTP_PORT", "587"))
    )
    email_smtp_user: str = field(default_factory=lambda: _env("EMAIL_SMTP_USER"))
    email_smtp_password: str = field(
        default_factory=lambda: _env("EMAIL_SMTP_PASSWORD")
    )
    # starttls | ssl | none
    email_smtp_security: str = field(
        default_factory=lambda: _env("EMAIL_SMTP_SECURITY", "starttls").lower()
    )
    email_from: str = field(
        default_factory=lambda: _env("EMAIL_FROM", "Blinq Scribe <no-reply@localhost>")
    )

    @property
    def ai_is_mock(self) -> bool:
        """No API key means every model call uses the deterministic mock."""
        return not self.model_api_key


def get_settings() -> Settings:
    return Settings()
