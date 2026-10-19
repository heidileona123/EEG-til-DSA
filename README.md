# EEG til DSA – forklaringsvideo (norsk, hvit bakgrunn)

Animert forklaring på hvordan EEG blir til DSA (Density Spectral Array), slik det vises i Masimo SedLine®.
Videoen er 90 sekunder og består av seks deler: EEG, frekvenser (FFT), farge, 3D-flate, DSA og SedLine.

Alle EEG-signaler og DSA-flater er syntetiske og genereres i koden.

## Innhold

| Fil | Beskrivelse |
|---|---|
| `EEG_til_DSA_norsk_hvit.mp4` | Ferdig video, 1920×1080, 25 bilder/s |
| `index.html` + `anim.js` | Hele animasjonen (HTML canvas). Åpne `index.html` i nettleser for å se den spille i løkke |
| `fonts/` | Roboto og Source Serif 4 (SIL Open Font License) |
| `scripts/` | Rendring til video |

## Se animasjonen i nettleser

Åpne `index.html` direkte, eller kjør `python3 -m http.server` og gå til `http://localhost:8000`.

## Lage videoen på nytt

Krever Python 3 med `playwright` (Chromium installert) og `ffmpeg`.

```sh
pip install playwright
sh scripts/build.sh
```

Hvis Chromium ligger et annet sted enn `/opt/pw-browsers/chromium`, endre `executable_path` i `scripts/chunk.py`
(eller fjern argumentet så Playwright bruker sin egen nettleser).

## Tilpasninger

- **Tekst:** alle norske tekster ligger i `anim.js` (søk etter tittel, bildetekst og aksenavn i `scene1` til `scene6`).
- **Farger:** `const C = {...}` øverst i `anim.js`. Bakgrunnen er hvit (`bg`).
- **Tidsstyring:** delene styres av tabellen `SEC` og tidene i hver `sceneN`-funksjon.
- **Logo:** ingen logo er med. Legg inn en `ctx.drawImage(...)` i `drawHeader()` for å vise logo øverst til venstre.
- **Faglig:** Toppeffekt-tallene regnes ut fra det syntetiske signalet og er kun illustrasjon, ikke kliniske verdier.

## Lisens

Kode: velg lisens før publisering (f.eks. MIT). Skriftene har egen lisens (OFL).
