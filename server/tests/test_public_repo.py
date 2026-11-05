"""Guard: Blinq Scribe is a public repo. Its code never uses the startup's private
packages, never names the startup's platform, and no file names its private partners."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP = {
    "node_modules",
    "dist",
    ".venv",
    ".turbo",
    "var",
    "private",
    "__pycache__",
    ".omc",
    ".claude",
    "test-results",
    "playwright-report",
}
# Not shared code: other sessions own these apps, and LICENSE keeps the copyright line.
OUTSIDE = {"glasses-ios", "mobile"}
CODE_PLACES = (
    "server/blinqscribe",
    "server/tests",
    "server/migrations",
    "web/src",
    "web/e2e",
    "packages",
)
# Top-level config files of the repo, the server and the web app.
CONFIG_DIRS = (".", "server", "web", "packages/tokens", "packages/ui")
NOT_CODE = {"LICENSE", ".env", "pnpm-lock.yaml"}
THIS_FILE = Path(__file__).resolve()
PARTNER_WORDS = ("bitwerx", "idexx")


def _tracked() -> list[Path]:
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True
        ).stdout.decode()
        files = [ROOT / name for name in out.split("\0") if name]
    except OSError, subprocess.CalledProcessError:
        files = [p for p in ROOT.rglob("*") if p.is_file()]
    return [
        p
        for p in files
        if p.is_file()
        and not SKIP & set(p.relative_to(ROOT).parts)
        and p.relative_to(ROOT).parts[0] not in OUTSIDE
    ]


def _shared_code() -> list[Path]:
    code = []
    for path in _tracked():
        rel = path.relative_to(ROOT)
        if path.suffix == ".md" or path.name in NOT_CODE:
            continue
        in_place = any(rel.as_posix().startswith(place + "/") for place in CODE_PLACES)
        is_config = rel.parent.as_posix() in CONFIG_DIRS
        if (in_place or is_config) and path.resolve() != THIS_FILE:
            code.append(path)
    return code


def test_the_guard_sees_the_code() -> None:
    names = {p.relative_to(ROOT).as_posix() for p in _shared_code()}
    assert "server/blinqscribe/api.py" in names
    assert "web/src/i18n/en.ts" in names
    assert "packages/tokens/src/index.ts" in names
    assert "package.json" in names and ".env.example" in names


def test_no_private_vetengage_packages() -> None:
    for path in _shared_code():
        assert "@vetengage/" not in path.read_text(errors="ignore"), path
    for manifest in [ROOT / "package.json", *ROOT.glob("web/package.json")]:
        if manifest.exists():
            data = json.loads(manifest.read_text())
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            assert not [d for d in deps if d.startswith("@vetengage")], manifest


def test_shared_code_never_names_the_platform() -> None:
    for path in _shared_code():
        text = path.read_text(errors="ignore").lower()
        assert "vetengage" not in text, path.relative_to(ROOT)


def test_no_partner_names_in_code_or_docs() -> None:
    docs = [p for p in _tracked() if p.suffix == ".md"]
    for path in [*_shared_code(), *docs]:
        text = path.read_text(errors="ignore").lower()
        for word in PARTNER_WORDS:
            assert word not in text, f"{word} in {path.relative_to(ROOT)}"
