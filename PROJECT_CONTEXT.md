# Kontekst projektu

Cel użytkownika: ulepszona, grywalna Kapitan Dupa, z materiałami oryginalnej gry
https://github.com/Megaemce/KapitanDupa, publikowana w
https://github.com/damiantomczyszyn/Giera i na https://damiantomczyszyn.github.io/Giera/.

## Niezmienne założenia

Oryginalna postać i głosy, dwa stany SVG zależne od naciśnięcia/puszczenia,
9 sekund, +10 punktów za pełne kliknięcie, 9 progów mocy co 100 punktów.
Spacja, mysz i dotyk. Login do 5 znaków. Bez kont, backendu i globalnego rankingu.

## Architektura od edycji 02

- `web/index.html`, `styles.css`: responsywna oprawa arcade, PL, dostępne kontrolki.
- `web/game.js`: niezależny od DOM model rundy, monotoniczny deadline,
  pojedynczy właściciel naciśnięcia, walidacja i sortowanie wyników.
- `web/audio.js`: Web Audio odblokowane gestem, OGG → MP3, anulowanie sekwencji.
- `web/app.js`: integracja, fazy idle/loading/intro/playing/results/aborted,
  localStorage, ustawienia, wejście i renderowanie.
- `kapitan_dupa.py`, `main.py`: osobna gra desktop pygame; Python i venv
  pozostają dostępne. Web nie jest już uruchamiany przez WebAssembly.
- `scripts/build_web.py`: jawna lista plików publikowanych do `build/site`.
- `.github/workflows/deploy.yml`: testy → pakowanie → GitHub Pages.
- `tests/`: zasady rundy i prawdziwe testy przeglądarkowe Playwright.

Powód zmiany web: wcześniejsza warstwa pygbag wymagała pobierania interpretera,
miała błędy inicjalizacji pygame i SVG, a scores.json w WASM nie gwarantował
trwałości. Oryginał również był grą HTML/JS. Oddzielny web upraszcza hosting
i daje natywne kontrolki telefonu. Nie przywracaj starego workflow przypadkiem.

## Dane i ograniczenia

`kd.scores.v2`: top 10; `kd.stats.v2`: rundy, trafienia, rekord, ostatni wynik;
`kd.settings.v2`: dźwięk, głośność, szybki start, ograniczenie ruchu.
Starszy klucz `scores` jest odczytywany jako fallback. Desktop: `scores.json`.
Wyniki klienta nie są odporne na celowe modyfikacje DevTools — ranking jest lokalny.
Wejście punktuje przed deadline, przerwanie karty nie zapisuje niepełnej rundy.
Oryginalna narracja działa niezależnie od przejść UI; awaria audio nie blokuje gry.

Licencja i pochodzenie: `LICENSE`, `THIRD_PARTY.md`. Nie dodano śledzenia ani reklam.
