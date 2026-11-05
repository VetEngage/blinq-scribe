"""Database tables as Peewee models, and the connection to PostgreSQL or SQLite.

DATABASE_URL picks PostgreSQL (postgresql://user:password@host:5432/name). Unset,
the data lives in SQLite in DATA_DIR, which is how demo mode and the tests run.
Alembic migrations in server/migrations create and change the tables; opening a
database brings it up to the latest revision first.

The models are not bound to a database: the Store passes its own to every query,
so two stores (two practices, or a test's second data folder) never share one.
Times are ISO 8601 text in UTC, the same on both databases.
"""

from __future__ import annotations

import threading
from pathlib import Path
from urllib.parse import unquote, urlsplit

import peewee
from peewee_async import AioModel, PostgresqlDatabase, SqliteDatabase
from playhouse.pool import PooledDatabase

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
SQLITE_FILE = "blinqscribe.db"
POOL_SIZE = 20  # sync PostgreSQL connections per process

type Database = PostgresqlDatabase | SqliteDatabase


class Base(AioModel):
    pass


class EncounterRow(Base):
    """One visit's note as JSON, with the fields lookups filter on as columns."""

    id = peewee.CharField(primary_key=True)
    body = peewee.TextField()
    group_id = peewee.CharField(default="", index=True)  # or its own id when alone
    patient_id = peewee.CharField(default="", index=True)
    appointment_id = peewee.CharField(default="", index=True)
    visit_day = peewee.CharField(default="", index=True)  # YYYY-MM-DD
    # When a failed save to the PIMS is tried again; "" when none is waiting.
    pims_next_try_at = peewee.CharField(default="", index=True)
    created_at = peewee.CharField(default="")

    class Meta:
        table_name = "encounters"


class PimsNoteRow(Base):
    """A medical note synced from the practice system."""

    id = peewee.CharField(primary_key=True)
    patient_id = peewee.CharField(index=True)
    provider_id = peewee.CharField(null=True, index=True)
    date = peewee.CharField()
    body = peewee.TextField()

    class Meta:
        table_name = "pims_notes"


class MetaRow(Base):
    key = peewee.CharField(primary_key=True)
    value = peewee.TextField()

    class Meta:
        table_name = "meta"


class AuditRow(Base):
    """Append only."""

    id = peewee.AutoField()
    ts = peewee.CharField()
    actor = peewee.CharField()
    action = peewee.CharField()
    encounter_id = peewee.CharField(null=True, index=True)
    detail = peewee.TextField(null=True)

    class Meta:
        table_name = "audit"


class RememberRow(Base):
    """Remember: an owner's milestone, staff only. visit_key is the visit's group id."""

    id = peewee.CharField(primary_key=True)
    visit_key = peewee.CharField(index=True)
    client_id = peewee.CharField(index=True)
    patient_id = peewee.CharField(index=True)
    kept = peewee.IntegerField(default=0)
    expires_at = peewee.CharField(null=True)
    body = peewee.TextField()
    position = peewee.IntegerField(default=0)  # the order they were said in

    class Meta:
        table_name = "remember"


class TemplateRow(Base):
    """A saved phrase. owner_user is a username, or '' for the clinic's."""

    id = peewee.CharField(primary_key=True)
    owner_user = peewee.CharField()
    body = peewee.TextField()

    class Meta:
        table_name = "templates"


class ShareRow(Base):
    """An owner summary link. Only a hash of the owner's last name is kept."""

    token = peewee.CharField(primary_key=True)
    encounter_id = peewee.CharField()
    language = peewee.CharField()
    name_hash = peewee.CharField()
    created_at = peewee.CharField()
    expires_at = peewee.CharField()
    failures = peewee.IntegerField(default=0)

    class Meta:
        table_name = "shares"


class DocumentRow(Base):
    """An outside record's index entry; the file itself is under media/documents."""

    id = peewee.CharField(primary_key=True)
    patient_id = peewee.CharField(index=True)
    body = peewee.TextField()

    class Meta:
        table_name = "documents"


class LetterRow(Base):
    """A referral letter (referrals.Letter as JSON), drafted to sent."""

    id = peewee.CharField(primary_key=True)
    patient_id = peewee.CharField(index=True)
    encounter_id = peewee.CharField(default="")
    status = peewee.CharField()
    created_at = peewee.CharField()
    body = peewee.TextField()

    class Meta:
        table_name = "letters"


class LetterLinkRow(Base):
    """A link to a sent letter: the owner's (only a hash of their last name is
    kept, as for summary links) or the specialist's "view online" (the token is the
    key)."""

    token = peewee.CharField(primary_key=True)
    letter_id = peewee.CharField()
    name_hash = peewee.CharField()
    created_at = peewee.CharField()
    expires_at = peewee.CharField()
    failures = peewee.IntegerField(default=0)
    kind = peewee.CharField(default="owner")  # owner | specialist

    class Meta:
        table_name = "letter_links"


class UserRow(Base):
    id = peewee.CharField(primary_key=True)
    username = peewee.CharField(unique=True)
    name = peewee.CharField()
    provider_id = peewee.CharField(default="")
    role = peewee.CharField()
    password_hash = peewee.CharField(null=True)
    active = peewee.IntegerField(default=1)
    created_at = peewee.CharField()
    email = peewee.CharField(default="")  # unique when set
    two_factor = peewee.IntegerField(default=0)
    two_factor_required = peewee.IntegerField(default=0)
    # Authenticator app (TOTP): the confirmed secret, one being set up, and the last
    # time step used (a code works once).
    totp_secret = peewee.CharField(default="")
    totp_pending = peewee.CharField(default="")
    totp_last_step = peewee.IntegerField(default=0)

    class Meta:
        table_name = "users"


