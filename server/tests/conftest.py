import os
import re
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from blinqscribe import db
from blinqscribe.api import create_app
from blinqscribe.config import Settings

# Unset: every test gets its own SQLite file in tmp_path. Set to a throwaway
# PostgreSQL database, the suite runs on it, emptied before each test.
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


@pytest.fixture(autouse=True)
def _empty_postgres(tmp_path):
    if not DATABASE_URL:
        yield
        return
    db.migrate(DATABASE_URL, tmp_path)
    conn = db.connect(DATABASE_URL, tmp_path)
    names = ", ".join(t._meta.table_name for t in db.TABLES)
    conn.execute_sql(f"TRUNCATE {names}")
    conn.close()
    yield


@pytest.fixture
def settings(tmp_path):
    return Settings(
        model_api_key="",
        stt_provider="mock",
        sam_endpoint="",
        practice_adapter="mock",
        sms_mode="off",
        data_dir=tmp_path,
        api_token="",
        database_url=DATABASE_URL,
        temporal_address="",
        # No read-aloud model unless a test brings one, whatever is installed here.
        models_dir=tmp_path / "models",
        tts_provider="",
    )


@pytest.fixture
def client(settings):
    # As if on the server itself: before the first account exists, only this machine may
    # create it.
    return TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 50000)
    )


# ---------- the vet confirms before signing ----------
# The server refuses to sign a note still marked "[confirm: ...]" (test_visit_page).
# Most tests sign the demo draft, which has one, to test what signing does next; as in
# the console, the vet first presses Confirm on each: a confirmed value keeps its
# words, a confirmed note to self goes. Tests about the refusal itself are marked
# `confirms_left` and sign as they are.
_MARK = re.compile(r"[ \t]*\[\s*confirm\b:?\s*([^\]]*)\]", re.I)
_SIGN = re.compile(r"/api/encounters/([^/]+)/sign$")
_GQL_SIGN = re.compile(r'sign_note\(\s*encounter_id:\s*(?:"([^"]+)"|\$(\w+))')


def _confirmed(note: dict[str, Any]) -> dict[str, Any]:
    def text(v: str) -> str:
        lines = [_MARK.sub("", ln) for ln in v.splitlines()]
        return "\n".join(ln for ln in lines if ln.strip(" -•\t") or not ln)

    out = dict(note)
    for k, v in note.items():
        if isinstance(v, str):
            out[k] = text(v)
    out["vitals"] = {k: _MARK.sub(r"\1", v) for k, v in note.get("vitals", {}).items()}
    out["medications"] = [m for m in map(text, note.get("medications", [])) if m]
    return out


def _confirm_first(client: TestClient, eid: str, headers: Any) -> None:
    got = TestClient.get(client, f"/api/encounters/{eid}", headers=headers)
    note = got.json().get("note") if got.status_code == 200 else None
    if note and got.json().get("status") != "signed" and _MARK.search(str(note)):
        path = f"/api/encounters/{eid}/note"
        TestClient.put(client, path, json=_confirmed(note), headers=headers)


@pytest.fixture(autouse=True)
def _vet_confirms_before_signing(request, monkeypatch):
    if request.node.get_closest_marker("confirms_left"):
        yield
        return
    post = TestClient.post

    def posting(self: TestClient, url: Any, *args: Any, **kw: Any) -> Any:
        headers = kw.get("headers")
        if m := _SIGN.search(str(url)):
            _confirm_first(self, m.group(1), headers)
        body = kw.get("json")
        if isinstance(body, dict) and (m := _GQL_SIGN.search(body.get("query", ""))):
            eid = m.group(1) or (body.get("variables") or {}).get(m.group(2), "")
            if eid:
                _confirm_first(self, eid, headers)
        return post(self, url, *args, **kw)

    monkeypatch.setattr(TestClient, "post", posting)
    yield
