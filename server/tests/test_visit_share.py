"""Sharing the owner summary: summary JSON, the text with a link, the PDF, and the
owner's page."""

from dataclasses import replace
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from blinqscribe.api import create_app
from blinqscribe.store import Store


@pytest.fixture
def preview(settings):
    return TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )


def _visit(client, sign=True, patient_ids=None, transcript=None):
    body = {
        "appointment_id": "appt-1",
        "consent_recorded": True,
        **({"patient_ids": patient_ids} if patient_ids else {}),
    }
    eid = client.post("/api/encounters", json=body).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={
            "text": transcript or client.get("/api/sample-transcript").json()["text"]
        },
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    recheck = next(f for f in enc["followups"] if f["kind"] == "recheck")
    client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}", json={"action": "approve"}
    )
    if sign:
        client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    return eid


def _share(client, eid, channel="text", language="en"):
    return client.post(
        f"/api/encounters/{eid}/share", json={"channel": channel, "language": language}
    )


def _path(url):
    return urlparse(url).path


def test_nothing_is_shared_before_signing(preview):
    eid = _visit(preview, sign=False)
    assert preview.get(f"/api/encounters/{eid}/summary").status_code == 409
    assert preview.get(f"/api/encounters/{eid}/summary.pdf").status_code == 409
    assert _share(preview, eid).status_code == 409


def test_summary(preview):
    eid = _visit(preview)
    s = preview.get(f"/api/encounters/{eid}/summary").json()
    assert (
        s["clinic"]["name"] == "Maple Street Animal Hospital (demo)"
        and s["clinic"]["phone"]
        and s["mock"]
    )
    [pet] = s["pets"]
    assert pet["name"] == "Biscuit" and "Cefpodoxime 100 mg" in pet["medicines"]
    assert any("twice a day" in h for h in pet["home_care"])
    assert pet["next_visit"]["kind"] == "pick_a_time" and pet["next_visit"][
        "url"
    ].startswith("https://")
    assert "call us" in s["when_to_call"]
    # The owner's wording only; the plan's "Owner to call if ..." would repeat it.
    assert "Owner to call" not in s["when_to_call"]
    assert "yeast" not in str(s) and "graduat" not in str(
        s
    )  # no exam or assessment, nothing from Remember

    es = preview.get(f"/api/encounters/{eid}/summary", params={"lang": "es"}).json()
    # The demo translator (no model) turns the phrases it knows into Spanish.
    for_owner = es["pets"][0]["for_owner"]
    assert es["language"] == "es" and for_owner != pet["for_owner"]
    assert "Biscuit" in for_owner and "llámenos" in for_owner
    assert (
        es["pets"][0]["medicines"] == pet["medicines"]
    )  # drug names and doses exactly as signed
    assert es["pets"][0]["next_visit"]["text"].startswith("Elija una hora")


def test_text_has_only_the_link(preview):
    eid = _visit(preview)
    out = _share(preview, eid).json()
    assert (
        out["status"] == "preview"
        and out["url"].startswith("http://localhost/s/")
        and out["expires_at"]
    )
    assert out["text"] == (
        "Hi Jordan, Biscuit's visit summary from Maple Street Animal "
        "Hospital (demo) is ready: "
        f"{out['url']}. Reply STOP to opt out."
    )
    es = _share(preview, eid, language="es").json()
    assert (
        es["text"].startswith("Hola Jordan, el resumen de la visita de Biscuit")
        and es["url"] != out["url"]
    )
    for text in (out["text"], es["text"]):
        assert "Cefpodoxime" not in text and "infection" not in text
    assert (
        preview.get(f"/api/encounters/{eid}/audit").json()[-1]["action"]
        == "summary_shared"
    )


def test_texting_off_still_gives_the_link(client):
    out = _share(client, _visit(client)).json()
    assert out["status"] == "ready" and out["url"]


def test_pdf(preview):
    eid = _visit(preview)
    r = preview.get(f"/api/encounters/{eid}/summary.pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF-1.4") and r.content.rstrip().endswith(b"%%EOF")
    assert (
        b"Maple Street Animal Hospital \\(demo\\)" in r.content
        and b"Cefpodoxime 100 mg" in r.content
    )
    es = preview.get(
        f"/api/encounters/{eid}/summary.pdf", params={"lang": "es"}
    ).content
    assert (
        b"PR\xd3XIMA VISITA" in es and b"/WinAnsiEncoding" in es
    )  # accents in the built-in font
    for channel in ("email", "print"):
        out = _share(preview, eid, channel).json()
        assert (
            out["status"] == "ready"
            and out["pdf_url"] == f"/api/encounters/{eid}/summary.pdf?lang=en"
        )


