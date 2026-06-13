# PadelClash — Feature Overview

One file per feature, ranked by importance (filename number = rank). No UI or implementation details — features only. **Padel only, by deliberate decision ([ADR-0005](../docs/adr/0005-padel-only.md)).**

> **Planning status (2026-06-12):** every feature has been through a design grilling; resolved decisions live at the bottom of each feature file. The domain language is in [CONTEXT.md](../CONTEXT.md), foundational decisions in [docs/adr/](../docs/adr/). All open questions are answered (see bottom). Platform: **v1 = web app optimized for mobile, v2 = PWA upgrade.** Stack: **Next.js + TypeScript, PostgreSQL + Drizzle, Better Auth, Resend, self-hosted on Coolify** ([ADR-0010](../docs/adr/0010-stack-and-platform.md)).
>
> **Architecture status (2026-06-13):** the build architecture has been grilled — the bridge from "what the product does" to "how the code is built." Reference docs in [docs/architecture/](../docs/architecture/): the [rating engine](../docs/architecture/rating-engine.md), [data model](../docs/architecture/data-model.md), [module structure](../docs/architecture/module-structure.md), and the [tracer-bullet first slice](../docs/architecture/tracer-bullet.md). New decisions: ADR-0007 (synchronous materialized projection), ADR-0008 (framework-free core + test strategy); ADR-0001/0003/0004 amended with implementation shapes. **Start point: tracer-bullet build-order step 1 (skeleton + deploy pipeline).**
>
> **UI / design-system binding (Session E, 2026-06-13):** the neo-brutalist design system in [docs/ui/ds/](../docs/ui/ds/) (now a frozen origin spec) has been bound to the build so it can't drift. The chain: tokens in Tailwind v4 `@theme` ([ADR-0009](../docs/adr/0009-tailwind-v4-tokens-as-source-of-truth.md)) → pure `src/ui/` primitives ([module-structure](../docs/architecture/module-structure.md), now five layers) → lint fence + `/dev/styleguide` guardrails. Full decision record incl. the primitive inventory, density/color/viz design rules, and mobile + a11y acceptance criteria: [design-system-binding.md](../docs/architecture/design-system-binding.md). **Light mode only by decision.**

## The ranking at a glance

| # | Feature | Tier | Milestone |
|---|---------|------|-----------|
| 01 | [User Accounts & Profiles](01-user-accounts-and-profiles.md) | Core — must exist | M1 |
| 02 | [Match Logging](02-match-logging.md) | Core — must exist | M1 |
| 03 | [Elo Rating System](03-elo-rating-system.md) | Core — must exist | M1 |
| 04 | [Groups / Friend Circles](04-groups-and-leagues.md) | Core — must exist | M1 |
| 05 | [Leaderboards & Rankings](05-leaderboards.md) | Core — must exist | M1 |
| 06 | [Competitions & Tournaments](06-competitions-and-tournaments.md) | High value | M3 |
| 07 | [Statistics & Match History](07-statistics-and-history.md) | High value | M2 |
| 08 | [Match Scheduling & Invitations](08-match-scheduling.md) | High value | M4 |
| 09 | [Result Confirmation & Disputes](09-result-confirmation.md) | High value | M2 |
| 10 | [Fair Team Balancing](10-team-balancing.md) | Differentiator | M2 |
| 11 | [Seasons](11-seasons.md) | Retention | M3 |
| 12 | [Notifications & Reminders](12-notifications.md) | Retention | M2/M3 |
| 13 | [Activity Feed](13-activity-feed.md) | Retention | M2/M3 |
| 14 | [Achievements & Badges](14-achievements.md) | Fun layer | M4 |
| 15 | [Venues & Courts](15-venues-and-courts.md) | Nice-to-have | M4 |
| 16 | [Rivalries & Challenges](16-rivalries-and-challenges.md) | Fun layer | M4 |
| 17 | [Data Export & Openness](17-data-export-and-api.md) | Nice-to-have | M3/M4 (split) |
| 18 | [Play Sessions](18-play-sessions.md) | Differentiator | M4 |
| 19 | [Global Ranking](19-global-ranking.md) | Ambition layer | M4 (late) |

## Roadmap

**M1 — The loop.** Accounts with Unclaimed Players (the bootstrap onboarding), groups with invite links, quick match logging, per-group Elo with replay, the leaderboard, rating graph, win probability. One founder can build a living group alone, then invite everyone into it.

