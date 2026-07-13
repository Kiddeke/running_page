# Current State Analysis

This document is a read-only inspection of this repository as of 2026-07-13, written to inform the long-term goal of building an iOS app that combines running tracking, Catholic faith habit tracking, and a unified dashboard/calendar. It answers ten specific questions about the current codebase. **No application code was changed to produce this report.**

## 1. Framework, languages, and build tools

**Frontend:** React 19 + TypeScript, built with **Vite 8** (`vite.config.ts`, `package.json` scripts `vite dev` / `vite build`). This fork has moved off the upstream `running_page` project's original Gatsby setup — there is no `gatsby-config.js` or GraphQL data layer. Styling is Tailwind CSS v4 (`@tailwindcss/vite`). Routing is client-side via `react-router-dom` v7. Maps use `mapbox-gl` / `react-map-gl`; charts use `recharts`. Package manager is pnpm 8 (`pnpm-lock.yaml`), Node `>=20` required. Linting/formatting via ESLint 10 (`eslint.config.mjs`) and Prettier 3.

**Data-processing backend:** Python 3.12 (`.python-version`, `pyproject.toml`), packaged as the `run_page` module. Multiple Python tooling paths coexist: `requirements.txt`/`requirements-dev.txt` (pip), `pdm.lock` (PDM), and `uv.lock` (uv). Key libraries: `stravalib`, `gpxpy`, `garth` (Garmin), `tcxreader`, `fit-tool`, `SQLAlchemy`, `textual` (powers a TUI at `run_page/tui/`), `gpxtrackposter`/`svgwrite`/`cairosvg` (SVG art generation), `duckdb`.

**Orchestration:** `Makefile` ties together Python (`uv run`) and JS (`pnpm run`) targets (`tui`, `test`, `lint`, `check`, `format`, `build`, `ci`). `Dockerfile` is a multi-stage build: Python sync stage → Node build stage → nginx serve stage (`nginx.conf`), useful for self-hosting outside GitHub Actions/Vercel.

## 2. How running data is imported and stored

`run_page/` contains roughly 25 sync scripts, one per data source: `strava_sync.py`, `garmin_sync.py` / `garmin_sync_cn_global.py`, `nike_sync.py`, `keep_sync.py`, `coros_sync.py`, `codoon_sync.py`, `joyrun_sync.py`, `oppo_sync.py`, `komoot_sync.py`, `intervals_icu_sync.py`, `tulipsport_sync.py`, `igpsport_sync.py`, `onelap_sync.py`, `endomondo_sync.py`, plus raw-file importers `gpx_sync.py` / `tcx_sync.py` / `fit_sync.py`, and cross-service scripts like `strava_to_garmin_sync.py`.

All of these share a `Generator` class and a SQLAlchemy `Activity` model (`run_page/generator/db.py`) with fields like `run_id`, `name`, `distance`, `moving_time`, `type`, `start_date_local`, `summary_polyline`, `average_heartrate`, `elevation_gain`. Paths are centralized in `run_page/config.py`:

- **Canonical store:** SQLite at `run_page/data.db` (confirmed via `run_page/data_to_csv.py`, which opens it directly with `sqlite3.connect`).
- **Frontend-facing export:** `src/static/activities.json` — this is what the browser actually fetches (see §3).
- **Raw staging files:** `GPX_OUT/`, `TCX_OUT/`, `FIT_OUT/`, `Workouts/` (Endomondo), `activities/`.

Typical flow (e.g. `strava_sync.py`): pull from the source API into SQLite via `Generator(SQL_FILE).sync(True)`, then `generator.load()` + `json.dump(...)` writes `activities.json`. `run_page/gen_svg.py` reads `--from-db` to render GitHub-contribution-style/grid/circular/"month of life"/year-summary SVGs into `assets/` — this heatmap-art generation happens in Python at data-sync time, not in the browser. `pnpm run data:clean` wipes `data.db`, the `*_OUT` directories, `activities/`, and `activities.json` for a fresh resync.

## 3. How maps, heatmap, stats, and activity pages are generated

Client-side routing is defined in `src/main.tsx`: routes are `/`, `/summary`, and `/readings/:date`. There is **no dedicated per-activity route** — selecting a single run is done via a URL hash (`#run_<id>`) handled in `src/pages/index.tsx` through `useSyncExternalStore`, which filters and animates the existing map/table in place rather than navigating to a new page.

`src/pages/index.tsx` renders a tab bar (Profile / Heatmap / Commits / Stats / Jesus / Activities) that conditionally mounts: `RunMap`, `RunTable`, `SVGStat`, `YearsStat` / `LocationStat`, `WeeklyChart`, `MassCalendar`, `GoalsCard`, `ProfileCards`, `FaithTab`, `ActivitiesTab`.

