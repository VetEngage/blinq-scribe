"""The schema as it was before migrations: SQLite tables created by the server.

A database made before migrations already has some or all of these tables, so each
one is created only when it is missing, and that database is adopted as it is.

Revision ID: 0001
Revises:
Create Date: 2026-10-31
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _text(
    name: str,
    *,
    nullable: bool = False,
    primary_key: bool = False,
    unique: bool = False,
) -> sa.Column[str]:
    return sa.Column(
        name, sa.Text(), nullable=nullable, primary_key=primary_key, unique=unique
    )


def upgrade() -> None:
    have = set(sa.inspect(op.get_bind()).get_table_names())

    def table(name: str, *columns: sa.Column[Any], indexes: dict[str, str]) -> None:
        if name in have:
            return
        op.create_table(name, *columns)
        for index, column in indexes.items():
            op.create_index(index, name, [column])

    table(
        "encounters",
        _text("id", primary_key=True),
        _text("body"),
        indexes={},
    )
    table(
        "pims_notes",
        _text("id", primary_key=True),
        _text("patient_id"),
        _text("provider_id", nullable=True),
        _text("date"),
        _text("body"),
        indexes={
            "pims_notes_patient": "patient_id",
            "pims_notes_provider": "provider_id",
        },
    )
    table(
        "meta",
        _text("key", primary_key=True),
        _text("value"),
        indexes={},
    )
    table(
        "audit",
        _text("ts"),
        _text("actor"),
        _text("action"),
        _text("encounter_id", nullable=True),
        _text("detail", nullable=True),
        indexes={},
    )
    table(
        "remember",
        _text("id", primary_key=True),
        _text("visit_key"),
        _text("client_id"),
        _text("patient_id"),
        sa.Column("kept", sa.Integer(), nullable=False, server_default="0"),
        _text("expires_at", nullable=True),
        _text("body"),
        indexes={"remember_visit": "visit_key", "remember_client": "client_id"},
    )
    table(
        "templates",
        _text("id", primary_key=True),
        _text("owner_user"),
        _text("body"),
        indexes={},
    )
    table(
        "shares",
        _text("token", primary_key=True),
        _text("encounter_id"),
        _text("language"),
        _text("name_hash"),
        _text("created_at"),
        _text("expires_at"),
        sa.Column("failures", sa.Integer(), nullable=False, server_default="0"),
        indexes={},
    )
    table(
        "documents",
        _text("id", primary_key=True),
        _text("patient_id"),
        _text("body"),
        indexes={"documents_patient": "patient_id"},
    )
    table(
        "users",
        _text("id", primary_key=True),
        _text("username", unique=True),
        _text("name"),
        sa.Column("provider_id", sa.Text(), nullable=False, server_default=""),
        _text("role"),
        _text("password_hash", nullable=True),
        sa.Column("active", sa.Integer(), nullable=False, server_default="1"),
        _text("created_at"),
        indexes={},
    )
    table(
        "invites",
        _text("token_hash", primary_key=True),
        _text("user_id"),
        _text("expires"),
        indexes={},
    )
    table(
        "sessions",
        _text("token_hash", primary_key=True),
        _text("user_id"),
        _text("expires"),
        indexes={},
    )


def downgrade() -> None:
    for name in (
        "sessions",
        "invites",
        "users",
        "documents",
        "shares",
        "templates",
        "remember",
        "audit",
        "meta",
        "pims_notes",
        "encounters",
    ):
        op.drop_table(name)
