"""Email: Jinja2 templates sent over SMTP.

With no EMAIL_SMTP_HOST nothing is sent and only who and what (never the body) is
logged, so a reset link or a sign in code never lands in a log. Callers that must
deliver a secret check `live` first.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from .config import Settings

log = logging.getLogger("blinqscribe.mail")

TEMPLATES = Path(__file__).parent / "templates" / "email"

SUBJECTS = {
    "sign_in_code": "Your Blinq Scribe sign in code",
    "password_reset": "Reset your Blinq Scribe password",
    "referral_letter": "{kind_title} for {pet} from {clinic}",
    "letter_for_owner": "{pet}: a letter from {clinic}",
}


def masked(email: str) -> str:
    """m•••@clinic.com: enough to know where to look, not the whole address."""
    name, _, domain = email.partition("@")
    return f"{name[:1]}•••@{domain}" if domain else "•••"


@dataclass(frozen=True)
class Rendered:
    subject: str
    text: str
    html: str


class Mailer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.env = Environment(
            loader=FileSystemLoader(TEMPLATES),
            autoescape=select_autoescape(["html"]),
            undefined=StrictUndefined,
        )

    @property
    def live(self) -> bool:
        return bool(self.settings.email_smtp_host)

    def render(self, template: str, **context: Any) -> Rendered:
        return Rendered(
            # One line: a name with a line break must not add a mail header.
            " ".join(SUBJECTS[template].format(**context).split()),
            self.env.get_template(f"{template}.txt").render(**context),
            self.env.get_template(f"{template}.html").render(**context),
        )

    async def send(
        self,
        to: str,
        template: str,
        attachments: list[tuple[str, bytes, str]] | None = None,
        **context: Any,
    ) -> bool:
        """Send one templated message, with (filename, data, mime type) attachments.
        False when there is no SMTP to send it."""
        rendered = self.render(template, **context)
        if not self.live:
            log.warning(
                "Email not sent (no SMTP) to %s: %s", masked(to), rendered.subject
            )
            return False
        msg = EmailMessage()
        msg["From"] = self.settings.email_from
        msg["To"] = to
        msg["Subject"] = rendered.subject
        msg.set_content(rendered.text)
        msg.add_alternative(rendered.html, subtype="html")
        for filename, data, mime in attachments or []:
            main, _, sub = mime.partition("/")
            msg.add_attachment(data, maintype=main, subtype=sub, filename=filename)
        security = self.settings.email_smtp_security
        await aiosmtplib.send(
            msg,
            hostname=self.settings.email_smtp_host,
            port=self.settings.email_smtp_port,
            username=self.settings.email_smtp_user or None,
            password=self.settings.email_smtp_password or None,
            use_tls=security == "ssl",
            start_tls=security == "starttls",
            timeout=20,
        )
        log.info("Email sent to %s: %s", masked(to), rendered.subject)
        return True
