# Seasons

**Rank: 11 — Recurring fresh starts**

## What it is
Time-boxed competitive periods (e.g. quarterly). At season end a champion is crowned, the books close, and everyone gets a fresh shot — late joiners and players on a losing streak aren't permanently buried.

## Core capabilities
- Group-configurable season length (monthly / quarterly / custom)
- Season leaderboard alongside the all-time leaderboard
- Season-end summary: champion, most improved, most active
- Rating handling at rollover: full reset, soft reset (squash toward the mean), or carry-over — group admin chooses

## Ideas beyond the basics
- Season hall of fame: past champions listed on the group page
- A final "championship event" (tournament, see [06]) that decides the season among the top N
- Placement matches at season start for returning players

## Why this rank
Important for long-term retention — permanent all-time rankings demotivate everyone outside the top 3 after a year. But it only matters once the app has been used for months.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Are seasons mandatory?** No — opt-in per group, because a group that plays monthly would see seasons as noise. When enabled: monthly / quarterly / custom length, **default quarterly** (a monthly champion is decided by who had a busy work week; a year is the demotivation problem seasons exist to fix).

**Q: What exactly happens at Rollover?** Admin picks one of three, **default soft reset**: carry-over (nothing), soft reset (`new = 1000 + (old − 1000) / 2` — keeps skill ordering, halves the gap), or full reset to 1000. After any reset, everyone gets a 5-match provisional boost — that *is* the "placement matches" idea, no separate mechanism needed. A rollover is an event in the group's history, replayed like everything else ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)).

**Q: How do the season and all-time leaderboards coexist?** Resolved by simplification: the rating timeline is **continuous through rollovers** — the "all-time leaderboard" just shows current ratings, the season view shows season W/L plus rating gained this season. There is no second parallel rating. One number, two lenses.

**Q: Season-end ceremony?** Champion = Rank 1 among Ranked players at season end; summary names champion, most improved (largest rating gain), and most active. Past champions go on the group page (hall of fame). The summary doubles as a share card (13) — this is the screenshot moment of the quarter.

**Q: Championship finale event?** Not a mechanism in v1 — an organizer can simply run a tournament (06) in the last week. Formalize only if groups actually do it.

**Scope: Milestone 3**, alongside tournaments — together they make a quarter feel like a story arc.
