# Grottechug 🌀🍺

Et lite, men seriøst useriøst system for å styre **Grottechug** på Geogrotta:

- chug-hjul (ekte random)
- chuggeliste (historikk per dato/semester)
- person-sider med grafer og statistikk
- topplister (beste “clean” tider)
- regler og kryss

Dette repoet inneholder både **frontend (React/Vite)** og **backend (Node/Express/Prisma/SQLite)**.

---

## Innhold

- [Hva er dette?](#hva-er-dette)
- [Funksjoner](#funksjoner)
- [Regler (utdrag)](#regler-utdrag)
- [Tech stack](#tech-stack)
- [Prosjektstruktur](#prosjektstruktur)
- [Kom i gang](#kom-i-gang)
- [Import av historikk (Excel)](#import-av-historikk-excel)
- [Bruk](#bruk)
- [API-oversikt](#api-oversikt)
- [Vanlige problemer](#vanlige-problemer)
- [Bidra](#bidra)

---

## Hva er dette?

**Grottechug** er et internt webverktøy for lesesalen/Geogrotta som gjør det enkelt å:

- registrere chuggetider per fredag
- vise historikk på tvers av semester (2025H / 2026V / total)
- velge rekkefølge med et hjul (helst på Tobias A. sin PC)
- holde orden på regler, fravær og kryss

---

## Funksjoner

### 🌀 Hjulet

- **Faste deltakere** vises i lista (default huket av).
- **Gjester legges til via søkefelt** (autocomplete fra DB).
  - Hvis navnet finnes → legges til i dagens liste.
  - Hvis navnet ikke finnes → opprettes automatisk som ny gjest i databasen.
- **Ekte random** via kvante-random (ANU QRNG) med kryptografisk fallback.
- Når vinner trekkes, **fjernes vinner fra neste runde** automatisk.
- Du kan krysse ut noen med:
  - **Fravær (gir kryss)** (logger i krysslista)
  - **Ekskluder i dag (ingen kryss)**

### 📊 Chuggelista

- Tabell med **historikk per dato**.
- **Tabs**: `2025 Høst` / `2026 Vår` / `Total historikk`.
- Klikk på:
  - **Beste** eller **Snitt** for sortering
  - **dato-kolonner** for sortering per dag
  - **navn** for egen person-side
- Prikk i cellen = **anmerkning** (hover viser tooltip).

### 👤 Person-side

- Graf over alle tider per dato (med trendlinje)
- Statistikk som best, snitt, stabilitet osv.

### 🏆 Toppliste

- Podium (Top 3)
- Rangerer på **beste “clean” tid** (beste tid uten anmerkning).

### 📜 Regler og kryss

- Regler ligger i databasen og kan oppdateres.
- Krysslista viser oversikt og totaler.

---

### Tid og sted

- Grottechug skjer på **Geogrotta fredager kl. 15:15**, med mindre annet avtales.
- **⅔ flertall** kreves for å flytte chug fra fredag.
- Flytting av tidspunkt på fredag er tillatt.
- Rekkefølgen avgjøres av hjulet (helst Tobias A. sin PC).
- Ved spesielt ønske/behov kan modifikasjon av rekkefølge tillates.

### Enhet

- Anbefalt enhet: **øl**.
- **Cider/seltzer** er tillatt som alternativ.
- Alkoholfri: **kun alkoholfri øl** er tillatt.
- Unntak: **Peder** er fritatt fra regelen om enhet (men oppfordres til kullsyreholdig enhet).

### Fravær / video / remote

- Ved fravær kan man sende inn video der bord er synlig for tidtaking.
  - Må skje **samme dag** som grottechug
  - Kun **ett (1)** forsøk
  - Video deles i grottas snapgruppe
- Remotechug er tillatt, men deltaker må fikse Zoom/Teams-link og varsle på forhånd.
  - Samme regler som video
- Alkoholfri: kun alkoholfri øl (Peder-unntaket gjelder)

### Forsøk

- På Grotta kan man gjøre så mange forsøk man vil. **Beste forsøk gjelder.**

### Gjester

- Gjester er lov og velkomne, så lenge de følger reglene.

### Tilleggsregler

- Alle deltakere må bruke **samme type glass** (f.eks. like plastglass 0,5L).
- Det føres kryss. Kryss kan brukes til kryssfest/vors/sponsing (avgjøres senere).
- “Priviligerte innvandrere” (petroleum/maskin/data/indøk):
  - Udokumentert fravær gir **tidsstraff 10 sek** per fravær etter bank på døren (kumulativt)
  - Trer i kraft etter **26.09.2025**

### Kryssoversikt

| Regel                  | Kryss |
| ---------------------- | ----: |
| DNS-chug               |     3 |
| Tobias-chug / DNF-chug |     2 |
| mm-chug                |   0.5 |
| w-chug                 |     1 |
| vw-chug                |     2 |
| p-chug                 |     1 |
| Fravær                 |     2 |
| Oppkast                |     4 |
| KPR                    |     1 |

Forklaringer:

- **DNS-chug**: være på Geogrotta uten å delta
- **Tobias-chug/DNF-chug**: ikke fullføre innen 25 sek  
  _Tobias-chug gjelder 25/26. Hvis Tobias A. fullfører under 10 sek, går regelen tilbake til DNF-chug._
- **mm-chug**: “mildly moist” – gult kort; 2 mm på rad → kryss
- **w-chug**: søle øl under chugging
- **vw-chug**: søle mye eller ha litt igjen i glasset
- **p-chug**: pause under chugging
- **Fravær**: ikke til stede på Geogrotta under chugging
- **Oppkast**: ikke fullføre etter å ha kasta opp
  - ved oppkast stoppes klokka til chugging gjenopptas
- **KPR**: klage på regler under chug

---

## Tech stack

- **Frontend**: React + Vite + TypeScript + CSS
- **Backend**: Node + Express + TypeScript
- **DB**: SQLite (via Prisma)
- **Charts**: Recharts (person-side, stats, topplister)
- **Randomness**: ANU QRNG (kvante-random) + crypto fallback

---

## Prosjektstruktur

```
grottechugg/
  apps/
    api/        # Express + Prisma API
    web/        # React/Vite frontend
  README.md
```

---

## Kom i gang

### Krav

- Node.js (helst LTS)
- npm

### Installer

Kjør fra repo-root:

```bash
npm install
```

### Start backend

```bash
cd apps/api
npm run dev
```

Backend kjører vanligvis på `http://localhost:4000`.

### Start frontend

```bash
cd apps/web
npm run dev
```

Frontend kjører vanligvis på `http://localhost:5173`.

---

## Import av historikk (Excel)

Historikk importeres fra Excel-arket (typisk `Grottechug_25_26.xlsx`) og legger inn:

- deltakere (faste/ gjester)
- datoer (sessions)
- tider (attempts)
- anmerkninger (notes)

Eksempel:

```bash
curl -F "file=@C:\path\to\Grottechug_25_26.xlsx" http://localhost:4000/api/import/excel
```

> Importen er laget for ark som `2026V` og `2025H`.

---

## Bruk

- **Hjulet**: velg hvem som er med, legg til gjester via søk, spin.
- **Chuggelista**: se historikk pr semester, sorter, klikk på navn for personside.
- **Toppliste**: se beste clean tider.
- **Regler**: oppdater regler/kryss/detaljer i DB.
