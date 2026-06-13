Status: done

## What to build

Create the Drizzle schema migration for the seven core tables from the data-model reference (`player`, `group`, `membership`, `match`, `match_participant`, `current_rating`, `rating_history`), plus wire Better Auth's tables with the `player_id` foreign key on `user`. Run migrations from the container entrypoint before `next start`. Also create `docs/open-questions/` (empty directory) so the `rating-engine.md` cross-reference to "open-question 03" resolves — the ≥3 ranked threshold is already decided.

## Acceptance criteria

- [x] `npm run db:migrate` creates all seven core tables + Better Auth tables in a local Postgres — verified against `postgres:16` in Docker: 11 tables created (player, group, membership, match, match_participant, current_rating, rating_history, user, session, account, verification)
- [x] `user.player_id` is a unique, not-null FK to `player.id` — confirmed in `information_schema`: `uuid`, `NOT NULL`, constraints `user_player_id_unique` (u) + `user_player_id_player_id_fk` (f)
- [x] `rating_history` and `current_rating` schemas match the projection table definitions in the engine reference — full-precision `numeric` rating columns, denormalized `played_at`, `is_provisional`/`is_ranked` on current_rating
- [x] Migration runs idempotently (re-running on an existing DB is a no-op) — second `db:migrate` recorded no new migration (still 1) and held at 11 tables; raw SQL also uses `CREATE TABLE IF NOT EXISTS` + guarded constraint adds
- [x] `docs/open-questions/` directory exists — created with a README noting open-question 03 (ranked threshold) is already decided as `group.ranked_threshold` default 3

## Done this session

- `src/db/schema.ts` — 11 tables: 7 domain core + 2 replay projections + 4 Better Auth tables. camelCase JS keys (Better Auth matches its model fields by name) over snake_case columns. Domain ids are app-generated UUIDv7 (`uuid`, no DB default); Better Auth ids are `text`. Better Auth core columns sourced from the official schema docs so slice 06 can wire the Drizzle adapter against these tables directly.
- `src/db/migrations/0000_true_ink.sql` — generated via `drizzle-kit generate`; the boot-time migrator (`scripts/migrate.mjs`) now applies it instead of no-op'ing.
- `docs/open-questions/README.md` — directory home; resolves the `rating-engine.md`/`data-model.md` cross-reference.
- Verified end-to-end against a throwaway `postgres:16` container (migrate → inspect → migrate again). lint + typecheck + test all green. Container torn down.

## Blocked by

- 01-skeleton-deploy-pipeline
