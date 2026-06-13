# Rating engine — design reference

The concrete shape of the rating engine and its data model. This consolidates the architecture grilling of Session A (2026-06-13). It is the realization of the foundational ADRs — read those first for the *why*:

- [ADR-0001](../adr/0001-ratings-derived-by-replay.md) — ratings are derived by replaying the match log; keys and ordering.
- [ADR-0002](../adr/0002-ratings-are-per-group.md) — one rating per Player per Group.
- [ADR-0003](../adr/0003-one-match-model-three-result-formats.md) — one Match model, three result formats; storage shape.
- [ADR-0007](../adr/0007-synchronous-materialized-projection.md) — ratings are a synchronous materialized projection.
- Feature [09](../../features/09-result-confirmation.md) — the replay-stream contract.

## Runtime model

The match log is the only source of truth. Derived state (current Rating, rating history, Leaderboard) is **stored** in projection tables and rebuilt by **full replay of one group, inside the same transaction as the mutation** that triggered it (ADR-0007). Projection tables are a formal cache — droppable and rebuildable from the log.

## The replay stream

Input to a group replay = **every Competitive, non-Voided match in the group, ordered by `(played-at, logged-at, id)`** (feature 09). Casual matches and Voided (soft-deleted) matches are skipped. Confirmation status (Pending / Confirmed / Contested) does not affect inclusion — the optimistic model.

## The engine function

A pure function, no hidden inputs (ADR-0001):

```
replayMatch(priorState, match) -> (nextState, perParticipantOutput[])
```

### Threaded state — rating-only, minimal

Per Player within the group being replayed:

| Field | Purpose |
|---|---|
| `rating` | the Elo number, stored at **full precision** (`numeric`), rounded only for display |
| `competitiveMatchesPlayed` | gates the 10-match Provisional phase (feature 03) |
| `matchesSinceReset` | gates the 5-match post-season-reset Provisional phase (feature 03) |

Nothing else is threaded state: nothing else feeds back into a future rating.

### Per-match output — one record per participant

`ratingBefore`, `delta`, `ratingAfter`, `wasProvisional`, and the Side's pre-match `winProbability`. These rows **are** the `rating_history` projection: they power the rating graph, the "+14!" feedback, and the per-match audit.

### Formula (feature 03)

Start 1000; logistic expected score, 400 divisor. K=32 normal, K=64 Provisional (first 10 in group; first 5 after a season reset), K/2 for Americano rounds. A Side's rating = arithmetic mean of its players; the delta is applied **equally** to each partner. Singles = the same engine with sides of one. The formula is a pluggable pure function (so margin-of-victory etc. can become a group setting later).

## What is NOT the engine — separate projections over the log

Streak, form (last-N), head-to-head, partner chemistry, Pairing stats. None affect a rating, so each is its own pass over the match log (plus the per-match rating records where a number is needed). This keeps the engine tiny and golden-master-testable.

## Projection tables (decided 2026-06-13)

Two tables; the Leaderboard is a query, not a table.

**`rating_history`** — the engine's per-match output, one row per (match, participant):
`group_id, match_id, player_id, side, rating_before, delta, rating_after, was_provisional, win_probability`, plus denormalized `played_at` so the rating graph orders without joining back to `matches`. Append-built during replay.

**`current_rating`** — one row per (group, player):
`rating, competitive_matches_played, matches_since_reset, is_provisional, is_ranked, last_match_at`. This is the **end-state of the replay loop written out** — free, since the loop already holds it. What the Leaderboard and Win Probability read. `is_ranked` = the ≥3-competitive-match threshold (open-question 03).

**Leaderboard** = a query/view over `current_rating`: `WHERE group_id = ? AND is_ranked ORDER BY rating DESC`, **Rank computed at read time** (window function over ≤100 rows). Not materialized — `current_rating` already holds everything and rank is trivial on read.

### Rebuild mechanism

On **any** mutation to a group's match log, inside the same transaction: `DELETE` that group's `rating_history` + `current_rating` rows → **replay the whole group from scratch** → bulk-insert. Not "replay from the change point" (that needs per-match state snapshots; ADR-0001 says full replay is cheap enough to skip the optimization for years). There is no snapshot cache that could drift. A 4,000-match group rewrites ~8,000 `rating_history` rows on a write — single-digit milliseconds, never on a read.

## Test contract (decided 2026-06-13)

Three tiers. Tiers 1–2 are pure (no DB, milliseconds) and gate every commit; see [ADR-0008](../adr/0008-test-strategy.md) for the app-wide posture.

**Tier 1 — Golden-master fixtures.** Hand-verified scenario logs, each with exact expected `current_rating` + `rating_history`. Minimum set: singles, doubles equal-split, the 10-match Provisional→normal transition, a season-reset re-provisional, an Americano K/2 round, a mid-stream void, and a backdated insert that re-sorts the log. They double as the human-readable spec of the formula. A deliberate formula change regenerates expected outputs; **the test diff is the reviewed blast radius** (the season-boundary-only guard of feature 03).

**Tier 2 — Property tests** (any random valid log):
- **Determinism** — same log → byte-identical projection.
- **Insertion-order independence** — matches inserted in any order yield identical projection (the stable `(played-at, logged-at, id)` sort is what the whole replay model rests on).
- **Per-match conservation** — deltas across both Sides sum to zero.
- **Idempotent rebuild** — replaying twice yields identical rows.

**Tier 3 — One Postgres integration test** — the transactional DELETE-replay-insert rebuild equals a pure from-scratch engine run on the same log. Guards the wiring, not the math.
