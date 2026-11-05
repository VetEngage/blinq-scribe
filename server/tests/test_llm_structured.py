"""Structured replies from Muse Spark: invented field names never empty a note."""

import json
from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import pytest

from blinqscribe.config import Settings
from blinqscribe.llm import MuseClient, strict_schema
from blinqscribe.scribe import NoteDraft

# What Muse Spark sent for a real test recording: the right content under
# made-up names, and sections as lists.
REAL_REPLY = {
    "subjective": "Owner reports Waffles has been limping for a few days.",
    "objective哪些": None,
    "objective_bullets": ["Abdomen checked", "No pain on palpation of paws"],
    "objective_final": ["Abdomen checked", "No pain on touch of paws"],
    "assessment_final": "Limping back legs, cause unclear [confirm: assessment]",
    "plan_final": ["Refer to emergency center for ultrasound"],
    "plan_note": ["Something else"],
    "client_summary_final": "We found no pain on touch. Next is an ultrasound.",
    "followups_note": [{"type": "task", "description": "Referral"}],
}

GOOD_REPLY = {
    "subjective": "Limping for a few days.",
    "objective": ["No pain on palpation of paws"],
    "assessment": "Cause unclear [confirm: assessment]",
    "plan": "Refer for ultrasound",
    "vitals": {},
    "medications": [],
    "client_summary": "Next is an ultrasound.",
    "followups": [{"kind": "task", "reason": "Referral for ultrasound"}],
}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def client(replies: list[dict[str, Any]], calls: list[dict[str, Any]]) -> MuseClient:
    muse = MuseClient(replace(Settings(), model_api_key="KEY"))

    async def create(**kwargs: Any) -> Any:
        calls.append(kwargs)
        content = json.dumps(replies[min(len(calls), len(replies)) - 1])
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )

    muse._client.chat.completions.create = create  # type: ignore[union-attr,method-assign]
    return muse


def test_the_schema_requires_every_field_and_allows_no_others() -> None:
    s = strict_schema(NoteDraft.model_json_schema())
    assert set(s["required"]) == set(NoteDraft.model_fields)
    assert s["additionalProperties"] is False
    item = next(d for d in s["$defs"].values() if "properties" in d)
    assert item["additionalProperties"] is False
    # vitals is a map of any names, so it stays open
    assert s["properties"]["vitals"].get("additionalProperties") is not False


@pytest.mark.anyio
async def test_a_bad_reply_is_sent_back_once_with_what_was_wrong() -> None:
    calls: list[dict[str, Any]] = []
    draft = await client([REAL_REPLY, GOOD_REPLY], calls).structured(
        "system", "user", NoteDraft
    )
    assert len(calls) == 2
    retry = calls[1]["messages"][-1]["content"]
    assert "objective_final" in retry and "plan" in retry
    assert draft.objective == "- No pain on palpation of paws"  # list became bullets
    assert draft.plan == "Refer for ultrasound" and draft.followups[0].kind == "task"


@pytest.mark.anyio
async def test_when_the_retry_is_bad_too_nothing_said_is_lost() -> None:
    calls: list[dict[str, Any]] = []
    draft = await client([REAL_REPLY, REAL_REPLY], calls).structured(
        "system", "user", NoteDraft
    )
    assert len(calls) == 2
    assert draft.subjective.startswith("Owner reports Waffles")
    assert "No pain on touch of paws" in draft.objective  # *_final wins
    assert draft.assessment.startswith("Limping back legs")
    assert draft.plan == "- Refer to emergency center for ultrasound"
    assert draft.client_summary.startswith("We found no pain")
    assert draft.followups == []  # an item that can't be read is left out


@pytest.mark.anyio
async def test_a_reply_that_fits_is_used_as_is_with_one_call() -> None:
    calls: list[dict[str, Any]] = []
    draft = await client([GOOD_REPLY], calls).structured("system", "user", NoteDraft)
    assert len(calls) == 1 and draft.assessment.startswith("Cause unclear")


def _refusal(message: str, param: str | None = None) -> Exception:
    import httpx
    from openai import BadRequestError

    request = httpx.Request("POST", "https://api.meta.ai/v1/chat/completions")
    return BadRequestError(
        message,
        response=httpx.Response(400, request=request),
        body={"message": message, "param": param},
    )


def refusing(refusals: list[Exception], calls: list[dict[str, Any]]) -> MuseClient:
    """A client whose first calls are refused, one refusal each, then answer."""
    muse = client([GOOD_REPLY], calls)
    answer = muse._client.chat.completions.create  # type: ignore[union-attr]

    async def create(**kwargs: Any) -> Any:
        if refusals:
            calls.append(kwargs)
            raise refusals.pop(0)
        return await answer(**kwargs)

    muse._client.chat.completions.create = create  # type: ignore[union-attr,method-assign]
    return muse


@pytest.mark.anyio
async def test_a_setting_the_api_never_takes_is_left_out_from_then_on(
    caplog: pytest.LogCaptureFixture,
) -> None:
    calls: list[dict[str, Any]] = []
    unsupported = _refusal(
        "Unsupported parameter: 'max_tokens' is not supported with this model.",
        "max_tokens",
    )
    muse = refusing([unsupported], calls)
    await muse.structured("system", "user", NoteDraft)
    assert "max_tokens" in calls[0] and "max_tokens" not in calls[1]
    assert calls[1]["temperature"] == 0.2  # only the named one is left out
    assert "refused max_tokens; left out from now on" in caplog.text
    await muse.structured("system", "user", NoteDraft)
    assert "max_tokens" not in calls[2] and "temperature" in calls[2]


@pytest.mark.anyio
async def test_a_refused_value_is_left_out_for_that_call_only(
    caplog: pytest.LogCaptureFixture,
) -> None:
    calls: list[dict[str, Any]] = []
    too_big = _refusal("max_tokens is too large: 12288. Use at most 8192.")
    muse = refusing([too_big], calls)
    await muse.structured("system", "user", NoteDraft, max_tokens=12288)
    assert "max_tokens" not in calls[1] and "temperature" in calls[1]
    assert "left out for this call" in caplog.text
    await muse.structured("system", "user", NoteDraft)
    assert calls[2]["max_tokens"] == 4096  # the runaway guard is back


@pytest.mark.anyio
async def test_a_refusal_that_names_no_setting_keeps_them() -> None:
    calls: list[dict[str, Any]] = []
    no_schema = _refusal("response_format json_schema is not available.")
    muse = refusing([no_schema], calls)
    await muse.structured("system", "user", NoteDraft)
    # Plain JSON mode instead, with temperature and max_tokens still sent.
    assert calls[1]["response_format"] == {"type": "json_object"}
    assert calls[1]["temperature"] == 0.2 and calls[1]["max_tokens"] == 4096
