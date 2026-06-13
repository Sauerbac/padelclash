Status: ready-for-agent

## What to build

The tracer-bullet payoff. A Server Action (`logMatch`) exposed via a log-match form: select two opposing sides (singles: one Player each), pick a winner, submit. The action calls `services.logMatch`, which inserts the match, replays the group's ratings, and rebuilds the projection. The Leaderboard page then reflects the new ratings — the winner rises, the loser falls. This proves the full spine: auth → group → members → match log → rating engine → projection → leaderboard render.

## Acceptance criteria

- [ ] Log-match form: pick Player A, pick Player B, pick winner, pick competitive/casual, submit
- [ ] Competitive match: ratings update; Leaderboard reflects the change
- [ ] Casual match: match appears in history but ratings are unchanged
- [ ] Leaderboard shows Rank, Player name, Rating, and competitive matches played
- [ ] The delta pill on a player's profile shows the rating change from their last match

## Blocked by

- 08-add-unclaimed-opponent
