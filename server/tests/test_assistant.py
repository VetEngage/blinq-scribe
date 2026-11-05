import json
from datetime import UTC
from types import SimpleNamespace

import pytest

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.assistant import DayAssistant
from blinqscribe.schemas import AssistantRequest
from blinqscribe.store import Store


class FakeMuse:
    """Plays back a tool call, then a final answer, like Muse Spark would."""

    enabled = True
    model = "fake"

    def __init__(self):
        self.calls = 0
        self.seen_tool_result = None

    async def chat(self, messages, tools=None):
        self.calls += 1
        if self.calls == 1:
            call = SimpleNamespace(
                id="c1", function=SimpleNamespace(name="get_schedule", arguments="{}")
            )
            msg = SimpleNamespace(content=None, tool_calls=[call])
            msg.model_dump = lambda **_: {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "get_schedule", "arguments": "{}"},
                    }
                ],
            }
            return msg
        self.seen_tool_result = json.loads(messages[-1]["content"])
        return SimpleNamespace(
            content="You have 5 visits. Biscuit is first.", tool_calls=None
        )


@pytest.mark.anyio
async def test_morning_brief(tmp_path):
    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), Store(tmp_path))
    brief = await a.morning_brief("prov-1")
    assert brief["spoken"].startswith("You have 5 appointments today.")
    assert "Miso" in brief["spoken"]  # flagged patient called out


@pytest.mark.anyio
async def test_tool_loop(tmp_path):
    muse = FakeMuse()
    a = DayAssistant(muse, MockAdapter(), Store(tmp_path))
    reply = await a.chat(
        AssistantRequest(message="How does my day look?", provider_id="prov-1")
    )
    assert reply.tools_used == ["get_schedule"]
    assert reply.reply.startswith("You have 5 visits")
    assert len(muse.seen_tool_result) == 5 and "Biscuit" in muse.seen_tool_result[0]


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_pre_room_card_includes_what_was_promised(tmp_path):
    from datetime import datetime

    from blinqscribe.schemas import (
        Encounter,
        EncounterStatus,
        FollowUp,
        FollowUpKind,
        FollowUpStatus,
        SoapNote,
    )

    store = Store(tmp_path)
    # A signed earlier visit for Biscuit with an approved recheck
    store.save(
        Encounter(
            id="old1",
            appointment_id="appt-1",
            patient_id="pat-1",
            consent_recorded=True,
            status=EncounterStatus.signed,
            note=SoapNote(plan="Recheck"),
            followups=[
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.recheck,
                    reason="Recheck ear infection",
                    due_in_days=14,
                    status=FollowUpStatus.approved,
                )
            ],
            created_at=datetime.now(UTC),
        )
    )
    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), store)
    card = await a.pre_room_card("appt-1")
    spoken = card["spoken"]
    assert spoken.startswith(
        "Biscuit, 6 year old canine, Golden Retriever, in for ear "
        "scratching, head shaking."
    )
    assert "Last seen 2 months ago for itchy face." in spoken
    assert "Last time you said: Recheck ear infection in 14 days." in spoken
    assert card["promised"] == ["Recheck ear infection in 14 days"]

    miso = await a.pre_room_card("appt-2")
    assert "Heads up: Fractious, use towel wrap." in miso["spoken"]
    assert (await a.pre_room_card("nope")) == {"error": "appointment not found"}


