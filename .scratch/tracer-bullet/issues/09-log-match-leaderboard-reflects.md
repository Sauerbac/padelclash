Status: done

## What to build

The tracer-bullet payoff. A Server Action (`logMatch`) exposed via a log-match form: select two opposing sides (singles: one Player each), pick a winner, submit. The action calls `services.logMatch`, which inserts the match, replays the group's ratings, and rebuilds the projection. The Leaderboard page then reflects the new ratings — the winner rises, the loser falls. This proves the full spine: auth → group → members → match log → rating engine → projection → leaderboard render.

## Acceptance criteria

- [x] Log-match form: pick Player A, pick Player B, pick winner, pick competitive/casual, submit — `/log` route renders `LogMatchForm` (singles, Simple Result per the bullet's cuts).
- [x] Competitive match: ratings update; Leaderboard reflects the change — `logMatchAction` → `services.logMatch` (tx + replay + projection rewrite) → `revalidatePath` → board reads the rebuilt `current_rating`.
- [x] Casual match: match appears in history but ratings are unchanged — the board's **Recent matches** section lists it with a Casual label; the engine excludes casual from replay (already proven in `logMatch.integration.test.ts`), so the leaderboard doesn't move.
- [x] Leaderboard shows Rank, Player name, Rating, and competitive matches played — `LeaderboardRow` shows a `matchesPlayed` sub-line on ranked rows; unranked rows already carry the count as "N of threshold".
- [x] The delta pill on a player's profile shows the rating change from their last match — the profile reads `getPlayerStanding` and renders the `RatingDelta` pill from the latest `rating_history` row.

## Done this session

The write spine (`services.logMatch` + engine + projection rewrite) and its Tier-3
test already existed from slice 04. This slice wired the **UI payoff** on top of it.

- **`src/app/log/`** — the Log tab made real (it was a dead `/log` link in the
  `TabBar`). `page.tsx` resolves the viewer into their first group (same pattern as
  Home; group-scoped routing stays deferred — [open-question 06](../../../docs/open-questions/06-group-scoped-navigation.md)),
  loads `getRoster`, and renders `LogMatchForm`. `actions.ts` is the thin
  `logMatchAction` shell — `requirePlayerId` → parse/validate the picks →
  `getGroupForMember` gate → `services.logMatch` → `revalidatePath` + redirect to
  the board (the moved leaderboard is the confirmation). `LogMatchForm.tsx` is the
  client form: two token-styled native `<select>`s for the sides, and two radio-group
  "toggles" (winner, competitive/casual) — `SegmentedToggle` isn't built yet
  (binding §7), so these are token-styled here. Same-player-both-sides is caught
  client-side and re-checked in `logMatch`.
- **`src/services/groups.ts`** — two reads added:
  - `getRecentMatches(groupId, limit)` — the board's history strip. Reads the
    source-of-truth `match` + `match_participant` (not the projection), newest first,
    voided excluded, casual kept + flagged. This is how a Casual match "appears in
    history" while leaving the leaderboard untouched.
  - `getPlayerStanding({ groupId, playerId })` — the profile's number: rating +
    matches-played from `current_rating`, and `lastDelta` from the latest
    `rating_history` row (competitive-only, so it's always the last rating-affecting
    result). Null when the player has no rated match yet.
- **`src/app/groups/[groupId]/page.tsx`** — added the prominent **Log a match**
  action (screens.md §0 — the sacred interaction, above the fold), a **Recent
  matches** section (ui `MatchResultBlock`), and `matchesPlayed` on each
  `LeaderboardRow`.
- **`src/ui/LeaderboardRow.tsx`** — new optional `matchesPlayed`: a mono sub-line on
  ranked rows (unranked rows keep "N of threshold" in the rank slot). Styleguide
  updated to render it.
- **`src/app/profile/page.tsx`** — the Me tab now shows the viewer's standing in
  their first group: current rating + the `RatingDelta` pill from their last match.
- **`src/services/groups.integration.test.ts`** (Tier-3, +5 tests = 18) —
  `getRecentMatches`: newest-first ordering, side names, winner, casual flag, voided
  exclusion, limit. `getPlayerStanding`: null with no rating, and rating + latest
  delta otherwise.
- **No schema/migration change** — the seven tables from slice 02 already carry the
  whole shape; this slice only reads/writes against them.

### Verification

- `npm run typecheck`, `npm run lint` (incl. the DS lint fence), `npm test` (33),
  `npm run test:integration` (25), and `npm run build` (all 6 routes compile) green.

### Notes / deferred

- **Singles + Simple Result only** — per the bullet's deliberate cuts
  (tracer-bullet.md). Doubles and set/points score entry are additive fast-follows.
- **No inline payoff celebration** — on success the action redirects to the board,
  where the leaderboard has moved and the new match shows in Recent matches; the
  delta pill lives on the profile. The animated "you +14!" moment (screens.md §3) is
  a later polish slice.
- **Group-scoped Log / multi-group picker** still deferred to
  [open-question 06](../../../docs/open-questions/06-group-scoped-navigation.md):
  `/log` and `/profile` resolve the viewer's first group, exactly as Home does.

## Blocked by

- 08-add-unclaimed-opponent
