Status: ready-for-agent

## What to build

Create the Drizzle schema migration for the seven core tables from the data-model reference (`player`, `group`, `membership`, `match`, `match_participant`, `current_rating`, `rating_history`), plus wire Better Auth's tables with the `player_id` foreign key on `user`. Run migrations from the container entrypoint before `next start`. Also create `docs/open-questions/` (empty directory) so the `rating-engine.md` cross-reference to "open-question 03" resolves — the ≥3 ranked threshold is already decided.

## Acceptance criteria

- [ ] `npm run db:migrate` creates all seven core tables + Better Auth tables in a local Postgres
- [ ] `user.player_id` is a unique, not-null FK to `player.id`
- [ ] `rating_history` and `current_rating` schemas match the projection table definitions in the engine reference
- [ ] Migration runs idempotently (re-running on an existing DB is a no-op)
- [ ] `docs/open-questions/` directory exists

## Blocked by

- 01-skeleton-deploy-pipeline
