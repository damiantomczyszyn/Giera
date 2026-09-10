"""Prepare immutable-code review worktrees and collect SHA-bound Claude reports.

No model API, credentials, resets, merges or pushes. Each revision gets its own
directory; existing reviews are never replaced or removed.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(root, *args):
    result = subprocess.run(["git", "-C", str(root), *args], text=True,
                            encoding="utf-8", capture_output=True, check=True)
    return result.stdout.strip()


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def prepare(root, revision="HEAD", base=None):
    root = root.resolve()
    if git(root, "status", "--porcelain"):
        raise ValueError("Commit or separately preserve pending work before preparing a review.")
    sha = git(root, "rev-parse", "--verify", f"{revision}^{{commit}}")
    base_sha = git(root, "rev-parse", "--verify", f"{base or sha + '^'}^{{commit}}")
    review_parent = root.parent / (root.name + "-reviews")
    target = (review_parent / sha[:12]).resolve()
    if target.parent != review_parent.resolve():
        raise ValueError("Unexpected worktree destination")
    if target.exists():
        raise ValueError(f"Review already exists at {target}; it was not changed.")
    review_parent.mkdir(exist_ok=True)
    git(root, "worktree", "add", "--detach", str(target), sha)
    git(root, "worktree", "lock", "--reason", f"Claude review of {sha}", str(target))
    metadata = {"revision": sha, "base": base_sha, "worktree": str(target),
                "developer": str(root), "report": str(target / "REVIEW.md")}
    session_text = json.dumps(metadata, indent=2, ensure_ascii=False)
    write(root / ".reviews" / sha[:12] / "session.json", session_text)
    write(root / ".reviews" / "latest.json", session_text)
    write(target / ".review" / "session.json", session_text)
    write(target / ".review" / "changes.patch", git(root, "diff", "--no-ext-diff", base_sha, sha))
    write(target / "REVIEW.md", f"""# Recenzja Claude Code

Reviewed-Commit: {sha}
Verdict: NOT_REVIEWED
Reviewer: Claude Code

## Zgłoszenia

Nie przeprowadzono jeszcze recenzji. Zastąp ten tekst konkretnymi ustaleniami.
Dla każdego: R-001, P1/P2/P3, plik:linia, reprodukcja, oczekiwane zachowanie.

## Testy

Podaj wykonane komendy, wyniki i środowisko. Oddziel uruchomione testy od analizy kodu.

## Niesprawdzone

Podaj ograniczenia oraz testy, których nie udało się wykonać.
""")
    write(target / ".review" / "REVIEW_PROMPT.md", f"""Jesteś niezależnym testerem Claude Code. Codex jest autorem i wykonuje poprawki.
Oceniasz wyłącznie commit {sha}, względem bazy {base_sha}.
Katalog roboczy: {target}. To osobny worktree z detached HEAD.

Przeczytaj AGENTS.md, PROJECT_CONTEXT.md, docs/AGENT_WORKFLOW.md i .review/changes.patch.
Wymagania użytkownika: ulepszona grywalna Kapitan Dupa z oryginalnymi SVG i głosami,
naciśnięcie/puszczenie, +10 punktów, dokładne 9 sekund, telefon i komputer, GitHub Pages.
Sprawdź niezależnie poprawność, regresje, dostępność, bezpieczeństwo danych i zgodność
z założeniami. Nie traktuj deklaracji autora ani zielonego CI jako dowodu wszystkiego.

Nie zmieniaj kodu, testów, zależności ani gałęzi. Jedyny edytowany plik śledzony to
REVIEW.md. Testy mogą tworzyć ignorowane build/ i test-results/. Nie wykonuj push/merge.
Nie czytaj aktywnego katalogu Codexa; oceniasz zamrożony snapshot, nie jego nowe zmiany.

Uruchom npm test, python scripts/build_web.py, npm run test:browser.
Na Windows z Edge ustaw BROWSER_CHANNEL=msedge (konfiguracja lokalna już to ustawia).
Jeżeli nie masz narzędzia lub dostępu, opisz ograniczenie, nie udawaj wykonania testu.
Możesz badać stronę w przeglądarce własnymi dostępnymi narzędziami.

