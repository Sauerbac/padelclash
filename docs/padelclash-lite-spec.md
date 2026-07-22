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

The scaffold, deploy plumbing (Dockerfile, compose, CI), and configs are **rebuilt
from scratch** on this branch — nothing config-level is inherited from the old app.

Suggested tables: `players`, `device_bindings`, `onboarding_invitations`, `matches`,
`match_participants`, `rating_history`, and `current_rating`. Database constraints enforce
normalized Player Name uniqueness, at most one active binding per Player, at most one
valid Personal Link per Player, and at most one valid General Link for the circle. There
are no user-account tables.

## What carries over from the old app

Only these, restated here as live decisions:

- `src/domain/rating/` — engine, golden test, property test, fixtures — verbatim
  (already on this branch).
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
| 4 | Device binding | Superseded by secure onboarding decisions 28–55 |
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
| 66 | Player Detail back affordance | Player Detail carries no back control, and `back-button.tsx` is deleted with it. This **reverses** the component's original argument — that an installed iOS PWA has no browser chrome and so each drill-in must supply its own — because the tab bar is present on every screen under the tab shell and iOS standalone PWAs have supported the edge-swipe back gesture since iOS 13. The accepted cost is real and was weighed: returning via the Feed tab resets scroll position, so a Player opened from deep in the feed comes back to the top. Re-adding a back control is a deliberate reversal, not an oversight to correct |
| 67 | Feed card rows | Set Scores get their own row instead of trailing the timestamp on the mono meta line — they are the match result, not metadata about it. Card heights are explicitly allowed to vary with content (singles vs doubles, scores vs none); no padding to a uniform height |
| 68 | Tab bar geometry and separation | The active tab's red band is reserved as a transparent border on inactive tabs so switching sections changes colour only, never layout — on Log Match neither text tab is active and the bar previously changed height. The bar also gains a short upward shadow, knowingly the first soft shadow in a theme that is otherwise flat planes and hard borders; it is kept tight and hugging so it reads as a lip rather than a glow. If the inconsistency grates, the on-theme alternative is a gradient scrim fading content out above the bar |
| 69 | Podium bronze, and W–L on the plinths | The returned design contradicted decision 65 twice, and both were re-decided with the user. **Bronze is adopted:** #3 gets a `--podium-bronze` token, reversing 65's "no silver/bronze" on the narrow ground that one medal colour is not the pair 65 was rejecting — #2 stays plain muted and #1 keeps the existing gold, so exactly one token was added. The #1 plinth reuses `--secondary` rather than the design's new tint. **W–L is adopted:** 65 excluded it because "three columns don't fit a 360 px phone", but the design renders `rating · W–L` as a single mono line rather than as columns, which dissolves that objection. Measured at 360, 390 and 430 px: zero column overflow, no horizontal page scroll. It stays unless a future name/rating combination breaks the line |
| 70 | Podium narrow-screen fit | Podium name type scales down fluidly on narrow phones so ordinary long names remain whole; balanced wrapping is only the fallback for names that still cannot fit. Rank numerals must remain visually inside their plinths: #3 is slightly smaller, uses normal line-height, and sits below its bronze rail rather than colliding with it |
| 71 | Feed result density | Singles render winner, ember-red `def.`, and muted loser on one shared baseline. Doubles use two team rows: the winning side and `def.` share the first baseline, with the losing side below. Recorded set values remain a separate result row but carry no `SETS` label because the bordered score values explain themselves |
| 72 | Raised-nav and action balance | One upward shadow follows the combined silhouette of the nav bar and raised centre Log plate, rising around the plate and rejoining the bar rather than layering two separate shadows. Match-card Edit and Delete retain identical 40 px targets and 16 px icon boxes; Delete uses a circled X so its visible footprint matches the pencil |
