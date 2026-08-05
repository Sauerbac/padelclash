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
- Reading (feed, leaderboard, stats) requires a connection in v1. No push notifications.
- Revocation is authoritative at the server immediately but becomes visible to an
  offline device only on its next server contact. At that point the invalid credential
  and private page caches are cleared. Already-downloaded local data cannot be erased
  remotely; rejected queued matches retain the explicit-discard behavior from decision 26.

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
