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
log matches, watch the Elo leaderboard move. Installable as a PWA on iOS and
Android.

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
Accounts, email verification, Google sign-in, platform device fingerprinting ·
i18n layer (English, hardcoded strings) · Points-score results (Americano format) ·
The old custom UI system (hand-rolled primitives, styleguide, token philosophy) —
replaced by shadcn/ui.

## Domain model

Terminology carried from the old CONTEXT.md where it still applies.

### Player

A person on the roster. Core fields: `id`, `name`, `normalized_name`, `avatar` (optional),
and `retired_at` (nullable — hides from match pickers, keeps history). A Player may be
created by Admin for match tracking or by an attendee through a General Onboarding Link.
No account, email, or password exists. Player Names are compatibility-normalized,
whitespace-normalized, and case-insensitively unique across the full roster, including
Retired Players; Admin may rename them.

A non-retired Player is **Joined** when they have an active Device Binding and **Not
Joined** otherwise. Admin may permanently delete a Player only when no existing Match
references them as participant or Logger. Once referenced, the Player may only be
retired; deleting all referencing Matches makes them deletable again. Restoration moves
a Retired Player to Not Joined without restoring old access.

### Guest

A named, match-scoped participant who is not on the roster. A Guest has no
cross-Match identity, profile, Device Binding, enduring Rating, or persistent
statistics. For one Match's Rating calculation, every Guest receives the mean
pre-Match Rating of all non-Guest participants as a hidden input. The value is
never shown, and the Guest receives no Rating output. Every Side must still
contain at least one Player, so Guests are doubles-only and each Side may
contain at most one.

A Guest Name uses the same normalization and 40-character limit as a Player
Name, but is stored only on that Match. It need not be unique across Matches.
Within a Match it must not collide with another participant's normalized name,
and it must not collide with any roster Player's normalized name; the Logger
must add a distinguishing suffix instead. Match surfaces render the name as
plain text with a Guest marker, never as a Player link or Rating delta.

A rated Match containing a Guest contributes normally to every participating
Player's win/loss record and to relationship statistics between its roster
Players. No statistic is created for a relationship with the Guest.

### Match

A completed contest between two **Sides** with exactly one winner. Never a draw.

- `id` — **UUIDv7, generated on the client** (idempotency key for offline sync).
- `playedAt` — when it was played (client-supplied; defaults to "now" in the form).
- `loggedAt` — when the server accepted it.
- `loggedBy` — the Player bound to the logging device (the **Logger**).
- Sides A and B contain the same number of participants. Singles is exactly one
  Player on each Side. Doubles is exactly two participants on each Side, with at
  least one Player and at most one Guest per Side. A Player appears only once,
  and every Guest is a distinct match-scoped participant.
- `winnerSide` — A or B. Always required.
- Result detail, one of:
  - **Set Score** — games per set: `6-4, 3-6, 7-5`. Stored, shown, and used as a
    capped Rating bonus. Every set must have a winner and the declared Match
    winner must have won more sets.
  - **Simple Result** — winner only, no scores. First-class, not a degraded case.

Every match is competitive (affects ratings). No casual flag, no status field in v1 —
a deleted match is a deleted row.

### Rating

