# The part of pycasbin Blinq Scribe uses (it ships no types).
class Enforcer:
    def __init__(
        self,
        model: str | None = ...,
        adapter: str | None = ...,
        enable_log: bool = ...,
    ) -> None: ...
    def enforce(self, *rvals: str) -> bool: ...
    def get_filtered_policy(
        self, field_index: int, *field_values: str
    ) -> list[list[str]]: ...