class InviteRow(Base):
    token_hash = peewee.CharField(primary_key=True)
    user_id = peewee.CharField()
    expires = peewee.CharField()

    class Meta:
        table_name = "invites"


class SessionRow(Base):
    token_hash = peewee.CharField(primary_key=True)
    user_id = peewee.CharField()
    expires = peewee.CharField()
    remember = peewee.IntegerField(default=0)
    created_at = peewee.CharField(default="")

    class Meta:
        table_name = "sessions"


class PasswordResetRow(Base):
    token_hash = peewee.CharField(primary_key=True)
    user_id = peewee.CharField()
    expires = peewee.CharField()

    class Meta:
        table_name = "password_resets"


class SignInCodeRow(Base):
    """A 2FA code sent by email, waiting for the person to type it."""

    ticket_hash = peewee.CharField(primary_key=True)
    user_id = peewee.CharField()
    code_hash = peewee.CharField()
    remember = peewee.IntegerField()
    tries = peewee.IntegerField(default=0)
    sends = peewee.IntegerField(default=1)
    expires = peewee.CharField()
    method = peewee.CharField(default="email")  # app (authenticator) | email

    class Meta:
        table_name = "sign_in_codes"


class OauthStateRow(Base):
    """A Google or Microsoft sign in on its way out and back."""

    state_hash = peewee.CharField(primary_key=True)
    provider = peewee.CharField()
    verifier = peewee.CharField()
    nonce = peewee.CharField()
    remember = peewee.IntegerField()
    expires = peewee.CharField()
    link_user_id = peewee.CharField(default="")  # set when connecting an account
    browser_hash = peewee.CharField(default="")  # the browser that started it

    class Meta:
        table_name = "oauth_states"


class OauthHandoffRow(Base):
    """A one-time code the web app redeems: a sign in, or connecting an account."""

    code_hash = peewee.CharField(primary_key=True)
    user_id = peewee.CharField()
    remember = peewee.IntegerField()
    expires = peewee.CharField()
    kind = peewee.CharField(default="sign_in")  # sign_in | link
    provider = peewee.CharField(default="")  # for a link
    subject = peewee.CharField(default="")  # for a link
    email = peewee.CharField(default="")  # for a link: the account's email, to show

    class Meta:
        table_name = "oauth_handoffs"


class OauthIdentityRow(Base):
    provider = peewee.CharField()
    subject = peewee.CharField()
    user_id = peewee.CharField()
    email = peewee.CharField(default="")  # shown in Account settings only
    connected_at = peewee.CharField(default="")

    class Meta:
        table_name = "oauth_identities"
        primary_key = peewee.CompositeKey("provider", "subject")


TABLES: list[type[Base]] = [
    EncounterRow,
    PimsNoteRow,
    MetaRow,
    AuditRow,
    RememberRow,
    TemplateRow,
    ShareRow,
    DocumentRow,
    LetterRow,
    LetterLinkRow,
    UserRow,
    InviteRow,
    SessionRow,
    PasswordResetRow,
    SignInCodeRow,
    OauthStateRow,
    OauthHandoffRow,
    OauthIdentityRow,
]


def sqlalchemy_url(database_url: str, data_dir: Path) -> str:
    """The same database, as Alembic (SQLAlchemy) names it."""
    if not database_url:
        return f"sqlite:///{data_dir / SQLITE_FILE}"
    scheme, _, rest = database_url.partition("://")
    if scheme not in ("postgres", "postgresql", "postgresql+psycopg2"):
        raise ValueError("DATABASE_URL must be a postgresql:// address.")
    return f"postgresql+psycopg2://{rest}"


class PooledPostgresqlDatabase(PooledDatabase, PostgresqlDatabase):
    """PostgreSQL with a pool of sync connections: a Store call takes one and gives
    it back, so request threads share a few instead of each holding its own."""


_pools: dict[str, PooledPostgresqlDatabase] = {}
_pools_lock = threading.Lock()


def connect(database_url: str, data_dir: Path) -> Database:
    """Open the database (not connected until the first query). Sync queries are
    allowed: the Store's interface is synchronous, async code can use the aio_ calls.
    Every store on one PostgreSQL address shares one pool."""
    if database_url:
        with _pools_lock:
            if database_url not in _pools:
                url = urlsplit(database_url)
                pool = PooledPostgresqlDatabase(
                    unquote(url.path.lstrip("/")),
                    max_connections=POOL_SIZE,
                    stale_timeout=300,
                    timeout=30,
                    user=unquote(url.username or ""),
                    password=unquote(url.password or ""),
                    host=url.hostname or "localhost",
                    port=url.port or 5432,
                )
                pool.set_allow_sync(True)
                _pools[database_url] = pool
            return _pools[database_url]
    db = SqliteDatabase(
        str(data_dir / SQLITE_FILE),
        pragmas={"journal_mode": "wal", "busy_timeout": 5000},
        check_same_thread=False,
    )
    db.set_allow_sync(True)
    return db


_migrated: set[str] = set()
_migrating = threading.Lock()


def migrate(database_url: str, data_dir: Path) -> None:
    """Bring the database to the latest Alembic revision, once per process."""
    url = sqlalchemy_url(database_url, data_dir)
    with _migrating:
        if url in _migrated:
            return
        from alembic import command
        from alembic.config import Config

        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS))
        config.attributes["url"] = url
        command.upgrade(config, "head")
        _migrated.add(url)