@pytest.mark.anyio
async def test_end_of_day(tmp_path):
    from datetime import datetime

    from blinqscribe.schemas import (
        Encounter,
        EncounterStatus,
        FollowUp,
        FollowUpKind,
        FollowUpStatus,
    )

    store = Store(tmp_path)
    from blinqscribe.schemas import Slot

    now = datetime.now(UTC)
    slot = Slot(start=datetime(2026, 11, 12, 9, 0), end=datetime(2026, 11, 12, 9, 30))
    # Biscuit: signed, one recheck booked, one approved but not booked, owner update
    # still waiting
    store.save(
        Encounter(
            id="e1",
            appointment_id="appt-1",
            patient_id="pat-1",
            consent_recorded=True,
            status=EncounterStatus.signed,
            created_at=now,
            followups=[
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.recheck,
                    reason="Recheck ears",
                    due_in_days=14,
                    status=FollowUpStatus.approved,
                    booked_slot=slot,
                ),
                FollowUp(
                    id="f3",
                    kind=FollowUpKind.recheck,
                    reason="Recheck skin",
                    due_in_days=30,
                    status=FollowUpStatus.approved,
                ),
                FollowUp(
                    id="f2",
                    kind=FollowUpKind.client_update,
                    reason="Send cytology results",
                ),
            ],
        )
    )
    # Miso: drafted, not signed
    store.save(
        Encounter(
            id="e2",
            appointment_id="appt-2",
            patient_id="pat-2",
            consent_recorded=True,
            status=EncounterStatus.draft_ready,
            created_at=now,
        )
    )
    # Another vet's visit does not count
    store.save(
        Encounter(
            id="e3",
            appointment_id="nope",
            patient_id="pat-9",
            consent_recorded=True,
            created_at=now,
        )
    )

    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), store)
    eod = await a.end_of_day("prov-1")
    assert eod["spoken"] == (
        "You saw 2 of 5 visits today. 1 note still to sign: Miso. "
        "1 follow up waiting for your approval. 1 recheck booked. "
        "1 recheck approved but not booked yet."
    )
    assert [u["encounter_id"] for u in eod["unsigned_notes"]] == ["e2"]
    assert [w["followup_id"] for w in eod["followups_waiting"]] == ["f2"]
    assert eod["rechecks_booked"] == 1
    assert [r["booked_for"] for r in eod["rechecks_approved"]] == [
        "2026-11-12T09:00:00",
        None,
    ]
    assert len(eod["not_started"]) == 3
    # The spoken list, the older lists and the screen's list come from the same open
    # items.
    assert [
        (i["kind"], i["encounter_id"], i.get("followup_id")) for i in eod["left_to_do"]
    ] == [("followup", "e1", "f2"), ("unsigned", "e2", None)]
    assert eod["rechecks_waiting"] == 1

    reply = await a.chat(
        AssistantRequest(message="Let's wrap up", provider_id="prov-1")
    )
    assert reply.tools_used == ["end_of_day"] and reply.reply == eod["spoken"]


@pytest.mark.anyio
async def test_end_of_day_all_done(tmp_path):
    from datetime import datetime

    from blinqscribe.schemas import Encounter, EncounterStatus

    store = Store(tmp_path)
    store.save(
        Encounter(
            id="e1",
            appointment_id="appt-1",
            patient_id="pat-1",
            consent_recorded=True,
            status=EncounterStatus.signed,
            created_at=datetime.now(UTC),
        )
    )
    eod = await DayAssistant(
        SimpleNamespace(enabled=False), MockAdapter(), store
    ).end_of_day("prov-1")
    assert (
        eod["spoken"]
        == "You saw 1 of 5 visits today. All notes signed and nothing waiting. "
        "Good night."
    )


@pytest.mark.anyio
async def test_end_of_day_counts_a_link_sent_as_sent_not_booked(tmp_path):
    from datetime import datetime, timedelta

    from blinqscribe.schemas import (
        BookingLink,
        Encounter,
        EncounterStatus,
        FollowUp,
        FollowUpKind,
        FollowUpStatus,
    )

    store = Store(tmp_path)
    now = datetime.now(UTC)

    def recheck(link_status: str) -> FollowUp:
        return FollowUp(
            id="f1",
            kind=FollowUpKind.recheck,
            reason="Recheck ears",
            status=FollowUpStatus.approved,
            booking_mode="link",
            booking_link=BookingLink(
                status=link_status,
                sent_at=now,
                booked_start=now + timedelta(days=14)
                if link_status == "booked"
                else None,
            ),
        )

    store.save(
        Encounter(
            id="e1",
            appointment_id="appt-1",
            patient_id="pat-1",
            provider_id="prov-1",
            consent_recorded=True,
            status=EncounterStatus.signed,
            created_at=now,
            followups=[recheck("sent")],
        )
    )
    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), store)
    eod = await a.end_of_day("prov-1")
    assert eod["spoken"].startswith(
        "You saw 1 of 5 visits today. 1 recheck link sent, none booked yet."
    )
    assert (eod["recheck_links_sent"], eod["recheck_links_booked"]) == (1, 0)
    assert "booked no" not in eod["spoken"]

    def booked(e: Encounter) -> None:
        e.followups = [recheck("booked")]

    store.update("e1", booked)
    eod = await a.end_of_day("prov-1")
    assert "1 recheck link sent, 1 booked." in eod["spoken"]
    assert (eod["recheck_links_sent"], eod["recheck_links_booked"]) == (1, 1)
    assert eod["rechecks_booked"] == 1


