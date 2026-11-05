"""Referral letters (requirement 61): the letters, and the owner's links to them.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _text(
    name: str, primary_key: bool = False, default: str | None = None
) -> sa.Column[str]:
    return sa.Column(
        name,
        sa.Text(),
        nullable=False,
        primary_key=primary_key,
        server_default=sa.text(default) if default is not None else None,
    )


def upgrade() -> None:
    have = set(sa.inspect(op.get_bind()).get_table_names())
    if "letters" not in have:
        op.create_table(
            "letters",
            _text("id", primary_key=True),
            _text("patient_id"),
            _text("encounter_id", default="''"),
            _text("status"),
            _text("created_at"),
            _text("body"),
        )
        op.create_index("letters_patient_id", "letters", ["patient_id"])
    if "letter_links" not in have:
        op.create_table(
            "letter_links",
            _text("token", primary_key=True),
            _text("letter_id"),
            _text("name_hash"),
            _text("created_at"),
            _text("expires_at"),
            sa.Column(
                "failures", sa.Integer(), nullable=False, server_default=sa.text("0")
            ),
        )


def downgrade() -> None:
    op.drop_table("letter_links")
    op.drop_index("letters_patient_id", "letters")
    op.drop_table("letters")