**M2 — Trust & usefulness.** Result confirmation, core stats (head-to-head, partner chemistry, streaks, form), the Balancer ("who plays with whom?"), basic activity feed, in-app notification inbox.

**M3 — Events & stories.** Tournaments (Americano first, then knockout and round robin), seasons with rollover and champions, share cards into the group chat, export, records page.

**M4 — The living room & beyond.** Scheduling & RSVPs, Play Sessions, venues, achievements, rivalries & challenges, spreadsheet import, weekly digest, year-in-review — and once multiple groups exist, the opt-in Global Ranking. Push notifications arrive with the v2 PWA upgrade.

## Ranking logic

- **01–05** form the minimum viable loop: log in → log a match → rating updates → leaderboard changes. If only these exist, the app already delivers its core promise.
- **06–09** were either explicitly requested (tournaments) or protect the core loop's integrity (result confirmation) and convenience (scheduling, stats). Note the milestone order deviates from the rank order: confirmation, stats and balancing ship *before* tournaments, because integrity and courtside usefulness compound, while tournaments are occasional events.
- **10** (team balancing) is the standout original idea: it uses the Elo data to actively improve real-life games, which generic match trackers don't do. Promoted to M2 in the grilling — it's cheap once Elo exists.
- **11–14** are retention and gamification — they decide whether the group still uses the app after six months.
- **15–18** are enhancements that can be added anytime without redesigning anything. **18 (Sessions)** was added in the grilling: it's the container three other features were independently reinventing.
- **19 (Global Ranking)** was added at Simon's request: an opt-in app-wide board on top of the per-group ratings. It needs population to mean anything, so it ships last — but its consent model is decided now ([ADR-0006](../docs/adr/0006-opt-in-global-rating.md)).

## Padel-specific threads running through the list

- Doubles-aware Elo (team ratings derived from two individuals) — file 03
- Partner-chemistry stats, unique to rotating-partner sports — file 07
- Americano / Mexicano tournament formats — file 06
- Preferred court side (left/right) on profiles — file 01
- The multi-match evening as a first-class concept — file 18

## Foundational decisions (ADRs)

- [0001 — Ratings are derived by replaying the match log](../docs/adr/0001-ratings-derived-by-replay.md): matches are the only source of truth; every correction, merge, import and rollover is one mechanism.
- [0002 — Ratings are per group](../docs/adr/0002-ratings-are-per-group.md): group policies require it; a match belongs to exactly one group.
- [0003 — One Match model, three result formats](../docs/adr/0003-one-match-model-three-result-formats.md): set scores, points scores, simple results; always a winner, never a draw.
- [0004 — Guests are Unclaimed Players](../docs/adr/0004-guests-are-unclaimed-players.md): full players without accounts; claiming keeps history; bootstrap onboarding falls out for free.
- [0005 — Padel only](../docs/adr/0005-padel-only.md): multi-sport support is rejected, not deferred.
- [0006 — Opt-in Global Rating](../docs/adr/0006-opt-in-global-rating.md): an app-wide board exists, fed only by matches where every participant consented.
- [0007 — Synchronous materialized projection](../docs/adr/0007-synchronous-materialized-projection.md): ratings are a synchronous materialized projection of the match log.
- [0008 — Framework-free core + test strategy](../docs/adr/0008-test-strategy.md): a framework-free domain core, tested as a pyramid across the whole app.
- [0009 — Tailwind v4 tokens as source of truth](../docs/adr/0009-tailwind-v4-tokens-as-source-of-truth.md): one machine-readable home for every design-system value.
- [0010 — Stack & platform](../docs/adr/0010-stack-and-platform.md): web app → PWA; Next.js + TypeScript, PostgreSQL + Drizzle, Better Auth (incl. Google sign-in in v1), Resend, self-hosted on Coolify.
- [0011 — English-first, i18n-ready](../docs/adr/0011-english-first-i18n-ready.md): English UI now, externalized strings from day one, German when users want it.

## Planning status

Every feature and foundational decision has been grilled; all questions raised during planning are resolved and recorded — product scope in the feature files, technical decisions in the ADRs above (audience scale and the *PadelClash* name in [CONTEXT.md](../CONTEXT.md), weekly-play defaults validated in features 04/09/11/17). **Planning is complete; implementation can start** at tracer-bullet build-order step 1.
