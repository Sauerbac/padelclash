# Secure onboarding — server contracts

What the frontend tranche consumes. Every type below is exported from the file
named above it. Spec decisions in parentheses.

The rule underneath all of it: **the client's opinion about who it is never
enters into an authorization decision.** The binding cookie is opaque, the
server resolves it, and every read and mutation re-checks.

## Authorization

`src/services/auth/authz.ts`

```ts
interface Viewer { player: Player | null; isAdmin: boolean }

currentViewer(): Promise<Viewer>            // request-scoped (React cache)
canReadPrivate(viewer): boolean
viewerForPrivateRead(): Promise<Viewer | null>   // pages
requirePrivateRead(): Promise<Viewer>            // actions, throws
requireLogger(): Promise<Player>                 // actions, throws
```

**Every player-facing page must call `viewerForPrivateRead()` and return
`<NotJoined />` before it queries anything** (decision 57). Gating in
`(tabs)/layout.tsx` is *not* sufficient on its own: Next renders the page
segment regardless of what its layout returns, so a page that fetches
unguarded ships roster and match data in the RSC payload even while the screen
reads "Not joined". This was a real leak during implementation, not a
hypothetical.

Admin bypasses the read gate but **cannot log a match** — every Match records a
Player Logger, so `requireLogger()` refuses an Admin session with no binding
(decision 49).

## The binding cookie

`src/services/auth/binding.ts`

```ts
BINDING_COOKIE = "pc_binding"          // opaque 256-bit credential
LEGACY_PLAYER_COOKIE = "pc_player"     // deleted on sight (decision 55)

currentBinding(): Promise<{ player, binding } | null>   // read-only, safe in RSC
getBoundPlayer(): Promise<Player | null>
isBound(): Promise<boolean>
setBindingCookie(credential): Promise<void>    // Server Action / Route Handler only
clearBindingCookie(): Promise<void>            // ditto
refreshBindingCookie(): Promise<void>          // ditto
```

Only the hash is persisted; the plaintext exists in the cookie and nowhere else
— never in localStorage (decision 47). Setting cookies is impossible once a
Server Component starts streaming, hence the split.

## Onboarding — visitor flows

`src/app/actions/onboarding.ts`

```ts
previewInvitationAction(token): Promise<
  | { ok: true; preview: InvitationPreview }
  | { ok: false; error: PreviewProblem }
>

confirmJoinAction(confirmation: JoinConfirmation): Promise<
  | { ok: true; playerId: string; playerName: string }
  | { ok: false; error: JoinProblem | "rate-limited" }
>

type JoinConfirmation =
  | { via: "personal";         token: string }
  | { via: "general-existing"; token: string; playerId: string }
  | { via: "general-new";      token: string; name: string }
```

`InvitationPreview` is either
`{ kind: "personal"; player: { id, name }; replacesBinding: boolean }` or
`{ kind: "general"; notJoined: { id, name }[] }`.

Error variants:

| Code | Meaning |
|---|---|
| `not-found` | No such token |
| `expired` | Past its 12 h / 7 d life |
| `revoked` | Admin killed it, or a competing join did (decision 44) |
| `consumed` | A Personal Link already spent (decision 32) |
| `player-unavailable` | Target retired or deleted |
| `player-already-joined` | General Link may only join a Not Joined Player (decision 29) |
| `wrong-link-kind` | Personal token used in a general flow, or vice versa |
| `name-blank` / `name-too-long` / `name-taken` | New-Player name rejected |
| `already-bound` | This installation belongs to a Player — redirect to `/`, don't consume (decision 38). Enforced *inside* the confirmation transaction, so it is also the answer to a double-submit from an already-joined installation |
| `rate-limited` | Back off and retry |

`previewInvitationAction` never mutates: opening or refreshing a link cannot
consume it or change a binding (decisions 42, 43). Confirmation is the only
mutating step, and it must be an explicit user action carrying the warning that
the installation cannot switch Players without Admin.

**Disable the confirm button while the request is in flight.** An unbound
installation presents no credential, so the server has no identity to serialize
two simultaneous confirmations on. Two tabs confirming different Players through
one General Link would both legitimately succeed, and only one credential would
survive in the cookie (decision 62). Everything else — including a confirmation
from an installation that is already bound — is closed server-side.

## Onboarding — Admin controls

`src/app/actions/admin.ts` — all return `{ ok: true }` or
`{ ok: false; error: string }` (prose, ready to display), except the link
generators which return `{ ok: true; link: LinkDetails }`.

```ts
generateGeneralLinkAction(): Promise<LinkResult>   // refuses while one is live
revokeGeneralLinkAction(): Promise<AdminResult>
getGeneralLinkAction(): Promise<LinkDetails | null>
getBindingHistoryAction(playerId): Promise<BindingRecord[]>

generatePersonalLinkAction(playerId): Promise<LinkResult>
revokePersonalLinkAction(playerId): Promise<AdminResult>
revokeAccessAction(playerId): Promise<AdminResult>

createPlayerAction / renamePlayerAction    // (prevState, formData) => { error? }
retirePlayerAction / restorePlayerAction / deletePlayerAction   // (playerId)
```

