"""Build a self-contained Pages artifact from explicitly allowed public files."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "site"


def build():
    # Fixed, verified destination: never package .git, venv, scores or agent settings.
    if OUTPUT.resolve() != ROOT.resolve() / "build" / "site":
        raise RuntimeError("Unexpected build destination")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for name in ("index.html", "styles.css", "game.js", "audio.js", "app.js"):
        shutil.copy2(ROOT / "web" / name, OUTPUT / name)
    shutil.copytree(ROOT / "assets", OUTPUT / "assets")
    for name in ("LICENSE", "THIRD_PARTY.md"):
        shutil.copy2(ROOT / name, OUTPUT / name)
    (OUTPUT / ".nojekyll").touch()
    count = sum(p.is_file() for p in OUTPUT.rglob("*"))
    print(f"Built {count} public files in {OUTPUT}")


if __name__ == "__main__":
    build()
