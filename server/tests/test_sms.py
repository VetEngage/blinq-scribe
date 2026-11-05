"""Telnyx demo texting. No network: Telnyx is replaced by an httpx mock transport."""

import json
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from blinqscribe import api as api_module
from blinqscribe.api import create_app
from blinqscribe.sms import SmsConfigError, Texter

DEMO = "+15550001234"


def demo_settings(settings, **kw):
    base = {
        "sms_mode": "demo",
        "telnyx_api_key": "KEY",
        "telnyx_from": "+15559998888",
        "demo_sms_to": DEMO,
    }
    base.update(kw)
    return replace(settings, **base)


class FakeTelnyx:
    def __init__(self, status=200):
        self.status = status
        self.requests = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.status >= 400:
            return httpx.Response(
                self.status,
                json={"errors": [{"title": "Invalid", "detail": "bad from number"}]},
            )
        return httpx.Response(200, json={"data": {"id": "msg_123"}})


@pytest.fixture
def telnyx(monkeypatch):
    fake = FakeTelnyx()
    real_init = Texter.__init__

    def init(self, settings, transport=None):
        real_init(self, settings, transport=httpx.MockTransport(fake))

    monkeypatch.setattr(api_module.Texter, "__init__", init)
    return fake


# These approve with booking_mode "book": the text goes out at approval with open times,
# as before booking
# links. A recheck sent as a booking link (the default) texts at signing; see
# test_visit_booking_links.py.
def drafted(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    recheck = next(f for f in enc["followups"] if f["kind"] == "recheck")
    return eid, recheck


def test_config_is_checked_at_startup(settings):
    with pytest.raises(SmsConfigError, match="not allowed"):
        Texter(replace(settings, sms_mode="live"))
    with pytest.raises(SmsConfigError, match="DEMO_SMS_TO"):
        Texter(demo_settings(settings, demo_sms_to=""))
    with pytest.raises(SmsConfigError, match="must look like"):
        Texter(demo_settings(settings, demo_sms_to="555-0101"))
    assert Texter(settings).label == "off"


def test_demo_text_goes_only_to_demo_number(settings, telnyx):
    client = TestClient(create_app(demo_settings(settings)))
    assert client.get("/health").json()["sms"] == "demo to (•••) •••-1234"
    eid, recheck = drafted(client)

    enc = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={"action": "approve", "booking_mode": "book"},
    ).json()
    sms = next(f for f in enc["followups"] if f["id"] == recheck["id"])["sms"]
    assert (
        sms["status"] == "sent"
        and sms["to_masked"] == "(•••) •••-1234"
        and sms["provider_id"] == "msg_123"
    )

    assert len(telnyx.requests) == 1
    req = telnyx.requests[0]
    body = json.loads(req.content)
    assert str(req.url) == "https://api.telnyx.com/v2/messages"
    assert req.headers["authorization"] == "Bearer KEY"
    assert body["to"] == DEMO  # never the owner's 555-0101
    assert "555-0101" not in json.dumps(body)
    assert (
        "Biscuit" in body["text"]
        and "Open times:" in body["text"]
        and "Book: " in body["text"]
    )

    actions = [a["action"] for a in client.get(f"/api/encounters/{eid}/audit").json()]
    assert actions[-2:] == ["followup_approved", "text_sent"]


def test_no_double_send_and_dismiss_sends_nothing(settings, telnyx):
    client = TestClient(create_app(demo_settings(settings)))
    eid, recheck = drafted(client)
    url = f"/api/encounters/{eid}/followups/{recheck['id']}"
    assert (
        client.post(url, json={"action": "approve", "booking_mode": "book"}).status_code
        == 200
    )
    assert (
        client.post(url, json={"action": "approve", "booking_mode": "book"}).status_code
        == 409
    )
    assert len(telnyx.requests) == 1

    eid2, recheck2 = drafted(client)
    client.post(
        f"/api/encounters/{eid2}/followups/{recheck2['id']}", json={"action": "dismiss"}
    )
    assert len(telnyx.requests) == 1


def test_failed_text_keeps_approval_and_can_retry(settings, telnyx):
    telnyx.status = 422
    client = TestClient(create_app(demo_settings(settings)))
    eid, recheck = drafted(client)
    url = f"/api/encounters/{eid}/followups/{recheck['id']}"
    f = next(
        x
        for x in client.post(
            url, json={"action": "approve", "booking_mode": "book"}
        ).json()["followups"]
        if x["id"] == recheck["id"]
    )
    assert (
        f["status"] == "approved"
        and f["sms"]["status"] == "failed"
        and "bad from number" in f["sms"]["detail"]
    )

    telnyx.status = 200
    f = next(
        x
        for x in client.post(url, json={"action": "retry_text"}).json()["followups"]
        if x["id"] == recheck["id"]
    )
    assert f["sms"]["status"] == "sent" and len(telnyx.requests) == 2
    assert (
        client.post(url, json={"action": "retry_text"}).status_code == 409
    )  # nothing left to retry


def test_sms_off_sends_nothing(client):
    eid, recheck = drafted(client)
    enc = client.post(
        f"/api/encounters/{eid}/followups/{recheck['id']}",
        json={"action": "approve", "booking_mode": "book"},
    ).json()
    sms = next(f for f in enc["followups"] if f["id"] == recheck["id"])["sms"]
    assert sms["status"] == "skipped"
