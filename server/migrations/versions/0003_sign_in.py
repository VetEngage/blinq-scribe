"""Sign in (requirement 57): email and 2FA on people, Remember me on sessions, and
the tables for reset links, 2FA codes and Google or Microsoft sign in.

A database where an earlier build already added some of these is adopted as it is.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_COLUMNS = {
    "users": {
        "email": (sa.Text(), "''"),
        "two_factor": (sa.Integer(), "0"),
        "two_factor_required": (sa.Integer(), "0"),
    },
    "sessions": {"remember": (sa.Integer(), "0"), "created_at": (sa.Text(), "''")},
    "oauth_states": {"link_user_id": (sa.Text(), "''")},
}


def _text(name: str, primary_key: bool = False) -> sa.Column[str]:
    return sa.Column(name, sa.Text(), nullable=False, primary_key=primary_key)


def _int(name: str, default: str | None = None) -> sa.Column[int]:
    return sa.Column(name, sa.Integer(), nullable=False, server_default=default)


def upgrade() -> None:
    have = set(sa.inspect(op.get_bind()).get_table_names())
    tables: dict[str, list[sa.Column[object]]] = {
        "password_resets": [
            _text("token_hash", primary_key=True),
            _text("user_id"),
            _text("expires"),
        ],
        "sign_in_codes": [
            _text("ticket_hash", primary_key=True),
            _text("user_id"),
            _text("code_hash"),
            _int("remember"),
            _int("tries", "0"),
            _int("sends", "1"),
            _text("expires"),
        ],
        "oauth_states": [
            _text("state_hash", primary_key=True),
            _text("provider"),
            _text("verifier"),
            _text("nonce"),
            _int("remember"),
            _text("expires"),
        ],
        "oauth_handoffs": [
            _text("code_hash", primary_key=True),
            _text("user_id"),
            _int("remember"),
            _text("expires"),
        ],
        "oauth_identities": [
            _text("provider", primary_key=True),
            _text("subject", primary_key=True),
            _text("user_id"),
        ],
    }
    for name, columns in tables.items():
        if name not in have:
            op.create_table(name, *columns)

    inspector = sa.inspect(op.get_bind())
    for table, new in _NEW_COLUMNS.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, (kind, default) in new.items():
            if name not in existing:
                op.add_column(
                    table,
                    sa.Column(
                        name, kind, nullable=False, server_default=sa.text(default)
                    ),
                )
    if "users_email" not in {i["name"] for i in inspector.get_indexes("users")}:
        op.create_index(
            "users_email",
            "users",
            ["email"],
            unique=True,
            sqlite_where=sa.text("email != ''"),
            postgresql_where=sa.text("email != ''"),
        )


_MADE_HERE = {"oauth_states"}  # dropped whole below


def downgrade() -> None:
    for name in (
        "oauth_identities",
        "oauth_handoffs",
        "oauth_states",
        "sign_in_codes",
        "password_resets",
    ):
        op.drop_table(name)
    op.drop_index("users_email", "users")
    for table, columns in _NEW_COLUMNS.items():
        if table in _MADE_HERE:
            continue
        with op.batch_alter_table(table) as batch:
            for name in columns:
                batch.drop_column(name)
