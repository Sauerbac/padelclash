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

```bash
npm install
cp .env.example .env      # point DATABASE_URL at a Postgres
npm run dev               # http://localhost:3000  (health: /api/health)
```

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

In the container, migrations apply on boot via `scripts/migrate.mjs` before the
server starts (`docker-entrypoint.sh`).