def test_assistant_prompt_refuses_clinical_advice():
    # Hackathon rules ban AI that gives medical advice: the day assistant must hand
    # clinical calls back to the vet.
    from blinqscribe.prompts import ASSISTANT_SYSTEM, PHOTO_SYSTEM, SCRIBE_SYSTEM

    assert "You are not a clinical advisor" in ASSISTANT_SYSTEM
    assert "That's your call" in ASSISTANT_SYSTEM
    assert "Do not diagnose" in PHOTO_SYSTEM
    assert "Never invent vitals, doses or diagnoses" in SCRIBE_SYSTEM
    assert "Add no new advice" in SCRIBE_SYSTEM


@pytest.mark.anyio
async def test_end_of_day_keeps_the_shapes_the_iphone_reads(tmp_path):
    """glasses-ios Models.swift decodes these as required: keep every key and type."""
    from datetime import datetime

    from blinqscribe.schemas import (
        Encounter,
        EncounterStatus,
        FollowUp,
        FollowUpKind,
        FollowUpStatus,
        WriteBackResult,
    )

    store = Store(tmp_path)
    now = datetime.now(UTC)
    store.save(
        Encounter(
            id="e1",
            appointment_id="appt-1",
            patient_id="pat-1",
            consent_recorded=True,
            status=EncounterStatus.signed,
            created_at=now,
            write_back=WriteBackResult(
                ok=False, status="queued_for_staff", detail="PIMS down"
            ),
            followups=[
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.recheck,
                    reason="Recheck ears",
                    due_in_days=14,
                    status=FollowUpStatus.approved,
                ),
                FollowUp(id="f2", kind=FollowUpKind.callback, reason="Call about labs"),
            ],
        )
    )
    store.save(
        Encounter(
            id="e2",
            appointment_id="appt-2",
            patient_id="pat-2",
            consent_recorded=True,
            status=EncounterStatus.draft_ready,
            created_at=now,
        )
    )
    eod = await DayAssistant(
        SimpleNamespace(enabled=False), MockAdapter(), store
    ).end_of_day("prov-1")
    assert eod["unsigned_notes"] == [
        {"encounter_id": "e2", "patient": "Miso", "status": "draft_ready"}
    ]
    assert eod["followups_waiting"] == [
        {
            "encounter_id": "e1",
            "followup_id": "f2",
            "patient": "Biscuit",
            "kind": "callback",
            "reason": "Call about labs",
        }
    ]
    assert eod["rechecks_approved"] == [
        {
            "encounter_id": "e1",
            "patient": "Biscuit",
            "reason": "Recheck ears",
            "due_in_days": 14,
            "booked_for": None,
            "link": "",
        }
    ]
    assert eod["queued_for_staff"] == [
        {
            "encounter_id": "e1",
            "patient": "Biscuit",
            "what": "note",
            "detail": "PIMS down",
        }
    ]
    assert (
        all(isinstance(s, str) for s in eod["not_started"])
        and len(eod["not_started"]) == 3
    )
    for key, kind in (
        ("spoken", str),
        ("visits_seen", int),
        ("appointments", int),
        ("rechecks_booked", int),
        ("left_to_do", list),
        ("done_today", list),
        ("waiting_on_owners", list),
        ("tomorrow", dict),
    ):
        assert isinstance(eod[key], kind), key
