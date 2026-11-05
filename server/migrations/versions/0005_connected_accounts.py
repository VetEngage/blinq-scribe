"""Account settings: which Google or Microsoft account is connected, and since when.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_COLUMNS = {
    "oauth_identities": ("email", "connected_at"),
    "oauth_handoffs": ("email",),
}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table, columns in _NEW_COLUMNS.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name in columns:
            if name not in existing:
                op.add_column(
                    table,
                    sa.Column(
                        name, sa.Text(), nullable=False, server_default=sa.text("''")
                    ),
                )


def downgrade() -> None:
    for table, columns in _NEW_COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for name in columns:
                batch.drop_column(name)
