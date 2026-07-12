---
name: verify
description: Build, launch, and drive PadelClash Lite locally to verify changes end-to-end at the browser surface.
---

# Verifying PadelClash Lite

## Launch

- DB: `docker compose up -d db` (Postgres on 5432; volume `db-data`).
- Port 3000 may be held by the compose app container from a previous
  image smoke test: `docker compose stop app` frees it.
- App: `npm run dev` (background). Ready when
  `curl http://localhost:3000/api/health` returns `{"status":"ok"}`.
  Boot-time migrations run automatically (instrumentation).

## Drive

- Surface is the browser. Use Playwright headless: install it in the
  session scratchpad (`npm i playwright && npx playwright install
  chromium` — ~115 MB, cached under `%LOCALAPPDATA%\ms-playwright`
  after the first time), never in the project (keep package.json
  clean; the Linux lockfile regeneration gotcha makes dep changes
  expensive).
- Server actions can't be curl'd (action ids are per-build); anything
  behind a form or button needs the browser. Plain GETs (join links,
  forged-cookie probes) work with curl.
- Admin password in dev is `change-me` (`.env` `ADMIN_PASSWORD`).
- Personal tokens aren't rendered in the DOM; read them from the db:
  `docker exec paddleclash-db-1 psql -U postgres -d padelclash -tAc
  "select personal_token from players where name='X'"`.
- Confirm dialogs (rotate/retire/name-picker) — register
  `page.on("dialog", d => d.accept())` before clicking.

## Cleanup

- Reset dev data: `docker exec paddleclash-db-1 psql -U postgres -d
  padelclash -c "truncate players, settings"` (add tables as slices
  add them).
- Integration tests use a separate `padelclash_test` database on the
  same server — dev data and tests never collide.
