# Rivalries & Challenges

**Rank: 16 — Manufactured drama**

## What it is
Formalized one-on-one (or team-on-team) narratives: declared rivalries with running scores, and direct challenges players can issue to each other.

## Core capabilities
- Challenge a player/team: "Best of 3 sets, Thursday, loser buys drinks" — accepted challenges become scheduled matches with a badge on the result
- Rivalry pages: once two players/teams have met N times, a rivalry page exists with the all-time score, history and current holder of "bragging rights"
- Title-belt mode: a virtual belt held by a player, taken by beating them in a challenge match

## Ideas beyond the basics
- Wager notes on challenges (non-monetary: "loser brings the balls for a month")
- Rivalry notifications: "Jonas just passed your rating — defend your honor?"
- Group-vs-group rivalries as a far-future idea

## Why this rank
Builds entirely on head-to-head data and scheduling. Great personality feature for the app, but clearly an enhancement layer.

## Resolved decisions (self-grill, 2026-06-12)

**Q: When does a rivalry exist?** Automatically at **5 competitive meetings** between the same two players (or pairings) in a group — no declaration needed. The page shows the all-time tally, history, and current bragging-rights holder (winner of the latest meeting). Auto-creation is the right call: declared rivalries would mostly never be declared.

**Q: Challenges — what are they really?** A Scheduled Match (08) with stakes attached: a wager note (non-monetary, free text) and a badge on the eventual result. This means **challenges sequence after scheduling ships** — they're a flavor on top of it, not a parallel system.

**Q: Title-belt mode?** One virtual belt per group, opt-in in group settings. The holder defends in any competitive match they play (not only declared challenges — a belt that's never on the line is boring); beat the holder, take the belt. Belt history on the group page.

**Q: Rivalry notifications ("defend your honor")?** Folded into the notification catalogue (12) under the competitive-pressure category — opt-in like the other "slightly evil" nudges.

**Q: Group-vs-group rivalries?** Out entirely; contradicts the one-group-per-match worldview ([ADR-0002](../docs/adr/0002-ratings-are-per-group.md)). Revisit only if cross-group play ever becomes real.

**Scope: Milestone 4**, after scheduling; rivalry pages can ship slightly earlier than challenges since they're pure derived data.
