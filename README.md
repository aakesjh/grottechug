# Grottechug

Grottechug er et fullstack websystem for å planlegge, gjennomføre og analysere ukentlig "chug" i Geogrotta.

Prosjektet samler hele flyten i ett verktøy:

- deltakeradministrasjon
- trekning av rekkefølge med tilfeldig generator
- registrering av tider og regelbrudd
- historikk, statistikk og topplister
- adminpanel for moderering og drift

## Innhold

- [Mål og omfang](#mål-og-omfang)
- [Nøkkelfunksjonalitet](#nøkkelfunksjonalitet)
- [Arkitektur](#arkitektur)
- [Teknologier](#teknologier)
- [Prosjektstruktur](#prosjektstruktur)
- [Kom i gang lokalt](#kom-i-gang-lokalt)
- [Miljøvariabler](#miljøvariabler)
- [Scripts](#scripts)
- [Datamodell](#datamodell)
- [API-oversikt](#api-oversikt)
- [Deployment](#deployment)
- [Import av historikk fra Excel](#import-av-historikk-fra-excel)
- [Produktregler](#produktregler)
- [Videre utvikling](#videre-utvikling)

## Mål og omfang

Målet med prosjektet er å erstatte manuell oppfølging med en robust, sporbar og lettdrevet løsning.

Løsningen gir:

- ett felles system for regler, tider og historikk
- mindre friksjon i gjennomføring av hver sesjon
- bedre innsikt i utvikling over tid, både per person og for gruppen

## Nøkkelfunksjonalitet

### Hjul og trekning

- Deltakerliste med faste deltakere og gjester.
- Gjestesøk med autocomplete mot databasen.
- Oppretting av ny gjest ved behov.
- Trekning via ANU QRNG med kryptografisk fallback.
- Automatisk fjerning av vinner i neste runde.

### Registrering og historikk

- Sessions med dato, semester og notat.
- Forsøk (attempts) per deltaker per session.
- Regelbrudd med kryssverdi.
- Chugliste med sortering og semesterfiltre.

### Analyse

- Personside med tidsserie, trendlinje og sammenligning.
- Toppliste basert på beste clean-tid.
- Dashboards for statistikk og aggregater.

### Admin og innmeldinger

- Innmelding av nye deltakere med bilde.
- Godkjenning og avvisning i adminpanel.
- Endring av navn, bilde og hard delete (admin-only).
- Rollebasert tilgangskontroll med Better Auth.

## Arkitektur

Monorepo med to apper:

- `apps/api`: Express API + Prisma
- `apps/web`: React SPA (Vite)

Flyt i produksjon:

1. Bruker treffer web (Vercel).
2. Web kaller API (Azure Container Apps).
3. API autentiserer med Better Auth og leser/skriver data via Prisma til Turso/libSQL.
4. Bilder lagres via Vercel Blob.

## Teknologier

- Frontend: React 19, TypeScript, Vite, React Router, Recharts
- Backend: Node.js 20, Express 5, TypeScript
- Data: Prisma ORM, SQLite lokalt, Turso/libSQL i produksjon
- Auth: Better Auth + Prisma adapter
- Media/upload: multer, Vercel Blob
- Drift: Azure Container Apps (API), Vercel (web), Docker-støttet API-bygg

## Prosjektstruktur

```text
grottechugg/
  apps/
    api/
      prisma/
      scripts/
      src/
    web/
      public/
      src/
  package.json
  README.md
```

## Kom i gang lokalt

### Krav

- Node.js `20.x`
- npm

### 1. Installer avhengigheter

Kjør fra repo-root:

```bash
npm install
```

### 2. Sett opp miljøfiler

Opprett:

- `apps/api/.env`
- `apps/web/.env`

Bruk variablene i seksjonen under.

### 3. Start utviklingsmiljø

Kjør begge apper samtidig fra root:

```bash
npm run dev
```

Alternativt separat:

```bash
npm run dev:api
npm run dev:web
```

Standard URL-er lokalt:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Miljøvariabler

### API (`apps/api/.env`)

| Variabel                      | Lokal   | Produksjon | Beskrivelse                                      |
| ----------------------------- | ------- | ---------- | ------------------------------------------------ |
| `DATABASE_URL`                | Ja      | Valgfri    | Lokal SQLite for dev/CLI, f.eks. `file:./dev.db` |
| `BETTER_AUTH_SECRET`          | Ja      | Ja         | Secret for auth (minst 32 tegn i prod)           |
| `BETTER_AUTH_URL`             | Ja      | Ja         | API base URL for auth                            |
| `FRONTEND_ORIGIN`             | Ja      | Ja         | Frontend origin brukt av CORS/cookies            |
| `AUTH_ALLOW_SIGNUP`           | Ja      | Ja         | `true/false` for signup                          |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Ja      | Ja         | Kommaseparerte trusted origins                   |
| `TURSO_DATABASE_URL`          | Nei     | Ja         | `libsql://...` URL                               |
| `TURSO_AUTH_TOKEN`            | Nei     | Ja         | Token for Turso                                  |
| `BLOB_READ_WRITE_TOKEN`       | Nei     | Ja         | Token for bildeopplasting                        |
| `ADMIN_1_*`, `ADMIN_2_*`      | Valgfri | Valgfri    | Seed av adminbrukere                             |

Lokal eksempelkonfig:

```env
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="replace-with-a-random-32-plus-character-secret"
BETTER_AUTH_URL="http://localhost:4000"
FRONTEND_ORIGIN="http://localhost:5173"
AUTH_ALLOW_SIGNUP="false"
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:5173,http://localhost:4000"
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""
BLOB_READ_WRITE_TOKEN=""
ADMIN_1_EMAIL=""
ADMIN_1_PASSWORD=""
ADMIN_1_NAME=""
ADMIN_2_EMAIL=""
ADMIN_2_PASSWORD=""
ADMIN_2_NAME=""
```

### Web (`apps/web/.env`)

| Variabel       | Lokal         | Produksjon | Beskrivelse                                        |
| -------------- | ------------- | ---------- | -------------------------------------------------- |
| `VITE_API_URL` | Vanligvis tom | Ja         | API base URL. Tom lokalt bruker proxy/samme origin |

Eksempel:

```env
VITE_API_URL=""
```

## Scripts

### Root

| Kommando          | Beskrivelse                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Starter API og web parallelt |
| `npm run dev:api` | Starter kun API              |
| `npm run dev:web` | Starter kun web              |
| `npm run build`   | Bygger API og web            |

### API (`apps/api`)

| Kommando                 | Beskrivelse                                        |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Starter API i watch mode                           |
| `npm run build`          | Genererer Prisma client + TypeScript build         |
| `npm run start`          | Kjører bygget API                                  |
| `npm run seed`           | Seeder basisdata/admin                             |
| `npm run migrate:deploy` | Prisma migrate deploy (ikke primærløype mot Turso) |

### Web (`apps/web`)

| Kommando          | Beskrivelse                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Starter Vite dev server      |
| `npm run build`   | Typecheck + produksjonsbuild |
| `npm run preview` | Kjører bygget web lokalt     |

## Datamodell

Kjernemodeller i Prisma:

- `Participant`: deltakere (faste/gjester, bilde)
- `Session`: dato, semester, notat
- `Attempt`: tid per deltaker i en session
- `Rule`: regelkatalog med kryssverdi
- `Violation`: registrerte regelbrudd
- `ParticipantSubmission`: innmeldinger for moderering
- `User`, `AuthSession`, `AuthAccount`, `AuthVerification`: auth og roller

Migrasjonshistorikk finnes i `apps/api/prisma/migrations`.

## API-oversikt

Hovedendepunkter (prefix `/api`):

- `/auth/*`: innlogging og session-henting
- `/participants`: listing, søk, oppdatering, bilde, sletting
- `/participant-submissions`: innmelding, godkjenning, avvisning
- `/wheel/spin`: trekning av vinner
- `/sessions`, `/attempts`: sessions og forsøk
- `/rules`, `/violations`, `/crosses`: regelverk og kryss
- `/person/:id`, `/stats`, `/leaderboard`, `/analytics`: innsikt og statistikk
- `/import/excel`: import av historikk

Health check:

- `GET /api/health`

## Deployment

### Produksjonsoppsett

- API: Azure Container Apps (`apps/api`)
- Web: Vercel (`apps/web`)
- Database: Turso/libSQL

### Azure Container Apps (API)

- Bygg API-container fra repoets Dockerfile (Node 20 + Prisma generate + `apps/api/dist`).
- Publiser image til container registry (f.eks. ACR).
- Deploy imaget til Azure Container Apps med eksponert HTTP ingress.
- Sett nødvendige env-vars i Container App (se [Miljøvariabler](#miljøvariabler)).

### Vercel (Web)

- Root Directory: `apps/web`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Obligatorisk env-var:

```env
VITE_API_URL=https://<your-api>.<region>.azurecontainerapps.io
```

### Turso

Opprett database og token med Turso CLI:

```bash
turso db create <db-name>
turso db show <db-name> --url
turso db tokens create <db-name>
```

Ved ny prod-database: kjør migrasjonsskriptene i `apps/api/prisma/migrations/*/migration.sql` i rekkefølge mot Turso.

## Import av historikk fra Excel

Importer historikk via API:

```bash
curl -F "file=@C:\\path\\to\\Grottechug_25_26.xlsx" http://localhost:4000/api/import/excel
```

Importen er laget for semesterark som `2025H` og `2026V`.

## Produktregler

Prosjektet inneholder et regelverk med kryss-system (DNS/DNF/mm/w/vw/p/fravær/oppkast/KPR osv.).

Reglene kan vedlikeholdes i appen og lagres i databasen. Den operative detaljlisten bor i produktet (regler-side/admin), mens README holdes på prosjekt- og driftsperspektiv.

## Videre utvikling

- Legg til automatiske tester (API-integrasjon + UI-smoke).
- Innfør releases/changelog for tydeligere versjonering.
- Vurder OpenAPI-spec for API-dokumentasjon.
- Legg inn skjermbilder i README for rask onboarding.
