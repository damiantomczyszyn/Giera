# Giera — Kapitan Dupa

Port gry **Kapitan Dupa** na Pythona + pygame, z wersją przeglądarkową (WebAssembly via `pygbag`) wdrażaną na GitHub Pages.

Oparte o [Megaemce/KapitanDupa](https://github.com/Megaemce/KapitanDupa) (GPL-3.0). Oryginalne grafiki (`assets/images/`) i dźwięki (`assets/sounds/`, przekonwertowane z MP3 na OGG dla kompatybilności z WASM) pochodzą stamtąd.

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
- Po czasie: jeśli to nowy rekord — wpisujesz login (max 5 znaków) i zapisujesz wynik do scoreboardu (`scores.json`)

## Wersja przeglądarkowa (GitHub Pages)

Lokalna budowa i podgląd w przeglądarce:

```bash
python -m pygbag main.py     # dev server na http://localhost:8000
python -m pygbag --build main.py    # tylko budowa do build/web/
```

Deploy na GitHub Pages odbywa się automatycznie przez workflow w [.github/workflows/deploy.yml](.github/workflows/deploy.yml) przy każdym pushu na `main`.

**Aby włączyć GitHub Pages w tym repo:**

1. Settings → Pages
2. Source: **GitHub Actions**
3. Po pierwszym udanym przebiegu workflow gra będzie dostępna pod `https://<user>.github.io/Giera/`

## Licencja

GPL-3.0 (zgodnie z licencją materiałów źródłowych).
