"""Phone numbers read the way people write them in everything the server writes as
text, while data fields stay as stored and texts still go to E.164 numbers."""

import json
import re
from types import SimpleNamespace

import pytest

from blinqscribe import referrals, sms
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.phone import format_phone, format_phones_in, mask_phone
from blinqscribe.schemas import AssistantRequest, Clinic

CLINIC_PHONE = "+15550104400"
SHOWN = "(555) 010-4400"


@pytest.mark.parametrize(
    ("raw", "shown"),
    [
        ("5550142231", "(555) 014-2231"),
        ("+1 555 014 2231", "(555) 014-2231"),
        ("1-555-014-2231", "(555) 014-2231"),
        ("555.014.2231 x12", "(555) 014-2231 ext. 12"),
        ("(555) 014-2231 ext 7", "(555) 014-2231 ext. 7"),
        ("555-0101", "555-0101"),  # not a full US number: as written
        ("+44 20 7946 0958", "+44 20 7946 0958"),
        ("front desk", "front desk"),
        ("", ""),
    ],
)
def test_format_phone(raw, shown):
    assert format_phone(raw) == shown


def test_masks_and_numbers_inside_sentences():
    assert mask_phone("+15550100101") == "(•••) •••-0101"
    assert mask_phone("555-014-2231 ext. 9") == "(•••) •••-2231"
    assert mask_phone("") == "(•••) •••-••••"
    assert sms.mask("+15550100101") == "(•••) •••-0101"
    assert (
        format_phones_in("Questions: call 5550104400, room 12.")
        == "Questions: call (555) 010-4400, room 12."
    )


@pytest.fixture
def clinic_phone(monkeypatch):
    async def clinic(self):
        return Clinic(
            name="Maple Street (demo)", address="120 Maple St", phone=CLINIC_PHONE
        )

    monkeypatch.setattr(MockAdapter, "get_clinic", clinic)


def pdf_text(pdf: bytes) -> str:
    raw = re.findall(rb"\(((?:[^()\\]|\\.)*)\) Tj", pdf)
    return " ".join(re.sub(rb"\\(.)", rb"\1", t).decode("cp1252") for t in raw)


def signed(client):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    client.post(f"/api/encounters/{eid}/draft")
    client.post(f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Demo"})
    return eid


def test_the_owner_summary_page_and_pdf(client, clinic_phone):
    eid = signed(client)
    summary = client.get(f"/api/encounters/{eid}/summary").json()
    assert summary["clinic"]["phone"] == CLINIC_PHONE  # data stays as stored
    assert SHOWN in pdf_text(client.get(f"/api/encounters/{eid}/summary.pdf").content)
    share = client.post(
        f"/api/encounters/{eid}/share", json={"channel": "text", "language": "en"}
    ).json()
    page = client.post(
        "/s/" + share["url"].rsplit("/s/", 1)[1], data={"last_name": "Lee"}
    ).text
    assert f"Questions? Call us at {SHOWN}" in page and CLINIC_PHONE not in page


def test_letters_pages_pdf_and_email(client, clinic_phone):
    eid = signed(client)
    letter = client.post(
        "/graphql",
        json={
            "query": "mutation ($e: String!) { create_letter(encounter_id: $e, "
            'draft: false, input: {reason: "Ears", body: "Dear Dr. Shah,", '
            'owner_consent: true, recipient: {name: "Dr. Shah", '
            'email: "shah@example.com"}}) { id } }',
            "variables": {"e": eid},
        },
    ).json()["data"]["create_letter"]["id"]
    sent = client.post(
        "/graphql",
        json={
            "query": "mutation ($id: String!) { send_letter(id: $id, "
            'channels: ["email", "print"]) { results { channel body text } } }',
            "variables": {"id": letter},
        },
    ).json()["data"]["send_letter"]["results"]
    email = next(r for r in sent if r["channel"] == "email")
    assert SHOWN in (email["body"] or "") + (email["text"] or "")
    pdf = client.get(f"/api/letters/{letter}.pdf").content
    assert f"Questions: call {SHOWN}." in pdf_text(pdf)
    clinic = {"name": "Maple", "address": "", "phone": CLINIC_PHONE}
    assert f"Maple ({SHOWN})" in referrals.page_message(clinic, "expired")


def test_ask_blinq_tool_results_and_answers(settings, monkeypatch):
    from blinqscribe.assistant import DayAssistant
    from blinqscribe.store import Store

    get_client = MockAdapter.get_client

    async def with_full_number(self, client_id):
        found = await get_client(self, client_id)
        return found.model_copy(update={"phones": ["5550100101"]}) if found else None

    monkeypatch.setattr(MockAdapter, "get_client", with_full_number)

    class Muse:
        enabled, model = True, "fake"

        def __init__(self):
            self.calls, self.tool_result = 0, ""

        async def chat(self, messages, tools=None):
            self.calls += 1
            if self.calls == 1:
                call = SimpleNamespace(
                    id="c1",
                    function=SimpleNamespace(
                        name="get_patient_record",
                        arguments=json.dumps({"patient_id": "pat-1"}),
                    ),
                )
                msg = SimpleNamespace(content=None, tool_calls=[call])
                msg.model_dump = lambda **_: {"role": "assistant", "content": None}
                return msg
            self.tool_result = messages[-1]["content"]
            return SimpleNamespace(
                content="Call Jordan at 5550100101.", tool_calls=None
            )

    muse = Muse()
    assistant = DayAssistant(muse, MockAdapter(), Store(settings.data_dir))  # type: ignore[arg-type]

    import anyio

    reply = anyio.run(assistant.chat, AssistantRequest(message="Jordan's number?"))
    assert reply.reply == "Call Jordan at (555) 010-0101."
    assert "(555) 010-0101" in muse.tool_result and "5550100101" not in muse.tool_result


def test_texts_still_go_to_e164():
    # tests/test_sms.py sends through a mock Telnyx: the request's "to" is the E.164
    # demo number while to_masked reads "(•••) •••-1234". Here: the rule itself.
    assert sms.E164.match("+15550101234") and not sms.E164.match("(555) 010-1234")
