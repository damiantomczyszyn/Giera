# Codex + Claude Code w jednym projekcie

Oba narzędzia mogą pracować na tych samych plikach. Nie zakładaj wspólnej pamięci
rozmowy. Synchronizacja to Git, aktualny kod i wersjonowane notatki.

## Na zmianę: polecany wariant

1. Autor (Codex lub Claude) odczytuje kontekst, zmienia status HANDOFF na
   IMPLEMENTING i wykonuje jeden spójny zakres. Drugi agent wtedy nie edytuje.
2. Autor uruchamia testy, zapisuje commit, opisuje wyniki i ograniczenia,
   wpisuje SHA i READY_FOR_REVIEW. Kończy edycję.
3. Uruchamiasz recenzenta. On czyta bieżące pliki, ocenia dokładnie wskazane
   SHA, wykonuje testy i zapisuje REVIEW.md. Nie poprawia badanego kodu.
4. Jeśli są błędy: REVIEW status CHANGES_REQUESTED, HANDOFF kolej na autora.
   Autor reprodukuje, poprawia i przy każdym R-xxx zapisuje wynik i nowe SHA.
5. Recenzent ponownie bada poprawki. PASS oznacza sprawdzony zakres, nie dowód
   braku wszystkich możliwych błędów. Wdrożenie wykonuje wyznaczony autor,
   zgodnie z poleceniem użytkownika; wynik Actions i URL zapisuje w HANDOFF.

Notatka nie jest automatyczną blokadą plików, powiadomieniem ani uruchomieniem
drugiego modelu. Ten obieg działa po ręcznym uruchomieniu odpowiedniego zadania.
Pełna automatyzacja wymaga osobnego koordynatora wywołań CLI, limitu iteracji,
izolowanych katalogów, logów i jawnych uprawnień do publikacji.

## Gotowy prompt dla Claude — recenzenta

> Pracujesz jako recenzent projektu Giera. Przeczytaj AGENTS.md,
> PROJECT_CONTEXT.md, HANDOFF.md i REVIEW.md. Zweryfikuj commit wskazany
> w HANDOFF względem założeń użytkownika i oryginalnych materiałów. Nie zmieniaj
> kodu gry. Uruchom testy i sprawdź grę w przeglądarce. Zapisz w REVIEW.md
> werdykt PASS lub CHANGES_REQUESTED, konkretne błędy z priorytetem,
> plikiem/linią, reprodukcją oraz rzeczy niesprawdzone. Zaktualizuj HANDOFF:
> kolej na autora, jeśli są poprawki. Nie wdrażaj ani nie uruchamiaj drugiego agenta.

## Gotowy prompt dla autora po recenzji

> Przeczytaj AGENTS.md, PROJECT_CONTEXT.md, HANDOFF.md i REVIEW.md. Sprawdź
> zgłoszenia recenzenta na wskazanym commicie, popraw potwierdzone błędy,
> uruchom odpowiednie testy i odnotuj odpowiedź dla każdego R-xxx. Nie odrzucaj
> uwag bez dowodu. Zrób commit, wpisz nowe SHA i READY_FOR_REVIEW w HANDOFF.

## Równocześnie

Przy jednym wspólnym folderze: jeden edytor; recenzent bada zamrożony commit
w drugim worktree. Do czytania commita może użyć `git show <SHA>:web/app.js`.
Nie testuj drzewa, które autor właśnie zmienia: wynik audytu będzie niejednoznaczny.

Przy dwóch autorach: osobne gałęzie i worktree, rozdzielone zadania i jeden
integrator. Przykład (dopiero gdy są potrzebne dwa katalogi):

```powershell
git worktree add ..\Giera-codex -b codex/game-improvements main
git worktree add ..\Giera-review --detach <SHA-do-oceny>
```

Każdy model otwierasz w przypisanym katalogu. Recenzent przekazuje raport
autorowi (plik/commit raportu), nie nadpisuje jego gałęzi. Samo `git pull`
w jednym worktree nie aktualizuje plików drugiego.

## Co jest wspólne, a co nie

| Element | Wspólne źródło |
| --- | --- |
| Cel, architektura i ograniczenia | PROJECT_CONTEXT.md |
| Stałe zasady pracy | AGENTS.md; CLAUDE.md odsyła do nich |
| Aktualna kolej, zakres, SHA, wyniki testów | HANDOFF.md |
| Ustalenia recenzenta i odpowiedzi autora | REVIEW.md |
| Faktyczne zmiany | git diff / git log / commit |
| Rozmowy, pamięć, procesy narzędzi | Nie zakładaj synchronizacji |

Codex odczytuje instrukcje AGENTS.md; dokumentacja:
https://learn.chatgpt.com/docs/agent-configuration/agents-md.
Izolacja pracy w worktree:
https://learn.chatgpt.com/docs/environments/git-worktrees.
Przy wznowieniu starej sesji zawsze poleć ponowne odczytanie powyższych plików.
