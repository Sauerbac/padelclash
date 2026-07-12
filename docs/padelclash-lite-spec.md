# PadelClash Lite — design & functionality spec

A greenfield rewrite of PadelClash, stripped to what one private circle actually uses.
Built on the `lite-rewrite` branch of this repo, wiped to a clean slate — everything
older stays recoverable on `main`. **All decisions predating this document (old ADRs,
CONTEXT.md, feature docs) are void unless restated here.** This document is
self-contained: what isn't in it, isn't decided.

Decided by Simon in grilling sessions, 2026-07-11.

## What this is

**One circle, not a platform.** The app *is* the group: one leaderboard, one feed,
one roster. A padel match tracker for a fixed circle of friends/colleagues —
log matches, watch the Elo leaderboard move. Installable as a PWA on iOS.

Guiding principles:

- **Single circle.** No Group entity anywhere. A second circle gets its own deployment.
- **No user accounts.** Devices are bound to players; one admin has a real login.
- **The match log is the source of truth.** Ratings and all stats are derived by
  replaying it. Edits and late-synced offline matches are handled by recomputation,
  never by patching derived numbers.
- **v1 is deliberately small.** Everything else lives on the [Later list](#later-list) —
  written down so it isn't lost, excluded so it isn't built.

## Explicitly cut (not in v1, most not ever)

Groups & invites-per-group, group admin roles · Seasons & rollovers · Global rating /
global leaderboard · Result confirmation, pending/contested states, trust-mode setting ·
Accounts, email verification, Google sign-in, claim links, unclaimed-player machinery ·
i18n layer (English, hardcoded strings) · Points-score results (Americano format) ·
The old custom UI system (hand-rolled primitives, styleguide, token philosophy) —
replaced by shadcn/ui.

## Domain model

Terminology carried from the old CONTEXT.md where it still applies.

### Player

A person on the roster. Just a row: `id`, `name`, `avatar` (optional), `personal_token`,
`retired_at` (nullable — hides from pickers, keeps history). Created by the admin.
No account, no email. Every player is what the old app called "unclaimed" — permanently,
and that's fine.

### Match

A completed contest between two **Sides** with exactly one winner. Never a draw.

- `id` — **UUIDv7, generated on the client** (idempotency key for offline sync).
- `playedAt` — when it was played (client-supplied; defaults to "now" in the form).
- `loggedAt` — when the server accepted it.
- `loggedBy` — the Player bound to the logging device (the **Logger**).
- Sides A and B: 1 player each (singles) or 2 each (doubles). A player appears on
  exactly one side.
- `winnerSide` — A or B. Always required.
- Result detail, one of:
  - **Set Score** — games per set: `6-4, 3-6, 7-5`. Stored, shown, not yet fed into Elo.
  - **Simple Result** — winner only, no scores. First-class, not a degraded case.

Every match is competitive (affects ratings). No casual flag, no status field in v1 —
a deleted match is a deleted row.

### Rating

A player's Elo number. Derived, never stored authoritatively — see
[Rating engine](#rating-engine).

## Identity & access

### Device binding (players)

No passwords, no accounts. A device becomes a player once and stays that player:

1. **Personal invite link** (primary): the admin creates a player and shares
   `/join/<personal_token>` via WhatsApp etc. Opening it sets a long-lived
   cookie + localStorage marker and shows the iOS "install to home screen" hint.
   The link is per-player, reusable (re-bind a new/forgetful device), and
   rotatable by the admin.
2. **Name picker** (fallback, admin-toggleable): with the toggle on, anyone opening
   the app URL unbound can pick their name from the roster. For lazy onboarding
   evenings; off by default.

iOS note: installed home-screen PWAs keep storage far more reliably than Safari tabs,
but eviction is possible after long disuse. Recovery is the same personal link or the
name picker — losing a binding loses nothing but a tap.

The binding pre-fills the logger into the log form and marks "you" across the UI.
It is convenience-grade identity, not security: any player can log any match.

### Admin

One real login (single admin credential, e.g. env-var password → session cookie;
no user table needed). Admin can, from any device:

- create / rename / retire players; issue and rotate personal links
- toggle the name picker
- edit or delete **any** match, at any age
- everything a player can do

### Edit rights (players)

The Logger can edit or delete their own match within a **24 h grace window**
(typo repairs without pinging the admin). Older matches, or matches logged by
someone else: admin only.

## Screens

Three tabs (bottom tab bar, mobile-first — same shell pattern as the old app):

1. **Feed** (home) — reverse-chronological match cards: sides, result, per-player
   rating deltas. Edit/delete affordances where the viewer has rights.
2. **Log Match** — singles/doubles toggle, player pickers (logger pre-filled),
   winner, then either set scores or "just the winner". Payoff moment after
   submit: rating changes.
3. **Leaderboard** — ranked table of active players: rank, name, rating, W–L.
   Players below the ranked threshold (3 competitive matches) listed unranked.

**Player Detail** is a drill-in page, not a tab — reached by tapping any avatar/name
in Feed or Leaderboard (including your own). It shows the full stats package:

- current rating + rank, W–L record
- rating-over-time chart (the replay already produces the series)
- match history list
- **head-to-head**: record vs. each opponent
- **partner stats**: record with each doubles partner

All of it is computed from the match log — read-side work only, no extra tables required
beyond the two projections.

Plus small non-tab surfaces: join/bind landing (`/join/…`), admin login + admin panel.

## Rating engine

The engine is carried over from the old codebase **as-is** — it already lives on this
branch at `src/domain/rating/` (engine + golden/property tests + fixtures). It is
framework-free and already implements everything v1 needs:

- Elo, logistic expected score, divisor 400, starting rating **1000**, constant **K = 32**
- **win/loss only** — set scores don't influence the delta (v1 decision; a
  score-aware refinement is the top "Later" item)
- doubles built in: a Side is 1–2 players, side rating = mean, delta split equally
- replay: filter → sort by total order **(playedAt, loggedAt, id)** → fold;
  idempotent, so edits/deletes/late syncs are handled by re-running it
- outputs both projections: `rating_history` (per participant per match) and
  `current_rating`; `rankMap()` defines leaderboard ordering in one place
- ranked threshold: 3 matches to hold a rank

Keep the synchronous materialized projection approach (restated here as a live
decision): on every match write/edit/delete, replay the (small) log in the same
transaction and rewrite the two projection tables. At private-circle scale this
stays trivially fast forever, and a long-lived container on Coolify has no
execution-time constraints.

Simplifications when porting: `classification` is always `"competitive"` and `status`
always `"confirmed"` (keep the fields in the engine's input type untouched to ease
porting; the app just never sets other values).

## PWA & offline

- Web manifest, icons, `display: standalone`; installable from Safari's share sheet
  on iOS. Served over HTTPS (Coolify handles certs).
- Service worker caches the **app shell** for instant open.
- **Offline log queue (v1):** a match logged without a connection is stored locally
  (IndexedDB) and synced when the network returns (on next open / regained
  connectivity). Server-side idempotency via the client-generated UUIDv7 match id —
  a retried sync can't double-log. Because ratings replay ordered by `playedAt`,
  a late-arriving match slots into history correctly and ratings recompute as if
  it had synced instantly. Queued matches show a "pending sync" marker in the
  logger's local feed.
- Reading (feed, leaderboard, stats) requires a connection in v1. No push notifications.

## Stack & hosting

| Layer | Choice |
|---|---|
| Language | TypeScript end-to-end |
| Framework | Next.js monolith (fresh `create-next-app` scaffold), `output: standalone` Docker |
| UI | **shadcn/ui** on Tailwind v4 — components copied into the repo, themed via CSS variables. No custom primitive system. |
| Database | PostgreSQL |
| DB access | Drizzle ORM |
| Auth | **none** (device tokens + one admin credential) — Better Auth dropped |
| Email | **none** — Resend dropped |
| Hosting | Simon's Coolify instance |
| Language/UI | English, hardcoded — no i18n layer |

The scaffold, deploy plumbing (Dockerfile, compose, CI), and configs are **rebuilt
from scratch** on this branch — nothing config-level is inherited from the old app.

Suggested tables: `players`, `matches`, `match_participants`, `rating_history`,
`current_rating`, plus a tiny `settings` row (name-picker toggle). No sessions/accounts
tables.

## What carries over from the old app

Only these, restated here as live decisions:

- `src/domain/rating/` — engine, golden test, property test, fixtures — verbatim
  (already on this branch).
- The test strategy: fast pure-domain tests first (vitest, milliseconds, no
  infrastructure), real-DB integration tests where persistence matters.
- The layering rule: `domain/` stays framework-free, persistence in `services/`,
  UI in `app/`/`components/`.
- Terminology for the concepts that survive (Player, Match, Side, Set Score,
  Simple Result, Logger, Rating, Rank, Ranked/Unranked, Leaderboard).

## Later list

Written down so nothing useful is lost; **none of it is in v1.** Roughly in the order
they earned interest during the grilling:

1. **Score-aware Elo** — refine the algorithm to weight rating changes by set-score
   margin. Explicitly flagged "worry about it later"; set scores are already stored,
   so this is a pure engine change + replay.
2. **Balancer** — pick who's present, get the fairest team split + win probability.
   Pure function over ratings; cheapest high-value Later item.
3. **Tournaments** — Knockout / Round Robin / Americano / Mexicano with standings.
   The biggest chunk of old scope; even a one-evening Americano mode is substantial.
4. **Scheduled matches / RSVP** — planning future matches (WhatsApp covers this today).
5. **Sessions** — grouping an evening's matches into one meetup entity.
6. **Venues & courts** — where matches happen.
7. **Streaks** — consecutive-win/loss tracking on profile/leaderboard.
8. **Badges / achievements** — milestone awards; a content treadmill.
9. **Rivalries & challenges** — auto head-to-head narratives, declared grudge matches.
10. **Result confirmation** — opponent approval before a match is final.
11. **Notifications / web push** — works on installed iOS PWAs (16.4+); the feed
    covers "what happened" until then.
12. **Casual match flag** — log a match that doesn't affect ratings.
13. **Data export** — JSON/CSV dump of the match log.
14. **Offline reads** — cached leaderboard/feed for offline viewing (the write
    queue is already in v1).
15. **Provisional K-phase** — accelerated early ratings (K=64 for first matches);
    the engine's `kFactor()` is the ready extension point.

## Decision log (2026-07-11)

| # | Decision | Call |
|---|---|---|
| 1 | Approach | Fresh rewrite from this spec; old codebase is a parts donor |
| 2 | Tenancy | Strictly single circle; multi-circle = another deployment |
| 3 | Identity | No accounts; device-bound players + one admin login |
| 4 | Device binding | Personal links (primary) + admin-toggleable name picker |
| 5 | Match model | Singles + doubles; Set Score or Simple Result |
| 6 | Elo input | Win/loss only in v1; score-aware = Later #1 |
| 7 | Screens | Tabs: Feed, Log Match, Leaderboard; Player Detail as drill-in |
| 8 | Stack | Keep Next.js + Postgres + Drizzle on Coolify |
| 9 | Offline | App-shell cache + offline log queue in v1; offline reads Later |
| 10 | Edit rights | Logger fixes own match ≤ 24 h; admin edits anything |
| 11 | Competitions/planning | All Later (tournaments, scheduling, sessions, venues) |
| 12 | Fun layer | All Later (balancer, streaks, badges, rivalries) |
| 13 | Stats | Full Player Detail: rating chart, H2H, partner stats |
| 14 | Integrity/misc | All Later (confirmation, push, casual flag, export) |
| 15 | Language | English, hardcoded; i18n layer dropped |
| 16 | Build location | New branch `lite-rewrite` in this repo, wiped to a clean slate; `main` is the archive |
| 17 | Scaffold | Fully fresh — deploy plumbing, CI and configs rebuilt, nothing config-level inherited |
| 18 | UI system | shadcn/ui from the start; the old custom UI philosophy is dropped |
| 19 | Old decisions | All pre-spec decisions (ADRs, CONTEXT.md, feature docs) are void unless restated in this document |

## Decision log (2026-07-12, Player Detail slice)

| # | Decision | Call |
|---|---|---|
| 20 | Rating chart | Hand-rolled inline SVG, no chart dependency — one line series doesn't earn recharts. Revisit only if a second chart form appears |
| 21 | H2H/partner ordering | Most-played-together first, ties alphabetical |
| 22 | Ranks & retirement | Rank is a property of the active leaderboard: retired players hold no rank and leave no numbering gap; their pages stay reachable and show unranked |