A Player's evolving estimate of competitive padel strength. Derived, never
stored authoritatively — see [Rating engine](#rating-engine). A Match result
always determines the direction of movement: every winner's Rating increases
and every loser's Rating decreases. The Player's own strength, the opposing
Side's strength, provisional state, and Set Score detail may change only the
magnitude, never reverse the direction. Rating has no lifetime floor and may
become negative.

## Identity & access

### Device Binding (players)

No passwords or accounts. A **Device Binding** is one active, server-managed bearer
credential for a Player. It is an unguessable token in a long-lived `HttpOnly`, `Secure`,
`SameSite=Lax` cookie; the database stores only its hash. Player ids and onboarding
secrets are never credentials, and no credential is copied into localStorage. The
server-side binding has no inactivity expiry; ordinary use refreshes the browser cookie.

This is an app credential, not a physical-device identifier: browsers expose no stable
device id and may copy a cookie from Safari into an installed Home Screen app. The
server enforces one active credential per Player but cannot prove how many browser
contexts contain that credential or remotely erase data already downloaded by an
offline device.

A bound installation cannot switch Players, use an onboarding link, or log out. An
onboarding route opened while bound redirects to `/` without consuming the invitation.
Only Admin can deliberately end access by revoking/replacing the binding, retiring the
Player, or deleting an unreferenced Player. Lost client storage requires Admin-assisted
onboarding again.

The binding pre-fills the Logger and marks "you" across the UI. Any Joined Player may
log any roster match; the Logger need not participate. This preserves the circle's trust
model while keeping outsiders from reading private data or submitting results.

### Onboarding Links

Both link types are unguessable bearer invitations. Merely opening or previewing one
does not mutate state; joining requires an explicit confirmation that the installation
cannot switch Players without Admin. Confirmation revalidates the invitation, Player,
Player Name, and installation state and performs all changes atomically.

- **Personal Onboarding Link** — generated by Admin on demand for one Player; never
  issued automatically at Player creation. It is single-use, revocable, expires after
  7 days, and can be recopied while valid. A Player has at most one valid Personal Link;
  replacing it revokes the former link. When used for device replacement, the current
  binding stays valid until confirmation succeeds, then is revoked atomically.
- **General Onboarding Link** — one circle-wide link, valid for 12 hours and revocable
  early by Admin. Its holder may select only a Not Joined Player or enter a unique name
  to create and immediately join a new Player. Admin may copy the link while valid and
  generate another only after expiry or revocation.

Whichever route joins a Player first wins and invalidates that Player's outstanding
Personal Link. Concurrent claims and name collisions fail cleanly with no partial Player
or binding. Emergency **Revoke access** invalidates the binding, outstanding Personal
Link, and active General Link; Admin may then issue fresh invitations deliberately.

Anyone holding the General Link during its lifetime is trusted to create or join a
Player and can then log matches. Rate limiting constrains automation but is not an
approval system; this is the deliberate convenience/security trade-off for onboarding
evenings.

### Admin

One real login (single admin credential, e.g. env-var password → session cookie;
no user table needed). Admin can, from any device:

- create, rename, restore, retire, and conditionally delete Players
- generate, copy, replace, and revoke Personal Onboarding Links and Device Bindings
- generate, copy, and revoke the one General Onboarding Link
- edit or delete **any** match, at any age
- browse player-facing screens without a Device Binding; logging a new Match still
  requires a Player binding because every Match has a Player Logger

Admin groups the roster into **Joined**, **Not Joined**, and **Retired**. Joined rows
show binding creation and last-seen timestamps plus rename, replace, revoke, and retire
actions. Not Joined rows offer rename, Personal Link controls, conditional delete, and
retire. Retired rows offer restore and conditional delete. Match surfaces expose the
stored Logger to Admin for accountability; no broader activity-tracking system is added.

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

An installation without a valid Device Binding sees a dedicated **Not Joined** screen
instead of the tab shell. Feed, Log Match, Leaderboard, Player Detail, and their server
operations validate the binding. Onboarding routes and Admin login remain reachable;
a valid Admin session may bypass the read gate as described above.

The Not Joined screen in an installed PWA also accepts a pasted invitation. The
expected input is the full same-site `/join/{token}` URL; the existing raw 256-bit
invitation token is accepted as a convenience, but there is no second short-code
credential format. Valid input continues through the ordinary read-only preview and
explicit confirmation flow so that the Device Binding cookie is created inside the
installed PWA's own storage context.

When an invitation is opened on iOS outside standalone mode, the normal join flow
remains available but is preceded by platform guidance. The reliable recovery for an
already-installed, unbound PWA is to copy the full invitation, open PadelClash, and
paste it there. The fallback is to open and accept the invitation in Safari, remove
the old Home Screen installation, and add it again from Safari so iOS can seed the new
web app's cookie store. Android keeps the normal join flow without uninstall guidance:
an in-scope link may open the installed PWA directly, and the universal paste input is
the fallback when it opens in a browser instead.

## Rating engine

The existing framework-free engine at `src/domain/rating/` remains the
architectural base, but its old `K = 32`, shared Side delta, equal doubles split,
floating-point output, and result-only behavior are superseded. The live
design rationale is recorded in
[ADR 0003](./adr/0003-use-independent-player-elo-for-team-matches.md). The live
constants are:

- starting Rating: **1000**
- logistic divisor: **400**
- Established Player factor: **K = 50**
- Provisional Player factor: a taper of **80, 70, 60** across their first three
  rated Matches, expressed as `max(50, 80 − 10 × priorRatedMatches)`
- final per-Player magnitude: an integer with a floor of **1** and no ceiling
- rated threshold: **3** — one constant governing the K taper, Provisional
  status, and Leaderboard rank alike

Every Match is evaluated from one immutable snapshot of all participating
Players' pre-Match state:

1. If the Match contains a Guest, calculate one hidden Guest Rating as the
   arithmetic mean of every participating Player's pre-Match Rating. Every Guest
   in that Match uses that same input Rating.
2. For each Player independently, calculate the opposing Side's mean from its
   Player Ratings and hidden Guest Rating, if present. The Player's own partner
   does not enter this expectation.
3. Calculate the Player's expected score:

   ```text
   expected = 1 / (1 + 10 ^ ((opposingMean - playerRating) / 400))
   ```

4. Derive the Player's K from how many rated Matches they had completed before
   this one, then calculate the unsigned result magnitude:

   ```text
   K    = max(50, 80 - 10 × priorRatedMatches)
   base = K × (winner ? 1 - expected : expected)
   ```

5. A Simple Result has multiplier `1`. For a Set Score, orient all games and
   sets to the declared winner and calculate:

   ```text
   gamesRatio = max(0, winnerGames - loserGames) / totalGames
   setMargin  = (winnerSets - loserSets) / totalSets
   dominance  = clamp(gamesRatio × setMargin, 0, 1)
   multiplier = 1 + 0.4 × dominance
   ```

6. Calculate `Math.round(base × multiplier)`, raise it to `1` if it rounded to
   zero, then apply a positive sign to a winner or negative sign to a loser.
   All quantities through the floor use full precision; only the positive final
   magnitude is rounded.
7. Emit and persist output only for Players. A Guest receives no history row,
   match count, or updated Rating. A Guest Match still increments each
   participating Player's rated Match count.

All Player updates in a Match use the same pre-Match snapshot, so iteration
order cannot affect the result. The independent expectations are deliberately
not one shared team win probability and need not be complementary across the
four participants. Projection data names this value `expectedScore`; it must not
be presented as a canonical team probability.

Acceptance anchors:

| Scenario | Winner change | Loser change |
|---|---:|---:|
| Equal Established Players, Simple Result | `+25` | `−25` |
| Equal Established Players, `6–0, 6–0` | `+35` | `−35` |
| Equal Established Players, `6–3, 6–3` | `+28` | `−28` |
| Equal Established Players, `6–0, 0–6, 6–0` | `+26` | `−26` |
| 800/1200 Side beats 1000/1000, Simple Result | `+38 / +12` | `−25 / −25` |
| 800/1200 Side loses to 1000/1000, Simple Result | `+25 / +25` | `−12 / −38` |
| 200-point underdog wins `6–0, 6–0`, Established | `+53` | `−53` |
| Equal Players, first placement Match, Simple Result | `+40` | `−40` |
| Equal Players, second placement Match, Simple Result | `+35` | `−35` |
| Equal Players, third placement Match, Simple Result | `+30` | `−30` |
| Equal Players, first placement Match, `6–0, 6–0` | `+56` | `−56` |

The last four rows are the only place the taper is visible: from the fourth
rated Match on, every anchor above uses `K = 50`.

The Rating Pool is not conserved. Independent Player updates can create or
remove Rating, and 1000 is a fixed starting reference rather than an enforced
circle average. Ratings and final deltas are integers and have no lifetime
floor; expected scores and the hidden Guest Rating may be fractional.

A per-Match magnitude has no ceiling: K alone bounds it, at `50 × 1.4 = 70` for
an Established Player and `80 × 1.4 = 112` in a first placement Match. Both
bounds require a near-total mismatch and a shutout simultaneously, and reaching
them is the intended behaviour rather than an edge case to suppress.

Replay still filters and sorts by the total order **(playedAt, loggedAt, id)**
before folding, so edits, deletions, and late syncs are handled by rebuilding.
It emits `rating_history` for Players who participated and `current_rating` for
Players seen during replay; `rankMap()` remains the one definition of
leaderboard ordering.

Keep the synchronous materialized projection approach (restated here as a live
decision): on every match write/edit/delete, replay the (small) log in the same
transaction and rewrite the two projection tables. At private-circle scale this
stays trivially fast forever, and a long-lived container on Coolify has no
execution-time constraints.

The app supplies only competitive, confirmed Matches. Compatibility fields for
future casual or confirmation features may remain in the engine input, but they
do not change the v1 Match model.

## PWA & offline

- Web manifest, icons, `display: standalone`; installable from Safari's share
  sheet on iOS and through the browser install flow on Android. Served over
  HTTPS (Coolify handles certs). Installation instructions live in the deployment
  runbook; v1 does not add a custom in-app install prompt.
- Service worker caches the **app shell** for instant open.
- **Offline log queue (v1):** a match logged without a connection is stored locally
  (IndexedDB) and synced when the network returns (on next open / regained
  connectivity). Server-side idempotency via the client-generated UUIDv7 match id —
  a retried sync can't double-log. Because ratings replay ordered by `playedAt`,
  a late-arriving match slots into history correctly and ratings recompute as if
  it had synced instantly. Queued matches show a "pending sync" marker in the
  logger's local feed. Each queued item records its originating Player. It may sync after
  recovery only when the current binding belongs to that same Player; it never syncs
  under a different identity and incompatible queued data requires explicit discard.
- Reading (feed, leaderboard, stats) requires a connection in v1. No push notifications.
- Revocation is authoritative at the server immediately but becomes visible to an
  offline device only on its next server contact. At that point the invalid credential
  and private page caches are cleared. Already-downloaded local data cannot be erased
  remotely; rejected queued matches retain the explicit-discard behavior from decision 26.

## Stack & hosting

| Layer | Choice |
|---|---|
| Language | TypeScript end-to-end |
| Framework | Next.js monolith (fresh `create-next-app` scaffold), `output: standalone` Docker |
| UI | **shadcn/ui** on Tailwind v4 — components copied into the repo, themed via CSS variables. No custom primitive system. |
| Database | PostgreSQL |
| DB access | Drizzle ORM |
| Auth | Server-managed Device Bindings + one admin credential; no user accounts — Better Auth dropped |
| Email | **none** — Resend dropped |
| Hosting | Simon's Coolify instance |
| Language/UI | English, hardcoded — no i18n layer |

Production is one self-contained Coolify Docker Compose resource: one app
container and one private PostgreSQL container with a named persistent volume.
There is exactly one steady-state app process. PostgreSQL is reachable only on
the Compose network and the app is reachable only through Coolify's HTTPS proxy.
See [the deployment runbook](./coolify-deployment.md) and
[ADR 0002](./adr/0002-bundle-postgresql-with-the-application.md).

The scaffold, deploy plumbing (Dockerfile, compose, CI), and configs are **rebuilt
from scratch** on this branch — nothing config-level is inherited from the old app.

Suggested tables: `players`, `device_bindings`, `onboarding_invitations`,
`matches`, `match_participants`, `rating_history`, and `current_rating`.
`match_participants` represents exactly one identity variant per row: either a
Player reference or a match-scoped Guest Name. Constraints enforce that exclusive
choice and the service validates the cross-row Side size and Guest participation
rules. Database constraints also enforce normalized Player Name uniqueness, at
most one active binding per Player, at most one valid Personal Link per Player,
and at most one valid General Link for the circle.
`rating_history` contains only Player participants; its Rating before/delta/after
columns and `current_rating.rating` are integers. There are no Guest, shared
Guest, or user-account tables.

## What carries over from the old app

Only these, restated here as live decisions:

- `src/domain/rating/` keeps its framework-free pure-step/replay architecture,
  golden and property test strategy, stable total ordering, projection outputs,
  and `rankMap()` boundary. The new Rating formula deliberately replaces the
  old constants, equal Side-delta split, and fixtures.
- The test strategy: fast pure-domain tests first (vitest, milliseconds, no
  infrastructure), real-DB integration tests where persistence matters.
- The layering rule: `domain/` stays framework-free, persistence in `services/`,
  UI in `app/`/`components/`.
- Terminology for the concepts that survive (Player, Match, Side, Set Score,
  Simple Result, Logger, Rating, Rank, Ranked/Unranked, Leaderboard), plus the secure
  onboarding terms defined in the root `CONTEXT.md`.

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

## Decision log (2026-07-11)

| # | Decision | Call |
|---|---|---|
| 1 | Approach | Fresh rewrite from this spec; old codebase is a parts donor |
| 2 | Tenancy | Strictly single circle; multi-circle = another deployment |
| 3 | Identity | No accounts; device-bound players + one admin login |
| 4 | Device binding | Superseded by secure onboarding decisions 28–55 |
| 5 | Match model | Singles + doubles; Set Score or Simple Result |
| 6 | Elo input | **Superseded by decisions 90–109.** Set Scores now provide a capped, sign-preserving Rating bonus; Simple Result remains first-class |
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

## Decision log (2026-07-19, PWA slice)

| # | Decision | Call |
|---|---|---|
| 23 | App icons | Generated at build time from one JSX mark via next/og ImageResponse — no binary icon assets in the repo |
| 24 | Service worker | Hand-rolled app-shell worker, no Serwist/Workbox dependency: network-first navigations with cache fallback, cache-first for build-hashed assets; `/api`, `/admin`, `/join` are never cached (tokens/admin state don't belong in Cache Storage) |
| 25 | SW in dev | `next dev` actively unregisters any service worker — a compose image smoke test on port 3000 would otherwise leave a prod worker serving stale chunks into dev |

## Decision log (2026-07-19, offline queue slice)

| # | Decision | Call |
|---|---|---|
| 26 | Failed sync | A queued match the server rejects (not a connectivity failure) is never silently dropped: it stays on the pending card with the error shown and an explicit Discard button |
| 27 | Offline edits | Only logging queues offline. Edit/delete need a connection and say so — the 24 h grace window plus replay-on-edit makes queued edits more machinery than a typo repair is worth |

## Decision log (2026-07-21, secure onboarding slice)

| # | Decision | Call |
|---|---|---|
| 28 | Installation identity | A Player has at most one active, server-managed Device Binding; replacing a lost or changed installation requires Admin involvement |
| 29 | Shared onboarding | Admin can issue a secret General Onboarding Link that expires after 12 hours, revoke it early, and let its holder select only a Not Joined Player or create and immediately join as a new Player |
| 30 | Player names | Player Names are case-insensitively unique across the entire roster, including Retired Players; Admin can rename them |
| 31 | Empty Player cleanup | Admin can permanently delete a Player only when no existing Match references them as participant or Logger; onboarding and browsing do not block deletion, and deleting every referencing Match makes the Player deletable again |
| 32 | Personal onboarding | A Personal Onboarding Link targets one Player, is single-use and revocable, and expires after 7 days; a replacement leaves the current Device Binding valid until the new link is used, then revokes it |
| 33 | Unbound access | An installation without a valid Device Binding sees a dedicated Not Joined screen and cannot browse player-facing screens or private circle data; onboarding routes and Admin login remain accessible |
| 34 | Binding lifetime | A Device Binding has no server-side inactivity expiry; it remains valid until Admin revokes or replaces it or the Player is retired, while loss of client storage requires onboarding again |
| 35 | Restore Player | Admin can restore a Retired Player to Not Joined with history and Player Name intact; any old Device Binding remains invalid and joining requires a fresh invitation |
| 36 | General-link lifecycle | The circle has at most one General Onboarding Link; Admin can copy it while valid and can generate another after it expires or is revoked |
| 37 | Match-entry trust | Any Joined Player can continue logging matches for any roster participants; the Logger does not have to participate |
| 38 | Bound onboarding attempt | A bound installation cannot use an onboarding link to switch Players; it redirects to `/` without consuming the invitation or changing either binding |
| 39 | Ending a binding | There is no Player-facing logout, unbind, or identity switch; only Admin can deliberately revoke or replace a Device Binding, including through retirement or deletion |
| 40 | Personal-link lifecycle | Each Player has at most one valid Personal Onboarding Link; Admin may recopy it while valid or replace it to revoke the old link and restart its 7-day lifetime without affecting the current binding |
| 41 | Personal-link issuance | Creating a Player does not automatically issue an invitation; Admin generates a Personal Onboarding Link on demand |
| 42 | Personal-link confirmation | Opening or previewing a Personal Onboarding Link does not consume it; the visitor must explicitly confirm “Join as {Player}” before the Device Binding is created or replaced |
| 43 | General-link confirmation | Selecting an existing Player or entering a new Player Name requires explicit confirmation that the installation cannot switch without Admin; creation and binding occur only after atomic server revalidation |
| 44 | Competing invitations | Any successful join invalidates the Player’s outstanding Personal Onboarding Link, including when the successful join used the General Onboarding Link |
| 45 | Emergency revocation | Admin “Revoke access” immediately invalidates both the Player’s Device Binding and outstanding Personal Onboarding Link; “Replace device” instead leaves the current binding valid until its link is successfully used |
| 46 | Shared-link revocation | Emergency Player revocation also invalidates the active General Onboarding Link so the newly Not Joined Player cannot immediately be reclaimed through an already-shared invitation |
| 47 | Credential security | Device Bindings use unguessable server-managed credentials in `HttpOnly`, `Secure`, `SameSite=Lax` cookies; only hashes are stored, and Player ids, invitation tokens, and localStorage never serve as binding credentials |
| 48 | PWA identity limit | One Device Binding means one active credential, not provably one physical device; browser contexts may share a copied credential, and offline local data cannot be remotely erased |
| 49 | Authorization boundary | Every player-facing read and mutation validates authorization server-side; Admin may bypass the read gate and edit/delete without a Player binding, but logging still requires a bound Player Logger |
| 50 | Admin organization | Admin groups Joined, Not Joined, and Retired Players with state-appropriate binding, invitation, lifecycle, and conditional-delete controls plus one separate General Link control |
| 51 | Atomic onboarding | Confirmation revalidates all invitation, installation, Player, and normalized-name state and commits creation, replacement, consumption, and revocation atomically; races fail without partial state |
| 52 | Offline authorization | Revocation is immediate on the server and observed by an offline client on next contact; invalid credentials and private page caches are then cleared, while queued matches remain bound to their originating Player and are never synced under another identity |
| 53 | Accountability | Admin can see each Match's Logger and binding creation/last-seen timestamps; revoked binding history is retained for troubleshooting without claiming physical-device identification or adding a general activity log |
| 54 | Name normalization | Player Names are trimmed, repeated whitespace collapsed, Unicode compatibility-normalized, and case-insensitively constrained by the database while preserving display casing |
| 55 | Secure cutover and abuse boundary | Existing Player-id cookies and reusable links are invalidated at rollout, all Players start Not Joined, no General Link is created automatically, and onboarding/mutation endpoints are rate-limited; a General Link holder remains intentionally trusted to join and then log matches |

## Decision log (2026-07-21, secure onboarding backend)

| # | Decision | Call |
|---|---|---|
| 56 | Invitation token storage | Device Binding credentials are stored as hashes only, but Onboarding Link tokens are stored in the clear — Admin must be able to re-copy a live link (decisions 36 and 40), which a hash cannot reproduce. The exposure is bounded by the 12 h / 7 d lifetime and by revocation |
| 57 | Read gating seam | Every player-facing **page** validates access before it queries, not just the tab-shell layout: Next renders a page segment regardless of what its layout returns, so layout-only gating ships private data in the RSC payload behind a "Not Joined" screen. Server actions re-validate independently |
| 58 | Onboarding concurrency | One transaction-scoped advisory lock covers the whole onboarding flow rather than a lattice of row locks — and **every** path that ends access takes it too (link revocation, "Revoke access", retire, restore), not just confirmation. A revoke that skipped the lock could commit while a confirmation had already re-read the invitation, producing a binding created after revocation. Onboarding happens a few times an evening, so serializing it is cheaper to reason about; the partial unique indexes remain the backstop |
| 62 | Installation state is checked in the transaction | The presented binding cookie is passed into `confirmJoin` and re-resolved under the lock, so decision 38 is enforced atomically with the write rather than merely checked beforehand. Residual, accepted: two confirmations from the *same unbound* browser selecting different Players through one General Link can both succeed, because an unbound installation presents nothing to serialize on. One credential survives; Admin clears the other with "Revoke access" |
| 63 | Restoration re-revokes | `restorePlayer` revokes any un-revoked binding on the way back in, rather than trusting that retirement already did. A retired Player's binding is only *inert* — `resolveCredential` refuses retired Players, the row survives — so clearing `retired_at` would otherwise re-activate it. This makes decision 35 true by construction |
| 64 | Cookie refresh surface | `GET /api/session` re-issues the binding cookie whenever it resolves. Pages cannot set cookies and only match mutations otherwise would, so a read-only member would hit the browser's ~400-day cap and lose access despite daily use — contradicting decision 34. The frontend already calls this endpoint on app open for the revocation check |
| 59 | Invitation slot release | The partial unique indexes for "one valid Personal Link per Player" and "one General Link" can't reference `now()`, so expiry doesn't free the slot on its own: issuing a replacement explicitly revokes the expired predecessor inside the same transaction |
| 60 | Rate-limit storage | Rate limits are an in-process sliding window, not a table — one long-lived container on Coolify, and the job is stopping scripted abuse rather than coordinating a cluster. Keys come from forwarded-for headers, which gate throttling only, never authorization. Admin mutations get their own, looser budget than the visitor-facing onboarding limiter: issuing a link per player back-to-back is exactly the work the app exists to support |
| 61 | Legacy name collisions | The cutover migration resolves pre-existing normalized-name collisions by suffixing later duplicates " (2)", " (3)" on both the display name and the key, rather than failing the migration or dropping a Player — Admin sees exactly which rows need a real rename. Its normalization strips the complete Unicode `Cf` set (Postgres has no `\p{Cf}`), matching the runtime exactly; anything less would let a legacy name keep an invisible character and hold a key the app would never compute |

## Decision log (2026-07-22, UI polish slice)

| # | Decision | Call |
|---|---|---|
| 65 | Rankings podium | A Top 3 stand replaces rows 1–3 rather than sitting above a complete table: in a circle of ~8–12 Players a duplicated top three costs a third of the screen to say nothing twice. The table therefore starts at #4, and ranks stay absolute. The stand renders only when three ranked Players exist — below that the plain table stands alone, because a one-Player podium reads as breakage rather than as an early state. Each plinth carries rank, Player Name and Rating but not W–L (three columns don't fit a 360 px phone, and the stand is a trophy, not a data row); #1 keeps the existing gold accent while #2 and #3 get plain borders and shorter plinths, since inventing silver and bronze tokens for one component is out of proportion. The "You" badge moves onto the plinth when the viewer is top three, otherwise it would vanish with the row that carried it |
| 66 | Player Detail back affordance | Player Detail carries no back control, and `back-button.tsx` is deleted with it. This **reverses** the component's original argument — that an installed PWA has no browser chrome and so each drill-in must supply its own — because the tab bar is present on every screen under the tab shell and installed mobile PWAs retain system/browser history navigation: iOS edge-swipe and Android's system Back gesture/button. The accepted cost is real and was weighed: returning via the Feed tab resets scroll position, so a Player opened from deep in the feed comes back to the top. Re-adding a back control is a deliberate reversal, not an oversight to correct |
| 67 | Feed card rows | Set Scores get their own row instead of trailing the timestamp on the mono meta line — they are the match result, not metadata about it. Card heights are explicitly allowed to vary with content (singles vs doubles, scores vs none); no padding to a uniform height |
| 68 | Tab bar geometry and separation | The active tab's red band is reserved as a transparent border on inactive tabs so switching sections changes colour only, never layout — on Log Match neither text tab is active and the bar previously changed height. The bar also gains a short upward shadow, knowingly the first soft shadow in a theme that is otherwise flat planes and hard borders; it is kept tight and hugging so it reads as a lip rather than a glow. If the inconsistency grates, the on-theme alternative is a gradient scrim fading content out above the bar |
| 69 | Podium bronze, and W–L on the plinths | The returned design contradicted decision 65 twice, and both were re-decided with the user. **Bronze is adopted:** #3 gets a `--podium-bronze` token, reversing 65's "no silver/bronze" on the narrow ground that one medal colour is not the pair 65 was rejecting — #2 stays plain muted and #1 keeps the existing gold, so exactly one token was added. The #1 plinth reuses `--secondary` rather than the design's new tint. **W–L is adopted:** 65 excluded it because "three columns don't fit a 360 px phone", but the design renders `rating · W–L` as a single mono line rather than as columns, which dissolves that objection. Measured at 360, 390 and 430 px: zero column overflow, no horizontal page scroll. It stays unless a future name/rating combination breaks the line |
| 70 | Podium narrow-screen fit | Podium name type scales down fluidly on narrow phones so ordinary long names remain whole; balanced wrapping is only the fallback for names that still cannot fit. Rank numerals must remain visually inside their plinths: #3 is slightly smaller, uses normal line-height, and sits below its bronze rail rather than colliding with it |
| 71 | Feed result density | Singles and doubles both use two team rows: the winning side and ember-red `def.` share the first baseline, with the muted losing side below. Recorded set values remain a separate result row but carry no `SETS` label because the bordered score values explain themselves |
| 72 | Raised-nav and action balance | One upward shadow follows the combined silhouette of the nav bar and raised centre Log plate, rising around the plate and rejoining the bar rather than layering two separate shadows. Match-card Edit and Delete retain identical 40 px targets and 16 px icon boxes; Delete uses a circled X so its visible footprint matches the pencil |

## Decision log (2026-07-22, production and mobile PWA)

| # | Decision | Call |
|---|---|---|
| 73 | Mobile platforms | PadelClash is an installable mobile PWA for both iOS and Android; production verification covers installed mode on both platforms at common phone widths |
| 74 | Coolify topology | Production is one Docker Compose resource containing one app container and one PostgreSQL 17 container. PostgreSQL is private, persists in a named volume, and the app is exposed only through Coolify's HTTPS proxy |
| 75 | Process topology | Production has exactly one steady-state app process. In-process rate limits deliberately do not coordinate across replicas; brief old/new overlap during a compatible deployment is acceptable, but horizontal scaling is not supported |
| 76 | Release policy | Production deploys are manual after CI passes. Coolify waits for the database-aware health check; stdout/stderr and Coolify health are the initial observability boundary, while external telemetry and fixed resource limits are deferred |
| 77 | Migration and rollback policy | The container applies committed Drizzle migrations before starting Next. Normal migrations remain compatible with deployment overlap; destructive migrations require a fresh database dump, and application code is never blindly rolled back across a schema change |
| 78 | Backups | The match log is irreplaceable, so PostgreSQL creates a daily custom-format dump and retains 30 daily generations on the VPS. An encrypted Windows PC catches up every missing dump over SSH/SFTP whenever it is online, retains 90 daily plus 12 monthly generations, never mirrors remote deletion, and warns when its newest copy is older than 7 days. The phone is not a required backup target. The internal Coolify backup path is discovered at deployment rather than hard-coded, and preserving only the Docker volume is not disaster recovery |
| 79 | Production secrets | Coolify generates and preserves the database password. `ADMIN_PASSWORD` is a runtime-only secret of at least 20 characters, kept in Coolify and a password manager; missing or weaker production configuration fails startup, and changing the admin password deliberately invalidates admin sessions |
| 80 | Install experience | Keep browser-native installation rather than building a custom prompt: Safari's Add to Home Screen flow on iOS and the browser install flow on Android are documented and verified after deployment |
| 81 | Offline launch contract | After one successful online launch while joined, the installed PWA must reopen offline and allow a Match to be queued on iOS and Android. Feed, Leaderboard and Player Detail remain online-only; the service-worker design must not turn cached private navigations into an accidental offline-read feature |
| 82 | Service-worker privacy and updates | Do not blindly pre-cache `/`, because it contains credential-dependent server output. Use an explicit versioned shell/offline strategy, exclude API/Admin/Onboarding surfaces, clear private caches after revocation, and verify that a deployment cannot strand cached HTML with missing Next.js chunks |
| 83 | Web hardening | The private installation is `noindex`; invitation-bearing pages send no referrer. Hide the framework header and add low-complexity type-sniffing and frame protections; a strict CSP is deferred until it can be tested with Next's generated scripts |
| 84 | Build assets | Keep generated PNG manifest icons and the existing build-time Google Font downloads. Coolify and CI therefore need outbound build access; all resulting font assets are self-hosted by the built application at runtime |
| 85 | Offline log snapshot | Reliable cold offline logging necessarily persists a minimal private snapshot: the bound Player identity plus the active roster needed by the Match form. It contains no Feed, ratings or Player Detail data, is refreshed after successful online reads, is subject to the same originating-Player sync checks as the queue, and is cleared when revocation is observed |

## Decision log (2026-07-23, mobile shell and invitation recovery)

| # | Decision | Call |
|---|---|---|
| 86 | Viewport-anchored tab bar | “Sticky” means fixed to the mobile viewport: the tab bar never travels with page scroll or iOS overscroll, its controls sit above the bottom safe area, and the tab shell reserves the bar's complete height so content is never obscured. Feed and Rankings labels increase from 12 px to 14 px. The active red rail extends inward from the active outer tab to the edge of the raised Log plate, never through or behind the plate |
| 87 | Invitation transfer into installed PWAs | Every unbound installed PWA accepts a pasted same-site full `/join/{token}` URL or the existing raw token, then reuses the ordinary preview and explicit confirmation flow so the binding is minted in that PWA's cookie store. No human-sized short-code credential is introduced. An iOS browser shows non-blocking recovery guidance above the normal join flow: copy the full link into the installed PWA first; alternatively accept it in Safari, remove the old Home Screen app, and reinstall from Safari. Android receives no uninstall guidance because link capture may open the PWA directly and paste remains the cross-browser fallback |
| 88 | Mobile page overflow | The application must not expose page-level horizontal scrolling at supported phone widths. Fix the element that exceeds the viewport rather than relying only on a global clipping rule; deliberately scrollable controls may retain local overflow |
| 89 | Active rail under the Log plate | The active outer tab's red rail continues to the navigation centreline beneath the raised Log plate, which masks the inner end. This reverses decision 86's stop-at-the-plate-edge rule: the uninterrupted band reads more cleanly than a precisely measured gap beside the rotated plate |
| 90 | Rating direction invariant | A Match winner always gains Rating and a loser always loses Rating. The Player's own strength, the opposing Side's strength, provisional state, and Set Score detail may scale the magnitude but never reverse its sign; the circle values an intuitive post-match payoff over the extra predictive information of rewarding an above-expectation loss or penalizing an underwhelming win |
| 91 | Rating responsiveness | The rating refinement will make results genuinely move the Rating and leaderboard faster, not merely multiply the displayed units. An ordinary unscored Match between established 1000-rated Players changes every participant by exactly 25 Rating points: `+25 / −25` in singles and `+25 / +25 / −25 / −25` in doubles. This calibration point is behavior, not merely presentation |
| 92 | Rating Pool conservation | The Rating Pool is not conserved. Each Player receives an independent Elo update against the opposing Side's mean Rating, following the battle-tested Age of Empires II team-Elo model: a lower-rated winner gains more than their higher-rated partner, while a higher-rated loser loses more than their lower-rated partner. The sum of gains need not equal the sum of losses, and 1000 remains a starting reference rather than an enforced circle average |
| 93 | Set Score direction and incentive | A Simple Result receives the normal Elo movement. Recording Set Scores can only preserve or increase that magnitude, never reduce it: a close scored result is worth approximately the Simple Result, while greater dominance earns a capped bonus. This sign-preserving, bonus-only rule prevents Players from gaining an advantage by omitting an inconveniently close score |
| 94 | Set Score dominance | **Superseded by decision 121.** The initial design used a games-only ratio, `max(0, winnerGames − loserGames) / totalGames`, which ignored set outcomes entirely and could therefore rate a win that dropped a set above a straight-sets win |
| 95 | Set Score maximum bonus | Set Score dominance multiplies every participant's independently calculated Elo magnitude by at most `1.4`. A complete shutout between equally rated established Players therefore changes each Rating by 35 instead of the Simple Result's 25; the shared multiplier preserves the weaker-winner and stronger-loser ordering |
| 96 | Set Score bonus curve | The score multiplier grows linearly as `1 + 0.4 × dominance`. For equally rated established Players, representative changes are approximately 25 for `7–6, 6–7, 7–6`, 27 for `6–4, 6–4`, 30 for `6–2, 6–2`, and 35 for `6–0, 6–0` |
| 97 | Per-Match Rating cap | **Superseded by decision 119.** The initial design capped every Player's final signed change at `±50` per Match. That ceiling was calibrated against decision 101's `K = 100` and outlived it |
| 98 | Shared format Rating | Singles and doubles update the same Player Rating and the same leaderboard. The individual-versus-opposing-average doubles formula reduces to ordinary head-to-head Elo for singles, and an ordinary balanced unscored Match produces the same per-Player `±25` baseline in either format |
| 99 | One-off Guest Rating | A Guest is a named, match-scoped participant rather than a roster Player. For that Match only, every Guest receives a hidden Rating equal to the arithmetic mean of all non-Guest participants' pre-Match Ratings. Only real Players receive Rating outputs; the Guest never receives a profile, Device Binding, leaderboard entry, or cross-Match history |
| 100 | Provisional boundary | A persistent Player is Provisional for their first three rated Matches and becomes Established immediately after completing the third; their fourth Match uses the standard rules. Provisional status and match count are derived during replay, so edits and deletions can move the boundary. This reuses the existing three-Match threshold before a Player qualifies for leaderboard rank |
| 101 | Provisional update speed | **Superseded by decision 120.** The initial design used `K = 100` during each of a Player's first three rated Matches, producing a raw `±50` change at equal Rating |
| 102 | Established Players in placement Matches | Provisional status affects only the Provisional Player's own update. Every Established Player always uses the normal `K = 50`, even when a teammate or opponent is Provisional; there is no reduced-impact or protection rule for the established participants |
| 103 | Rating expectation curve | The individual Elo expectation retains the classic 400-point logistic divisor. With established `K = 50`, an unscored win before the final cap is worth approximately 25 at equal Rating, 18 when the Player is 100 above the opposing Side's mean, 32 when 100 below, 12 when 200 above, and 38 when 200 below; losses mirror those magnitudes |
| 104 | Persistent Player starting Rating | Every persistent Player starts at the fixed Rating of 1000, regardless of the current Rating Pool or circle average. The three Provisional Matches, rather than a moving initial seed, place newcomers; the match-scoped mean used for a Guest remains a separate rule |
| 105 | Guest Matches during placement | A rated Match containing a Guest counts toward every participating Provisional Player's three-Match placement phase. It moves their Rating at the current point on the K taper like any other placement Match; there is no separate confidence or match-count rule for Guest participation |
| 106 | Rating migration | The new rating algorithm applies by replaying the complete historical Match log, not only Matches recorded after deployment. Historical feed deltas, each Player's first three Provisional updates, Set Score bonuses, Rating charts, and the current leaderboard are all recalculated under one formula; no permanent algorithm-version cutover or mixed-scale history is retained. At design time the log contains only four Matches, all Simple Results, so no legacy Set Score fallback is required. Recheck that fact immediately before rollout; any Set Scores added in the meantime must satisfy the normal consistency rules |
| 107 | Set Score consistency | A scored Match is valid only when every recorded set has a winner and the declared Match winner won more sets than the loser. Nonstandard completed scores such as `9–7` or `21–15` remain allowed within the existing numeric and set-count bounds; contradictory or incomplete scores must be corrected or entered as a Simple Result and never feed the dominance bonus |
| 108 | Per-Match Rating floor | After every expectation, K factor, and Set Score multiplier is applied, each real Player's final signed Rating change has an absolute minimum of 1. Every winner therefore gains at least `+1` and every loser loses at least `−1`; the engine cannot produce a change that the integer UI renders as `±0`. The floor only binds beyond roughly an 800-point Rating gap, so it does not meaningfully distort Elo's self-correction at this circle's scale |
| 109 | Integer Rating arithmetic | A Player's final positive Rating-change magnitude is rounded to the nearest whole point, raised to 1 if it rounded to zero, and then given the win/loss sign before it is applied. Player Ratings, history deltas, and before/after values therefore remain integers and exactly match every UI surface; expected probabilities and hidden Guest means may remain fractional calculation inputs |
| 110 | Guest participation boundary | Every Side must contain at least one roster Player. Guests are therefore doubles-only, with at most one Guest on each Side; singles remains Player versus Player. A doubles Match may contain zero, one, or two Guests, and two Guests must be opponents rather than partners |
| 111 | Guest Match records | A rated Match containing one or two Guests contributes normally to every participating roster Player's win/loss record. Guests have no persistent statistics or cross-Match record, so only the roster Players' records change |
| 112 | Guest Match relationship statistics | Guest Matches update head-to-head and partnership statistics normally wherever both members of the relationship are roster Players. No head-to-head or partnership record is created for a Guest; for example, in `Anna + Guest` versus `Ben + Carla`, Anna records Ben and Carla as opponents and Ben and Carla's partnership record updates |
| 113 | Rating range | A Player's lifetime Rating has no hard minimum and may become negative. The fixed 1000 starting Rating and Elo's own self-correction — a Player far below the field faces low expectations and therefore loses little — make that outcome remote, while an unbounded scale preserves the invariant that every loss costs at least one point without a special case at zero |
| 114 | Provisional score ceiling | **Superseded by decision 120**, via 118. Under the initial `K = 100` design, an equally rated Provisional Player already reached `±50` from a Simple Result, so a shutout could not move them farther |
| 115 | Match evaluation snapshot | Every Player's independent expectation and Guest input is calculated from one pre-Match Rating snapshot. A Player is compared only with the opposing Side's mean; the teammate's Rating does not directly enter that Player's expectation, and participant iteration order cannot change the outcome. The projected value is called `expectedScore`, not team win probability, because the independent Player expectations need not be complementary |
| 116 | Guest Name and presentation | A Guest Name uses Player Name normalization and its 40-character limit but has no cross-Match uniqueness. Within its Match it may not collide with another participant or any roster Player after normalization. Match surfaces show it as non-linked text with a Guest marker and never reveal a hidden Rating or Rating delta |
| 117 | Guest uncertainty trade-off | A Guest's actual skill is deliberately not estimated or persisted. Using the participating Players' mean is a neutral one-Match approximation that can misrate an unusually strong or weak Guest; the private circle's trust model is the accepted safeguard, and no extra protection rule is added for Established Players |
| 118 | Provisional K adjustment | **Superseded by decision 120.** An intermediate design reduced the flat Provisional factor from `K = 100` to `K = 70`, chosen so an equally rated shutout landed at 49 — one point under decision 97's ceiling. Removing that ceiling voided the calibration |

## Decision log (2026-07-27, rating calibration review)

| # | Decision | Call |
|---|---|---|
| 119 | Per-Match cap removed | The `±50` cap of decision 97 is deleted; K alone bounds a per-Match change, at `70` for an Established Player and `112` in a first placement Match. The cap was calibrated against decision 101's `K = 100`, where it genuinely prevented a `±140` swing, and survived the reduction to `K = 70` without its rationale. At the shipped constants it bound only on big upsets and shutouts — precisely the most informative results — flattening decisions 92, 95, 96 and 103 to a constant exactly where they should vary most. Reaching the new bounds requires a near-total mismatch and a shutout at once, which is the intended payoff rather than an edge case to suppress |
| 120 | Placement K taper | The flat Provisional factor is replaced by `K = max(50, 80 − 10 × priorRatedMatches)`, giving `80, 70, 60` across a Player's three placement Matches and `50` from the fourth on. This removes the perceptible 40% cliff between Match 3 and Match 4 that a flat factor created at a boundary no Player can predict, while landing a strong newcomer at the same Rating the shipped flat `K = 70` produced, so no re-calibration of decision 91's `±25` baseline is required. The formula reaches `50` exactly at the threshold, so the taper needs no separate clamp and cannot drift from the Established factor |
| 121 | Set-margin-weighted dominance | Set Score dominance becomes `clamp(gamesRatio × setMargin, 0, 1)`, where `gamesRatio` is decision 94's games ratio and `setMargin` is `(winnerSets − loserSets) / totalSets`. The games-only metric ignored set outcomes, so `6–4, 6–4` scored below `6–0, 0–6, 6–1` — the Player who was bagelled in a set out-earned the Player who never dropped one — and rated `6–3, 6–3` identically to `6–0, 0–6, 6–0`. Not losing a set is itself evidence of dominance. Straight-sets results are unaffected, so decision 96's published curve (25 / 27 / 30 / 35) still holds; only results that drop a set are reduced. A contradictory score yields a negative set margin, which clamps to zero and degrades the Match to Simple Result movement, preserving decision 93's bonus-only rule |
| 122 | Rating rollout preflight retired | The boot-time `ratingRolloutPreflight` scan is deleted and decision 106's "recheck immediately before rollout" is recorded as discharged by a one-off manual check. It enforced decision 107's Set Score consistency on every server start and exited the process on failure, so one bad historical row would have refused all traffic on Coolify with no recourse but hand-editing Postgres. `validateSets` already gates every write, making a violating row unreachable after a single verification, and decision 121's clamp degrades one to a Simple Result anyway. Boot remains `migrate` then full projection rebuild, both fatal on failure, called as two steps from `instrumentation.ts` so the database layer no longer imports the match service |
| 123 | One rated threshold | A single constant, `RATED_THRESHOLD = 3`, governs the K taper, Provisional status, and Leaderboard rank. `projectGroup`'s unused `rankedThreshold` override is deleted: it had no caller in the application or the tests and existed only to let `isRanked` diverge from `isProvisional`, which had already happened in the shipped code. Two names for one number cannot drift once there is one number |
| 124 | Match write failure contract | A Match write is permanently refused only when the payload itself is invalid. `logMatchAction` returns `code: "invalid"` for a `MatchValidationError` and rethrows everything else, so a dropped connection or a deadlock reaches the offline queue as a thrown action — which its flush loop already treats as "retry untouched" — instead of a permanent refusal that invites the Logger to discard a real result. This makes the typed error load-bearing: every rejection the match service raises for bad input must be a `MatchValidationError` and never a bare `Error`. No legacy payload shape is accepted; the pre-Guest `string[]` Side format is not supported, since the production log holds four Matches and re-rating them under one formula is the intended rollout (decision 106) |
| 125 | Admin round-trip and invite copy | An authenticated Admin gets a small `Admin panel` control in the Rankings header's top-right action position, matching the root page logo placement, and the Admin panel mirrors it there with `Back to app` linking to `/`; logged-out viewers never see the Rankings control. Successfully generating either a Personal Link or the General Link immediately copies its full same-site `/join/{token}` URL through the same clipboard path and fallback used by the explicit copy controls. Failed generation copies nothing. |
