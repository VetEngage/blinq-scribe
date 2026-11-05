# Types for the part of ONNX Runtime the read-aloud voice uses.
from typing import Any

import numpy as np
import numpy.typing as npt

class InferenceSession:
    def __init__(self, path: str, providers: list[str] | None = None) -> None: ...
    def run(
        self, output_names: list[str] | None, input_feed: dict[str, npt.NDArray[Any]]
    ) -> list[npt.NDArray[np.float32]]: ...
