"""The morning brief is a conversation (requirement 71): one sentence in parts, two or
three suggested questions, and Ask Blinq answers with link chips, sources and follow
ups. Press to talk turns a short clip into a question."""

import json
import re
import struct
from dataclasses import replace
from datetime import date, datetime, time, timedelta
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from test_permissions import gql, h
from test_roles_view import client, team  # noqa: F401 - fixtures

from blinqscribe import api as api_module
from blinqscribe import assistant as assistant_module
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.assistant import DayAssistant, brief_sentence, brief_suggestions
from blinqscribe.plain import plain_answer, plain_words
from blinqscribe.schemas import AssistantRequest, ChatTurn
from blinqscribe.speech_g2p import normalize
from blinqscribe.store import Store
from blinqscribe.stt import Transcriber


@pytest.fixture
def morning(monkeypatch):
    """8:00 AM today, before the first visit: the brief's "up next" depends on the
    clock, so these run the same at any hour."""

    class Morning(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[override]
            return datetime.combine(date.today(), time(8, 0))

    monkeypatch.setattr(assistant_module, "datetime", Morning)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def said(parts):
    return "".join(p["text"] for p in parts)


# ---------- the sentence and the suggestions ----------


def test_the_sentence_says_what_is_left_by_name_and_marks_what_failed():
    needs = (
        [{"kind": "failed_text"}, {"kind": "unsigned"}, {"kind": "unsigned"}]
        + [{"kind": "followup"}] * 3
        + [{"kind": "link"}]
    )
    new = [
        {"kind": "result", "patient_name": "Miso", "detail": "Kidney panel"},
        {"kind": "reply", "text": "Jordan Lee replied: Biscuit is shaking"},
    ]
    parts = brief_sentence(5, needs, new)
    assert said(parts) == (
        "5 visits today. 2 notes to sign, 1 text that didn't send, 3 follow ups to "
        "decide and 1 recheck link not booked. 2 new since yesterday: Miso's kidney "
        "results and a text from Jordan."
    )
    assert [(p["text"], p["emphasis"]) for p in parts if p["emphasis"] != "none"] == [
        ("5 visits", "bold"),
        ("2 notes to sign", "bold"),
        ("1 text that didn't send", "failed"),
        ("3 follow ups to decide", "bold"),
        ("1 recheck link not booked", "bold"),
        ("2 new", "bold"),
    ]
    # Counted parts are named, so a screen can say a count its own way.
    assert [p["kind"] for p in parts if p["kind"]] == [
        "visits",
        "needs",
        "failed",
        "needs",
        "needs",
        "new",
    ]


def test_the_sentence_reads_right_when_there_is_little_or_nothing():
    assert said(brief_sentence(1, [{"kind": "unsigned"}], 0)) == (
        "1 visit today. 1 note to sign."
    )
    assert said(brief_sentence(0, [], 0)) == "No visits today. Nothing needs you."
    assert all(p["emphasis"] == "none" for p in brief_sentence(0, [], 0))


def test_the_sentence_is_facts_never_advice():
    text = said(
        brief_sentence(
            3,
            [{"kind": "unsigned"}, {"kind": "prescription"}],
            [{"kind": "booked", "patient_name": "Pepper"}],
        )
    )
    assert text == (
        "3 visits today. 1 note to sign and 1 prescription to enter. 1 new since "
        "yesterday: Pepper booked online."
    )
    assert not any(w in text.lower() for w in ("check", "likely", "should", "consider"))


def test_suggestions_come_from_today():
    appts = [SimpleNamespace()]
    result = {"kind": "result", "patient_name": "Miso", "detail": "Kidney panel"}
    reply = {"kind": "reply", "text": "Jordan Lee replied: Biscuit is shaking"}
    assert brief_suggestions(appts, [{"kind": "x"}], [result, reply], []) == [
        "What's first?",
        "Miso's kidney results",
        "What needs me?",
    ]
    assert brief_suggestions(appts, [], [reply], [{"text": "Miso: Fractious"}]) == [
        "What's first?",
        "What did Jordan say?",
        "Any heads ups today?",
    ]
    assert brief_suggestions([], [], [], []) == []


def test_the_brief_says_it_in_one_sentence_matching_home(client, morning):  # noqa: F811
    brief = client.get("/api/brief").json()
    notes = client.get("/api/notes/unsigned").json()  # Home's buckets
    text = said(brief["sentence"])
    assert text.startswith(f"{len(brief['appointments'])} visits today.")
    ready = sum(n["bucket"] == "ready" for n in notes)
    pending = len(notes) - ready
    assert ready and f"{ready} note{'s' if ready != 1 else ''} to sign" in text
    if pending:
        assert f"{pending} note{'s' if pending != 1 else ''} pending" in text
    assert "1 text that didn't send" in text
    assert f"{len(brief['new_since_yesterday'])} new since yesterday: " in text
    assert {"bold", "failed"} <= {p["emphasis"] for p in brief["sentence"]}
    # The Up next card shows the first visit, so the brief asks what comes after it.
    assert brief["suggestions"] == [
        "What's after Biscuit?",
        "Miso's kidney results",
        "What needs me?",
    ]
    # The iPhone still reads these.
    assert brief["spoken"] and brief["heads_up"] and brief["new_since_yesterday"]


def test_graphql_has_the_sentence_and_suggestions(client, team):  # noqa: F811
    data = gql(
        client,
        team["rivera"],
        "{ brief { sentence { text emphasis } suggestions } }",
    )["data"]["brief"]
    assert data["sentence"][0]["emphasis"] == "bold" and len(data["suggestions"]) >= 2


# ---------- Ask Blinq answers ----------


def mock_assistant(tmp_path):
    return DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), Store(tmp_path))


