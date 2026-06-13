# 02 — Provisional and Americano K-factors (deferred from slice 03)

**Status:** open — deferred to its own slice; not blocking.

Slice 03 (issue `03-pure-rating-engine-tests`) deliberately implements the
**constant K=32** Simple-Result / singles path only. The issue's golden master is
explicit: "start 1000, K=32". The rating-engine reference documents two K
variations that are **not yet modelled**:

- **Provisional** — K=64 for a Player's first **10** competitive matches in a
  group, and the first **5** after a season reset.
- **Americano** — K/2 for Americano rounds.

## What is already in place

- `PlayerState` carries `competitiveMatchesPlayed` and `matchesSinceReset`, so
  the Provisional gate needs no new threaded state.
- The K decision is isolated in one pure function, `kFactor()` in
  `src/domain/rating/engine.ts`. Today it takes no argument and returns `BASE_K`.
- `current_rating.isProvisional` and `rating_history.was_provisional` are emitted
  as `false` for now (no Player is treated as provisional).

## What the follow-up slice must do

1. Restore a `state: PlayerState` parameter on `kFactor` and return 64 while
   `competitiveMatchesPlayed < 10` (or `matchesSinceReset < 5` post-reset), else
   32; K/2 once an Americano result format/flag exists on `EngineMatch`.
2. Set `isProvisional` / `wasProvisional` from the same predicate.
3. Add the golden masters listed in `rating-engine.md`'s Tier-1 minimum set: the
   10-match Provisional→normal transition, a season-reset re-provisional, and an
   Americano K/2 round.

Note: with Provisional active, the slice-03 symmetric golden master (two fresh
Players, ±16) becomes ±32 for a first match — expected by the formula, and the
golden-master diff is the reviewed record of that change (ADR-0008).
