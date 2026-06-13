Status: done

## What to build

`services.logMatch(input)` — the transactional mutation that is the app's write spine. In one Postgres transaction: validate input, insert `match` + `match_participant` rows, invoke the pure replay engine over the group's full competitive/non-voided stream, DELETE the group's `rating_history` + `current_rating` projection rows, bulk-insert the rebuilt rows, commit. Write the Tier-3 integration test: the transactional DELETE-replay-insert rebuild equals a pure from-scratch engine run on the same log.

## Acceptance criteria

- [x] `logMatch({ groupId, players: [{side, playerId}], winnerSide, loggedBy })` succeeds and produces correct projection rows
- [x] Tier-3 Postgres integration test passes: tx rebuild output matches pure engine output byte-for-byte
- [x] Transaction rolls back on failure (no partial projection)
- [x] Casual matches are inserted but excluded from replay (no rating impact)
- [x] Voided matches are excluded from replay

## Notes (implementation)

- `services.logMatch` (`src/services/logMatch.ts`) — injectable `db` param so the
  Tier-3 test targets `padelclash_test`; production uses the pooled `getDb()`.
- App-side UUIDv7 generator added (`src/db/ids.ts`) for source-row ids, per the
  schema convention; the time-ordered prefix doubles as the replay tiebreaker.
- Tier-3 runs on a separate config (`vitest.integration.config.ts`,
  `npm run test:integration`) so the pure commit gate stays DB-free. Bootstrap
  (create `padelclash_test` + migrate + truncate-between) in `src/db/test-db.ts`.
- One decision deferred: a freshly logged match is hardcoded `status: "confirmed"`
  (replay ignores status except `voided`). Trust-mode-aware default is the
  confirmation slice — see `docs/open-questions/03-new-match-confirmation-status.md`.

## Blocked by

- 02-core-schema-migration
- 03-pure-rating-engine-tests
