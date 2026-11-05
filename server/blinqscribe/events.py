"""Progress events while Blinq works: each step of drafting a note, and what Ask Blinq
is checking before it answers. GraphQL subscriptions stream them (requirement 58).

In-process, like the per-visit locks in api.py: run one server worker, or move this
to a shared broker before scaling out. Each topic keeps its latest run, so a screen
that subscribes a moment after the work started, or just after a quick mock draft
finished, still sees every step.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import OrderedDict, defaultdict
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

Event = dict[str, Any]

REPLAY_SECONDS = 30.0  # a finished run is replayed to late subscribers this long
MAX_TOPICS = 500


class _Run:
    def __init__(self) -> None:
        self.events: list[tuple[Event, bool]] = []
        self.finished_at: float | None = None

    def replayable(self) -> bool:
        return (
            self.finished_at is None
            or time.monotonic() - self.finished_at < REPLAY_SECONDS
        )


class Events:
    def __init__(self) -> None:
        self._runs: OrderedDict[str, _Run] = OrderedDict()
        self._listeners: defaultdict[str, set[asyncio.Queue[tuple[Event, bool]]]] = (
            defaultdict(set)
        )

    def run(self, topic: str, **fields: Any) -> Run:
        """Start a new run on a topic. Earlier runs are no longer replayed."""
        self._runs[topic] = _Run()
        self._runs.move_to_end(topic)
        while len(self._runs) > MAX_TOPICS:
            self._runs.popitem(last=False)
        return Run(self, topic, {"run_id": uuid.uuid4().hex[:10], **fields})

    def publish(self, topic: str, event: Event, last: bool = False) -> None:
        run = self._runs.get(topic)
        if run:
            run.events.append((event, last))
            if last:
                run.finished_at = time.monotonic()
        for queue in self._listeners.get(topic, ()):
            queue.put_nowait((event, last))

    async def subscribe(self, topic: str) -> AsyncIterator[Event]:
        """The current run's events so far, then new ones, until the run ends."""
        queue: asyncio.Queue[tuple[Event, bool]] = asyncio.Queue()
        run = self._runs.get(topic)
        # No await between the snapshot and listening, so no event is missed or doubled.
        backlog = list(run.events) if run and run.replayable() else []
        self._listeners[topic].add(queue)
        try:
            for event, last in backlog:
                yield event
                if last:
                    return
            while True:
                event, last = await queue.get()
                yield event
                if last:
                    return
        finally:
            self._listeners[topic].discard(queue)
            if not self._listeners[topic]:
                del self._listeners[topic]


class Run:
    """One run: a note being drafted, or one Ask Blinq turn. An empty topic sends
    nothing (a REST caller that isn't following along)."""

    def __init__(self, events: Events | None, topic: str, fields: Event) -> None:
        self._events, self._topic, self._fields = events, topic, fields

    def emit(self, last: bool = False, **fields: Any) -> None:
        if self._events and self._topic:
            event = {**self._fields, **fields, "at": datetime.now(UTC)}
            self._events.publish(self._topic, event, last)


def draft_topic(encounter_id: str) -> str:
    return f"draft:{encounter_id}"


def turn_topic(turn_id: str) -> str:
    return f"turn:{turn_id}"
