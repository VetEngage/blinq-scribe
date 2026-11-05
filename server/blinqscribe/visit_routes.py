"""Visit tools: note types, edit tools, templates, Remember, booking links and sharing
the owner summary."""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any, Literal

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from . import (
    booking_links,
    editor,
    note_types,
    permissions,
    plan_checks,
    remember,
    share,
)
from .accounts import Caller
from .adapters import PracticeAdapter
from .schemas import (
    Appointment,
    AssistIn,
    AssistOut,
    Encounter,
    EncounterStatus,
    Patient,
    Template,
    TemplateIn,
)

SHORTCUT = re.compile(r"^[a-z0-9][a-z0-9_-]{0,23}$")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{20,64}$")
# Demo clinic templates, written by the clinic. The AI never writes or edits a template.
CLINIC_TEMPLATES = [
    {
        "name": "Normal ear exam",
        "shortcut": "earnormal",
        "note_type": "",
        "text": "Ears: canals clean, no erythema or discharge, tympanic membranes "
        "intact bilaterally.",
    },
    {
        "name": "Wellness exam, normal",
        "shortcut": "wellnormal",
        "note_type": "wellness",
        "text": "Bright, alert, responsive. Eyes, ears, nose and throat normal. "
        "Heart and lungs normal on auscultation. "
        "Abdomen soft, non painful. Skin and coat normal. Lymph nodes normal.",
    },
    {
        "name": "Dental home care",
        "shortcut": "dentalhome",
        "note_type": "dental",
        "text": "Soft food for 3 days. Brush teeth daily once gums have healed. Call "
        "us if eating stops or there is bleeding.",
    },
]


class NoteTypeIn(BaseModel):
    note_type: str


class KeepIn(BaseModel):
    keep: list[str] = []


class PlanChecksIn(BaseModel):
    patient_id: str
    lines: list[str] = []


class PlanReminderIn(BaseModel):
    # "added": the provider put the line in the Plan (the note is saved as usual).
    action: Literal["added", "dismissed"]


class ShareIn(BaseModel):
    channel: Literal["text", "email", "print"]
    language: Literal["en", "es"] = "en"


async def visit_pets(
    adapter: PracticeAdapter, appt: Appointment, patient_ids: list[str]
) -> list[Patient]:
    """The pets in a visit, in the order given (default the appointment's pet). All must
    be this owner's, and none may be booked with another vet that day: that visit is
    the other vet's to write."""
    ids = patient_ids or [appt.patient.id]
    pets = {appt.patient.id: appt.patient}
    for p in await adapter.get_household(appt.client.id):
        pets.setdefault(p.id, p)
    if any(i not in pets for i in ids):
        raise HTTPException(400, "Every pet in a visit must belong to the same owner.")
    if extra := [i for i in ids if i != appt.patient.id]:
        for a in await adapter.get_schedule(appt.start.date()):
            if (
                a.patient.id in extra
                and a.provider_id
                and a.provider_id != appt.provider_id
            ):
                vet = a.provider_name or "another provider"
                raise HTTPException(
                    400,
                    f"{a.patient.name} has a visit with {vet} today, so add them to "
                    "that visit instead.",
                )
    return [pets[i] for i in ids]


async def clinic_of(adapter: PracticeAdapter) -> dict[str, Any]:
    """Name, address, phone and logo for the summary, the PDF and the owner's page."""
    return (await adapter.get_clinic()).model_dump()


