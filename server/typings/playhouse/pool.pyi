# Types for the part of Peewee's connection pool this server uses.
from typing import Any

class PooledDatabase:
    def __init__(
        self,
        database: str | None,
        max_connections: int = 20,
        stale_timeout: int | None = None,
        timeout: int | None = None,
        **kwargs: Any,
    ) -> None: ...
    def close_idle(self) -> None: ...
    def close_all(self) -> None: ...