@pytest.mark.anyio
async def test_a_result_answer_has_sources_links_and_follow_ups(tmp_path):
    a = mock_assistant(tmp_path)
    r = await a.chat(AssistantRequest(message="Miso's kidney results"))
    assert r.reply.startswith("Miso's kidney panel came in at ")
    assert "Miso is your 9:30 AM kidney recheck today." in r.reply
    assert [s.to for s in r.sources] == ["documents", "record"]
    assert r.sources[0].label.startswith("Kidney panel, received ")
    assert r.sources[1].label.startswith("Last visit ")
    assert [(link.label, link.to) for link in r.links] == [
        ("Open Miso's visit", "visit"),
        ("Open Miso's record", "record"),
    ]
    assert r.links[0].appointment_id == "appt-2"
    assert 2 <= len(r.followups) <= 3 and "Miso's last note" in r.followups
    assert "Miso's kidney results" not in r.followups  # never the question just asked


@pytest.mark.anyio
async def test_an_owner_reply_and_a_draft_answer(tmp_path):
    a = mock_assistant(tmp_path)
    r = await a.chat(AssistantRequest(message="What did Jordan say about Biscuit?"))
    assert r.reply.startswith("Jordan wrote at ")
    assert "that Biscuit is shaking his head again." in r.reply
    assert r.sources[0].label.startswith("Text from Jordan Lee, ")
    assert r.sources[0].to == "household" and r.sources[0].client_id == "cli-1"
    assert r.followups[0] == "Draft a reply to Jordan"
    draft = await a.chat(
        AssistantRequest(
            message="Draft a reply to Jordan",
            history=[
                ChatTurn(role="user", content="What did Jordan say about Biscuit?"),
                ChatTurn(role="assistant", content=r.reply),
            ],
        )
    )
    assert draft.reply.startswith("Here's a draft for Jordan Lee: \"Hi Jordan")
    assert draft.links[0].to == "household"
    asked = {"draft a reply to jordan", "what did jordan say about biscuit?"}
    assert not asked & {f.lower() for f in draft.followups}


@pytest.mark.anyio
async def test_what_needs_me_is_the_to_do_list(tmp_path):
    a = mock_assistant(tmp_path)
    brief = await a.morning_brief()
    r = await a.chat(AssistantRequest(message="What needs me?"))
    if brief["from_yesterday"]:
        n = len(brief["from_yesterday"])
        assert r.reply.startswith(f"{n} thing")
    else:
        assert r.reply == "Nothing needs you from earlier days."


