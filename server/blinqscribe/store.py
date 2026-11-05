"""The store: encounters (JSON with indexed lookup columns), synced notes, the audit
log and the smaller tables, on PostgreSQL or SQLite (see db.py)."""

from __future__ import annotations

import builtins
import contextlib
import json
import os
import threading
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import peewee

from . import db
from .db import (
    AuditRow,
    DocumentRow,
    EncounterRow,
    InviteRow,
    LetterLinkRow,
    LetterRow,
    MetaRow,
    OauthHandoffRow,
    OauthIdentityRow,
    OauthStateRow,
    PasswordResetRow,
    PimsNoteRow,
    RememberRow,
    SessionRow,
    ShareRow,
    SignInCodeRow,
    TemplateRow,
    UserRow,
)
from .schemas import Encounter, PastNote


def _visit_day(enc: Encounter) -> str:
    from .day import visit_day  # day.py reads the store, so imported here

    return visit_day(enc).isoformat()


class Store:
    def __init__(self, data_dir: Path, database_url: str | None = None):
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "media").mkdir(exist_ok=True)
        self.media_dir = data_dir / "media"
        if database_url is None:
            database_url = os.environ.get("DATABASE_URL", "").strip()
        db.migrate(database_url, data_dir)
        self.db = db.connect(database_url, data_dir)
        # SQLite takes one writer at a time, so its calls take turns, as they always
        # have, on one connection per thread. On PostgreSQL each call borrows a
        # connection from the process's pool and gives it back.
        self._postgres = bool(database_url)
        self._lock = threading.Lock()

    @contextlib.contextmanager
    def _turn(self) -> Iterator[None]:
        if self._postgres:
            with self.db.connection_context(), self.db.atomic():
                yield
        else:
            with self._lock, self.db.atomic():
                yield

    def run(
        self, sql: str, args: tuple[Any, ...] = ()
    ) -> builtins.list[tuple[Any, ...]]:
        """Raw SQL with ? placeholders, for tests and one-off maintenance only: the app
        uses the methods below. Returns any rows."""
        with self._turn():
            query = peewee.RawQuery(sql.replace("?", self.db.param), args)
            cursor = query.bind(self.db).execute().cursor
            rows: builtins.list[tuple[Any, ...]] = (
                cursor.fetchall() if cursor.description else []
            )
            return rows

    # ---------- encounters ----------
    def save(self, enc: Encounter) -> Encounter:
        with self._turn():
            self._write(enc)
        return enc

    def update(
        self, encounter_id: str, change: Callable[[Encounter], object]
    ) -> Encounter | None:
        """Re-read the encounter, apply `change` and save it, in one transaction:
        nobody's write lands in between (the row is locked on PostgreSQL; on SQLite
        the store's calls take turns). For code that awaits something slow, then
        saves only the fields it owns. Returns the saved encounter, or None."""
        query = EncounterRow.select(EncounterRow.body).where(
            EncounterRow.id == encounter_id
        )
        if self._postgres:
            query = query.for_update()
        with self._turn():
            row = query.bind(self.db).first()
            if not row:
                return None
            enc = Encounter.model_validate_json(row.body)
            change(enc)
            self._write(enc)
        return enc

    def _write(self, enc: Encounter) -> None:
        row = {
            EncounterRow.body: enc.model_dump_json(),
            EncounterRow.group_id: enc.group_id or enc.id,
            EncounterRow.patient_id: enc.patient_id,
            EncounterRow.appointment_id: enc.appointment_id,
            EncounterRow.visit_day: _visit_day(enc),
            EncounterRow.pims_next_try_at: enc.pims_next_try_at.isoformat()
            if enc.pims_next_try_at
            else "",
            EncounterRow.created_at: enc.created_at.isoformat(),
        }
        EncounterRow.insert({EncounterRow.id: enc.id, **row}).on_conflict(
            conflict_target=[EncounterRow.id], update=row
        ).execute(self.db)

    def get(self, encounter_id: str) -> Encounter | None:
        with self._turn():
            row = (
                EncounterRow.select(EncounterRow.body)
                .where(EncounterRow.id == encounter_id)
                .bind(self.db)
                .first()
            )
        return Encounter.model_validate_json(row.body) if row else None

    def list(
        self,
        group_id: str | None = None,
        patient_id: str | None = None,
        visit_day: date | None = None,
        appointment_id: str | None = None,
    ) -> builtins.list[Encounter]:
        """Encounters, newest first; each filter given narrows them."""
        query = EncounterRow.select(EncounterRow.body)
        for column, value in (
            (EncounterRow.group_id, group_id),
            (EncounterRow.patient_id, patient_id),
            (EncounterRow.visit_day, visit_day.isoformat() if visit_day else None),
            (EncounterRow.appointment_id, appointment_id),
        ):
            if value is not None:
                query = query.where(column == value)
        with self._turn():
            bodies = [r.body for r in query.bind(self.db)]
        return sorted(
            (Encounter.model_validate_json(b) for b in bodies),
            key=lambda e: e.created_at,
            reverse=True,
        )

    def pims_retries(self) -> builtins.list[Encounter]:
        """Encounters with a failed save to the PIMS waiting to be tried again."""
        query = EncounterRow.select(EncounterRow.body).where(
            EncounterRow.pims_next_try_at != ""
        )
        with self._turn():
            bodies = [r.body for r in query.bind(self.db)]
        return [Encounter.model_validate_json(b) for b in bodies]

    # ---------- notes synced from the practice system ----------
    def upsert_notes(self, notes: builtins.list[PastNote]) -> None:
        with self._turn():
            self._upsert_notes(notes)

    def _upsert_notes(self, notes: builtins.list[PastNote]) -> None:
        for n in notes:
            row = {
                PimsNoteRow.patient_id: n.patient_id,
                PimsNoteRow.provider_id: n.provider_id,
                PimsNoteRow.date: n.date.isoformat(),
                PimsNoteRow.body: n.model_dump_json(),
            }
            PimsNoteRow.insert({PimsNoteRow.id: n.id, **row}).on_conflict(
                conflict_target=[PimsNoteRow.id], update=row
            ).execute(self.db)

    def replace_patient_notes(
        self, patient_id: str, notes: builtins.list[PastNote], since: datetime
    ) -> int:
        """Make this patient's notes inside the window exactly `notes`. Returns how
        many were removed."""
        with self._turn():
            removed: int = (
                peewee.ModelDelete(PimsNoteRow)
                .where(
                    (PimsNoteRow.patient_id == patient_id)
                    & (PimsNoteRow.date >= since.isoformat())
                    & PimsNoteRow.id.not_in([n.id for n in notes])
                )
                .execute(self.db)
            )
            self._upsert_notes(notes)
        return removed

    def notes(
        self,
        patient_id: str | None = None,
        provider_id: str | None = None,
        since: datetime | None = None,
    ) -> builtins.list[PastNote]:
        """Synced notes, newest first."""
        query = PimsNoteRow.select(PimsNoteRow.body).order_by(PimsNoteRow.date.desc())
        if patient_id is not None:
            query = query.where(PimsNoteRow.patient_id == patient_id)
        if provider_id is not None:
            query = query.where(PimsNoteRow.provider_id == provider_id)
        if since:
            query = query.where(PimsNoteRow.date >= since.isoformat())
        with self._turn():
            bodies = [r.body for r in query.bind(self.db)]
        return [PastNote.model_validate_json(b) for b in bodies]

    def purge_notes(self, before: datetime) -> int:
        with self._turn():
            purged: int = (
                peewee.ModelDelete(PimsNoteRow)
                .where(PimsNoteRow.date < before.isoformat())
                .execute(self.db)
            )
        return purged

    # ---------- meta ----------
    def get_meta(self, key: str) -> str | None:
        with self._turn():
            row = MetaRow.select().where(MetaRow.key == key).bind(self.db).first()
        return str(row.value) if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self._turn():
            MetaRow.insert(key=key, value=value).on_conflict(
                conflict_target=[MetaRow.key], update={MetaRow.value: value}
            ).execute(self.db)

    # ---------- audit ----------
    def audit(
        self,
        actor: str,
        action: str,
        encounter_id: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        with self._turn():
            AuditRow.insert(
                ts=datetime.now(UTC).isoformat(),
                actor=actor,
                action=action,
                encounter_id=encounter_id,
                detail=json.dumps(detail or {}),
            ).execute(self.db)

    def audit_log(self, encounter_id: str) -> builtins.list[dict[str, Any]]:
        query = (
            AuditRow.select()
            .where(AuditRow.encounter_id == encounter_id)
            .order_by(AuditRow.ts, AuditRow.id)
        )
        with self._turn():
            rows = builtins.list(query.bind(self.db))
        return [
            {
                "ts": r.ts,
                "actor": r.actor,
                "action": r.action,
                "detail": json.loads(r.detail or "{}"),
            }
            for r in rows
        ]

    # ---------- Remember ----------
    def add_remember(
        self,
        visit_key: str,
        client_id: str,
        patient_id: str,
        bodies: builtins.list[dict[str, Any]],
    ) -> None:
        """New suggestions for one visit, in the order they were said."""
        with self._turn():
            for position, body in enumerate(bodies):
                RememberRow.insert(
                    id=body["id"],
                    visit_key=visit_key,
                    client_id=client_id,
                    patient_id=patient_id,
                    kept=0,
                    body=json.dumps(body),
                    position=position,
                ).execute(self.db)

    def remember_for_visit(
        self, visit_key: str
    ) -> builtins.list[tuple[str, bool, dict[str, Any]]]:
        """(id, kept, body) for each suggestion from this visit, in order."""
        query = (
            RememberRow.select()
            .where(RememberRow.visit_key == visit_key)
            .order_by(RememberRow.position)
        )
        with self._turn():
            rows = builtins.list(query.bind(self.db))
        return [(str(r.id), bool(r.kept), json.loads(r.body)) for r in rows]

    def set_remember_kept(
        self, item_id: str, kept: bool, expires_at: str | None, body: dict[str, Any]
    ) -> None:
        with self._turn():
            RememberRow.update(
                kept=int(kept), expires_at=expires_at, body=json.dumps(body)
            ).where(RememberRow.id == item_id).execute(self.db)

    def kept_remember(
        self,
        alive_at: datetime | None = None,
        client_id: str | None = None,
        patient_id: str | None = None,
        item_id: str | None = None,
    ) -> builtins.list[dict[str, Any]]:
        """Kept items (only those not expired at `alive_at`, when given), narrowed by
        each filter given."""
        query = RememberRow.select(RememberRow.body).where(RememberRow.kept == 1)
        if alive_at:
            query = query.where(RememberRow.expires_at > alive_at.isoformat())
        for column, value in (
            (RememberRow.client_id, client_id),
            (RememberRow.patient_id, patient_id),
            (RememberRow.id, item_id),
        ):
            if value is not None:
                query = query.where(column == value)
        with self._turn():
            bodies = [r.body for r in query.bind(self.db)]
        return [json.loads(b) for b in bodies]

    def delete_remember(self, item_id: str) -> None:
        with self._turn():
            peewee.ModelDelete(RememberRow).where(RememberRow.id == item_id).execute(
                self.db
            )

    def purge_remember(self, now: datetime) -> int:
        """Delete kept items whose time is up. Returns how many."""
        with self._turn():
            purged: int = (
                peewee.ModelDelete(RememberRow)
                .where(
                    (RememberRow.kept == 1) & (RememberRow.expires_at < now.isoformat())
                )
                .execute(self.db)
            )
        return purged

    # ---------- templates ----------
    def templates(
        self, owners: builtins.list[str]
    ) -> builtins.list[tuple[str, dict[str, Any]]]:
        """(owner, body) for the templates of these owners ('' is the clinic)."""
        query = TemplateRow.select().where(TemplateRow.owner_user.in_(owners))
        with self._turn():
            rows = builtins.list(query.bind(self.db))
        return [(str(r.owner_user), json.loads(r.body)) for r in rows]

    def save_template(self, owner: str, body: dict[str, Any]) -> None:
        """Add a template, or change one's text (its owner never changes)."""
        raw = json.dumps(body)
        with self._turn():
            TemplateRow.insert(id=body["id"], owner_user=owner, body=raw).on_conflict(
                conflict_target=[TemplateRow.id], update={TemplateRow.body: raw}
            ).execute(self.db)

    def delete_template(self, template_id: str) -> None:
        with self._turn():
            peewee.ModelDelete(TemplateRow).where(
                TemplateRow.id == template_id
            ).execute(self.db)

    # ---------- owner summary links ----------
    def add_share(
        self,
        token: str,
        encounter_id: str,
        language: str,
        name_hash: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> None:
        with self._turn():
            ShareRow.insert(
                token=token,
                encounter_id=encounter_id,
                language=language,
                name_hash=name_hash,
                created_at=created_at.isoformat(),
                expires_at=expires_at.isoformat(),
            ).execute(self.db)

    def share(self, token: str) -> ShareRow | None:
        with self._turn():
            row: ShareRow | None = (
                ShareRow.select().where(ShareRow.token == token).bind(self.db).first()
            )
        return row

    def share_tried(self, token: str, ok: bool) -> None:
        """Count a wrong last name, or start the count again after a right one."""
        failures = 0 if ok else ShareRow.failures + 1
        with self._turn():
            ShareRow.update(failures=failures).where(ShareRow.token == token).execute(
                self.db
            )

    # ---------- outside records ----------
    def add_document(self, body: dict[str, Any]) -> None:
        with self._turn():
            DocumentRow.insert(
                id=body["id"], patient_id=body["patient_id"], body=json.dumps(body)
            ).execute(self.db)

    def documents(
        self, patient_id: str, doc_id: str | None = None
    ) -> builtins.list[dict[str, Any]]:
        query = DocumentRow.select(DocumentRow.body).where(
            DocumentRow.patient_id == patient_id
        )
        if doc_id is not None:
            query = query.where(DocumentRow.id == doc_id)
        with self._turn():
            bodies = [r.body for r in query.bind(self.db)]
        return [json.loads(b) for b in bodies]

    # ---------- referral letters ----------
    def save_letter(
        self,
        letter_id: str,
        patient_id: str,
        encounter_id: str,
        status: str,
        created_at: str,
        body: str,
    ) -> None:
        """Add or replace a letter (body is the whole letter as JSON)."""
        with self._turn():
            LetterRow.insert(
                id=letter_id,
                patient_id=patient_id,
                encounter_id=encounter_id,
                status=status,
                created_at=created_at,
                body=body,
            ).on_conflict(
                conflict_target=[LetterRow.id],
                update={LetterRow.status: status, LetterRow.body: body},
            ).execute(self.db)

    def letter(self, letter_id: str) -> str | None:
        """The letter's JSON."""
        query = LetterRow.select(LetterRow.body).where(LetterRow.id == letter_id)
        with self._turn():
            row = query.bind(self.db).first()
        return str(row.body) if row else None

    def recent_letters(self, limit: int) -> builtins.list[str]:
        """The newest letters for every patient, as JSON (saved contacts)."""
        query = (
            LetterRow.select(LetterRow.body)
            .order_by(LetterRow.created_at.desc())
            .limit(limit)
        )
        with self._turn():
            return [str(r.body) for r in query.bind(self.db)]

    def letters(self, patient_id: str) -> builtins.list[str]:
        """Every letter for a patient, newest first, as JSON."""
        query = (
            LetterRow.select(LetterRow.body)
            .where(LetterRow.patient_id == patient_id)
            .order_by(LetterRow.created_at.desc())
        )
        with self._turn():
            return [str(r.body) for r in query.bind(self.db)]

    def delete_letter(self, letter_id: str) -> None:
        """The letter and any owner link to it: no link outlives its letter."""
        with self._turn():
            peewee.ModelDelete(LetterLinkRow).where(
                LetterLinkRow.letter_id == letter_id
            ).execute(self.db)
            peewee.ModelDelete(LetterRow).where(LetterRow.id == letter_id).execute(
                self.db
            )

    def add_letter_link(
        self,
        token: str,
        letter_id: str,
        name_hash: str,
        created_at: datetime,
        expires_at: datetime,
        kind: str = "owner",
    ) -> None:
        with self._turn():
            LetterLinkRow.insert(
                token=token,
                letter_id=letter_id,
                name_hash=name_hash,
                created_at=created_at.isoformat(),
                expires_at=expires_at.isoformat(),
                kind=kind,
            ).execute(self.db)

    def letter_link(self, token: str) -> LetterLinkRow | None:
        query = LetterLinkRow.select().where(LetterLinkRow.token == token)
        with self._turn():
            row: LetterLinkRow | None = query.bind(self.db).first()
        return row

    def letter_link_tried(self, token: str, ok: bool, most: int) -> int | None:
        """Start the count again after a right last name, or count a wrong one in a
        single UPDATE that stops at `most`. Returns the count, or None when the
        link was already locked."""
        where = LetterLinkRow.token == token
        with self._turn():
            if ok:
                LetterLinkRow.update(failures=0).where(where).execute(self.db)
                return 0
            changed = (
                LetterLinkRow.update(failures=LetterLinkRow.failures + 1)
                .where(where & (LetterLinkRow.failures < most))
                .execute(self.db)
            )
            if not changed:
                return None
            row = LetterLinkRow.select(LetterLinkRow.failures).where(where)
            found = row.bind(self.db).first()
        return int(found.failures) if found else None

    # ---------- accounts ----------
    def users(self, **where: str | int) -> builtins.list[UserRow]:
        """People, by name; each keyword (id, username, provider_id, active) narrows."""
        query = UserRow.select().order_by(UserRow.name)
        for column, value in where.items():
            query = query.where(getattr(UserRow, column) == value)
        with self._turn():
            return builtins.list(query.bind(self.db))

    def any_users(self, except_username: str = "") -> bool:
        query = UserRow.select().where(UserRow.username != except_username)
        with self._turn():
            found: bool = query.bind(self.db).exists()
        return found

    def user_by_login(self, login: str) -> UserRow | None:
        """The person whose username, or email when set, is `login`."""
        query = UserRow.select().where(
            (UserRow.username == login)
            | ((UserRow.email == login) & (UserRow.email != ""))
        )
        with self._turn():
            row: UserRow | None = query.bind(self.db).first()
        return row

    def add_user(self, **fields: str | int) -> None:
        with self._turn():
            UserRow.insert(**fields).execute(self.db)

    def update_user(self, user_id: str, **fields: str | int | None) -> None:
        with self._turn():
            UserRow.update(**fields).where(UserRow.id == user_id).execute(self.db)

    def set_invite(self, user_id: str, token_hash: str, expires: datetime) -> None:
        """The person's only open invite: any earlier one stops working."""
        with self._turn():
            peewee.ModelDelete(InviteRow).where(InviteRow.user_id == user_id).execute(
                self.db
            )
            InviteRow.insert(
                token_hash=token_hash, user_id=user_id, expires=expires.isoformat()
            ).execute(self.db)

    def invite(self, token_hash: str) -> InviteRow | None:
        with self._turn():
            row: InviteRow | None = (
                InviteRow.select()
                .where(InviteRow.token_hash == token_hash)
                .bind(self.db)
                .first()
            )
        return row

    def add_session(
        self, user_id: str, token_hash: str, expires: datetime, remember: bool
    ) -> None:
        now = datetime.now(UTC).isoformat()
        with self._turn():
            SessionRow.insert(
                token_hash=token_hash,
                user_id=user_id,
                expires=expires.isoformat(),
                remember=int(remember),
                created_at=now,
            ).execute(self.db)

    def session(self, token_hash: str) -> SessionRow | None:
        with self._turn():
            row: SessionRow | None = (
                SessionRow.select()
                .where(SessionRow.token_hash == token_hash)
                .bind(self.db)
                .first()
            )
        return row

    def end_sessions(
        self,
        user_id: str | None = None,
        token_hash: str | None = None,
        keep_token_hash: str | None = None,
    ) -> None:
        """Sign out everywhere (user_id), or one session (token_hash).
        keep_token_hash: with user_id, everywhere but this session."""
        where: peewee.Expression = (
            SessionRow.user_id == user_id
            if user_id is not None
            else SessionRow.token_hash == token_hash
        )
        if keep_token_hash is not None:
            where = where & (SessionRow.token_hash != keep_token_hash)
        with self._turn():
            peewee.ModelDelete(SessionRow).where(where).execute(self.db)

    def end_invites(self, user_id: str) -> None:
        with self._turn():
            peewee.ModelDelete(InviteRow).where(InviteRow.user_id == user_id).execute(
                self.db
            )

    # ---------- sign in: 2FA codes, reset links, Google and Microsoft ----------
    def add_sign_in_code(
        self,
        ticket_hash: str,
        user_id: str,
        code_hash: str,
        remember: bool,
        expires: datetime,
        method: str = "email",
    ) -> None:
        """method "app": the authenticator's code; code_hash is set only once an
        emailed backup code is asked for."""
        with self._turn():
            SignInCodeRow.insert(
                ticket_hash=ticket_hash,
                user_id=user_id,
                code_hash=code_hash,
                remember=int(remember),
                expires=expires.isoformat(),
                method=method,
            ).execute(self.db)

    def claim_totp_step(self, user_id: str, step: int) -> bool:
        """Mark an authenticator code's time step used, in one conditional UPDATE:
        True only for the first caller, so a code can't sign in twice at once."""
        with self._turn():
            changed: int = (
                UserRow.update(totp_last_step=step)
                .where((UserRow.id == user_id) & (UserRow.totp_last_step < step))
                .execute(self.db)
            )
        return changed > 0

    def sign_in_code(self, ticket_hash: str) -> SignInCodeRow | None:
        query = SignInCodeRow.select().where(SignInCodeRow.ticket_hash == ticket_hash)
        with self._turn():
            row: SignInCodeRow | None = query.bind(self.db).first()
        return row

    def sign_in_code_missed(self, ticket_hash: str) -> None:
        with self._turn():
            SignInCodeRow.update(tries=SignInCodeRow.tries + 1).where(
                SignInCodeRow.ticket_hash == ticket_hash
            ).execute(self.db)

    def resend_sign_in_code(
        self, ticket_hash: str, code_hash: str, expires: datetime
    ) -> None:
        with self._turn():
            SignInCodeRow.update(
                code_hash=code_hash,
                sends=SignInCodeRow.sends + 1,
                expires=expires.isoformat(),
            ).where(SignInCodeRow.ticket_hash == ticket_hash).execute(self.db)

    def end_sign_in_code(self, ticket_hash: str) -> None:
        with self._turn():
            peewee.ModelDelete(SignInCodeRow).where(
                SignInCodeRow.ticket_hash == ticket_hash
            ).execute(self.db)

    def set_password_reset(
        self, user_id: str, token_hash: str, expires: datetime
    ) -> None:
        """The person's only open reset link: any earlier one stops working."""
        with self._turn():
            peewee.ModelDelete(PasswordResetRow).where(
                PasswordResetRow.user_id == user_id
            ).execute(self.db)
            PasswordResetRow.insert(
                token_hash=token_hash, user_id=user_id, expires=expires.isoformat()
            ).execute(self.db)

    def password_reset(self, token_hash: str) -> PasswordResetRow | None:
        query = PasswordResetRow.select().where(
            PasswordResetRow.token_hash == token_hash
        )
        with self._turn():
            row: PasswordResetRow | None = query.bind(self.db).first()
        return row

    def end_password_resets(self, user_id: str) -> None:
        with self._turn():
            peewee.ModelDelete(PasswordResetRow).where(
                PasswordResetRow.user_id == user_id
            ).execute(self.db)

    def add_oauth_state(
        self,
        state_hash: str,
        provider: str,
        verifier: str,
        nonce: str,
        remember: bool,
        expires: datetime,
        link_user_id: str,
        browser_hash: str,
    ) -> None:
        """Also clears states nobody came back for."""
        with self._turn():
            peewee.ModelDelete(OauthStateRow).where(
                OauthStateRow.expires < datetime.now(UTC).isoformat()
            ).execute(self.db)
            OauthStateRow.insert(
                state_hash=state_hash,
                provider=provider,
                verifier=verifier,
                nonce=nonce,
                remember=int(remember),
                expires=expires.isoformat(),
                link_user_id=link_user_id,
                browser_hash=browser_hash,
            ).execute(self.db)

    def take_oauth_state(self, state_hash: str) -> OauthStateRow | None:
        """The state, which can be used only once."""
        where = OauthStateRow.state_hash == state_hash
        with self._turn():
            row: OauthStateRow | None = (
                OauthStateRow.select().where(where).bind(self.db).first()
            )
            peewee.ModelDelete(OauthStateRow).where(where).execute(self.db)
        return row

    def add_oauth_handoff(
        self,
        code_hash: str,
        user_id: str,
        remember: bool,
        expires: datetime,
        kind: str = "sign_in",
        provider: str = "",
        subject: str = "",
        email: str = "",
    ) -> None:
        """kind sign_in, or link with the provider account to connect."""
        with self._turn():
            OauthHandoffRow.insert(
                code_hash=code_hash,
                user_id=user_id,
                remember=int(remember),
                expires=expires.isoformat(),
                kind=kind,
                provider=provider,
                subject=subject,
                email=email,
            ).execute(self.db)

    def take_oauth_handoff(self, code_hash: str) -> OauthHandoffRow | None:
        """The hand-off code, which can be used only once."""
        where = OauthHandoffRow.code_hash == code_hash
        with self._turn():
            row: OauthHandoffRow | None = (
                OauthHandoffRow.select().where(where).bind(self.db).first()
            )
            peewee.ModelDelete(OauthHandoffRow).where(where).execute(self.db)
        return row

    def oauth_identity_user(self, provider: str, subject: str) -> str | None:
        """The id of the person this Google or Microsoft account signs in as."""
        query = OauthIdentityRow.select(OauthIdentityRow.user_id).where(
            (OauthIdentityRow.provider == provider)
            & (OauthIdentityRow.subject == subject)
        )
        with self._turn():
            row = query.bind(self.db).first()
        return str(row.user_id) if row else None

    def link_oauth_identity(
        self, provider: str, subject: str, user_id: str, replace: bool, email: str = ""
    ) -> None:
        """Connect an account to a person. replace: it becomes their only one from
        this provider; otherwise an account already connected is left as it is."""
        with self._turn():
            if replace:
                peewee.ModelDelete(OauthIdentityRow).where(
                    (OauthIdentityRow.provider == provider)
                    & (OauthIdentityRow.user_id == user_id)
                ).execute(self.db)
            OauthIdentityRow.insert(
                provider=provider,
                subject=subject,
                user_id=user_id,
                email=email,
                connected_at=datetime.now(UTC).isoformat(),
            ).on_conflict_ignore().execute(self.db)

    def oauth_identities(self, user_id: str) -> builtins.list[OauthIdentityRow]:
        """The Google and Microsoft accounts connected to this person."""
        query = (
            OauthIdentityRow.select()
            .where(OauthIdentityRow.user_id == user_id)
            .order_by(OauthIdentityRow.provider)
        )
        with self._turn():
            return builtins.list(query.bind(self.db))

    def unlink_oauth_identity_unless_last(
        self, provider: str, user_id: str, keep_one: bool
    ) -> str:
        """Disconnect, checked and done in one transaction. keep_one: refuse if it
        is the person's only connected account. Returns "ok", "missing" or
        "last"."""
        mine = OauthIdentityRow.user_id == user_id
        this = mine & (OauthIdentityRow.provider == provider)
        with self._turn():
            if not OauthIdentityRow.select().where(this).bind(self.db).exists():
                return "missing"
            if (
                keep_one
                and OauthIdentityRow.select().where(mine).bind(self.db).count() <= 1
            ):
                return "last"
            peewee.ModelDelete(OauthIdentityRow).where(this).execute(self.db)
        return "ok"