Zapisz cały raport w REVIEW.md, zachowując Reviewed-Commit: {sha}.
Wybierz Verdict: PASS, CHANGES_REQUESTED lub BLOCKED. Dla błędów zapisz R-xxx,
priorytet, plik:linia, kroki i dowód. Oddziel rzeczywiste błędy od sugestii.
Na końcu git diff --check i git status --short; poza REVIEW.md kod ma być niezmieniony.
Nie naprawiaj samodzielnie — odpowiedź autora trafi do nowej rewizji i następnego review.
""")
    protected = ["web/**", "assets/**", "tests/**", "scripts/**", ".github/**",
                 "kapitan_dupa.py", "main.py", "package*.json", "requirements.txt"]
    config = {"permissions": {"defaultMode": "default", "allow": [
        "Read", "Glob", "Grep", "Bash(npm test)", "Bash(python scripts/build_web.py)",
        "Bash(npm run test:browser)", "Bash(git status --short)", "Bash(git diff --check)",
        "Bash(git rev-parse HEAD)", "Edit(./REVIEW.md)", "Write(./REVIEW.md)"],
        "deny": [f"{tool}(./{path})" for path in protected for tool in ("Edit", "Write")]
            + ["Bash(git push *)", "Bash(git commit *)", "Bash(git reset *)",
               "Bash(git checkout *)", "Bash(git switch *)", "Bash(git merge *)"]}}
    edge = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
    if edge.exists():
        config["env"] = {"BROWSER_CHANNEL": "msedge"}
    write(target / ".claude" / "settings.local.json", json.dumps(config, indent=2))
    write(target / ".review" / "START_CLAUDE.ps1", """$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw 'Claude Code CLI is unavailable. Open this folder in Claude Code and read .review/REVIEW_PROMPT.md.'
}
& claude --permission-mode default --append-system-prompt-file "$PSScriptRoot/REVIEW_PROMPT.md" 'Wykonaj niezalezna recenzje zgodnie z .review/REVIEW_PROMPT.md i zapisz REVIEW.md.'
""")
    return metadata


def parse_report(text, sha):
    commit = re.search(r"^Reviewed-Commit:\s*([0-9a-f]{40})\s*$", text, re.M)
    verdict = re.search(r"^Verdict:\s*(PASS|CHANGES_REQUESTED|BLOCKED)\s*$", text, re.M)
    if not commit or commit[1] != sha:
        raise ValueError("Report belongs to another commit or has no Reviewed-Commit header.")
    if not verdict:
        raise ValueError("Claude has not supplied a valid review verdict yet.")
    return verdict[1]


def collect(root, session_path):
    root = root.resolve()
    metadata = json.loads(session_path.read_text(encoding="utf-8"))
    sha = metadata["revision"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Invalid revision")
    expected = (root.parent / (root.name + "-reviews") / sha[:12]).resolve()
    target = Path(metadata["worktree"]).resolve()
    if target != expected or Path(metadata["developer"]).resolve() != root:
        raise ValueError("Review worktree is outside the expected project location.")
    if git(target, "rev-parse", "HEAD") != sha:
        raise ValueError("Reviewer HEAD has changed; do not attribute this report to the original snapshot.")
    changed = set(git(target, "diff", "--name-only", sha).splitlines())
    extra = set(git(target, "ls-files", "--others", "--exclude-standard").splitlines())
    if changed - {"REVIEW.md"} or extra:
        raise ValueError("Reviewer modified code or added untracked files. Preserve them and inspect before collecting.")
    text = (target / "REVIEW.md").read_text(encoding="utf-8")
    verdict = parse_report(text, sha)
    destination = root / "reviews" / sha[:12] / "CLAUDE_REVIEW.md"
    if destination.exists() and destination.read_text(encoding="utf-8") != text:
        raise ValueError("An earlier report exists for this revision; it was not overwritten.")
    if git(root, "diff", "HEAD", "--", "REVIEW.md"):
        raise ValueError("Developer REVIEW.md contains pending edits; preserve them before importing.")
    write(destination, text)
    write(root / "REVIEW.md", text)
    return {"verdict": verdict, "revision": sha, "current": git(root, "rev-parse", "HEAD") == sha,
            "report": str(destination)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    prep = sub.add_parser("prepare")
    prep.add_argument("--revision", default="HEAD")
    prep.add_argument("--base", help="Comparison base (default: parent of revision)")
    take = sub.add_parser("collect")
    take.add_argument("--session", type=Path, default=ROOT / ".reviews" / "latest.json")
    args = parser.parse_args()
    try:
        result = prepare(ROOT, args.revision, args.base) if args.command == "prepare" else collect(ROOT, args.session)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Review workflow: {exc}\n")


if __name__ == "__main__":
    main()
