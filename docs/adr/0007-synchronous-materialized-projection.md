# Ratings are a synchronous materialized projection of the match log

The match log is the only source of truth ([ADR-0001](0001-ratings-derived-by-replay.md)), but the derived state — each Player's current Rating, their rating-history points, and the group Leaderboard — is **stored** in projection tables, not recomputed on every read. Any mutation to a group's match history (log, edit, delete, confirm, contest resolution, account merge, season rollover) triggers a **full replay of that one group, inside the same database transaction**, which replaces the group's projection rows. Reads are served from the projection tables as plain indexed queries.

## Considered Options

**Compute-on-read** — store only the log, replay on every view. Rejected: the Leaderboard could not be expressed as `ORDER BY rating LIMIT n` in SQL (ratings would not be columns), and every profile/graph/leaderboard view would pay the replay cost. Simpler schema, but it pushes complexity onto the hottest paths.

**Asynchronous projection** — replay in a background job after the write commits. Rejected for v1: it buys a queue, a worker, and an eventual-consistency window to design around, none of which the scale (thousands of matches per group, ~100 Players) justifies. A confirmed match must show correct ratings immediately.

## Consequences

- Every match mutation does work proportional to the group's entire history, not just the changed match. Explicitly accepted in [ADR-0001](0001-ratings-derived-by-replay.md) ("full replay is trivially cheap; no incremental optimization needed for years").
- The write path and the replay must share one transaction: a match insert and the projection rebuild commit or roll back together. There is never a moment where the log and the projection disagree.
- The projection tables are a cache in the formal sense — droppable and fully rebuildable from the log. This makes a formula change, a bug fix, or a schema migration of the projection safe: rebuild from source.
- The Global Rating ([ADR-0006](0006-opt-in-global-rating.md)) is a second projection over a different input stream, produced by the same engine. Its replay trigger and transaction boundary are a separate question (a cross-group match touches it), revisited when feature 19 is built.
