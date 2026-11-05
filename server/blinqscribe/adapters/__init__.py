from __future__ import annotations

from ..config import Settings
from ..schemas import WriteBackResult
from .base import PracticeAdapter
from .mock import MockAdapter


def build_adapter(settings: Settings) -> PracticeAdapter:
    # "mock" is the built-in demo PIMS. A clinic's own PIMS connector implements
    # base.PracticeAdapter and is added here under its own PRACTICE_ADAPTER value.
    if settings.practice_adapter != "mock":
        raise ValueError(
            f"Unknown PRACTICE_ADAPTER {settings.practice_adapter!r}. "
            "Use 'mock', or add your PIMS connector here."
        )
    return MockAdapter(
        booking_url_template=settings.booking_url_template,
        # what signing writes to the mock practice system, kept across restarts
        state_file=settings.data_dir / "mock_practice_system.json",
    )


__all__ = ["MockAdapter", "PracticeAdapter", "WriteBackResult", "build_adapter"]
