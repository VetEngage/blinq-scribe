"""Alembic environment. The server runs this itself on startup (blinqscribe.db.migrate);
from the server/ folder, `uv run alembic upgrade head` does the same by hand."""

from __future__ import annotations

import os
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool, text

from blinqscribe.db import sqlalchemy_url

# Any number, the same in every process: one server or worker migrates at a time.
_LOCK_ID = 7_352_118

config = context.config
url: str = config.attributes.get("url") or sqlalchemy_url(
    os.environ.get("DATABASE_URL", "").strip(),
    Path(os.environ.get("DATA_DIR", "").strip() or "./var"),
)


def run() -> None:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, render_as_batch=True)
        with context.begin_transaction():
            if connection.dialect.name == "postgresql":
                # Held to the end of the transaction, so a second process starting
                # at the same time waits, then finds the database already current.
                connection.execute(text(f"SELECT pg_advisory_xact_lock({_LOCK_ID})"))
            context.run_migrations()
    engine.dispose()


run()