@pytest.mark.anyio
async def test_first_up_and_hear_more(tmp_path):
    a = mock_assistant(tmp_path)
    first = await a.chat(AssistantRequest(message="What's first?"))
    assert first.reply.startswith("First up is Biscuit at 9:00 AM")
    assert first.links[0].label == "Open Biscuit's visit"
    more = await a.chat(AssistantRequest(message="Yes"))
    assert "Miso's kidney panel came in" in more.reply
    assert "Heads ups today for Miso" in more.reply
    assert {link.to for link in more.links} >= {"documents", "household"}


@pytest.mark.anyio
async def test_clinical_questions_are_the_vet_s_call_with_the_facts(tmp_path):
    a = mock_assistant(tmp_path)
    r = await a.chat(AssistantRequest(message="What dose of meloxicam for Miso?"))
    assert r.reply.startswith("That's your call. On file for Miso: Fractious")
    assert "Latest weight 8.9 lb" in r.reply
    assert r.sources and r.sources[0].to == "record"


@pytest.mark.anyio
async def test_a_model_answer_gets_links_to_the_visits_it_names(tmp_path):
    class Muse:
        enabled = True

        async def chat(self, messages, tools=None):
            return SimpleNamespace(
                content="Miso is at 9:30 AM, then Luna.", tool_calls=None
            )

    a = DayAssistant(Muse(), MockAdapter(), Store(tmp_path))
    r = await a.chat(AssistantRequest(message="Who's after Biscuit?"))
    assert [link.label for link in r.links] == [
        "Open Miso's visit",
        "Open Luna's visit",
    ]
    assert 2 <= len(r.followups) <= 3


def test_graphql_answers_carry_links_sources_and_follow_ups(client, team):  # noqa: F811
    out = gql(
        client,
        team["rivera"],
        'mutation { ask_assistant(input: {message: "Miso\'s kidney results"}) '
        "{ reply links { label to appointment_id } sources { label to document_id } "
        "followups } }",
    )["data"]["ask_assistant"]
    assert out["links"][0] == {
        "label": "Open Miso's visit",
        "to": "visit",
        "appointment_id": "appt-2",
    }
    assert out["sources"][0]["to"] == "documents" and out["sources"][0]["document_id"]
    assert out["followups"]


def test_front_office_gets_no_note_offer(client, team):  # noqa: F811
    out = client.post(
        "/api/assistant",
        json={"message": "Miso's kidney results"},
        headers=h(team["front"]),
    ).json()
    assert "last note" not in out["reply"]
    assert [s["to"] for s in out["sources"]] == ["documents"]  # no visit date


def test_the_card_has_blinq_s_take(client):  # noqa: F811
    take = client.get("/api/appointments/appt-1/card").json()["take"]
    last = date.today() - timedelta(days=62)  # Biscuit's itchy face visit
    assert take.startswith("Jordan wrote at ") and f"Last seen {last:%b %-d}" in take
    take = client.get("/api/appointments/appt-2/card").json()["take"]
    assert take.startswith("Kidney panel came in at ")


# ---------- press to talk ----------


def wav(seconds=0.1, rate=16000) -> bytes:
    pcm = b"\0\0" * int(rate * seconds)
    return (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
        + b"data"
        + struct.pack("<I", len(pcm))
        + pcm
    )


def listen(c, body=None, **headers):
    return c.post(
        "/api/speech/listen",
        files={"file": ("question.wav", body or wav())},
        headers=headers,
    )


def test_the_demo_hears_a_question_mock_ask_blinq_answers(client):  # noqa: F811
    heard = [listen(client).json() for _ in range(4)]
    assert all(h["via"] == "mock" for h in heard)
    assert [h["text"] for h in heard][:2] == ["What's first?", "Miso's kidney results"]
    for h_ in heard:
        reply = client.post("/api/assistant", json={"message": h_["text"]}).json()
        assert "mock mode" not in reply["reply"]


