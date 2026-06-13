# Ratings are derived state, recomputed by replaying the match log

Matches are the only source of truth; ratings, leaderboards, streaks and stats are deterministic projections of a group's match history, ordered by (played-at, logged-at, id). Any correction — a contested result, an edit, a deletion, a backdated match, an account merge, a season rollover, a future formula change — is handled by replaying the affected group's history from the change point, never by manual adjustment.

## Considered Options

Incremental-only Elo updates with compensating adjustments on correction — rejected. Edits, backdating, merges and rollovers each become error-prone special cases, and "every error permanently poisons the ratings" is exactly the failure mode the result-confirmation feature exists to prevent. With replay, all of these collapse into one mechanism.

## Consequences

- Rating formulas must be pure functions of (prior state, match) with no hidden inputs.
- A per-group replay must stay fast. A friend group produces thousands of matches at most, so full replay is trivially cheap; no incremental optimization is needed for years.
- Historical rating deltas shown in the UI can change retroactively after a correction. Accepted — that is the point.
- Spreadsheet import of historical matches is free: insert the matches, replay.

## Keys and ordering (decided 2026-06-13)

The replay order `(played-at, logged-at, id)` must be a stable **total order** — the same log must always yield the same ratings, and matches can tie on both `played-at` (an evening logged together) and `logged-at` (a bulk import). The tiebreaker `id` is therefore a **UUIDv7** (time-sortable, generated in the domain layer *before* insert): the tiebreak is itself chronological, ids stay opaque in URLs and leak no volume count, and the engine can build a complete match object — id included — without a database round-trip, which keeps the pure rating function testable in isolation. Rejected: `bigint` auto-increment (leaks volume, guessable, id unknown until insert) and random UUIDv4 (stable but arbitrary tiebreak). `played-at` is a **timestamp** (defaults to "now" on quick-log, editable) so within-evening order stays meaningful when people log live; `logged-at` is **immutable**. Editing `played-at` (backdating) re-sorts the affected log and triggers a replay — it is just another correction, per this ADR.
