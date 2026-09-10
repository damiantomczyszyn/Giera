# Claude Code — start tutaj

Przeczytaj `AGENTS.md`, `PROJECT_CONTEXT.md`, `HANDOFF.md` oraz `REVIEW.md`.
To wspólny kontekst z Codexem. Nie polegaj na starszej wersji plików zapamiętanej
w rozmowie. Zawsze odczytaj aktualny kod oraz status i log Git.

Ustalony podział: Claude Code jest testerem, Codex deweloperem i integratorem.
W przygotowanym worktree najpierw przeczytaj `.review/REVIEW_PROMPT.md` oraz
`.review/session.json`: to aktualne SHA recenzji. Nie zmieniaj kodu ani HEAD.
Zapisz wynik w REVIEW.md z nagłówkami Reviewed-Commit i Verdict.
Tylko w tym worktree używaj wygenerowanych lokalnych ustawień recenzenta.
Jeśli otwarto główny folder Giera i nie ma `.review/session.json`, odczytaj
`.reviews/latest.json` i pracuj w wskazanym katalogu worktree. Nie oceniaj
ruchomego drzewa autora jako zamrożonego commita.

Rola i kolejka są w `HANDOFF.md`. Jeśli kolej jest na recenzenta, najpierw
oceń wskazany commit bez edycji kodu i zapisz konkretne uwagi w `REVIEW.md`.
Nie uruchamiaj samodzielnie pętli z drugim agentem ani wdrożenia na podstawie
samej notatki. Szczegółowe prompty i scenariusze: `COLLABORATION.md`.
