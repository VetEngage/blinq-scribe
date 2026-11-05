"""Entry point: `uvicorn blinqscribe.main:app` (run from the server/ folder)."""

from .api import create_app
from .config import load_dotenv
from .config import parse_env_value as parse_env_value

load_dotenv()
app = create_app()
