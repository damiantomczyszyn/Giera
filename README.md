# Giera — Kapitan Dupa

**[Zagraj w przeglądarce →](https://damiantomczyszyn.github.io/Giera/)**

Edycja 02: responsywna gra arcade na komputer i telefon, z oryginalną postacią,
animacją oraz 13 nagraniami. Osobny port Python + pygame pozostaje dostępny lokalnie.
Wersja web działa bez pobierania interpretera Python i bez zewnętrznego CDN.

Oparte o [Megaemce/KapitanDupa](https://github.com/Megaemce/KapitanDupa) (GPL-3.0).
Oryginalne SVG i MP3 oraz konwersje OGG znajdują się w `assets/`.
Pochodzenie materiałów: [THIRD_PARTY.md](THIRD_PARTY.md).

## Co nowego w wersji web

- Oprawa arcade, interfejs PL i obsługa spacji, myszy oraz dotyku.
- Dokładne 9 sekund; +10 tylko za pełne naciśnięcie i puszczenie. Powtarzanie
  klawisza i jednoczesne źródła wejścia nie dublują trafień.
- Statystyki rundy: trafienia, kliknięcia/s, najlepsza sekunda i stopień Kapitana.
- Top 10, rekord i statystyki zapisane na danym urządzeniu. Bez kont
  i rankingu globalnego; wersja desktop ma własny `scores.json`.
- Oryginalne intro i głosy, głośność, wyciszenie (`M`), szybki start (3 s),
  pełny ekran tam, gdzie wspiera go przeglądarka, ograniczenie animacji.
- Awaria audio lub blokada localStorage nie blokuje gry. Ukrycie karty przerywa
  rundę; niepełny wynik nie jest zapisywany.
- Testy zasad oraz prawdziwej przeglądarki przed wdrożeniem.

## Uruchomienie lokalne

```bash
python -m venv venv
venv\Scripts\activate         # Windows
# source venv/bin/activate    # Linux/macOS
pip install -r requirements.txt
python kapitan_dupa.py
```

## Mechanika

- Ekran startowy — klik / `Spacja` aby rozpocząć
- Masz **9 sekund**: naciskaj i puszczaj `Spację` lub LPM jak najszybciej
- Każde puszczenie = **+10 punktów**; co 100 punktów zapala się jedna z 9 kropek `HIT`
- Web: po rundzie wpisz login (max 5 znaków) i zapisz wynik lokalnie lub od razu
  zagraj ponownie. Desktop zachowuje oryginalną sekwencję rekordu i loginu.

## Wersja przeglądarkowa (GitHub Pages)

Lokalna budowa i podgląd w przeglądarce:

```powershell
python scripts/build_web.py
python -m http.server 8000 --bind 127.0.0.1 --directory build/site
```

Otwórz `http://localhost:8000`. Nie otwieraj index.html jako file:// — moduły JS
i audio wymagają serwera HTTP. Build kopiuje wyłącznie publiczne pliki gry.

Deploy przez [.github/workflows/deploy.yml](.github/workflows/deploy.yml): push na
`main` → testy → `build/site` → GitHub Pages. PR wykonuje testy bez publikacji.
Source w Settings → Pages: **GitHub Actions**.

## Testy

Node 22+ i Python 3.12+:

```powershell
npm ci
npm test
python scripts/build_web.py
npx playwright install chromium
npm run test:browser
```

Windows z zainstalowanym Edge może zamiast pobierania Chromium użyć:

```powershell
$env:BROWSER_CHANNEL='msedge'
npm run test:browser
```

Testy startują własny serwer na wolnym porcie, grają pełną rundę, weryfikują
animację, dźwięki, zapis po odświeżeniu, dotyk i działanie bez audio/storage.
Zrzuty trafiają do ignorowanego `test-results/`.
Zmiennej `GAME_URL` można użyć do sprawdzenia wdrożonej strony tym samym testem.

## Praca Codex + Claude Code

[Instrukcja i gotowe prompty](COLLABORATION.md).
[Diagramy, konfiguracja worktree i komendy krok po kroku](docs/AGENT_WORKFLOW.md).
`python scripts/review_worktree.py prepare --base SHA` przygotowuje snapshot,
a `python scripts/review_worktree.py collect` odbiera raport powiązany z commitem.
Stały kontekst: `PROJECT_CONTEXT.md`. Kolejka i stan: `HANDOFF.md`.
Raport recenzenta: `REVIEW.md`. Instrukcje wejściowe: `AGENTS.md`, `CLAUDE.md`.
Jeden autor edytuje; drugi ocenia konkretny commit. Notatki nie uruchamiają
automatycznie drugiego agenta.

## Licencja

GPL-3.0 (zgodnie z licencją materiałów źródłowych).
