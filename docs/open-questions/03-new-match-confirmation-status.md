# Open question 03 — what status does a freshly logged match get?

**Raised:** 2026-06-13, during slice 04 (`services.logMatch`).
**Status:** deferred to the confirmation slice (feature 09 / result confirmation).

## The question

`logMatch` must write a `match.status`. The four statuses are `pending`,
`confirmed`, `contested`, `voided`. What should a brand-new logged match be?

Plausibly it depends on the group's `trust_mode`:

- **trust_mode = true** (the schema default): no confirmation step, so a logged
  match is effectively `confirmed` the moment it lands.
- **trust_mode = false**: the optimistic model logs it as `pending` (it still
  counts toward ratings immediately — confirmation status does not gate replay,
  rating-engine.md), and the opponent later confirms or contests it.

## Why it's safe to defer

Replay inclusion depends only on `classification` (competitive) and `status !==
voided` (rating-engine.md, "The replay stream"). `pending`, `confirmed`, and
`contested` are all *included* identically. So the rating math is unaffected by
the choice — it only changes what the confirmation UI shows.

## What slice 04 does in the meantime

Hardcodes `status: "confirmed"`. When the confirmation slice lands, replace this
with the trust-mode-aware decision (and the pending→confirmed/contested
transitions, which are their own mutations on the same write spine).
