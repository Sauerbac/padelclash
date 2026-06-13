# One Match model with three result formats; a winner is always required

Every Match has two Sides (one or two players each) and exactly one of three result formats: Set Score, Points Score, or Simple Result. Draws do not exist. Decided because the three real logging situations differ irreconcilably — standard play wants set scores, Americano rounds are point-based, and courtside quick-logging wants one tap — and forcing everything into set scores would either block Americano or pollute the data with invented scores.

## Consequences

- The rating engine consumes only (sides, winner, format) plus optional detail, and may weight by format (e.g. short Americano rounds at reduced K). It never requires set-level data.
- Stats must tolerate matches without set detail; set-based stats simply skip them.
- If a future format genuinely needs draws (e.g. a points-league variant), that is a deliberate extension, not a bug fix.

## Storage shape (decided 2026-06-13)

A Match row carries a `result_format` discriminator enum (`set` / `points` / `simple`) and a single `result` `jsonb` payload holding the format-specific detail (set scores, point totals, or nothing). The **derived winner is promoted to real columns** — the engine and nearly every query depend only on (sides, winner, format), so that contract is a proper column, never a `jsonb` lookup. The payload's per-format shape is pinned by a discriminated union validated in the domain core (not by the database); the replay loop switches on `result_format` exactly once to parse the payload into a typed value. Rejected: separate `set_results` / `points_results` tables (a three-way join on every read and in the replay loop, for no benefit at this scale). Future margin-of-victory weighting becomes a payload field, not a migration.
