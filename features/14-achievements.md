# Achievements & Badges

**Rank: 14 — Goals for everyone, not just the best player**

## What it is
Collectible badges for milestones and quirky feats. Gives the bottom half of the leaderboard things to chase.

## Core capabilities
- Milestone badges: 10/50/100/500 matches, first win, first tournament title
- Streak badges: 5/10 wins in a row (and, for humor, losing streaks too)
- Feat badges: "Giant Slayer" (beat a team 200+ Elo above you), "Comeback Kid" (win after losing the first set), "Bagel" (win a set 6-0) / "Bageled" (the other side of it)
- Badge showcase on the profile

## Ideas beyond the basics
- Padel-specific badges: "Wall Wizard", "Golden Point hero" (if golden-point scoring is tracked)
- Seasonal badges that are only earnable during one season → collectibles
- Secret badges discovered only when triggered
- Anti-achievements as friendly mockery ("Lost to the same guy 5 times in a row") — make these opt-in per group

## Why this rank
Pure gamification on top of existing data. Cheap fun, real retention value, zero urgency.

## Resolved decisions (self-grill, 2026-06-12)

**Q: How are badges awarded mechanically?** A rule engine evaluated when a match is confirmed (and on tournament/season completion). Rules are pure functions over the group's history, so when the feature ships, all badges are **granted retroactively** in one pass — day-one users wake up to a shelf of trophies, which is exactly the launch moment this feature wants.

**Q: Launch set?** ~15 badges from the lists above: milestones (10/50/100 matches, first win, first title), streaks (5/10 wins), feats (Giant Slayer at +200 rating gap, Comeback Kid, Bagel/Bageled). Goal: at least one badge reachable by the *worst* player in the group within a month.

**Q: Anti-achievements?** Opt-in per group, default off, and always about results, never about absence ("lost 5 straight to Jonas" is funny; "hasn't played in a month" is just mean).

**Q: Golden-point and Wall Wizard badges?** Cut — they require point-by-point or shot-level data we deliberately don't track ([ADR-0003](../docs/adr/0003-one-match-model-three-result-formats.md) stops at set/points granularity). Badges must be grantable from logged data alone.

**Q: Secret and seasonal badges?** A handful of secret ones at launch (discovery is the fun); seasonal collectibles arrive once seasons (11) have run at least once.

**Scope: Milestone 4.**
