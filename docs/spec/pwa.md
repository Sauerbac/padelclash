# PadelClash — PWA and offline

Installation, service-worker behavior, offline Match logging, synchronization, and mobile-platform constraints.

This file is one part of the [PadelClash specification](../padelclash-spec.md).

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
- The minimal offline Match-entry snapshot also stores, for each active roster
  Player, how many surviving Matches that Player shares with the bound Player.
  This keeps participant-picker ordering identical during a cold offline launch.
  It stores no Feed, Rating, match-by-match history, or full Player Detail read model.
- Feed and Leaderboard are live server reads, but a joined device retains each
  screen's last successful projection as a timestamped, read-only Saved View.
  A Saved View is a degraded fallback, never an authoritative offline read
  model: it expires after 30 days, is scoped to its originating Device Binding,
  and is cleared when replacement, identity mismatch, or revocation is observed.
  Player Detail and other read screens still require a connection. No push
  notifications.
- Revocation is authoritative at the server immediately but becomes visible to an
  offline device only on its next server contact. At that point the invalid credential
  and private page caches are cleared. Already-downloaded local data cannot be erased
  remotely; rejected queued matches retain the explicit-discard behavior from decision 26.

### Slow and intermittent connectivity

- Server responsiveness, not `navigator.onLine`, controls the slow-connection
  experience. Feed and Leaderboard show their destination skeleton immediately.
  If fresh data has not arrived after five seconds, the screen reveals its Saved
  View with its exact refresh time and a persistent `Connection is poor` status;
  when no Saved View exists it shows a retryable connection state instead. The
  original live attempt may continue and replaces the fallback atomically whenever
  it succeeds. A definite browser-offline signal may skip the otherwise pointless
  five-second wait, but an online signal never proves that the server is reachable.
- Pull-to-refresh keeps the existing screen visible. At five seconds it adds the
  same poor-connection status rather than replacing already-visible data. Retry and
  rapid tab changes start a new current attempt; late results from superseded
  attempts must not replace the screen the Player chose afterward.
- Saved Views persist projection data, not cached private HTML or framework route
  responses. The saved Feed exposes no edit or delete actions, because stale
  authorization must never enable a write. Saved Player links do not navigate into
  an uncached Player Detail; they explain that the detail needs a connection while
  preserving the source view. Unbound Admin sessions do not create or consume a
  Player-scoped Saved View.
- A previously joined Player opens Log Match from the existing private Match-entry
  snapshot immediately while session, roster, reserved names, and shared-Match
  counts refresh in the background. The UI says that it is checking for roster
  updates, and after five seconds identifies the timestamp of the roster snapshot
  being used. A fresh response updates available choices without resetting any
  draft field. A renamed selected Player adopts the current name; a missing or
  Retired selected Player stays visible but blocks submission until replaced. A
  device with no snapshot still needs one successful server response before it can
  log offline. The Match-entry snapshot is required for offline logging and does
  not inherit the Saved View's 30-day display expiry.
- Creating a Match queues immediately when the browser is definitely offline, or
  automatically after five seconds without a server response. The original request
  and queued retry share the existing client Match id; a late success removes the
  queued copy and must never produce two cards or two Matches. Edit and delete stay
  online-only. After five seconds they say `Still waiting for the server…`; after
  fifteen seconds they offer `Check result`, which refreshes authoritative state.
  They never claim cancellation or failure merely because the response is late:
  the server may already have committed, and delete retries are not response-
  idempotent.
