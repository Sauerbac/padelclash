# Fair Team Balancing (Matchmaker)

**Rank: 10 — Turns the Elo data into better games**

## What it is
Given 4+ players, the app suggests team splits that produce the closest possible match, using everyone's Elo. Solves the eternal "okay, who plays with whom?" debate.

## Core capabilities
- Pick the players present → app proposes the most balanced 2v2 split with predicted win probabilities
- Show alternatives ("second-fairest split") so people can still choose
- For 5+ players: propose rotation schedules so everyone gets equal court time

## Ideas beyond the basics
- "Chaos mode": deliberately propose the most lopsided fun pairings, or random teams
- Account for partner chemistry (see [07]), not just raw individual Elo
- Balance an entire Americano round assignment, not just one match

## Why this rank
A genuine differentiator that uses data the app already has, and it removes a real friction in every session. Pure delight feature — but useless until enough matches exist to make ratings meaningful, hence mid-table.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Algorithm for 4 players?** Trivial and that's fine: enumerate all 3 possible 2v2 splits, compute win probability for each (mean-of-pair ratings, same engine as feature 03), rank by closeness to 50/50. Show the fairest and second-fairest with their probabilities; one more tap reveals **Chaos Mode** — the most lopsided split, clearly labelled ("87% — good luck").

**Q: How are provisional players handled?** Their rating is used as-is, with a "low confidence" marker on the suggestion. Excluding them would make the feature useless exactly when a new player joins — the moment you most need help balancing.

**Q: 5+ players and rotation schedules?** Deferred to Sessions (feature 18), where it naturally lives: a session knows who's present and how many courts there are. Balancing a full Americano round assignment belongs to the tournament engine (06), not here.

**Q: Chemistry-aware balancing?** Later, once partner-chemistry data (07) has volume. When it comes, it's a refinement of the predicted probability, not a separate mode — and the preferred-side profile field (01) can be a tiebreaker between near-equal splits.

**Q: Where does it surface?** Standalone "Who plays with whom?" screen in v1; later also embedded in Scheduled Match conversion (08) and Sessions (18).

**Scope: Milestone 2.** Cheap to build once Elo exists, and it's the feature that makes the app *useful courtside* rather than just a scoreboard — the differentiator deserves to ship early.