def test_listen_refuses_long_clips_and_needs_sign_in(settings):
    live = TestClient(
        create_app(replace(settings, api_token="s3cret")),
        base_url="http://localhost",
        client=("10.0.0.9", 50000),
    )
    assert listen(live).status_code == 401
    big = b"RIFF" + b"\0" * (2 * 1024 * 1024 + 1)
    assert listen(live, big, Authorization="Bearer s3cret").status_code == 413


def test_a_live_practice_without_a_model_falls_back_to_the_browser(
    settings, monkeypatch
):
    real_init = Transcriber.__init__

    def init(self, s, demo=False, transport=None):
        real_init(self, s, False, transport)  # a live practice

    monkeypatch.setattr(api_module.Transcriber, "__init__", init)
    c = TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 50000)
    )
    r = listen(c)
    assert r.status_code == 503 and "Type instead" in r.json()["detail"]


def test_listen_uses_the_speech_model(settings, monkeypatch):
    sent = []

    def meta(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200, json={"transcript": " What's first? "})

    real_init = Transcriber.__init__

    def init(self, s, demo=False, transport=None):
        real_init(
            self,
            replace(s, stt_provider="meta", stt_api_key="KEY"),
            demo,
            httpx.MockTransport(meta),
        )

    monkeypatch.setattr(api_module.Transcriber, "__init__", init)
    c = TestClient(
        create_app(settings), base_url="http://localhost", client=("127.0.0.1", 50000)
    )
    assert listen(c).json() == {"text": "What's first?", "via": "model"}
    assert len(sent) == 1


# ---------- plain words, and what the screen already shows ----------


def test_plain_words_match_the_shared_cases():
    """The same cases the web's browser voice is checked against."""
    cases = Path(__file__).resolve().parents[2] / "web/src/lib/plainWords.cases.json"
    if not cases.is_file():
        pytest.skip("no web app in this checkout")
    shared = json.loads(cases.read_text())
    for written, said in shared["words"]:
        assert plain_words(written) == said, written
    for written, said in shared["answers"]:
        assert plain_answer(written) == said, written


def test_answers_are_plain_spoken_sentences():
    raw = (
        "First: **9:00 AM Biscuit - Exam 1**\n\n- 6yo Golden Retriever\n"
        "- Last note: Cefpodoxime 100 mg SID x10d, ear drops BID "
        "[confirm product/dose/duration]\n"
    )
    assert plain_answer(raw) == (
        "First: 9:00 AM Biscuit, Exam 1. 6 year old Golden Retriever. Last note: "
        "Cefpodoxime 100 mg once a day for 10 days, ear drops twice a day (product, "
        "dose and duration not confirmed yet)."
    )


def test_read_aloud_says_the_shorthand_in_words():
    assert normalize("6yo, SID x10d") == "six year old, once a day for ten days"


@pytest.mark.anyio
async def test_a_model_answer_comes_back_plain(tmp_path):
    class Muse:
        enabled = True

        async def chat(self, messages, tools=None):
            self.system = messages[0]["content"]
            return SimpleNamespace(
                content="**Biscuit**\n- 6yo\n- ear d/c [confirm]", tool_calls=None
            )

    muse = Muse()
    a = DayAssistant(muse, MockAdapter(), Store(tmp_path))
    r = await a.chat(
        AssistantRequest(message="Tell me about Biscuit", showing="appt-1")
    )
    assert r.reply == "Biscuit. 6 year old. ear discharge (not confirmed yet)."
    assert "No markdown" in muse.system
    assert "On screen already: the Up next card for Biscuit at 9:00 AM" in muse.system


@pytest.mark.anyio
async def test_what_s_first_when_up_next_already_shows_it(tmp_path, morning):
    a = mock_assistant(tmp_path)
    r = await a.chat(AssistantRequest(message="What's first?", showing="appt-1"))
    assert r.reply.startswith("Biscuit is up now. After him, Miso at 9:30 AM for ")
    assert "kidney panel came in at" in r.reply
    assert r.links[0].label == "Open Miso's visit"
    after = await a.chat(AssistantRequest(message="What's after Biscuit?"))
    assert after.reply.startswith("After Biscuit, Miso at 9:30 AM")
    assert "What's first?" not in after.followups


