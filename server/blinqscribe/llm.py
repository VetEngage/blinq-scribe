"""Muse Spark client over Meta Model API (OpenAI compatible).

Base URL https://api.meta.ai/v1, model muse-spark-1.1, bearer MODEL_API_KEY.
The OpenAI SDK does not read MODEL_API_KEY on its own, so we pass it in.
"""

from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any, TypeVar

from openai import AsyncOpenAI, BadRequestError
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessage,
    ChatCompletionMessageParam,
)
from pydantic import BaseModel, ValidationError

from .config import Settings

T = TypeVar("T", bound=BaseModel)
log = logging.getLogger("blinqscribe.llm")
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
# Structured replies: steady wording, and a cap so a runaway reply ends. The cap
# counts Muse Spark's reasoning too: real note and letter drafts took 3,600 to 6,600
# tokens and a short reply (photo, record, Remember) about 1,500, so each cap is
# about twice what it needs. Schemas have fixed fields only: an open map (the old
# `vitals`) is where it padded the JSON with spaces until the cap.
TEMPERATURE = 0.2
LONG_TOKENS = 12288
SECTION_TOKENS = 8192
SHORT_TOKENS = 4096
# A refusal that says the API never takes a parameter (not just this value of it).
_UNSUPPORTED = re.compile(
    r"unsupported (?:parameter|value)|n(?:o|')t supported|unrecognized|unknown param|"
    r"unexpected keyword|extra (?:inputs|fields) (?:are )?not permitted",
    re.I,
)

# A short field (a label, a one-line item) is garbled when it has runs of
# punctuation ("??", "..", "~?"), mostly symbols, or one word over and over.
_PUNCT_RUN = re.compile(r"[?~!]{2}|\.\.|[^\w\s]\s*[?~]|\?\s*[^\w\s]")
_WORD = re.compile(r"[A-Za-z]{3,}")


def garbled(text: str) -> bool:
    """A short label the model lost the thread on."""
    if _PUNCT_RUN.search(text):
        return True
    symbols = sum(1 for c in text if not (c.isalnum() or c.isspace()))
    if text and symbols / len(text) > 0.2:
        return True
    words = [w.lower() for w in _WORD.findall(text)]
    return any(words.count(w) >= 4 for w in set(words))


def runaway(text: str, limit: int = 320) -> bool:
    """A sentence or two the model lost the thread on: far too long, a phrase said
    over and over, or mostly not words."""
    if len(text) > limit or _PUNCT_RUN.search(text):
        return True
    words = re.findall(r"[a-z']+", text.lower())
    runs = [" ".join(words[i : i + 3]) for i in range(len(words) - 2)]
    if any(runs.count(r) >= 3 for r in set(runs)):
        return True
    letters = sum(c.isalpha() or c.isspace() for c in text)
    return bool(text) and letters / len(text) < 0.75


def _short_fields(schema: type[BaseModel]) -> dict[str, int]:
    """Text fields with a length limit, which are labels, by name: their limit."""
    out = {}
    for name, field in schema.model_fields.items():
        limit = next((getattr(m, "max_length", None) for m in field.metadata), None)
        if field.annotation is str and limit:
            out[name] = limit
    return out


def _nested(schema: type[BaseModel]) -> dict[str, type[BaseModel]]:
    """List fields of models (follow ups in a note draft), by name: the item model."""
    out = {}
    for name, field in schema.model_fields.items():
        args = getattr(field.annotation, "__args__", ())
        if (
            getattr(field.annotation, "__origin__", None) is list
            and args
            and isinstance(args[0], type)
            and issubclass(args[0], BaseModel)
        ):
            out[name] = args[0]
    return out


def _bad_labels(
    data: dict[str, Any], schema: type[BaseModel], fix: bool = False, where: str = ""
) -> list[str]:
    """The short fields that are too long or garbled, as readable names. With fix,
    each is replaced by the model's fallback (`fallback(name, item)`), or emptied,
    so the junk never reaches the screen."""
    bad = []
    for name, limit in _short_fields(schema).items():
        value = data.get(name)
        if isinstance(value, str) and (len(value) > limit or garbled(value)):
            bad.append(f"{where}{name}")
            if fix:
                fallback = getattr(schema, "fallback", None)
                data[name] = fallback(name, data) if fallback else ""
    for name, item_schema in _nested(schema).items():
        items = data.get(name)
        if isinstance(items, list):
            for i, item in enumerate(items):
                if isinstance(item, dict):
                    bad += _bad_labels(item, item_schema, fix, f"{where}{name}[{i}].")
    return bad


