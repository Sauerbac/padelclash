# Statistics & Match History

**Rank: 7 — Depth that rewards regular use**

## What it is
Aggregated insights derived from all logged matches: per player, per pairing, per matchup. The longer the group uses the app, the more valuable this gets.

## Core capabilities
- Per-player stats: matches played, win rate, sets won/lost, current and longest streaks, rating-over-time graph
- **Head-to-head**: full record between any two players ("You lead Jonas 12–8")
- **Partner chemistry**: win rate with each doubles partner — "you and Max win 78% together, you and Tom only 35%" (uniquely fun in padel because partners rotate)
- Form indicator: last 5–10 match results

## Ideas beyond the basics
- Time patterns: win rate by weekday or daytime ("you're terrible before noon")
- Nemesis & favorite victim: the opponent you lose to / beat the most
- Group-wide records page: longest streak ever, biggest upset (Elo gap), most matches in a month
- Year-in-review recap ("Your 2026 on court") — highly shareable

## Why this rank
Not needed on day one, but this is what makes the app feel alive after a few months of data and gives the group endless things to argue about.

## Resolved decisions (self-grill, 2026-06-12)

**Q: What's the v1.1 stats cut?** Head-to-head record, partner chemistry (shown once a pairing has ≥3 matches — below that it's noise), current/longest streaks (competitive matches only), form (last 10 results), and the rating graph (which already ships in MVP, since replay produces it for free).

**Q: Are stats global or per group?** **Per group**, consistently with [ADR-0002](../docs/adr/0002-ratings-are-per-group.md). Your head-to-head against Jonas in the club group doesn't mention your work-group matches. One worldview everywhere beats a cleverer aggregate that contradicts the leaderboard next to it.

**Q: Match-level or set-level win rates?** Match-level is the headline number everywhere. Set/game stats are secondary and simply skip matches logged without set detail ([ADR-0003](../docs/adr/0003-one-match-model-three-result-formats.md)).

**Q: Do casual matches appear in stats?** In match history and head-to-head counts (labelled), but never in streaks, form, or anything rating-adjacent. Same rule as everywhere else.

**Q: The fun extras?** Records page (nemesis, favorite victim, biggest upset, group records) in v1.2 — an upset is a win at <30% pre-match win probability, which we already compute. Time patterns and the year-in-review recap land with seasons (the recap is effectively the season summary grown up).

**Scope: Milestone 2** for the core cut; records page Milestone 3; year-in-review Milestone 4.
