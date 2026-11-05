"""The schema as SDL, committed at web/schema.graphql for the web app to code against.

After changing the schema, from server/: `uv run python -m blinqscribe.gql.sdl`
"""

from __future__ import annotations

import sys
from pathlib import Path

from .schema import schema

SDL_PATH = Path(__file__).resolve().parents[3] / "web" / "schema.graphql"


def sdl() -> str:
    return schema.as_str() + "\n"


if __name__ == "__main__":
    SDL_PATH.write_text(sdl())
    sys.stdout.write(f"Wrote {SDL_PATH}\n")
