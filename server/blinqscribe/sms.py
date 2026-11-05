"""Owner texts through Telnyx, locked to one demo number for the hackathon.

SMS_MODE=preview  nothing is sent; the vet sees the exact text that would go out
(default, demo mode)
SMS_MODE=off      nothing is sent or shown
SMS_MODE=demo     every approved message goes to DEMO_SMS_TO, whoever the owner is.
               Real owner numbers are never read, even with live PIMS data.
Any other mode is refused: texting real owners needs opt-out handling first.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

import httpx

from .config import Settings
from .phone import mask_phone
from .schemas import Appointment, FollowUp, FollowUpKind, SmsResult

TELNYX_URL = "https://api.telnyx.com/v2/messages"
E164 = re.compile(r"^\+[1-9]\d{7,14}$")
OWNER_FACING = {FollowUpKind.recheck, FollowUpKind.client_update}
MAX_CHARS = 640  # 4 SMS segments


def mask(number: str) -> str:
    """Where a text went, without the number: "(•••) •••-0101"."""
    return mask_phone(number)


class SmsConfigError(ValueError):
    pass


class Texter:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ):
        self.mode = settings.sms_mode
        self.api_key = settings.telnyx_api_key
        self.from_number = settings.telnyx_from
        self.profile_id = settings.telnyx_messaging_profile_id
        self.demo_to = settings.demo_sms_to
        # Where an owner's summary link points when no web request is at hand (a text
        # sent at signing by a job): the public address, else this machine's app.
        self.public_url = settings.public_url.rstrip("/") or "http://127.0.0.1:8010"
        self._transport = transport
        if self.mode not in ("preview", "off", "demo"):
            raise SmsConfigError(
                f"SMS_MODE={self.mode!r} is not allowed in this build. Use "
                "preview, off or demo."
            )
        if self.mode == "demo":
            missing = [
                n
                for n, v in (
                    ("TELNYX_API_KEY", self.api_key),
                    ("TELNYX_FROM_NUMBER", self.from_number),
                    ("DEMO_SMS_TO", self.demo_to),
                )
                if not v
            ]
            if missing:
                raise SmsConfigError(f"SMS_MODE=demo needs {', '.join(missing)}")
            for name, value in (
                ("TELNYX_FROM_NUMBER", self.from_number),
                ("DEMO_SMS_TO", self.demo_to),
            ):
                if not E164.match(value):
                    raise SmsConfigError(f"{name} must look like +15551234567")

    @property
    def label(self) -> str:
        return f"demo to {mask(self.demo_to)}" if self.mode == "demo" else self.mode

    @staticmethod
    def compose(followup: FollowUp) -> str:
        text = followup.message_draft.strip()
        if followup.kind == FollowUpKind.recheck and followup.booked_slot:
            text += (
                f"\nBooked: {followup.booked_slot.start:%a %b %-d %-I:%M %p}. "
                "Reply to change it."
            )
        elif followup.booking_mode == "link" and followup.booking_link:
            if followup.booking_link.url:
                text += f"\nPick a time that works for you: {followup.booking_link.url}"
            else:
                text += "\nCall us to pick a time."
        elif followup.kind == FollowUpKind.recheck and followup.suggested_slots:
            times = ", ".join(
                f"{s.start:%a %b %-d %-I:%M %p}" for s in followup.suggested_slots[:3]
            )
            text += f"\nOpen times: {times}"
            if followup.suggested_slots[0].booking_url:
                text += f"\nBook: {followup.suggested_slots[0].booking_url}"
        return text[:MAX_CHARS]

    async def send_followup(
        self, followup: FollowUp, appt: Appointment | None
    ) -> SmsResult | None:
        """Text an approved, owner-facing follow up. Returns None when it is not
        owner-facing."""
        if followup.kind not in OWNER_FACING or not followup.message_draft.strip():
            return None
        return await self.send_text(self.compose(followup), appt)

    async def send_text(self, text: str, appt: Appointment | None) -> SmsResult:
        """Text the owner of `appt`, under the same modes: preview, off, or the demo
        number only."""
        text = text[:MAX_CHARS]
        if self.mode == "preview":
            return SmsResult(
                status="preview",
                text=text,
                at=datetime.now(UTC),
                detail="Demo mode: not sent. This is the text the owner would get.",
            )
        if self.mode != "demo":
            return SmsResult(status="skipped", detail="Texting is off (SMS_MODE=off)")
        # Demo lock: the recipient is ALWAYS the demo number. `appt` is accepted only so
        # live mode can be added later; the owner's phone is deliberately not read here.
        to = self.demo_to
        body = {"from": self.from_number, "to": to, "text": text}
        if self.profile_id:
            body["messaging_profile_id"] = self.profile_id
        try:
            async with httpx.AsyncClient(timeout=20, transport=self._transport) as http:
                r = await http.post(
                    TELNYX_URL,
                    json=body,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
            if r.status_code >= 400:
                errors = (
                    r.json().get("errors", [])
                    if r.headers.get("content-type", "").startswith("application/json")
                    else []
                )
                detail = (
                    "; ".join(e.get("detail") or e.get("title", "") for e in errors)
                    or f"HTTP {r.status_code}"
                )
                return SmsResult(
                    status="failed", detail=detail[:300], to_masked=mask(to)
                )
            provider_id = (r.json().get("data") or {}).get("id", "")
            return SmsResult(
                status="sent",
                to_masked=mask(to),
                provider_id=provider_id,
                at=datetime.now(UTC),
                detail="Sent to the demo number",
            )
        except httpx.HTTPError as exc:
            return SmsResult(
                status="failed",
                detail=f"Could not reach Telnyx: {exc.__class__.__name__}",
                to_masked=mask(to),
            )