def test_owner_page(preview):
    eid = _visit(preview)
    url = _path(_share(preview, eid).json()["url"])
    form = preview.get(url)
    assert (
        form.status_code == 200
        and "last name" in form.text
        and "Biscuit" not in form.text
    )
    assert (
        form.headers["referrer-policy"] == "no-referrer"
        and form.headers["cache-control"] == "no-store"
    )
    page = preview.post(url, data={"last_name": "  lee "})
    assert (
        page.status_code == 200
        and "Biscuit" in page.text
        and "Cefpodoxime 100 mg" in page.text
    )
    assert (
        "Pick a time" in page.text
        and "fonts.g" not in page.text
        and "#047857" in page.text
    )
    assert (
        preview.get(f"/api/encounters/{eid}/audit").json()[-1]["action"]
        == "summary_opened"
    )
    assert preview.get("/s/" + "x" * 32).status_code == 404


def test_owner_page_needs_no_sign_in(settings):
    c = TestClient(
        create_app(replace(settings, api_token="s3cret")), base_url="http://localhost"
    )
    # The API token never writes or signs a note: the visit's vet signs in.
    invite = (
        c.post(
            "/api/admin/users",
            headers={"Authorization": "Bearer s3cret"},
            json={
                "username": "arivera",
                "name": "Dr. Ana Rivera",
                "provider_id": "prov-1",
            },
        )
        .json()["invite_url"]
        .split("#invite=")[1]
    )
    session = c.post(
        "/api/auth/invite/accept",
        json={"token": invite, "password": "correct horse battery staple"},
    ).json()["token"]
    auth = {"Authorization": f"Bearer {session}"}
    eid = c.post(
        "/api/encounters",
        headers=auth,
        json={"appointment_id": "appt-1", "consent_recorded": True},
    ).json()["id"]
    c.post(
        f"/api/encounters/{eid}/transcript",
        headers=auth,
        json={"text": c.get("/api/sample-transcript", headers=auth).json()["text"]},
    )
    c.post(f"/api/encounters/{eid}/draft", headers=auth)
    c.post(
        f"/api/encounters/{eid}/sign",
        headers=auth,
        json={"signed_by": "Dr. Ana Rivera"},
    )
    assert c.get(f"/api/encounters/{eid}/summary").status_code == 401
    url = _path(
        c.post(
            f"/api/encounters/{eid}/share", headers=auth, json={"channel": "text"}
        ).json()["url"]
    )
    assert c.post(url, data={"last_name": "LEE"}).status_code == 200


def test_five_wrong_tries_lock_the_link(preview):
    url = _path(_share(preview, _visit(preview)).json()["url"])
    first = preview.post(url, data={"last_name": "Smith"})
    assert (
        first.status_code == 401
        and "4 tries left" in first.text
        and "Biscuit" not in first.text
    )
    for _ in range(4):
        r = preview.post(url, data={"last_name": "Smith"})
    assert r.status_code == 423 and "locked" in r.text
    assert (
        preview.post(url, data={"last_name": "Lee"}).status_code == 423
    )  # even the right name now
    assert preview.get(url).status_code == 423


def test_link_expires_after_14_days(preview, settings):
    out = _share(preview, _visit(preview)).json()
    Store(settings.data_dir).run(
        "UPDATE shares SET expires_at = '2000-01-01T00:00:00+00:00'"
    )
    r = preview.post(_path(out["url"]), data={"last_name": "Lee"})
    assert r.status_code == 410 and "expired" in r.text and "Biscuit" not in r.text


def test_every_value_is_escaped(preview):
    eid = _visit(preview, sign=False)
    note = preview.get(f"/api/encounters/{eid}").json()["note"]
    note["client_summary"] = '<script>alert(1)</script> "Biscuit" & co'
    preview.put(f"/api/encounters/{eid}/note", json=note)
    preview.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"})
    page = preview.post(
        _path(_share(preview, eid).json()["url"]), data={"last_name": "Lee"}
    ).text
    assert (
        "<script>" not in page
        and "&lt;script&gt;alert(1)&lt;/script&gt; &quot;Biscuit&quot; &amp; co" in page
    )


def test_group_visit_sends_one_summary(preview):
    eid = _visit(preview, sign=True, patient_ids=["pat-1", "pat-6"])
    sibling = next(
        e
        for e in preview.get("/api/encounters", params={"group_id": eid}).json()
        if e["id"] != eid
    )
    assert (
        len(preview.get(f"/api/encounters/{eid}/summary").json()["pets"]) == 1
    )  # only signed notes
    preview.post(
        f"/api/encounters/{sibling['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
    )
    s = preview.get(f"/api/encounters/{sibling['id']}/summary").json()
    assert [p["name"] for p in s["pets"]] == ["Biscuit", "Waffles"]
    assert "Biscuit and Waffles' visit summary" in _share(preview, eid).json()["text"]
