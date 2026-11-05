"""Letters with kinds (the specialist's "view online" link next to the owner's) and
two step sign in with an authenticator app.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_COLUMNS: dict[str, dict[str, tuple[sa.types.TypeEngine[object], str]]] = {
    "letter_links": {"kind": (sa.Text(), "'owner'")},
    "sign_in_codes": {"method": (sa.Text(), "'email'")},
    "users": {
        "totp_secret": (sa.Text(), "''"),
        "totp_pending": (sa.Text(), "''"),
        "totp_last_step": (sa.Integer(), "0"),
    },
}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table, columns in _NEW_COLUMNS.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, (kind, default) in columns.items():
            if name not in existing:
                op.add_column(
                    table,
                    sa.Column(
                        name, kind, nullable=False, server_default=sa.text(default)
                    ),
                )


def downgrade() -> None:
    for table, columns in _NEW_COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for name in columns:
                batch.drop_column(name)