def test_the_take_and_the_spoken_brief_use_plain_words(client):  # noqa: F811
    brief = client.get("/api/brief").json()
    assert not re.search(r"\d+\s?yo\b|\bSID\b|\bBID\b|\bx\d+d\b", brief["spoken"])
    take = client.get("/api/appointments/appt-1/card").json()["take"]
    assert "Last seen Nov" not in take or "today" not in take


# ---------- end of day counts what To do counts ----------


@pytest.mark.anyio
async def test_end_of_day_includes_earlier_days_open_items(tmp_path):
    from datetime import UTC, date, datetime, timedelta

    from blinqscribe.schemas import Encounter, EncounterStatus

    store = Store(tmp_path)
    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), store)
    earlier = date.today() - timedelta(days=2)
    store.save(
        Encounter(
            id="old-draft",
            appointment_id=f"appt-4@{earlier.isoformat()}",
            patient_id="pat-4",
            patient_name="Luna",
            provider_id="prov-1",
            consent_recorded=True,
            status=EncounterStatus.draft_ready,
            created_at=datetime.combine(earlier, datetime.min.time(), tzinfo=UTC),
        )
    )
    todo = await a.carried_over("prov-1")
    assert todo, "the earlier draft is on To do"
    eod = await a.end_of_day("prov-1")
    keys = {(i["kind"], i["encounter_id"]) for i in eod["left_to_do"]}
    assert {(i["kind"], i["encounter_id"]) for i in todo} <= keys
    unsigned = [i for i in eod["left_to_do"] if i["kind"] == "unsigned"]
    assert f"{len(unsigned)} note" in eod["spoken"] and "Luna" in eod["spoken"]
    assert [n["patient"] for n in eod["unsigned_notes"]].count("Luna") == 1


def test_up_next_says_why_it_matters_in_facts_only(client):  # noqa: F811
    """The Up next card's purple block: the last visit, care due soon, results in and
    the owner's latest text about the pet, quoted. Facts on record, never advice."""
    card = client.get("/api/appointments/appt-1/card").json()
    last = date.today() - timedelta(days=62)
    # Plain words, never shorthand: it is on screen and read aloud.
    assert card["why"][0] == (
        f"Last visit {last:%b %-d} for itchy face. Apoquel 16 mg by mouth twice a day "
        "for 14 days, then once a day."
    )
    assert not any(
        re.search(r"\b(PO|BID|SID|TID|q\d+h|x\d+d)\b", w) for w in card["why"]
    )
    assert any(w.startswith("Rabies vaccine due ") for w in card["why"])
    assert card["why"][-1].startswith(
        "Jordan texted at 4:12 PM yesterday: \u201cBiscuit"
    )
    assert card["owner_message"]["who"] == "Jordan"
    assert card["last_visit_on"] == last.isoformat() and card["weight"] == "72 lb"
    assert "Owner messaged" in card["prep"]
    words = " ".join(card["why"] + card["prep"]).lower()
    assert not any(w in words for w in ("plan to", "check for", "likely", "consider"))
    miso = client.get("/api/appointments/appt-2/card").json()
    assert "Results in" in miso["prep"]
    assert any(w.startswith("Kidney panel came in ") for w in miso["why"])


def test_graphql_lists_the_notes_to_sign_and_why_up_next_matters(client, team):  # noqa: F811
    data = gql(
        client,
        team["rivera"],
        "{ notes_to_sign { encounter_id bucket reason waiting_days } "
        'pre_room_card(appointment_id: "appt-1") { why prep last_visit_on weight '
        "owner_message { who text } } }",
    )["data"]
    assert {n["bucket"] for n in data["notes_to_sign"]} <= {"ready", "pending"}
    card = data["pre_room_card"]
    assert card["why"] and card["weight"] == "72 lb"
    assert card["owner_message"]["who"] == "Jordan"
