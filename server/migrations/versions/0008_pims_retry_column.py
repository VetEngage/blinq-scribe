"""An indexed pims_next_try_at on encounters, so the 5 minute retry of saves to the
PIMS reads only the visits waiting for one, not every visit.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-01
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column(
        "encounters",
        sa.Column(
            "pims_next_try_at", sa.Text(), nullable=False, server_default=sa.text("''")
        ),
    )
    rows = bind.execute(sa.text("SELECT id, body FROM encounters")).fetchall()
    for encounter_id, raw in rows:
        if at := json.loads(raw).get("pims_next_try_at"):
            bind.execute(
                sa.text("UPDATE encounters SET pims_next_try_at = :t WHERE id = :id"),
                {"t": at, "id": encounter_id},
            )
    op.create_index("encounters_pims_next_try_at", "encounters", ["pims_next_try_at"])


def downgrade() -> None:
    op.drop_index("encounters_pims_next_try_at", "encounters")
    with op.batch_alter_table("encounters") as batch:
        batch.drop_column("pims_next_try_at")