def register(app: FastAPI, ctx: SimpleNamespace) -> dict[str, Any]:
    """Add the visit routes. ctx carries settings, adapter, store, muse, texter, auth
    and friends (see api.py).
    Returns the handlers: GraphQL resolves through them too."""
    store, adapter, muse, texter = ctx.store, ctx.adapter, ctx.muse, ctx.texter
    demo = adapter.name == "mock"
    locked = asynccontextmanager(
        ctx.one_at_a_time
    )  # for routes that find their encounter from another id

    def editable(encounter_id: str) -> Encounter:
        enc: Encounter = ctx.load(encounter_id)
        if enc.status == EncounterStatus.signed:
            raise HTTPException(409, "Note is already signed")
        return enc

    def signed(encounter_id: str) -> Encounter:
        enc: Encounter = ctx.load(encounter_id)
        if enc.status != EncounterStatus.signed:
            raise HTTPException(409, "Sign the note before sharing the summary.")
        return enc

    # ---------- note types ----------
    @app.get("/api/note-types", dependencies=[Depends(ctx.auth)])
    def list_note_types() -> list[dict[str, Any]]:
        return [note_types.public(t) for t in note_types.NOTE_TYPES]

    @app.put(
        "/api/encounters/{encounter_id}/note-type",
        response_model=Encounter,
        dependencies=[Depends(ctx.auth), Depends(ctx.one_at_a_time)],
    )
    def set_note_type(
        encounter_id: str, body: NoteTypeIn, who: Caller = Depends(ctx.auth)
    ) -> Encounter:
        enc = editable(encounter_id)
        ctx.allow(who, "note.edit", enc)
        if body.note_type not in note_types.NOTE_TYPES:
            raise HTTPException(400, "Unknown note type")
        before, enc.note_type = enc.note_type, body.note_type
        store.save(enc)
        store.audit(
            who.actor,
            "note_type_changed",
            enc.id,
            {"from": before, "to": enc.note_type},
        )
        return enc

    # ---------- last-plan checkboxes: asked to cover today ----------
    @app.put("/api/appointments/{appointment_id}/plan-checks")
    async def set_plan_checks(
        appointment_id: str, body: PlanChecksIn, who: Caller = Depends(ctx.auth)
    ) -> list[str]:
        """Keep the last plan's lines the provider ticked for this pet, with the
        visit. The draft gets them as asked to cover today."""
        appt = await adapter.get_appointment(appointment_id)
        if not appt:
            raise HTTPException(404, "Appointment not found")
        permissions.check(
            who, "visit.start", appt.vet_id, appt.vet_name, store, ownerless_ok=True
        )
        if body.patient_id not in {appt.patient.id, *(p.patient.id for p in appt.pets)}:
            raise HTTPException(400, "That pet isn't on this visit")
        kept = plan_checks.write(store, appointment_id, body.patient_id, body.lines)
        store.audit(
            who.actor,
            "plan_lines_ticked",
            None,
            {"appointment": appointment_id, "lines": len(kept)},
        )
        return kept

    @app.post(
        "/api/encounters/{encounter_id}/plan-reminders/{reminder_id}",
        response_model=Encounter,
        dependencies=[Depends(ctx.auth), Depends(ctx.one_at_a_time)],
    )
    def act_on_plan_reminder(
        encounter_id: str,
        reminder_id: str,
        body: PlanReminderIn,
        who: Caller = Depends(ctx.auth),
    ) -> Encounter:
        """A line from the last plan the visit didn't cover: added to the Plan by
        the provider, or dismissed. A reminder only: signing never waits on it."""
        enc = editable(encounter_id)
        ctx.allow(who, "note.edit", enc)
        found = next((r for r in enc.plan_reminders if r.id == reminder_id), None)
        if not found:
            raise HTTPException(404, "Reminder not found")
        found.status = body.action
        store.save(enc)
        store.audit(who.actor, f"plan_line_{body.action}", enc.id, {"line": found.id})
        return enc

    # ---------- edit tools: suggestions only, nothing is saved ----------
    @app.post("/api/encounters/{encounter_id}/assist", response_model=AssistOut)
    async def assist(
        encounter_id: str, body: AssistIn, who: Caller = Depends(ctx.auth)
    ) -> AssistOut:
        enc = editable(encounter_id)
        ctx.allow(who, "note.edit", enc)
        text = (
            body.text
            if body.text is not None
            else (getattr(enc.note, body.section) if enc.note else "")
        )
        appt, pets = None, [enc.patient_name]
        if body.action == "repull":
            if not enc.transcript.strip():
                raise HTTPException(400, "No transcript yet")
            appt = await ctx.appointment_for(enc)  # with this encounter's pet on it
            if not appt:
                raise HTTPException(404, "Appointment not found")
            pets = [
                p.name
                for p in await visit_pets(
                    adapter, appt, enc.patient_ids or [enc.patient_id]
                )
            ]
        out = await editor.assist(
            muse, enc, appt, pets, body.section, body.action, text, body.instruction
        )
        store.audit(
            who.actor,
            "assist_used",
            enc.id,
            {
                "section": body.section,
                "action": body.action,
                "refused": bool(out.refused),
                "mock": out.mock,
            },
        )
        return out

    # ---------- templates: the vet's and the clinic's saved phrases ----------
    if demo and not store.get_meta("templates_seeded"):
        for t in CLINIC_TEMPLATES:
            tid = uuid.uuid4().hex[:10]
            store.save_template("", {"id": tid, **t})
        store.set_meta("templates_seeded", "1")

    def visible(who: Caller) -> list[tuple[str, dict[str, Any]]]:
        found: list[tuple[str, dict[str, Any]]] = store.templates(["", who.actor])
        return found

    def shown(owner: str, body: dict[str, Any]) -> Template:
        return Template(**body, owner="clinic" if owner == "" else "me")

    def check(body: TemplateIn, who: Caller, skip_id: str = "") -> None:
        if not body.name.strip() or not body.text.strip():
            raise HTTPException(400, "A template needs a name and some text.")
        if len(body.text) > 4000:
            raise HTTPException(400, "Keep a template under 4,000 characters.")
        if not SHORTCUT.match(body.shortcut):
            raise HTTPException(
                400,
                "Shortcuts are lowercase letters and numbers, up to 24, like "
                "earnormal.",
            )
        if body.note_type and body.note_type not in note_types.NOTE_TYPES:
            raise HTTPException(400, "Unknown note type")
        if any(
            t["shortcut"] == body.shortcut and t["id"] != skip_id
            for _, t in visible(who)
        ):
            raise HTTPException(409, f"/{body.shortcut} is already a shortcut.")

    def owned(template_id: str, who: Caller) -> tuple[str, dict[str, Any]]:
        found = next(((o, t) for o, t in visible(who) if t["id"] == template_id), None)
        if not found:
            raise HTTPException(404, "Template not found")
        if found[0] == "" and not who.admin:
            raise HTTPException(403, "Only an admin can change the clinic's templates.")
        return found

    @app.get("/api/templates", response_model=list[Template])
    def list_templates(
        note_type: str = "", who: Caller = Depends(ctx.auth)
    ) -> list[Template]:
        out = [
            shown(o, t)
            for o, t in visible(who)
            if not note_type or t.get("note_type") in ("", note_type)
        ]
        return sorted(out, key=lambda t: (t.owner != "me", t.name.lower()))

    @app.post("/api/templates", response_model=Template)
    def add_template(body: TemplateIn, who: Caller = Depends(ctx.auth)) -> Template:
        permissions.check(who, "template.manage", store=store)
        if body.owner == "clinic" and not who.admin:
            raise HTTPException(403, "Only an admin can add a clinic template.")
        check(body, who)
        t = {"id": uuid.uuid4().hex[:10], **body.model_dump(exclude={"owner"})}
        owner = "" if body.owner == "clinic" else who.actor
        store.save_template(owner, t)
        store.audit(
            who.actor,
            "template_added",
            None,
            {"template": t["id"], "owner": body.owner},
        )
        return shown(owner, t)

    @app.put("/api/templates/{template_id}", response_model=Template)
    def update_template(
        template_id: str, body: TemplateIn, who: Caller = Depends(ctx.auth)
    ) -> Template:
        permissions.check(who, "template.manage", store=store)
        owner, _ = owned(template_id, who)
        check(body, who, skip_id=template_id)
        t = {"id": template_id, **body.model_dump(exclude={"owner"})}
        store.save_template(owner, t)
        store.audit(who.actor, "template_updated", None, {"template": template_id})
        return shown(owner, t)

    @app.delete("/api/templates/{template_id}")
    def delete_template(
        template_id: str, who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        permissions.check(who, "template.manage", store=store)
        owned(template_id, who)
        store.delete_template(template_id)
        store.audit(who.actor, "template_deleted", None, {"template": template_id})
        return {"ok": True}

    # ---------- booking links waiting on owners ----------
    @app.get("/api/followups/waiting")
    def waiting(who: Caller = Depends(ctx.auth)) -> list[dict[str, Any]]:
        """Links waiting on owners: a vet's own visits; every vet's for front office
        and admins."""
        items = booking_links.waiting_links(store)
        if not permissions.is_role(who, "vet"):
            return items
        mine = {e.id for e in store.list() if permissions.owns(who, e.provider_id)}
        return [i for i in items if i["encounter_id"] in mine]

    @app.post("/api/followups/{followup_id}/resend")
    async def resend(
        followup_id: str, who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        found = booking_links.find(store, followup_id)
        if not found:
            raise HTTPException(404, "Follow up not found")
        visit = found[0]
        permissions.check(
            who, "link.resend", visit.provider_id, visit.provider_name, store, visit.id
        )
        async with locked(found[0].id):
            enc = ctx.load(found[0].id)
            f = next(x for x in enc.followups if x.id == followup_id)
            if (
                not f.booking_link
                or f.booking_mode != "link"
                or booking_links.status_now(f.booking_link) not in booking_links.WAITING
            ):
                raise HTTPException(
                    409,
                    "Only a booking link that was sent and not booked can be "
                    "sent again.",
                )
            await ctx.send_text(enc, f, await ctx.appointment_for(enc))
            store.audit(
                who.actor,
                "booking_link_resent",
                enc.id,
                {"followup": f.id, "text": f.sms.status if f.sms else ""},
            )
            return booking_links.item(enc, f)

    # ---------- Remember: staff only, never in the note, summary, texts or the PIMS
    # ----------
    @app.get("/api/encounters/{encounter_id}/remember")
    async def remember_suggestions(
        encounter_id: str, who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        enc = ctx.load(encounter_id)
        # Built from the transcript: only the visit's own vet sees them.
        if not enc.note or not permissions.owns(who, enc.provider_id):
            return {"suggestions": [], "left_out": 0, "mock": not muse.enabled}
        return await remember.suggestions(store, muse, enc)

    @app.post("/api/encounters/{encounter_id}/remember")
    async def keep_remember(
        encounter_id: str, body: KeepIn, who: Caller = Depends(ctx.auth)
    ) -> list[dict[str, Any]]:
        enc = ctx.load(encounter_id)
        ctx.allow(who, "remember.keep", enc)
        if not enc.note:
            raise HTTPException(409, "Write the note first")
        await remember.suggestions(store, muse, enc)
        for change in remember.keep(store, enc, body.keep, who.actor):
            store.audit(
                who.actor,
                "remember_kept" if change["kept"] else "remember_unkept",
                enc.id,
                {"item": change["item"], "kind": change["kind"]},
            )
        return remember.kept_for_client(store, enc.client_id)

    @app.get("/api/clients/{client_id}/remember", dependencies=[Depends(ctx.auth)])
    def client_remember(client_id: str) -> list[dict[str, Any]]:
        return remember.kept_for_client(store, client_id)

    @app.delete("/api/clients/{client_id}/remember/{item_id}")
    def forget(
        client_id: str, item_id: str, who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        kept = remember.kept_for_client(store, client_id)  # unexpired only
        said = next((i for i in kept if i["id"] == item_id), None)
        if not said:
            raise HTTPException(404, "Nothing kept with that id")
        # Forgetting is the doctor's, like keeping. A visit that's gone has no doctor,
        # so only the API token or the open demo may forget its items.
        visit = store.get(said["encounter_id"])
        permissions.check(
            who,
            "remember.keep",
            visit.provider_id if visit else "",
            visit.provider_name if visit else "",
            store,
            said["encounter_id"] or None,
        )
        item = remember.delete(store, client_id, item_id)
        if not item:
            raise HTTPException(404, "Nothing kept with that id")
        store.audit(
            who.actor,
            "remember_deleted",
            item["encounter_id"],
            {"item": item_id, "kind": item["kind"], "client_id": client_id},
        )
        return {"ok": True}

    # ---------- share the owner summary ----------
    async def build_summary(enc: Encounter, lang: str) -> dict[str, Any]:
        # The visit details: the appointment and each pet as the practice system has
        # them. Nothing it doesn't have is made up.
        appt = await adapter.get_appointment(enc.appointment_id)
        animals = {appt.patient.id: appt.patient} if appt else {}
        for e in share.group_of(store, enc):
            if found := await adapter.get_patient(e.patient_id):
                animals[e.patient_id] = found
        return await share.summary(
            store,
            muse,
            await clinic_of(adapter),
            enc,
            lang,
            mock=demo,
            appt=appt,
            animals=animals,
        )

    @app.get("/api/encounters/{encounter_id}/summary", dependencies=[Depends(ctx.auth)])
    async def owner_summary(
        encounter_id: str, lang: Literal["en", "es"] = "en"
    ) -> dict[str, Any]:
        return await build_summary(signed(encounter_id), lang)

    @app.get(
        "/api/encounters/{encounter_id}/summary.pdf", dependencies=[Depends(ctx.auth)]
    )
    async def owner_summary_pdf(
        encounter_id: str, lang: Literal["en", "es"] = "en"
    ) -> Response:
        enc = signed(encounter_id)
        summary = await build_summary(enc, lang)
        body = share.summary_pdf(summary, share.photo_files(store, summary))
        name = (
            re.sub(r"[^A-Za-z0-9]+", "-", enc.patient_name or "visit").strip("-")
            or "visit"
        )
        return Response(
            body,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{name}-summary-{lang}.pdf"',
                "Cache-Control": "no-store",
            },
        )

    @app.post("/api/encounters/{encounter_id}/share")
    async def share_summary(
        encounter_id: str,
        body: ShareIn,
        request: Request,
        who: Caller = Depends(ctx.auth),
    ) -> dict[str, Any]:
        enc = ctx.load(encounter_id)
        # Front office shares any visit's; a vet only their own.
        permissions.check(
            who, "summary.share", enc.provider_id, enc.provider_name, store, enc.id
        )
        enc = signed(encounter_id)
        summary = await build_summary(
            enc, body.language
        )  # once: the pets, the clinic, and whether Spanish held
        pdf_url = f"/api/encounters/{enc.id}/summary.pdf?lang={body.language}"
        out = {
            "channel": body.channel,
            "language": body.language,
            "status": "ready",
            "detail": "",
            "text": "",
            "url": "",
            "pdf_url": pdf_url,
            "expires_at": None,
            "translated": summary["translated"],
        }
        if body.channel == "email":
            out["detail"] = (
                "Email isn't connected in this build. Download the PDF and attach it."
            )
        elif body.channel == "print":
            out["detail"] = "The PDF is ready to print."
        else:
            appt = await adapter.get_appointment(enc.appointment_id)
            if not appt:
                raise HTTPException(404, "Appointment not found")
            first, last = appt.client.first_name, appt.client.last_name
            if not last.strip():
                raise HTTPException(
                    409,
                    "We don't have the owner's last name, so the link can't "
                    "be protected. "
                    "Print or email the summary instead.",
                )
            token, expires = share.create_link(store, enc.id, body.language, last)
            base = (
                ctx.settings.public_url.rstrip("/") + "/"
                if ctx.settings.public_url
                else str(request.base_url)
            )
            url = f"{base}s/{token}"
            text = share.text_message(
                first,
                [p["name"] for p in summary["pets"]],
                summary["clinic"]["name"],
                url,
                body.language,
            )
            sms = await texter.send_text(text, appt)
            status = {"preview": "preview", "sent": "sent", "failed": "failed"}.get(
                sms.status, "ready"
            )
            detail = (
                sms.detail
                if sms.status != "skipped"
                else "Texting is off. Copy the link to share it."
            )
            out.update(
                status=status,
                detail=detail,
                text=text,
                url=url,
                expires_at=expires.isoformat(),
            )
        if not summary[
            "translated"
        ]:  # the owner's page and the PDF: part of the Spanish stayed in English
            out["detail"] = (
                out["detail"] + " Part of the Spanish summary stayed in English."
            ).strip()
        store.audit(
            who.actor,
            "summary_shared",
            enc.id,
            {
                "channel": body.channel,
                "language": body.language,
                "status": out["status"],
                "expires_at": out["expires_at"],
            },
        )
        return out

    # ---------- the owner's page: public, last name check, 14 days, locks after 5 wrong
    # tries ----------
    def owner_page(html: str, status: int = 200) -> HTMLResponse:
        return HTMLResponse(
            html,
            status,
            headers={
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
                "X-Robots-Tag": "noindex, nofollow",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
                # img-src data: for the photos the vet chose to show, embedded inline
                "Content-Security-Policy": "default-src 'none'; img-src data:; "
                "style-src 'unsafe-inline'; form-action "
                "'self'; "
                "base-uri 'none'; frame-ancestors 'none'",
            },
        )

    async def owner_link(token: str, last_name: str | None) -> HTMLResponse:
        clinic = await clinic_of(adapter)
        state, row = (
            share.open_link(store, token, last_name)
            if TOKEN.match(token)
            else ("missing", None)
        )
        lang = row["language"] if row else "en"
        enc = store.get(row["encounter_id"]) if row else None
        if state != "missing" and (
            not enc or not share.group_of(store, enc)
        ):  # the summary shows signed pets only
            state = "missing"
        if state in ("missing", "expired", "locked"):
            return owner_page(
                share.page_message(clinic, lang, state),
                {"missing": 404, "expired": 410, "locked": 423}[state],
            )
        assert row is not None and enc is not None  # else the link is "missing"
        if state == "ask":
            return owner_page(share.page_form(clinic, lang))
        if state == "wrong":
            error = share.LABELS[lang]["wrong"].format(n=row["tries_left"])
            return owner_page(share.page_form(clinic, lang, error), 401)
        store.audit("owner", "summary_opened", enc.id, {"language": lang})
        summary = await build_summary(enc, lang)
        return owner_page(
            share.page_summary(summary, share.photo_files(store, summary))
        )

    @app.get("/s/{token}", response_class=HTMLResponse, include_in_schema=False)
    async def owner_form(token: str) -> HTMLResponse:
        return await owner_link(token, None)

    @app.post("/s/{token}", response_class=HTMLResponse, include_in_schema=False)
    async def owner_open(
        token: str, last_name: str = Form("", max_length=80)
    ) -> HTMLResponse:
        return await owner_link(token, last_name)

    return {
        "set_plan_checks": set_plan_checks,
        "act_on_plan_reminder": act_on_plan_reminder,
        "list_note_types": list_note_types,
        "set_note_type": set_note_type,
        "assist": assist,
        "list_templates": list_templates,
        "add_template": add_template,
        "update_template": update_template,
        "delete_template": delete_template,
        "waiting": waiting,
        "resend": resend,
        "remember_suggestions": remember_suggestions,
        "keep_remember": keep_remember,
        "client_remember": client_remember,
        "forget": forget,
        "owner_summary": owner_summary,
        "share_summary": share_summary,
    }
