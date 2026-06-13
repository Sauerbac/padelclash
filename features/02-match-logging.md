# Match Logging

**Rank: 2 — The core daily action**

## What it is
Recording who played whom and how it ended. This is the single most-used feature; everything else (ratings, stats, leaderboards) is derived from logged matches.

## Core capabilities
- Log a match: players/teams, date, result
- Support padel's standard format: 2 vs 2 with set scores (e.g. 6-4, 3-6, 7-5), but also allow 1 vs 1 and simple "Team A won" quick-logging for casual play
- Any participant can log the match
- Edit/delete within a grace period (typos happen)
- Match history list, filterable by player, partner, opponent, date

## Ideas beyond the basics
- Quick-log mode: pick 4 players, tap the winning team, done in 10 seconds courtside
- Optional details: venue/court, match duration, indoor/outdoor
- "Rematch" button that pre-fills the same players
- Tag matches as "casual" vs "competitive" (only competitive affects Elo — see [09])

## Why this rank
If logging a match takes more than a few seconds, people stop doing it and the whole app dies. This is the heartbeat of the product.

## Resolved decisions (self-grill, 2026-06-12)

**Q: What is the canonical result model?** A Match = two Sides (1–2 players each) + exactly one result format: **Set Score**, **Points Score** (needed for Americano), or **Simple Result** (winner only). A winner is always required; draws don't exist. See [ADR-0003](../docs/adr/0003-one-match-model-three-result-formats.md).

**Q: Who may log a match?** Any group member — not just participants. Rationale: unclaimed players can't log their own matches, and in practice one person is "the phone person" for the evening. Confirmation (feature 09) is the integrity guardrail, so widening who can log is safe.

**Q: Is backdating allowed?** Yes, freely. Replay ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)) reorders by played-at and recomputes, so inserting last month's forgotten match just works. This also gives us spreadsheet import for free.

**Q: Edit/delete rules?** While Pending: the logger edits or deletes freely. After confirmation: any edit puts the match back into Pending (re-confirmation); deletion requires an admin. Everything is audited (who, what, when).

**Q: Casual vs competitive — what's the default and can it flip?** Default is **competitive** (the rating is the product). A casual toggle at log time; flipping after confirmation re-triggers confirmation. Casual matches appear in history and head-to-head, but never touch ratings or streaks.

**Q: How fast is quick-log really?** Target: pick 4 players (recent-players first), tap the winning side, done — under 10 seconds, no score required (Simple Result). Set scores are progressive disclosure, not a gate.

**Q: Match metadata (venue, duration, indoor/outdoor)?** Deferred to Milestone 4 with Venues. MVP logs date + players + result + casual flag, nothing else. "Rematch" pre-fill button lands in v1.1.

**Scope: Milestone 1 (MVP).**
