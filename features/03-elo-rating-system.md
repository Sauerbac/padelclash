# Elo Rating System

**Rank: 3 — The hook that keeps people engaged**

## What it is
Every player has a numeric skill rating that goes up when they win and down when they lose, weighted by how strong the opposition was. Beating a much better team gains a lot; beating a much weaker team gains little.

## Core capabilities
- Individual Elo per player, updated after every competitive match
- Doubles handling: a team's rating is derived from both players (e.g. average), and rating change is distributed to both — this is the padel-specific twist most generic Elo implementations get wrong
- New players start at a default rating (e.g. 1000) with a provisional phase where the rating moves faster until it stabilizes
- Rating history graph per player
- Show expected win probability before a match ("Team A: 64%")

## Ideas beyond the basics
- Margin-of-victory weighting: a 6-0, 6-0 win moves ratings more than 7-6, 7-6
- Rating decay for long inactivity (gentle, to avoid punishing vacations)
- Separate ratings per group, or one global rating — decide early, it's hard to change later
- Named tiers on top of the number (Bronze/Silver/Gold/…) for casual readability

## Why this rank
The Elo number is what gives every single match stakes. It turns "we played padel" into "I'm climbing." It's the explicit centerpiece of the app's appeal.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Per-group or global rating? (the "decide early" flag)** **Per group** as the primary mechanic — group-configurable policies (season rollovers, trust mode, future formula options) are incompatible with one shared number. See [ADR-0002](../docs/adr/0002-ratings-are-per-group.md). *Amended 2026-06-12:* an **opt-in Global Rating** additionally exists as a separate number computed by the same engine over the cross-group stream of fully-opted-in matches — see feature [19](19-global-ranking.md) and [ADR-0006](../docs/adr/0006-opt-in-global-rating.md).

**Q: Concrete formula for v1?**
- Start at **1000**. Expected score via the standard logistic curve with a 400-point divisor.
- **K = 32** normally; **K = 64** while Provisional (first 10 competitive matches in a group, and first 5 after a season reset). Provisional players get a marker on the leaderboard.
- Doubles: a Side's rating = **arithmetic mean** of its two players; the resulting delta is applied **equally** to both partners. Singles uses the identical engine with sides of one.
- Americano rounds (short point-games, ~15 min) count at **K/2** — they're real competitive play but shouldn't swing ratings like a full match. Format-aware weight, easy to explain.

**Q: Why equal delta instead of weighting the lower-rated partner's change higher?** Explainability beats theoretical elegance in a friends app. "We both got +12" survives a courtside argument; asymmetric deltas don't. Revisitable later — replay makes a formula change technically cheap (though socially disruptive, so any change applies from a season boundary, never retroactively).

**Q: Margin-of-victory weighting?** Deferred. The formula is a pluggable pure function (forced by [ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)), so MOV can become a group setting later. Not v1: it punishes mercy and rewards stat-padding against weak sides.

**Q: Inactivity decay?** Rejected for v1. In small friend groups it punishes vacations and parents; the season system (11) already provides the freshness mechanism.

**Q: Named tiers?** v1.2, purely cosmetic on top of the number. Thresholds decided then.

**Q: What ships in MVP?** Rating per player, provisional phase, rating-over-time graph (free from replay), and pre-match win probability. Everything above is the MVP rating engine.

**Scope: Milestone 1 (MVP).**