def strict_schema(node: Any) -> Any:
    """Every object in a JSON schema lists all its properties as required and allows
    no others. Map-like objects (no `properties`, e.g. vitals) stay open."""
    if isinstance(node, dict):
        out = {k: strict_schema(v) for k, v in node.items()}
        if isinstance(out.get("properties"), dict):
            out["required"] = list(out["properties"])
            out["additionalProperties"] = False
        return out
    if isinstance(node, list):
        return [strict_schema(v) for v in node]
    return node


def _coerce(data: dict[str, Any], schema: type[BaseModel]) -> dict[str, Any]:
    """Text fields the model sent as a list of points become bullet lines, and
    nulls become the field's default."""
    out = dict(data)
    for name, field in schema.model_fields.items():
        value = out.get(name)
        if value is None and name in out:
            del out[name]
        elif field.annotation is str and isinstance(value, list):
            out[name] = "\n".join(f"- {v}" for v in value if v not in (None, ""))
    return out


def _check(raw: str, schema: type[BaseModel]) -> tuple[dict[str, Any], str]:
    """The reply as data, and what is wrong with it ("" when it fits)."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}, "That reply wasn't valid JSON."
    if not isinstance(data, dict):
        return {}, "That reply wasn't a JSON object."
    data = _coerce(data, schema)
    extra = sorted(set(data) - set(schema.model_fields))
    if extra:
        return data, f"Your reply used fields that don't exist: {', '.join(extra)}."
    if bad := _bad_labels(data, schema):
        return data, (
            f"These should be short, plain labels, but were too long or garbled: "
            f"{', '.join(bad)}. Write each as a few plain words, like "
            "'Recheck right ear in 2 weeks'."
        )
    try:
        schema.model_validate(data)
    except ValidationError as exc:
        return data, f"Your reply didn't match the schema: {exc.errors()[0]['msg']}."
    return data, ""


_PREFERRED_SUFFIXES = ("final", "note", "")


def _salvage[M: BaseModel](data: dict[str, Any], schema: type[M]) -> M:
    """Last resort after a retry: take an empty field's content from a near-named
    field the model invented ("plan_final" for `plan`), drop the rest, and leave out
    list items or fields that still don't validate."""
    fields = schema.model_fields
    out = {k: v for k, v in data.items() if k in fields}
    _bad_labels(out, schema, fix=True)
    for name in fields:
        if out.get(name) not in (None, "", [], {}):
            continue
        near = {
            k[len(name) + 1 :]: v
            for k, v in data.items()
            if k.startswith(name + "_") and k not in fields and v not in (None, "", [])
        }
        for suffix in _PREFERRED_SUFFIXES:
            pick = near.get(suffix) if suffix else next(iter(near.values()), None)
            if pick is not None:
                out[name] = pick
                break
    out = _coerce(out, schema)
    for _ in range(5):
        try:
            return schema.model_validate(out)
        except ValidationError as exc:
            for err in exc.errors():
                loc = err["loc"]
                value = out.get(str(loc[0])) if loc else None
                if len(loc) > 1 and isinstance(loc[1], int) and isinstance(value, list):
                    value[loc[1]] = None  # dropped below, so indexes stay valid
                elif loc:
                    out.pop(str(loc[0]), None)
            out = {
                k: [i for i in v if i is not None] if isinstance(v, list) else v
                for k, v in out.items()
            }
    return schema.model_validate({})


class CutOff(Exception):
    """Muse Spark's reply ran on to the token cap, or came back empty, twice."""


class MuseClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.muse_model
        self.enabled = not settings.ai_is_mock
        # temperature or max_tokens, once the API has said it never takes them
        self._unsupported: set[str] = set()
        self._client = (
            AsyncOpenAI(base_url=settings.meta_base_url, api_key=settings.model_api_key)
            if self.enabled
            else None
        )

    @staticmethod
    def image_part(data: bytes, mime: str = "image/jpeg") -> dict[str, Any]:
        b64 = base64.b64encode(data).decode()
        return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}

    async def structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        images: list[dict[str, Any]] | None = None,
        max_tokens: int = SHORT_TOKENS,
        must_finish: bool = False,
    ) -> T:
        """Ask for JSON that matches a pydantic model.

        Every field is required and no other field is allowed, because the model
        otherwise invents names ("objective_final") that would be dropped quietly.
        A reply that still doesn't fit is sent back once with what was wrong; after
        that, fields are recovered by name and bad list items are left out. With
        must_finish, a reply that ran on to the token cap or came back empty both
        times raises CutOff instead of salvaging an empty answer.
        """
        assert self._client is not None, "MuseClient is in mock mode"
        content: Any = user if not images else [{"type": "text", "text": user}, *images]
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": system},
            {"role": "user", "content": content},
        ]
        json_schema = strict_schema(schema.model_json_schema())
        fmt: Any = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "schema": json_schema},
        }
        try:
            raw, finished = await self._complete(messages, fmt, max_tokens)
        except BadRequestError:
            messages[0]["content"] = (
                system
                + "\n\nReply with JSON only, with exactly these fields:\n"
                + json.dumps(json_schema)
            )
            fmt = {"type": "json_object"}
            raw, finished = await self._complete(messages, fmt, max_tokens)
        data, problem = _check(raw, schema)
        if not finished:
            problem = (
                "Your reply ran on until it was cut off. Reply again with just the "
                "JSON, without padding or repeated text."
            )
        if problem:
            if finished:  # show it what was wrong; a cut off reply is only noise
                messages.append({"role": "assistant", "content": raw})
            messages.append(
                {
                    "role": "user",
                    "content": f"{problem} Reply again with JSON that has exactly "
                    f"these fields and no others: {', '.join(schema.model_fields)}.",
                }
            )
            raw, finished = await self._complete(messages, fmt, max_tokens)
            data, problem = _check(raw, schema)
            if must_finish and (not finished or not raw.strip("{} \n")):
                raise CutOff("The model's reply ran on or came back empty twice.")
        return _salvage(data, schema) if problem else schema.model_validate(data)

    async def _complete(
        self,
        messages: list[ChatCompletionMessageParam],
        fmt: Any,
        max_tokens: int = SHORT_TOKENS,
    ) -> tuple[str, bool]:
        """The reply's text, and whether it finished (not cut off at the cap)."""
        assert self._client is not None
        settings: dict[str, Any] = {
            k: v
            for k, v in (("temperature", TEMPERATURE), ("max_tokens", max_tokens))
            if k not in self._unsupported
        }
        while True:
            try:
                resp = await self._client.chat.completions.create(
                    model=self.model, messages=messages, response_format=fmt, **settings
                )
                break
            except BadRequestError as exc:
                # Leave out only the setting the refusal names, for this call; for
                # good only when it says the API never takes it. max_tokens is the
                # guard against a runaway reply, so it's never dropped quietly.
                named = [k for k in settings if k == exc.param or k in str(exc)]
                if not named:
                    raise
                always = bool(_UNSUPPORTED.search(str(exc)))
                for k in named:
                    del settings[k]
                    if always:
                        self._unsupported.add(k)
                    log.warning(
                        "Muse Spark refused %s; left out %s: %s",
                        k,
                        "from now on" if always else "for this call",
                        exc,
                    )
        choice = resp.choices[0]
        text = _FENCE.sub("", choice.message.content or "{}").strip()
        return text, getattr(choice, "finish_reason", None) != "length"

    async def chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None
    ) -> ChatCompletionMessage:
        """One chat turn. Returns the assistant message (may contain tool_calls)."""
        assert self._client is not None, "MuseClient is in mock mode"
        kwargs: dict[str, Any] = {"model": self.model, "messages": messages}
        if tools:
            kwargs["tools"] = tools
        resp: ChatCompletion = await self._client.chat.completions.create(**kwargs)
        return resp.choices[0].message
