Status: ready-for-human

## What to build

Scaffold the whole delivery pipeline before any feature code exists. A Next.js 15 App Router project with the four-folder layout (`src/domain/`, `src/services/`, `src/db/`, `src/ui/`, `src/app/`), ESLint boundary rules enforcing that `domain` imports nothing of `next`/`drizzle`/`src/db` and `ui` imports nothing of `services`/`db`/`domain`/`next` (except `next/image`), Drizzle ORM wired to a PostgreSQL connection string, a Dockerfile (`output: standalone`) that builds a deployable image, a trivial health route that pings the DB, and a GitHub Actions workflow that runs lint + test on every push. Deploy to Coolify and confirm green.

## Acceptance criteria

- [x] `npm run dev` starts the Next.js dev server
- [x] `npm run lint` passes with the two boundary rules active (domain fence, ui fence) — fences verified rejecting real violations; `next/image` allowed in `ui`
- [x] `npm run build` produces a standalone build that starts and serves a health route — verified locally: `/` → 200, `/api/health` → 503 with no DB (clean catch, no crash), would be 200 with a DB
- [ ] GitHub Actions workflow runs lint on push and passes — **HITL:** needs Simon to create the GitHub repo and push (`.github/workflows/ci.yml` runs lint + typecheck + test)
- [ ] Coolify deploys the image and the health route returns 200 — **HITL:** needs Simon to deploy to his Coolify instance with `DATABASE_URL` set

## Done this session

Implemented and committed locally (`main`, commit `74bf032`). The two open boxes are deploy verification only — all code is in place:
- Four-layer `src/` with lint-enforced boundaries (`eslint.config.mjs`).
- Drizzle + postgres.js client, `/api/health` pinging the DB through `services`.
- `Dockerfile` (`output: standalone`) + boot-time migrator (`scripts/migrate.mjs`, no-op until slice 02) via `docker-entrypoint.sh`.
- Vitest pure tier green; `next build` green.

**Simon's next steps:** create the GitHub repo + push (triggers Actions), then point Coolify at it with a Postgres service + `DATABASE_URL`, set the health check to `/api/health`, and confirm green.

## Blocked by

None — can start immediately.
