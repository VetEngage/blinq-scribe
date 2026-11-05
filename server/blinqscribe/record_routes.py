"""Patient record, household, search and the week strip: read only, from the practice
system."""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from . import day as days
from . import permissions, record
from .accounts import Caller
from .documents import SAFE_ID, Documents


def register(app: FastAPI, ctx: SimpleNamespace) -> dict[str, Any]:
    """Add the record routes. ctx carries settings, adapter, store, muse, assistant,
    auth and friends (see api.py).
    Returns the handlers: GraphQL resolves through them too."""
    adapter, store = ctx.adapter, ctx.store
    documents = Documents(store, ctx.muse)
    auth = [Depends(ctx.auth)]

    @app.get("/api/days", response_model=None)
    async def week_strip(
        start: date | None = Query(None, alias="from"),
        end: date | None = Query(None, alias="to"),
        provider_id: str = "",
        who: Caller = Depends(ctx.auth),
    ) -> list[dict[str, Any]]:
        """One entry per day, oldest first: visits, open and failed items, and the
        marker. Default: this week."""
        start = start or date.today() - timedelta(days=date.today().weekday())
        end = end or start + timedelta(days=6)
        if end < start or (end - start).days >= days.MAX_DAYS:
            raise HTTPException(400, f"Pick a range of 1 to {days.MAX_DAYS} days")
        provider_id = permissions.default_provider(who, provider_id)
        return await days.strip(adapter, store, start, end, provider_id)

    @app.get("/api/search", dependencies=auth, response_model=None)
    async def search(q: str = "") -> dict[str, Any]:
        return await record.search(adapter, q)

    @app.get(
        "/api/patients/{patient_id}/visits", dependencies=auth, response_model=None
    )
    async def patient_visits(
        patient_id: str,
        type: Literal["sick", "wellness", ""] = "",
        q: str = "",
        related_to: str = "",
        who: Caller = Depends(ctx.auth),
    ) -> list[dict[str, Any]]:
        """Past visits. Notes, medicines and photos are for vets; front office sees
        the visits themselves. Opening another vet's notes is logged."""
        rows = await record.visits(adapter, store, patient_id, type, q, related_to)
        if not permissions.sees_notes(who):
            return [{**r, "note": None, "medications": [], "photos": []} for r in rows]
        name = who.user.name if who.user else ""
        others = sorted(
            {r["provider_name"] for r in rows if r["note"] and r["provider_name"]}
            - {name}
        )
        if who.via == "session" and others:
            store.audit(
                who.actor,
                "notes_opened",
                None,
                {"patient_id": patient_id, "providers": others},
            )
        return rows

    @app.get(
        "/api/patients/{patient_id}/profile", dependencies=auth, response_model=None
    )
    async def patient_profile(patient_id: str) -> dict[str, Any]:
        found = await record.profile(adapter, patient_id, store)
        if not found:
            raise HTTPException(404, "Patient not found")
        return found

    @app.get("/api/patients/{patient_id}/panel", response_model=None)
    async def record_panel(
        patient_id: str, who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        """The Record side panel on a visit page (record.panel). Read only, any role.
        Recent visits are lines, never notes, so opening the panel reads no one's
        notes."""
        found = await record.panel(adapter, store, patient_id)
        if not found:
            raise HTTPException(404, "Patient not found")
        return found

    @app.get(
        "/api/clients/{client_id}/invoices", dependencies=auth, response_model=None
    )
    async def client_invoices(client_id: str, patient_id: str = "") -> dict[str, Any]:
        found = await record.invoices(adapter, client_id, patient_id)
        if not found:
            raise HTTPException(404, "Client not found")
        return found

    @app.get(
        "/api/clients/{client_id}/household", dependencies=auth, response_model=None
    )
    async def client_household(client_id: str) -> dict[str, Any]:
        found = await record.household(adapter, store, client_id)
        if not found:
            raise HTTPException(404, "Client not found")
        return found

    # ---------- outside records ----------
    @app.get(
        "/api/patients/{patient_id}/documents", dependencies=auth, response_model=None
    )
    def patient_documents(patient_id: str) -> list[dict[str, Any]]:
        return documents.list(patient_id)

    @app.post("/api/patients/{patient_id}/documents", response_model=None)
    async def add_document(
        patient_id: str, file: UploadFile = File(...), who: Caller = Depends(ctx.auth)
    ) -> dict[str, Any]:
        permissions.check(who, "record.upload", store=store)
        if not SAFE_ID.match(patient_id) or not await adapter.get_patient(patient_id):
            raise HTTPException(404, "Patient not found")
        data = await ctx.read_upload(file)
        try:
            doc = await documents.add(patient_id, file.filename or "record", data)
        except ValueError as exc:
            raise HTTPException(415, str(exc)) from exc
        store.audit(
            who.actor,
            "document_added",
            None,
            {
                "patient_id": patient_id,
                "document": doc["id"],
                "pages": doc["pages"],
                "key_points": len(doc["key_points"]),
            },
        )
        return doc

    @app.get("/api/patients/{patient_id}/documents/{doc_id}/file", dependencies=auth)
    def document_file(patient_id: str, doc_id: str) -> FileResponse:
        doc = documents.get(patient_id, doc_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        safe = (
            "".join(ch for ch in doc["name"] if ch.isascii() and ch not in '"\\')
            or "record"
        )
        return FileResponse(
            doc["path"],
            media_type=doc["content_type"],
            headers={"Content-Disposition": f'inline; filename="{safe}"'},
        )

    return {
        "week_strip": week_strip,
        "search": search,
        "patient_visits": patient_visits,
        "patient_profile": patient_profile,
        "record_panel": record_panel,
        "client_invoices": client_invoices,
        "client_household": client_household,
        "patient_documents": patient_documents,
        "add_document": add_document,
    }
