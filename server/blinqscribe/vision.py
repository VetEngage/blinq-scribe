"""Exam photos from the glasses: Muse Spark describes, SAM 3.1 outlines.

SAM 3.1 takes a text prompt ("wound", "mass", "tooth") and returns masks for
every match. We store the box and area of each mask with the photo so the
note can say "2 regions found" and the console can draw the outlines.

SAM 3.1 on Meta Model API is the Responses API with model "sam-3.1". It
streams special-token text, one line per frame, one record per object:
  <0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561;c=0.91|><|mask;...|>,1<|box;...|>...
Boxes are pixel corners on the source image; w and h are the image size.
No match is an empty stream, not an error.
"""

from __future__ import annotations

import re
from typing import Any

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from . import images
from .config import Settings
from .llm import MuseClient
from .prompts import PHOTO_SYSTEM

_BOX = re.compile(r"<\|box;([^|]*)\|>")


def _mime(image: bytes) -> str:
    return "image/png" if image.startswith(b"\x89PNG") else "image/jpeg"


def parse_sam_output(text: str, label: str) -> list[dict[str, Any]]:
    """SAM 3.1 output text -> [{label, score, box: 0..1 fractions, area_px}].

    area_px is the box area in source pixels; we do not decode the mask payload.
    """
    regions = []
    for m in _BOX.finditer(text):
        f = dict(kv.split("=", 1) for kv in m.group(1).split(";") if "=" in kv)
        w, h = float(f["w"]), float(f["h"])
        x1, y1, x2, y2 = (float(f[k]) for k in ("x1", "y1", "x2", "y2"))
        regions.append(
            {
                "label": label,
                "score": float(f.get("c", 0)),
                "box": [
                    round(x1 / w, 4),
                    round(y1 / h, 4),
                    round(x2 / w, 4),
                    round(y2 / h, 4),
                ],
                "area_px": int((x2 - x1) * (y2 - y1)),
            }
        )
    return regions


class PhotoReading(BaseModel):
    caption: str = Field(
        max_length=120,
        description="What is visible, in a few words, like 'Left ear canal'",
    )
    findings: str

    @staticmethod
    def fallback(field: str, item: dict[str, Any]) -> str:
        return "Exam photo"


class Vision:
    def __init__(self, settings: Settings, muse: MuseClient):
        self.settings = settings
        self.muse = muse

    async def describe(self, image: bytes, hint: str = "") -> PhotoReading:
        if not self.muse.enabled:
            return PhotoReading(
                caption=hint or "Exam photo",
                findings="[mock] Photo saved. Connect MODEL_API_KEY to get a Muse "
                "Spark description.",
            )
        user = f"The vet said: {hint}" if hint else "Describe this exam photo."
        return await self.muse.structured(
            PHOTO_SYSTEM,
            user,
            PhotoReading,
            images=[MuseClient.image_part(image, _mime(image))],
        )

    async def segment(self, image: bytes, prompt: str) -> list[dict[str, Any]]:
        """Returns [{label, score, box: [x0, y0, x1, y1] as 0..1 fractions, area_px}]"""
        if not self.settings.sam_endpoint:
            return [
                {
                    "label": prompt or "region",
                    "score": 0.0,
                    "box": [0.35, 0.35, 0.65, 0.65],
                    "area_px": 0,
                    "mock": True,
                }
            ]
        label = prompt or "lesion"
        # Without EXIF, SAM sees the raw pixels for sure; the outline is turned upright
        # from those (schemas.outline_of).
        image = images.strip_exif(image)
        client = AsyncOpenAI(
            base_url=self.settings.sam_endpoint,
            api_key=self.settings.sam_api_key or "none",
            timeout=60,
        )
        # One concept per request: SAM 3.1 returns nothing for "a, b" lists.
        # SAM's input and stream events are not OpenAI's typed ones, so the call is
        # untyped.
        request: dict[str, Any] = {
            "model": self.settings.sam_model,
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": label},
                        {
                            "type": "input_image",
                            "image_url": MuseClient.image_part(image, _mime(image))[
                                "image_url"
                            ]["url"],
                        },
                    ],
                }
            ],
            "stream": True,
            "metadata": {"include_confidence": "true", "mask_encoding": "one_bit"},
        }
        stream = await client.responses.create(**request)
        text = "".join(
            [e.delta async for e in stream if e.type == "response.output_text.delta"]
        )
        return parse_sam_output(text, label)
