Status: ready-for-agent

## What to build

The pure `replayMatch(priorState, match) -> (nextState, perParticipantOutput[])` function in `src/domain/`, targeting the Simple-Result / singles path only. No database, no Next.js — pure TypeScript testable in milliseconds. Write the Tier-1 golden-master fixture for one singles match (compute expected ratings by hand from the formula: start 1000, K=32, 400 divisor, logistic expected score, equal delta split across zero-sum sides), and the Tier-2 property tests (determinism, insertion-order independence, per-match conservation, idempotent rebuild). RED→GREEN per ADR-0008 — tests before implementation. Run with Vitest.

## Acceptance criteria

- [ ] `npm run test` runs pure tests in milliseconds with no DB dependency
- [ ] Golden-master: one singles-match fixture produces exact expected `current_rating` and `rating_history`
- [ ] Determinism: same log → byte-identical projection
- [ ] Insertion-order independence: matches in any order → identical projection
- [ ] Per-match conservation: deltas across both sides sum to zero
- [ ] Idempotent rebuild: replaying twice yields identical rows

## Blocked by

- 01-skeleton-deploy-pipeline

## Notes

Golden-master expected values are computed mechanically from the formula. A human should sanity-check those expected numbers before merging — but the computation is deterministic, so the slice itself is AFK.
