from dataclasses import replace
from types import SimpleNamespace

import anyio

from blinqscribe import vision
from blinqscribe.vision import Vision, parse_sam_output

# Shape from the SAM 3.1 docs ("Reading segmentation output"), mask payloads shortened.
SAMPLE = (
    "<0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561;c=0.91|><|mask;x=0;y=0;c=0.9;data=46,101,!abc|>,"
    "1<|box;x1=260;y1=382;x2=340;y2=427;w=537;h=561;c=0.42|><|mask;x=0;y=0;c=0.4;data=46,81,!def|>"
)


def test_parse_boxes_to_fractions():
    regions = parse_sam_output(SAMPLE, "mass")
    assert len(regions) == 2
    first = regions[0]
    assert first["label"] == "mass" and first["score"] == 0.91
    assert first["box"] == [
        round(353 / 537, 4),
        round(382 / 561, 4),
        round(453 / 537, 4),
        round(427 / 561, 4),
    ]
    assert first["area_px"] == 100 * 45
    assert all(0 <= v <= 1 for r in regions for v in r["box"])


def test_parse_empty_and_no_confidence():
    assert parse_sam_output("", "mass") == []
    (r,) = parse_sam_output(
        "<0f>3<|box;x1=0;y1=0;x2=10;y2=20;w=100;h=100|><|mask;x=0;y=0;data=1,1,~x|>",
        "tooth",
    )
    assert r["score"] == 0.0 and r["box"] == [0.0, 0.0, 0.1, 0.2]


class _FakeStream:
    def __init__(self, deltas):
        self.events = (
            [SimpleNamespace(type="response.created")]
            + [
                SimpleNamespace(type="response.output_text.delta", delta=d)
                for d in deltas
            ]
            + [SimpleNamespace(type="response.completed")]
        )

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for e in self.events:
            yield e


def _fake_client(deltas, calls):
    class FakeResponses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return _FakeStream(deltas)

    class FakeClient:
        def __init__(self, **kwargs):
            calls.append(kwargs)
            self.responses = FakeResponses()

    return FakeClient


def test_segment_live_request_and_parse(settings, monkeypatch):
    calls = []
    half = len(SAMPLE) // 2
    monkeypatch.setattr(
        vision, "AsyncOpenAI", _fake_client([SAMPLE[:half], SAMPLE[half:]], calls)
    )
    v = Vision(
        replace(settings, sam_endpoint="https://api.meta.ai/v1", sam_api_key="k"),
        muse=None,
    )

    regions = anyio.run(v.segment, b"\x89PNG fake", "mass")

    client_kwargs, req = calls
    assert (
        client_kwargs["base_url"] == "https://api.meta.ai/v1"
        and client_kwargs["api_key"] == "k"
    )
    assert req["model"] == "sam-3.1" and req["stream"] is True
    text_part, image_part = req["input"][0]["content"]
    assert text_part == {"type": "input_text", "text": "mass"}
    assert image_part["image_url"].startswith("data:image/png;base64,")
    assert len(regions) == 2 and regions[1]["score"] == 0.42


def test_segment_live_no_match(settings, monkeypatch):
    monkeypatch.setattr(vision, "AsyncOpenAI", _fake_client([], []))
    v = Vision(replace(settings, sam_endpoint="https://api.meta.ai/v1"), muse=None)
    assert anyio.run(v.segment, b"jpeg", "") == []
