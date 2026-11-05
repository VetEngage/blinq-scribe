"""Columns for the lookups the server makes, and keys PostgreSQL needs.

Encounters keep their JSON body and gain indexed group_id (the visit's group, or the
encounter's own id when it has none), patient_id, appointment_id and visit_day,
filled in from the body, plus created_at. The audit
log gets an id, and Remember a position, in place of SQLite's hidden rowid.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-31
"""

import json
from collections.abc import Sequence
from datetime import date, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENCOUNTER_COLUMNS = ("group_id", "patient_id", "appointment_id", "visit_day")


def _visit_day(appointment_id: str, created_at: str) -> str:
    """The appointment's day when its id carries one, else the local day it began."""
    _, _, on = appointment_id.partition("@")
    try:
        return date.fromisoformat(on).isoformat()
    except ValueError:
        pass
    try:
        started = datetime.fromisoformat(created_at)
    except ValueError:
        return ""
    return (started.astimezone() if started.tzinfo else started).date().isoformat()


def upgrade() -> None:
    bind = op.get_bind()
    postgres = bind.dialect.name == "postgresql"

    for column in (*_ENCOUNTER_COLUMNS, "created_at"):
        op.add_column(
            "encounters",
            sa.Column(column, sa.Text(), nullable=False, server_default=""),
        )
    rows = bind.execute(sa.text("SELECT id, body FROM encounters")).fetchall()
    for encounter_id, raw in rows:
        body = json.loads(raw)
        appointment_id = body.get("appointment_id") or ""
        created_at = body.get("created_at") or ""
        bind.execute(
            sa.text(
                "UPDATE encounters SET group_id = :g, patient_id = :p, "
                "appointment_id = :a, visit_day = :d, created_at = :c WHERE id = :id"
            ),
            {
                "g": body.get("group_id") or encounter_id,
                "p": body.get("patient_id") or "",
                "a": appointment_id,
                "d": _visit_day(appointment_id, created_at),
                "c": created_at,
                "id": encounter_id,
            },
        )
    for column in _ENCOUNTER_COLUMNS:
        op.create_index(f"encounters_{column}", "encounters", [column])

    if postgres:
        op.execute("ALTER TABLE audit ADD COLUMN id BIGSERIAL PRIMARY KEY")
    else:  # SQLite can't add a key to a table, so the log is copied in order
        op.execute(
            "CREATE TABLE audit_new (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, "
            "encounter_id TEXT, detail TEXT)"
        )
        op.execute(
            "INSERT INTO audit_new (ts, actor, action, encounter_id, detail) "
            "SELECT ts, actor, action, encounter_id, detail FROM audit ORDER BY rowid"
        )
        op.execute("DROP TABLE audit")
        op.execute("ALTER TABLE audit_new RENAME TO audit")
    op.create_index("audit_encounter", "audit", ["encounter_id"])

    op.add_column(
        "remember",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    if not postgres:
        op.execute("UPDATE remember SET position = rowid")
    op.create_index("remember_patient", "remember", ["patient_id"])


def downgrade() -> None:
    op.drop_index("remember_patient", "remember")
    with op.batch_alter_table("remember") as batch:
        batch.drop_column("position")
    op.drop_index("audit_encounter", "audit")
    with op.batch_alter_table("audit") as batch:
        batch.drop_column("id")
    for column in _ENCOUNTER_COLUMNS:
        op.drop_index(f"encounters_{column}", "encounters")
    with op.batch_alter_table("encounters") as batch:
        for column in (*_ENCOUNTER_COLUMNS, "created_at"):
            batch.drop_column(column)
