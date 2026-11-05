"""Letters over REST, as the PRD's API table lists them (GraphQL has the same in
gql/referrals.py), plus the pages people open from a link: the owner's (last-name
check) and the specialist's "view online" (the token is the key)."""

from __future__ import annotations

import re
from types import SimpleNamespace
from typing import Any

from fastapi import Body, Depends, FastAPI, Form, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from . import referrals
from .accounts import Caller
from .referrals import Letter, LetterError, Letters, channels_from, fields_from

TOKEN = re.compile(r"^[A-Za-z0-9_-]{20,64}$")
LETTER_ID = re.compile(r"^[a-f0-9]{12}$")


class SendIn(BaseModel):
    channels: list[str]
    to_email: str = ""
    owner_copy: bool = False


def owner_page(body: str, status: int = 200) -> HTMLResponse:
    return HTMLResponse(
        body,
        status,
        headers={
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Robots-Tag": "noindex, nofollow",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; "
            "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        },
    )


def pdf_response(data: bytes, letter: Letter) -> Response:
    name = re.sub(r"[^A-Za-z0-9 _-]", "", letter.patient_name) or "letter"
    kind = referrals.KIND_TEXT[letter.kind]
    return Response(
        data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{kind} {name}.pdf"',
            "Cache-Control": "no-store",
        },
    )


def register(app: FastAPI, ctx: SimpleNamespace) -> None:
    letters: Letters = ctx.letters

    def refused(exc: ValueError) -> HTTPException:
        if isinstance(exc, LetterError):
            return HTTPException(exc.status, str(exc))
        return HTTPException(400, "Check the letter's fields.")

    def known(letter_id: str) -> Letter:
        if not LETTER_ID.match(letter_id):
            raise HTTPException(404, "That letter wasn't found.")
        try:
            return letters.get(letter_id)
        except LetterError as exc:
            raise refused(exc) from exc

    @app.get("/api/patients/{patient_id}/letters")
    def patient_letters(
        patient_id: str, who: Caller = Depends(ctx.auth)
    ) -> list[Letter]:
        return letters.readable_for_patient(who, patient_id)

    @app.post("/api/patients/{patient_id}/letters")
    async def start_letter(
        patient_id: str,
        body: dict[str, Any] = Body(...),
        who: Caller = Depends(ctx.auth),
    ) -> Letter:
        """{kind, encounter_id?, recipient, reason, urgency, attachments,
        owner_consent}. Returns Blinq's draft."""
        encounter_id = str(body.pop("encounter_id", "") or "")
        try:
            fields = fields_from(body)
            return await letters.create(who, patient_id, encounter_id, fields)
        except ValueError as exc:
            raise refused(exc) from exc

    @app.put("/api/letters/{letter_id}")
    async def edit_letter(
        letter_id: str,
        body: dict[str, Any] = Body(...),
        who: Caller = Depends(ctx.auth),
    ) -> Letter:
        known(letter_id)
        try:
            return await letters.update(who, letter_id, fields_from(body))
        except ValueError as exc:
            raise refused(exc) from exc

    @app.post("/api/letters/{letter_id}/send")
    async def send_letter(
        letter_id: str,
        body: SendIn,
        request: Request,
        who: Caller = Depends(ctx.auth),
    ) -> dict[str, Any]:
        """Sign and send: {channels, to_email, owner_copy}."""
        known(letter_id)
        try:
            return await letters.send(
                who,
                letter_id,
                channels_from(body.channels),
                body.to_email,
                body.owner_copy,
                str(request.base_url),
            )
        except ValueError as exc:
            raise refused(exc) from exc

    @app.get("/api/letters/{letter_id}.pdf", response_model=None)
    async def letter_pdf(letter_id: str, who: Caller = Depends(ctx.auth)) -> Response:
        known(letter_id)
        try:
            letter, data = await letters.pdf_for(who, letter_id)
        except LetterError as exc:
            raise refused(exc) from exc
        return pdf_response(data, letter)

    # ---------- the owner's page: last name check, 14 days, locks after 5 ----------
    async def owner_link(
        token: str, last_name: str | None, want_pdf: bool = False
    ) -> Response:
        clinic = (await ctx.adapter.get_clinic()).model_dump()
        state, letter = (
            letters.open_link(token, last_name)
            if TOKEN.match(token)
            else ("missing", None)
        )
        if state in ("missing", "expired", "locked"):
            return owner_page(
                referrals.page_message(clinic, state),
                {"missing": 404, "expired": 410, "locked": 423}[state],
            )
        if state == "ask":
            return owner_page(referrals.page_form(clinic))
        if state == "wrong" or not letter or last_name is None:
            return owner_page(
                referrals.page_form(clinic, referrals.PAGE_TEXT["wrong"]), 401
            )
        if want_pdf:
            return pdf_response(await letters.pdf(letter), letter)
        return owner_page(
            referrals.page_letter(
                clinic,
                letter,
                letters.attachment_names(letter),
                referrals.owner_pdf_form(token, last_name),
            )
        )

    @app.get("/r/{token}", response_class=HTMLResponse, include_in_schema=False)
    async def owner_form(token: str) -> Response:
        return await owner_link(token, None)

    @app.post("/r/{token}", response_class=HTMLResponse, include_in_schema=False)
    async def owner_open(
        token: str, last_name: str = Form("", max_length=80)
    ) -> Response:
        return await owner_link(token, last_name)

    @app.post("/r/{token}/pdf", include_in_schema=False, response_model=None)
    async def owner_pdf(
        token: str, last_name: str = Form("", max_length=80)
    ) -> Response:
        return await owner_link(token, last_name, want_pdf=True)

    # ---------- the specialist's "view online": records that it was opened ----------
    async def specialist_link(token: str, want_pdf: bool) -> Response:
        clinic = (await ctx.adapter.get_clinic()).model_dump()
        state, letter = (
            letters.open_link(token, None, kind="specialist")
            if TOKEN.match(token)
            else ("missing", None)
        )
        if state != "ok" or not letter:
            return owner_page(
                referrals.page_message(clinic, state),
                {"expired": 410}.get(state, 404),
            )
        if want_pdf:
            return pdf_response(await letters.pdf(letter), letter)
        link = (
            f'<p><a class="btn" href="/l/{token}/pdf">Download the PDF with its '
            "attachments</a></p>"
        )
        return owner_page(
            referrals.page_letter(
                clinic, letter, letters.attachment_names(letter), link
            )
        )

    @app.get("/l/{token}", response_class=HTMLResponse, include_in_schema=False)
    async def specialist_view(token: str) -> Response:
        return await specialist_link(token, want_pdf=False)

    @app.get("/l/{token}/pdf", include_in_schema=False, response_model=None)
    async def specialist_pdf(token: str) -> Response:
        return await specialist_link(token, want_pdf=True)
