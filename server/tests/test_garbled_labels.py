"""A short label the model garbles (a real Muse Spark reply: a follow up reason of
about 900 characters of loops and punctuation) is asked for again once, then
replaced by a plain one. It never reaches the screen."""

import json
from dataclasses import replace
from types import SimpleNamespace

import anyio
import httpx
from openai import BadRequestError

from blinqscribe.llm import SHORT_TOKENS, TEMPERATURE, MuseClient, garbled
from blinqscribe.schemas import FollowUp, FollowUpKind, followup_title
from blinqscribe.scribe import NoteDraft

GARBLED = (
    "ear infection recheck after treatment start for symptom relapse with poor "
    "treatment adherence ... ok HRI ... callback etc ?? .. man While can all be ~? "
    "??.:. "
) * 6  # about 900 characters, like the reply that filled the Follow ups card


class FakeOpenAI:
    """Answers each chat call with the next reply, and keeps what was asked."""

    def __init__(self, replies, refuse_settings=False):
        self.replies, self.calls = list(replies), []
        self.refuse_settings = refuse_settings
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.refuse_settings and "temperature" in kwargs:
            request = httpx.Request("POST", "https://api.example/v1/chat/completions")
            raise BadRequestError(
                "temperature isn't supported",
                response=httpx.Response(400, request=request),
                body=None,
            )
        content = self.replies.pop(0)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )


def _draft(reason):
    return json.dumps(
        {
            "subjective": "Head shaking for a week.",
            "objective": "Right ear canal red.",
            "assessment": "Otitis externa, right.",
            "plan": "Recheck in 2 weeks.",
            "vitals": {},
            "medications": [],
            "client_summary": "Biscuit has an ear infection.",
            "followups": [
                {
                    "kind": "recheck",
                    "reason": reason,
                    "due_in_days": 14,
                    "message_draft": "",
                }
            ],
        }
    )


def _muse(settings, fake):
    muse = MuseClient(replace(settings, model_api_key="test-key"))
    muse._client = fake
    return muse


def test_the_real_garbled_reason_is_retried_then_replaced(settings):
    assert len(GARBLED) > 800 and garbled(GARBLED)
    fake = FakeOpenAI([_draft(GARBLED), _draft(GARBLED)])
    draft = anyio.run(_muse(settings, fake).structured, "system", "user", NoteDraft)
    assert len(fake.calls) == 2  # the one retry was asked for
    ask = fake.calls[1]["messages"][-1]["content"]
    assert "followups[0].reason" in ask and "short, plain labels" in ask
    reason = draft.followups[0].reason
    assert reason == "Recheck in 14 days"  # the safe fallback, never the junk
    follow = FollowUp(kind=FollowUpKind.recheck, reason=reason, due_in_days=14)
    assert follow.title == "Recheck"


def test_a_good_retry_is_used(settings):
    fake = FakeOpenAI([_draft(GARBLED), _draft("Recheck right ear in 2 weeks")])
    draft = anyio.run(_muse(settings, fake).structured, "system", "user", NoteDraft)
    assert draft.followups[0].reason == "Recheck right ear in 2 weeks"


def test_a_long_label_is_asked_again_too(settings):
    long = (
        "Recheck the right ear canal after finishing the cefpodoxime course, with "
        "cytology and an otoscopic exam of both canals"
    )
    assert not garbled(long) and len(long) > 80
    fake = FakeOpenAI([_draft(long), _draft("Recheck both ears in 2 weeks")])
    draft = anyio.run(_muse(settings, fake).structured, "system", "user", NoteDraft)
    assert len(fake.calls) == 2
    assert draft.followups[0].reason == "Recheck both ears in 2 weeks"


def test_short_fields_carry_their_limit_in_the_schema():
    schema = NoteDraft.model_json_schema()
    reason = schema["$defs"]["_FollowUpOut"]["properties"]["reason"]
    assert reason["maxLength"] == 80 and "short label" in reason["description"]


def test_plain_labels_are_not_garbled():
    for ok in (
        "Recheck right ear in 2 weeks",
        "Call owner re: lab results (CBC, chem)",
        "Recheck in 2-3 weeks.",
        "Send Luna's vaccine record to the owner",
    ):
        assert not garbled(ok), ok
    for bad in ("Recheck ?? soon", "ear .. ear", "recheck recheck recheck recheck"):
        assert garbled(bad), bad


def test_generation_settings_and_a_refusal_of_them(settings):
    fake = FakeOpenAI([_draft("Recheck right ear in 2 weeks")])
    anyio.run(_muse(settings, fake).structured, "system", "user", NoteDraft)
    assert fake.calls[0]["temperature"] == TEMPERATURE
    assert fake.calls[0]["max_tokens"] == SHORT_TOKENS  # unless the call asks more

    refusing = FakeOpenAI(
        [_draft("Recheck right ear in 2 weeks")] * 2, refuse_settings=True
    )
    muse = _muse(settings, refusing)
    anyio.run(muse.structured, "system", "user", NoteDraft)
    anyio.run(muse.structured, "system", "user", NoteDraft)
    # Refused once, then left out without asking again; max_tokens stays.
    assert ["temperature" in c for c in refusing.calls] == [True, False, False]
    assert all(c["max_tokens"] == SHORT_TOKENS for c in refusing.calls)


def test_titles_are_short_and_made_here():
    assert followup_title(FollowUpKind.recheck, "ear infection recheck") == (
        "Recheck: ear infection"
    )
    assert followup_title(FollowUpKind.callback, "Call owner with lab results") == (
        "Call the owner: lab results"
    )
    assert len(followup_title(FollowUpKind.task, "word " * 40)) <= 60
