"""Google and Microsoft sign in: the browser that started it, and hand-off codes
that connect an account as well as sign in.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_COLUMNS = {
    "oauth_states": {"browser_hash": "''"},
    "oauth_handoffs": {"kind": "'sign_in'", "provider": "''", "subject": "''"},
}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table, columns in _NEW_COLUMNS.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, default in columns.items():
            if name not in existing:  # an earlier build may have added it
                op.add_column(
                    table,
                    sa.Column(
                        name,
                        sa.Text(),
                        nullable=False,
                        server_default=sa.text(default),
                    ),
                )


def downgrade() -> None:
    for table, columns in _NEW_COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for name in columns:
                batch.drop_column(name)