- A cold launch follows the intended route instead of silently turning Feed into
  Log Match. It reaches the application shell within the same five-second bound,
  where Feed can show its Saved View and Log Match can use its Match-entry snapshot.
  A usable navigation response that arrives after the shell is stored as a
  one-shot, build-versioned recovery response; the shell consumes that exact
  response in one controlled navigation rather than starting another network
  race. Non-OK and non-HTML responses never mark recovery ready.
  Once the server identifies a revoked or different binding, all mismatched Saved
  Views and snapshots are suppressed and cleared under the existing revocation
  rules.

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 9 | 2026-07-11 | Offline | App-shell cache + offline log queue in v1; offline reads Later |
| 23 | 2026-07-19 | App icons | Generated at build time from one JSX mark via next/og ImageResponse — no binary icon assets in the repo |
| 24 | 2026-07-19 | Service worker | Hand-rolled app-shell worker, no Serwist/Workbox dependency: network-first navigations with cache fallback, cache-first for build-hashed assets; `/api`, `/admin`, `/join` are never cached (tokens/admin state don't belong in Cache Storage) |
| 25 | 2026-07-19 | SW in dev | `next dev` actively unregisters any service worker — a compose image smoke test on port 3000 would otherwise leave a prod worker serving stale chunks into dev |
| 26 | 2026-07-19 | Failed sync | A queued match the server rejects (not a connectivity failure) is never silently dropped: it stays on the pending card with the error shown and an explicit Discard button |
| 27 | 2026-07-19 | Offline edits | Only logging queues offline. Edit/delete need a connection and say so — the 24 h grace window plus replay-on-edit makes queued edits more machinery than a typo repair is worth |
| 52 | 2026-07-21 | Offline authorization | Revocation is immediate on the server and observed by an offline client on next contact; invalid credentials and private page caches are then cleared, while queued matches remain bound to their originating Player and are never synced under another identity |
| 73 | 2026-07-22 | Mobile platforms | PadelClash is an installable mobile PWA for both iOS and Android; production verification covers installed mode on both platforms at common phone widths |
| 80 | 2026-07-22 | Install experience | Keep browser-native installation rather than building a custom prompt: Safari's Add to Home Screen flow on iOS and the browser install flow on Android are documented and verified after deployment |
| 81 | 2026-07-22 | Offline launch contract | After one successful online launch while joined, the installed PWA must reopen offline and allow a Match to be queued on iOS and Android. Feed, Leaderboard and Player Detail remain online-only; the service-worker design must not turn cached private navigations into an accidental offline-read feature |
| 82 | 2026-07-22 | Service-worker privacy and updates | Do not blindly pre-cache `/`, because it contains credential-dependent server output. Use an explicit versioned shell/offline strategy, exclude API/Admin/Onboarding surfaces, clear private caches after revocation, and verify that a deployment cannot strand cached HTML with missing Next.js chunks |
| 83 | 2026-07-22 | Web hardening | The private installation is `noindex`; invitation-bearing pages send no referrer. Hide the framework header and add low-complexity type-sniffing and frame protections; a strict CSP is deferred until it can be tested with Next's generated scripts |
| 85 | 2026-07-22 | Offline log snapshot | Reliable cold offline logging necessarily persists a minimal private snapshot: the bound Player identity plus the active roster needed by the Match form. It contains no Feed, ratings or Player Detail data, is refreshed after successful online reads, is subject to the same originating-Player sync checks as the queue, and is cleared when revocation is observed |
| 154 | 2026-08-27 | Offline frequent-player ordering | The minimal private offline Match-entry snapshot extends decision 85 with one integer shared-Match count per active roster Player, computed for the bound Player across both partnership and opposition. This is the smallest durable read needed to preserve the Log Match picker order during a cold offline launch; it adds no Match rows, outcomes, Rating data, Feed, or full Player Detail projection. Older snapshots without counts remain usable with alphabetical ties until the next successful refresh. |
| 156 | 2026-08-27 | Slow-court resilience and Saved Views | Reverse decisions 9, 81 and 85 only for two bounded read projections: a joined device retains timestamped, binding-scoped, 30-day Saved Views of the last successful Feed and Leaderboard, while Player Detail and all other reads remain online-only. Feed and Leaderboard render destination skeletons immediately, reveal the Saved View or a retryable connection state after five seconds without fresh data, keep the live attempt eligible to replace it, and never expose stale write permissions. Log Match instead opens immediately from its separate durable Match-entry snapshot, refreshing the roster without destroying an in-progress draft. A new Match automatically enters the idempotent offline queue after five seconds without a response; edits and deletes remain online-only and report prolonged uncertainty without claiming cancellation. Cold startup, service-worker fallback, refresh, and ordinary tab navigation all obey the same responsiveness contract. This knowingly expands private data retained on a joined device; observed revocation, replacement, expiry, or identity mismatch clears it, while remote erasure before contact remains impossible. |
