# Leaderboards & Rankings

**Rank: 5 — Where the bragging rights live**

## What it is
A ranked table of all players in a group, ordered by Elo. The first screen most people open.

## Core capabilities
- Group leaderboard sorted by Elo, showing rating, win/loss record, and recent trend (↑/↓)
- Rank-change indicators since last week ("+2 places")
- Minimum match count to appear ranked (avoids the guy who played once and quit sitting at #1)
- Filter by timeframe: all-time, this season, this month

## Ideas beyond the basics
- Secondary leaderboards: most matches played, longest win streak, best win rate this month — gives weaker players something to top
- Doubles-team leaderboard: rank fixed pairings, not just individuals
- "Movers of the week" highlight
- Podium visual for top 3

## Why this rank
The leaderboard converts Elo into social currency. It's the artifact people screenshot and send to the group chat — the main retention driver after the rating itself.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Minimum matches to be Ranked?** **3 competitive confirmed matches.** Friend groups play weekly; 3 is reachable in one or two evenings, while still keeping the played-once-and-quit guy off #1. Unranked players are listed greyed-out below the ranked table, with progress shown ("1 of 3 matches"). Group-tunable later, not in v1.

**Q: Default view?** Current season if the group has seasons enabled, otherwise all-time. The all-time leaderboard simply shows current ratings — with per-group ratings and soft resets, "all-time" and "current" are the same number by design (see feature 11).

**Q: What exactly is the trend indicator?** Two things, both cheap from replay: rating delta over the last 7 days (↑/↓ with amount) and rank change since one week ago ("+2 places").

**Q: Secondary leaderboards?** v1.2: most matches this month, best win rate this month (minimum 5 matches), longest active streak. Purpose: give the bottom half something to top.

**Q: Doubles-pairing leaderboard?** v1.2. A **Pairing** qualifies with ≥3 matches together and is ranked by win rate and combined rating. Deliberately *no* separate pairing Elo — one rating system in the app, ever. Chemistry stats (feature 07) cover the rest.

**Scope: Milestone 1 (MVP)** for the core board with trend indicators; secondary and pairing boards in Milestone 2–3.