- **Map/heatmap:** `src/components/RunMap/index.tsx` uses Mapbox GL JS via `react-map-gl`, plus `@mapbox/mapbox-gl-language`. Routes are drawn as GeoJSON `LineString` layers built in `src/utils/geoUtils.ts` (`geoJsonForRuns`, `pathForRun`), which decodes Strava/Garmin polylines with `@mapbox/polyline` and applies coordinate-system transforms via `gcoord` and `@math.gl/web-mercator`. Map tile vendor/token config lives in `src/utils/const.ts`.
- **Stats:** `YearsStat` and `LocationStat` are hand-rolled aggregations over the `Activity[]` array (not a charting library). `WeeklyChart` uses Recharts.
- **SVG heatmap tab:** `SVGStat` simply displays the pre-generated static SVGs (`assets/github.svg`, `assets/grid.svg`, etc.) produced by the Python `gen_svg.py` step described in §2 — no client-side rendering of the heatmap itself.
- **Data loading:** `src/hooks/useActivities.ts` does `fetch(activitiesUrl)` (activities.json imported as a Vite `?url` asset), caches the result in module-level variables, and derives years/cities/countries/run-periods client-side via `processActivities`.

There is **no site-level login or password protection** anywhere in the frontend. The only `password` field in the repo is `sync.garmin.password` in `config-example.yaml` — credentials used by the Python sync script to pull data from Garmin, unrelated to protecting the deployed site itself. The deployed site is public by default.

## 4. How the Catholic faith tracker currently stores its data

The faith tracker is fully implemented, not a stub. It's surfaced as a tab literally labeled **"Jesus"** in the main navigation (renamed from "Faith" per commit `6035a28`). Key files:

- `src/components/FaithTab/index.tsx` — logs activities of type `mass | confession | prayer | almsgiving | fasting`, each with a date and optional notes, plus a 12-week Recharts area chart and filtering.
- `src/components/MassCalendar/index.tsx` — a horizontal date-picker strip linking to `/readings/:date`.
- `src/pages/readings.tsx` — fetches the daily Catholic Mass readings.

**Storage:** `FaithActivity[]` entries (`{ id, type, date, notes? }`) are stored **entirely in the browser's `localStorage`**, under the key `faith_activities_v1` (`FaithTab/index.tsx:56, 60-69`). There is no backend, no database, and no file under version control for this data. A manual JSON export/import feature exists specifically to move a backup between devices by hand — the code's own comment says so directly: *"Activities only live in this browser's localStorage, so logging on one device won't show up on another... until there's a synced backend."*

**Daily readings** (`readings.tsx`) are fetched live, client-side, via **JSONP** from `universalis.com` on every page view — a public, unauthenticated third-party feed. Nothing from the readings is cached or stored locally; each visit re-fetches.

## 5. How the site is deployed

