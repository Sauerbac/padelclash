# Tracer bullet — the first slice

The thinnest vertical slice that pierces every architectural layer, proving the whole stack before features are built on it. From Session D of the architecture grilling (2026-06-13). This is **not** all of M1 — it's the spine M1 hangs on.

## The slice

> A newly registered Player creates a Group, adds one Unclaimed opponent, logs one singles match, and sees the Leaderboard reflect the new ratings.

One flow, every layer touched once: Better Auth registration → fresh-registration path (`player` + `user`) → group + membership → unclaimed `player` → `logMatch` Server Action → service transaction → **pure replay engine** → projection rewrite → leaderboard query → render.

## Deliberate cuts (fast follows, not redesigns)

- **Simple Result only** — the engine reduces every format to `(sides, winner)`, so this drives the full rating path with the least UI. Set/points formats follow.
- **Singles only** — sides of one; doubles is the same engine with mean-of-two, added immediately after.
- **No confirmation** — the bullet's group runs as Trust Mode (confirmation is M2).
- **Create unclaimed opponent, don't claim yet** — claiming is its own slice once the spine works.

## Build order (first issues, dependency-ordered)

1. **Skeleton** — Next.js app; the four folders (`domain` / `services` / `db` / `app`) + ESLint boundary rule; Drizzle + Postgres; Better Auth wired; a Docker build that deploys to Coolify. *Proves the deploy pipeline on day one.*
2. **Schema migration** — the seven tables from [data-model.md](./data-model.md): `player`, `group`, `membership`, `match`, `match_participant`, `current_rating`, `rating_history` (plus Better Auth's own tables + `player_id`).
3. **Domain engine + golden-master fixture for one singles match** — RED→GREEN per [ADR-0008](../adr/0008-test-strategy.md), *before any UI*, no DB. The riskiest logic, proven first.
4. **`services.logMatch`** — transaction + replay + projection rewrite ([module-structure.md](./module-structure.md)), with the Tier-3 Postgres integration test.
5. **App** — register/login, create group, add unclaimed player, log-match Server Action, leaderboard page.

Rationale: each step is independently verifiable, and the two riskiest things — the **deploy pipeline** and the **rating engine** — are proven first, in isolation, before any UI exists.

## After the bullet

Doubles → set-score & points formats → confirmation (M2) → claiming → rating graph & win probability. The bullet makes all of these additive: each hangs off a spine already proven to work.
