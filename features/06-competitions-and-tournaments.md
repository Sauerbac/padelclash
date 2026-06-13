# Competitions & Tournaments

**Rank: 6 — Organized play, explicitly requested**

## What it is
Structured events beyond casual matches: a tournament evening, a league running over weeks, or a one-day social format. The app handles draw, scheduling and standings so nobody has to maintain a spreadsheet.

## Core capabilities
- Tournament types:
  - **Knockout bracket** (single elimination, optional consolation round)
  - **Round robin / league** (everyone plays everyone, table with points)
  - **Americano / Mexicano** — the classic padel social formats where partners rotate every round and individuals score points; arguably the most-used format for friend groups
- Sign-up phase, then automatic draw/schedule generation
- Enter results round by round; standings and bracket update live
- Tournament results feed into Elo (configurable, perhaps with a higher weight)

## Ideas beyond the basics
- Seeding by Elo for fair brackets
- Recurring league: "every Tuesday for 8 weeks", with automatic fixtures
- Handicap events: weaker players start games with points advantage
- Tournament page as a shareable summary (champion, results, stats)

## Why this rank
Explicitly part of the original idea. Ranked below the core loop only because casual match logging will happen weekly while tournaments are occasional events — but this is the feature that creates the memorable highlights.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Which format ships first?** **Americano first**, then knockout, then round robin. Americano is what friend groups actually run on a random Tuesday and is the format spreadsheets handle worst (rotating partners + individual points). Mexicano follows as an Americano variant (pairings derived from standings each round) shortly after. Knockout/RR are for the occasional "real" tournament day.

**Q: Americano spec?** 4–16 players (sit-outs rotated fairly when not a multiple of 4); points per round configurable (16/21/24/32, default 32); fixed rotation pattern so everyone partners everyone as evenly as possible; individual standings by cumulative points; tie-break by head-to-head points, then fewest points conceded. Each round is logged as a normal Match with a **Points Score** ([ADR-0003](../docs/adr/0003-one-match-model-three-result-formats.md)).

**Q: Do tournament matches affect Elo, and at what weight?** Yes, as normal competitive matches at normal weight — *except* Americano/Mexicano rounds at K/2 (short point-games, see feature 03). The "higher weight for tournaments" idea is rejected: it double-counts drama and makes the rating harder to trust.

**Q: Confirmation inside tournaments?** Skipped. Everyone is physically present and the standings are on the screen; disputes get resolved courtside in the moment. Async confirmation would just gum up round progression.

**Q: Who can create and run a tournament?** Any member is an **Organizer** for tournaments they create; admins can delete any tournament. Organizers may add unclaimed players to the draw — a tournament evening is a great recruitment event.

**Q: Lifecycle?** Draft → Sign-up → In progress (round by round, standings/bracket live) → Completed (summary page with champion, results, share card). Seeding by rating is a toggle for knockout, default on.

**Q: Recurring leagues and handicap events?** Both deferred — recurring needs scheduling (08) underneath; handicaps need evidence anyone wants them.

**Scope: Milestone 3.** Americano in the first cut; knockout and RR in the same milestone, Mexicano trailing.
