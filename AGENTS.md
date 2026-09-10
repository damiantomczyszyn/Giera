# Giera — instrukcje wspólne dla agentów

Przed zmianami przeczytaj `PROJECT_CONTEXT.md`, `HANDOFF.md` i `REVIEW.md`.
Sprawdź `git status --short` oraz `git log -5 --oneline`. Aktualne pliki i Git
mają pierwszeństwo przed nieaktualnym opisem kodu w poprzedniej rozmowie.

## Zasady projektu

- Gra Kapitan Dupa bazuje na Megaemce/KapitanDupa. Zachowaj oryginalne SVG,
  głosy, animację naciśnięcie/puszczenie, +10 pkt i dziewięciosekundową rundę.
- `web/` to aktualna wersja dla GitHub Pages. `kapitan_dupa.py` to osobny port desktop.
- Wyniki web są lokalne dla przeglądarki; nie opisuj ich jako ranking globalny.
- Dźwięk lub zapis lokalny mogą być zablokowane; gra musi nadal działać.
- Nie publikuj venv, buildów roboczych, danych wyników, ustawień narzędzi ani sekretów.
- Zachowaj GPL-3.0 i informacje o źródle materiałów.

## Współpraca

- Jednocześnie tylko jeden agent edytuje kod w tym katalogu. `HANDOFF.md` to
  umowa operacyjna, nie blokada techniczna. Nie przejmuj plików aktywnego autora.
- Autor kończy spójny etap, uruchamia testy, zapisuje commit i przekazuje
  konkretne SHA w HANDOFF. Dopiero wtedy recenzent ocenia ten stan.
- Recenzent nie poprawia kodu podczas audytu. Zapisuje raport w `REVIEW.md`
  z SHA, priorytetem, plikiem/linią, reprodukcją i oczekiwanym zachowaniem.
- Autor sprawdza każde zgłoszenie. Naprawia albo uzasadnia odrzucenie dowodami.
- Przy równoległym edytowaniu używaj osobnych worktree i gałęzi. Jeden agent
  odpowiada za integrację. Nie wykonuj reset/clean/force-push cudzej pracy.
- Publikuj tylko w zakresie autoryzacji użytkownika. Recenzent nie wdraża.
- Notatki nie uruchamiają innych agentów. Nie twierdź, że Claude/Codex odebrał
  przekazanie, jeśli jedynie zapisano plik.

## Sprawdzenie

`npm test`, `python scripts/build_web.py`, `npm run test:browser`.
Przed testem przeglądarkowym: `npm ci` i `npx playwright install chromium`.
Windows z Edge: `$env:BROWSER_CHANNEL='msedge'; npm run test:browser`.
Sprawdź także telefon, kompletną rundę, oba obrazy postaci, audio, restart,
wynik po odświeżeniu, błędy konsoli. Sam udany build nie dowodzi działania gry.