Three GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`** — on every push/PR: a Python job (matrix 3.12/3.13/3.14) runs sync smoke tests plus `black --check` / `ruff check`; a Node job (matrix 20/22/24) runs `pnpm run check`, `lint`, `build`.
- **`run_data_sync.yml`** — scheduled twice daily (`cron: 0 6,18 * * *`), plus manual dispatch and pushes touching sync scripts. Driven by env vars (`RUN_TYPE: strava`, `ATHLETE: Grant`, `BIRTHDAY_MONTH: 1994-05`, etc.), it runs the sync script matching `RUN_TYPE` with credentials pulled from GitHub Secrets, regenerates SVG heatmap art, commits the updated data back to `master` (`git commit -m 'update new runs'`), and — if `BUILD_GH_PAGES: true` — triggers `gh-pages.yml`.
- **`gh-pages.yml`** — installs pnpm deps, runs `PATH_PREFIX=/$REPO_NAME pnpm build`, uploads `dist/` and deploys it to GitHub Pages.

**Alternate path:** `vercel.json` is present and explicitly disables Vercel's own auto-deploy on the `gh-pages` branch while adding an SPA rewrite rule — combined with `@vercel/analytics` being wired directly into `src/pages/index.tsx`, this suggests **Vercel is the actual production host**, with GitHub Pages as a secondary/verification target. A Docker/nginx path (`Dockerfile`, `nginx.conf`) also exists for self-hosting the full sync-build-serve pipeline outside either platform.

## 6. Which code or logic could be reused in a React Native / Expo app

Portable, non-DOM logic that could move to a shared package with little or no change:

- `src/utils/utils.ts` — the `Activity` type and pure data transforms: `filterAndSortRuns`, `filterCityRuns`/`filterYearRuns`/`filterTitleRuns`, `sortDateFunc`, `titleForRun`, `locationForRun`.
- `src/utils/geoUtils.ts` (non-DOM parts) — `pathForRun` (polyline decode + `gcoord` transform), `geoJsonForRuns` (GeoJSON construction), and bounds calculation via `@math.gl/web-mercator`'s `WebMercatorViewport`, which is plain coordinate math, not DOM-bound.
- `src/hooks/useActivities.ts` — the `processActivities` aggregation logic (cities/countries/years/run-periods) is portable once its `fetch(activitiesUrl)` call is swapped for a platform-appropriate loader (e.g. bundled JSON or a native `fetch`).
- The `FaithActivity` type and the week-bucketing logic in `FaithTab` (`getWeekKey`, `monthAxisTicks`) — simple, portable *concepts*, though today's implementation is localStorage-bound (see §7).
- The entire **Python `run_page/` backend** — sync scripts, SQLite store, and JSON export are already fully decoupled from the frontend and would serve a mobile app exactly as they serve the website today, with no changes required.

## 7. Which parts are tightly coupled to the browser and would need to be rebuilt

- **`src/components/RunMap/*`** — Mapbox GL JS via `react-map-gl` requires WebGL/DOM canvas; a React Native equivalent (e.g. `@rnmapbox/maps`) would be close to a ground-up rewrite of this component.
- **Theme system** (`src/hooks/useTheme.ts`, `src/utils/colorUtils.ts`, `MAP_HEIGHT` in `const.ts`) — direct `window`, `document.documentElement`, `MutationObserver`, and `localStorage` usage for theme detection/sync.
- **`FaithTab`'s storage layer** — `localStorage` plus `Blob`/`URL.createObjectURL` for export has no direct React Native equivalent; would need AsyncStorage/SQLite on-device at minimum, and the code already acknowledges the lack of a cross-device sync story.
- **URL-hash-based run selection** and `document.getElementById` scroll/click wiring in `src/pages/index.tsx` and `SVGStat` — relies on browser history/hash APIs.
- **`readings.tsx`'s Universalis fetch** — implemented as JSONP via a dynamically injected `<script>` tag, a browser-only CORS-bypass technique; a mobile app would need a real HTTP client (or a small proxy, since Universalis's endpoint may not return standard CORS-friendly JSON).
- **Analytics wiring** (`src/utils/analytics.ts`, Google Analytics 4 + `@vercel/analytics/react`) — web-specific SDKs with no direct RN equivalent.

## 8. Privacy or security concerns

- **Running routes are public with no access control.** Full GPS polylines are published via `activities.json` (and `run_page/data.db` is committed to the repo) on a site with no login. Start/end points of routes on a public map can reveal home or work addresses. A `PRIVACY_MODE`/"lights" toggle exists in `RunMap`, but it's a display option (hides route glow), not a data-access control — the underlying coordinates are still shipped to every visitor.
- **Faith data is currently the lowest-exposure part of the app** — it never leaves the browser (`localStorage` only). But that cuts both ways: there is **no backup**, so clearing site data silently and permanently deletes the faith log, and there's **no PIN/lock**, so anyone with access to the same browser/device can read or delete it.
- **Universalis JSONP calls** send the visitor's IP and referrer to a third-party server on every readings-page view, with no disclosure or consent UI.
- **Google Analytics and Vercel Analytics** run unconditionally for all visitors — no cookie/consent gate was found in the code.
- **Sync credentials** (Strava/Garmin/etc.) are handled correctly today via GitHub Secrets, never committed — worth explicitly preserving this pattern if a mobile backend is introduced later.
- **Moving to iOS raises the stakes only if faith data leaves the device.** Synchronizing it to a cloud database would turn a currently zero-attack-surface feature into one requiring authentication, encryption in transit/at rest, and a privacy policy — a real design decision, not an inevitability (see §9). Route privacy needs deliberate design regardless of what happens with faith data, since running data is already headed toward broader reuse (§6).

## 9. Faith-tracker storage: three options, compared neutrally

Because faith-habit data (including confession logs) is sensitive, this section deliberately compares options rather than assuming cloud sync is the goal.

| | **(a) Local-first, sync deferred** | **(b) Shared backend (web + mobile)** | **(c) Fully separate web/mobile data** |
|---|---|---|---|
| **What it looks like** | SQLite/AsyncStorage/MMKV on-device, mirroring today's localStorage model but durable and native | A small hosted API/DB (e.g. Supabase/Firebase/custom) read/written by both `FaithTab` and a future Expo app | Web dashboard stays running-focused (or its faith data stays local-only); iOS app owns faith data independently, with no shared store or repo path |
| **Pros** | Strongest privacy by default — data never leaves the device unless the user explicitly exports it (the export/import pattern already exists in `FaithTab`); no backend to build or secure; fastest to ship | Cross-device sync; single source of truth; enables server-side features later (reminders, shared household tracking) | Sidesteps any risk of faith data ever flowing through the same pipeline that publishes public running routes (`activities.json`, committed `data.db`); clean separation of a public artifact from a private one |
| **Cons** | No cross-device access; device loss/reinstall can lose data unless the user manually backs up | Real attack surface and data-handling responsibility for sensitive personal data — needs auth, encryption, a privacy policy, ongoing hosting; meaningfully larger scope than the app itself | No unified "one dashboard" experience across web and mobile for faith data specifically |

Given the faith tracker already works fully offline today and nothing currently requires cross-device sync, **(a)** is the lowest-risk starting point — but this report presents it as the user's decision to make, not a conclusion the codebase forces.

### Smallest sensible next step

- **Product/design next step:** Decide, independent of any code, whether faith-habit data needs to leave the device at all (single user, single phone — no cross-device requirement?), and separately whether the public running dashboard and a private faith/devotional experience should be presented to end users as "one app" or kept visually/conceptually distinct. This determines whether options (b) or (c) above are even in scope, and should be settled before any backend work starts.
- **Technical next step:** Regardless of that product decision, the lowest-effort way to prove feasibility is to scaffold a bare Expo app and port the already-portable logic identified in §6 — `Activity` types/filters from `src/utils/utils.ts`, polyline/GeoJSON helpers from `src/utils/geoUtils.ts`, and the `FaithActivity` type from `FaithTab` — into a local shared package, consumed by a minimal Expo screen reading a static copy of `activities.json`. This validates the React Native toolchain and reuse strategy without committing to a faith-data storage architecture yet.

## 10. Should the web project stay separate, or become a monorepo?

**Recommendation: keep them separate initially.** The web app's Python data pipeline and GitHub Actions cron/deploy flow (§5) are unrelated to anything a React Native app needs — folding them into one repo/toolchain now adds coordination overhead (shared lockfiles, a combined CI matrix, Vite vs. Metro bundler conflicts) without a matching benefit yet.

This holds under all three options in §9 — even under option (b), a shared backend does not require a shared repository; the mobile app and web app can each call the same API independently. The natural point to introduce a monorepo is once there's real shared *code* (not just a shared data shape) — e.g. the local shared package described in the technical next step above. At that point a lightweight workspace (pnpm workspaces or Turborepo) with `apps/web`, `apps/mobile`, `packages/shared` becomes worth the setup cost.

## Suggested reading order for building the iOS app

Pointers to the files most relevant for reuse, per §6 — not a new plan, just where to start reading:

1. `run_page/generator/db.py` and `run_page/config.py` — the `Activity` schema and canonical data paths.
2. `src/utils/utils.ts` — the frontend `Activity` type and filter/sort helpers.
3. `src/utils/geoUtils.ts` — polyline decoding and GeoJSON construction, independent of Mapbox rendering.
4. `src/hooks/useActivities.ts` — how activity data is loaded and aggregated today.
5. `src/components/FaithTab/index.tsx` — the faith-tracker data model and UI logic (storage layer to be redesigned per §9).
6. `.github/workflows/run_data_sync.yml` — the full picture of how and when running data refreshes, useful context for deciding how a mobile app would get data (poll the same JSON? call a new API?).

## Files inspected

`package.json`, `Makefile`, `pyproject.toml`, `.python-version`, `vercel.json`, `.github/workflows/ci.yml`, `.github/workflows/gh-pages.yml`, `.github/workflows/run_data_sync.yml`, `Dockerfile`, `nginx.conf`, `config-example.yaml`, `.env.production`, `src/main.tsx`, `src/pages/index.tsx`, `src/pages/total.tsx`, `src/pages/readings.tsx`, `src/components/RunMap/index.tsx`, `src/components/SVGStat/index.tsx`, `src/components/FaithTab/index.tsx`, `src/components/MassCalendar/index.tsx`, `src/hooks/useActivities.ts`, `src/utils/geoUtils.ts`, `src/utils/utils.ts`, `run_page/` directory listing, `run_page/data_to_csv.py`, `run_page/db_updater.py`, plus `git log --oneline --all` and `git branch -a` to trace the faith-tracker's development history.
