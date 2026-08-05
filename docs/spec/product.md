# PadelClash — Product scope

The product boundary: what PadelClash is, what it deliberately excludes, and what may come later.

This file is one part of the [PadelClash specification](../padelclash-spec.md).

## What this is

**One circle, not a platform.** The app *is* the group: one leaderboard, one feed,
one roster. A padel match tracker for a fixed circle of friends/colleagues —
log matches, watch the Elo leaderboard move. Installable as a PWA on iOS and
Android.

Guiding principles:

- **Single circle.** No Group entity anywhere. A second circle gets its own deployment.
- **No user accounts.** Devices are bound to players; one admin has a real login.
- **The match log is the source of truth.** Ratings and all stats are derived by
  replaying it. Edits and late-synced offline matches are handled by recomputation,
  never by patching derived numbers.
- **v1 is deliberately small.** Everything else lives on the [Later list](./product.md#later-list) —
  written down so it isn't lost, excluded so it isn't built.

## Explicitly cut (not in v1, most not ever)

Groups & invites-per-group, group admin roles · Seasons & rollovers · Global rating /
global leaderboard · Result confirmation, pending/contested states, trust-mode setting ·
Accounts, email verification, Google sign-in, platform device fingerprinting ·
i18n layer (English, hardcoded strings) · Points-score results (Americano format) ·
The old custom UI system (hand-rolled primitives, styleguide, token philosophy) —
replaced by shadcn/ui.

## Later list

Written down so nothing useful is lost; **none of it is in v1.** Roughly in the order
they earned interest during the grilling:

1. **Balancer** — pick who's present, get the fairest team split plus a separately
   defined team win probability. Pure function over ratings; cheapest high-value
   Later item.
2. **Tournaments** — Knockout / Round Robin / Americano / Mexicano with standings.
   The biggest chunk of old scope; even a one-evening Americano mode is substantial.
3. **Scheduled matches / RSVP** — planning future matches (WhatsApp covers this today).
4. **Sessions** — grouping an evening's matches into one meetup entity.
5. **Venues & courts** — where matches happen.
6. **Streaks** — consecutive-win/loss tracking on profile/leaderboard.
7. **Badges / achievements** — milestone awards; a content treadmill.
8. **Rivalries & challenges** — auto head-to-head narratives, declared grudge matches.
9. **Result confirmation** — opponent approval before a match is final.
10. **Notifications / web push** — works on installed iOS PWAs (16.4+); the feed
    covers "what happened" until then.
11. **Casual match flag** — log a match that doesn't affect ratings.
12. **Data export** — JSON/CSV dump of the match log.
13. **Offline reads** — cached leaderboard/feed for offline viewing (the write
    queue is already in v1).

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 1 | 2026-07-11 | Approach | Fresh rewrite from this spec; old codebase is a parts donor |
| 2 | 2026-07-11 | Tenancy | Strictly single circle; multi-circle = another deployment |
| 11 | 2026-07-11 | Competitions/planning | All Later (tournaments, scheduling, sessions, venues) |
| 12 | 2026-07-11 | Fun layer | All Later (balancer, streaks, badges, rivalries) |
| 14 | 2026-07-11 | Integrity/misc | All Later (confirmation, push, casual flag, export) |
| 15 | 2026-07-11 | Language | English, hardcoded; i18n layer dropped |
| 19 | 2026-07-11 | Old decisions | All pre-spec decisions (ADRs, CONTEXT.md, feature docs) are void unless restated in this document |
