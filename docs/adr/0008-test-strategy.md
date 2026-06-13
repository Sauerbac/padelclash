# A framework-free domain core, tested as a pyramid across the whole app

The app is built to be tested, not retrofitted with tests. The domain core — the rating engine and the other log projections — is **pure TypeScript with no dependency on Next.js, the database, or any framework**, so its logic is testable in milliseconds without spinning up infrastructure. Above it sits a thin framework/persistence layer that is covered by a smaller band of integration tests, and the critical user flows by a still-smaller band of end-to-end tests. Decided 2026-06-13; applies to the whole app, not just the engine.

## Considered Options

**Test the engine thoroughly, the rest ad hoc** — rejected. The user explicitly wanted full testing for the whole app, and the integrity features (confirmation, contests, merges, rollovers) are exactly where untested wiring would silently corrupt ratings.

**Lean on end-to-end tests for confidence** — rejected as the primary tier. E2E tests are slow, flaky, and can't enumerate the formula's edge cases the way pure golden-master + property tests can. They stay the thin top of the pyramid (critical flows only).

## Consequences

- The domain core must not import framework or DB types. This forces the module boundary that Session C will formalize: pure core ← persistence adapters ← Next.js (server actions / route handlers). Anything that needs a DB to test belongs *above* the core, not in it.
- The rating engine's concrete test contract is the three tiers in [the engine reference](../architecture/rating-engine.md): golden-master fixtures, property tests (determinism, insertion-order independence, per-match conservation, idempotent rebuild), and one Postgres integration test for the transactional rebuild.
- Pure tiers (fixtures + properties) run with no database in milliseconds and gate every commit. Integration and E2E tiers run against real Postgres and are narrower.
- A deliberate rating-formula change is reviewed via the golden-master diff — the test suite is the visible record of a formula change's blast radius.
