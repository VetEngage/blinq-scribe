"""The built web app is served at / without hiding the API."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from blinqscribe import api as api_module
from blinqscribe.api import create_app
from blinqscribe.config import Settings


@pytest.fixture
def web_client(settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Blinq Scribe app</title>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("not public")
    monkeypatch.setattr(api_module, "WEB_DIST", dist)
    return TestClient(create_app(settings), base_url="http://localhost")


def test_pages_get_the_app_and_files_are_served(web_client: TestClient) -> None:
    for path in ("/", "/visit/appt-1", "/reset-password"):
        r = web_client.get(path)
        assert r.status_code == 200 and "Blinq Scribe app" in r.text
    assert web_client.get("/assets/app.js").text == "console.log(1)"


def test_the_page_has_a_content_security_policy(web_client: TestClient) -> None:
    headers = web_client.get("/visit/appt-1").headers
    csp = headers["content-security-policy"]
    assert "script-src 'self'" in csp and "frame-ancestors 'none'" in csp
    assert "unsafe-eval" not in csp and headers["x-content-type-options"] == "nosniff"


def test_the_api_is_never_hidden(web_client: TestClient) -> None:
    assert web_client.get("/health").json()["ok"] is True
    assert web_client.get("/api/schedule").status_code == 200
    assert web_client.get("/api/not-a-route").status_code == 404
    assert "Blinq Scribe app" not in web_client.get("/graphql").text


def test_no_file_outside_the_build_is_served(web_client: TestClient) -> None:
    for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt"):
        assert "not public" not in web_client.get(path).text


def test_without_a_build_the_page_says_how_to_build(
    settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(api_module, "WEB_DIST", tmp_path / "no-build")
    r = TestClient(create_app(settings), base_url="http://localhost").get("/")
    assert r.status_code == 200 and "pnpm build" in r.text
