Status: ready-for-agent

## What to build

`services.logMatch(input)` — the transactional mutation that is the app's write spine. In one Postgres transaction: validate input, insert `match` + `match_participant` rows, invoke the pure replay engine over the group's full competitive/non-voided stream, DELETE the group's `rating_history` + `current_rating` projection rows, bulk-insert the rebuilt rows, commit. Write the Tier-3 integration test: the transactional DELETE-replay-insert rebuild equals a pure from-scratch engine run on the same log.

## Acceptance criteria

- [ ] `logMatch({ groupId, players: [{side, playerId}], winnerSide, loggedBy })` succeeds and produces correct projection rows
- [ ] Tier-3 Postgres integration test passes: tx rebuild output matches pure engine output byte-for-byte
- [ ] Transaction rolls back on failure (no partial projection)
- [ ] Casual matches are inserted but excluded from replay (no rating impact)
- [ ] Voided matches are excluded from replay

## Blocked by

- 02-core-schema-migration
- 03-pure-rating-engine-tests