`LinkDetails` is `{ token: string; expiresAt: Date }`; build the URL as
`/join/${token}`.

Two things worth knowing:

- **"Replace device" is `generatePersonalLinkAction`.** There is no separate
  action. The existing binding deliberately stays live until the new link is
  actually used (decisions 32, 45), so a mis-click locks nobody out.
- **`revokeAccessAction` also revokes the circle's General Link** (decision 46).
  That is intentional: otherwise the Player who just lost access walks back in
  through the link already sitting in the group chat. The Admin UI should say so.

## Admin roster

`src/services/players.ts`

```ts
getAdminRoster(db, now?): Promise<{
  joined: RosterEntry[]; notJoined: RosterEntry[]; retired: RosterEntry[]
}>

interface RosterEntry {
  id: string;
  name: string;
  status: "joined" | "not-joined" | "retired";
  binding: { createdAt: Date; lastSeenAt: Date } | null;   // decision 53
  personalLink: { token: string; expiresAt: Date } | null; // only if still valid
  deletable: boolean;                                      // decision 31
}
```

`deletable` is false whenever the match log references the Player as participant
*or* Logger. Onboarding state never blocks deletion; deleting the referencing
Matches makes them deletable again.

`RosterEntry.binding` is only the *active* one. For the retained history of
decision 53 — when previous devices were bound and when they stopped working —
call `getBindingHistoryAction(playerId)`:

```ts
interface BindingRecord {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  active: boolean;
}
```

Newest first, and deliberately hash-free: nothing it returns can be replayed as
a credential.

## Matches

`src/app/actions/matches.ts`

```ts
interface MatchPayload { id, playedAt, sides, winnerSide, sets }
interface LogMatchPayload extends MatchPayload { ownerPlayerId: string }
type EditMatchPayload = MatchPayload

type MatchMutationError =
  | "not-bound" | "identity-mismatch" | "not-allowed" | "rate-limited" | "invalid"

logMatchAction(payload):  { ok: true; deltas; alreadyLogged } | { ok: false; code; error }
editMatchAction(payload): { ok: true; deltas }                | { ok: false; code; error }
deleteMatchAction(id):    { ok: true }                        | { ok: false; code; error }
```

### The offline-sync identity contract (decision 52)

`ownerPlayerId` is **the Player who queued the match**, not whoever is bound at
sync time. The server refuses the write with `code: "identity-mismatch"` when
they differ — a device rebound to someone else must never re-attribute queued
matches to the new Player.

Handle the codes differently on sync:

- `identity-mismatch`, `invalid` — permanently un-syncable. Keep the item, show
  the reason, offer the explicit Discard of decision 26. Never drop silently.
- `rate-limited` — transient, retry later.
- `not-bound` — the installation lost its binding; see below.
- a thrown error (not a result) — no connection, retry on the next `online`.

Idempotency still holds: a retried sync of an already-stored id returns the
stored result, but only to the Player who actually logged it.

## Session status

`GET /api/session` → `SessionStatus`

```ts
{ bound: boolean; player: { id, name } | null; revoked: boolean }
```

When it resolves, this endpoint also **re-issues the binding cookie**, which is
what keeps "ordinary use refreshes the cookie" true for a member who reads the
feed but never logs a match (decision 64). Pages can't set cookies, so call it
on app open — which the revocation check below needs anyway.

`revoked: true` means the installation *presented* a credential that no longer
resolves — revoked, replaced, or its Player retired. The route clears the dead
cookie itself. That flag is the frontend's cue to do the rest of decision 52:
drop private page caches and clean up queued matches that can no longer sync.
`bound: false, revoked: false` is just an ordinary unbound visitor with nothing
to clean up. Never cached (`no-store`); the service worker must keep skipping
`/api`.

## Rate limits

`src/services/rate-limit.ts` — in-process sliding windows (decision 60).

| Limiter | Budget |
|---|---|
| `adminLoginLimiter` | 10 / 15 min |
| `onboardingLimiter` | 30 / hour — visitor preview + confirm |
| `adminMutationLimiter` | 200 / hour — every Admin mutation, links included |
| `matchMutationLimiter` | 60 / 5 min |

Deliberately not an approval system: a human onboarding a room full of people
never reaches these. The offline queue's catch-up flush shares the match budget,
so a very large backlog can hit it — treat `rate-limited` as retry-later, not
as failure.

## Not covered here

Client IndexedDB behaviour, the service worker's cache-clearing on revocation,
and the finished onboarding/admin screens belong to the frontend tranche. The
join and admin surfaces currently in the repo are deliberately plain — correct,
but not designed.
