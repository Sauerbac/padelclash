# PadelClash

Padel ratings, leagues, and leaderboards. A TypeScript Next.js monolith,
self-hosted on Coolify (see [ADR-0010](docs/adr/0010-stack-and-platform.md)).

## Layout

```
src/
├── domain/    pure core: rating engine, projections, policy   (no next, no db)
├── services/  application layer: transactions, calls domain, reads/writes db
├── db/        Drizzle schema + client
├── ui/        presentational design-system kit                (no next*, no data)
└── app/       Next.js routes + Server Actions (the seam)
```

Layer boundaries are lint-enforced (`eslint.config.mjs`); see
[module-structure.md](docs/architecture/module-structure.md).

## Develop

A fresh clone goes from zero to a running, DB-backed app with **no secrets to
obtain** — Postgres comes from Docker, and external services (Resend email,
Google sign-in) degrade to dev-safe stubs when their keys are absent.

```bash
npm install
npm run setup             # .env from template + Postgres up + migrations applied
npm run dev               # http://localhost:3000  (health: /api/health)
```

`npm run setup` is a thin wrapper (`scripts/setup.mjs`): it copies `.env` from
`.env.example` if missing, starts the local Postgres and waits for it, then runs
migrations. It stops before `dev` (interactive) and `db:seed` (a stub until
slice 04). To run the steps by hand instead:

```bash
docker compose up -d --wait db    # local Postgres (see docker-compose.yml)
cp .env.example .env              # only if you don't have one
npm run db:migrate
npm run dev
```

### Local Postgres

`docker-compose.yml` provides a `db` service (`postgres:16`, persistent volume)
for local dev only — production runs on Coolify with its own managed Postgres
([ADR-0010](docs/adr/0010-stack-and-platform.md)). If port 5432 is taken, change
it in both `docker-compose.yml` and `DATABASE_URL`.

### Environment & external services

`.env.example` documents every variable. `DATABASE_URL` is required to boot
(`BETTER_AUTH_SECRET` joins it from slice 06). The rest are optional and stub out
when blank:

- **Email (Resend):** with no `RESEND_API_KEY`, the `EmailSender` port uses a
  console adapter — verification/claim links print to the **server log**; copy
  the link from the terminal. Set a real key only to test live email.
- **Google sign-in:** offered only when `GOOGLE_CLIENT_ID`/`_SECRET` are present;
  email+password is the primary local path.

## Gates

```bash
npm run lint        # boundary rules + Next lint
npm run typecheck   # tsc --noEmit
npm test            # Vitest pure tier (ADR-0008)
```

CI (`.github/workflows/ci.yml`) runs all three on every push.

## Database

Versioned Drizzle migrations:

```bash
npm run db:generate   # diff schema.ts -> SQL in src/db/migrations
npm run db:migrate    # apply locally
```

Migrations are **manual locally** (run them deliberately, especially after
`db:generate`); `next dev` does not auto-migrate. In the container they apply on
boot via `scripts/migrate.mjs` before the server starts (`docker-entrypoint.sh`),
since there's no human in the loop there.

```bash
npm run db:seed       # demo group + players + matches (stub until slice 04)
```

The seed builds on the real match-logging service so it exercises the replay
engine, rather than writing projection rows directly.

The single Postgres-backed test (Tier 3, [ADR-0008](docs/adr/0008-test-strategy.md))
will run against a separate `padelclash_test` database on the same compose
Postgres, each test wrapped in a rolled-back transaction so it never pollutes dev
data. It joins CI (as a Postgres `services:` block) in slice 03, when the first
integration test exists.
