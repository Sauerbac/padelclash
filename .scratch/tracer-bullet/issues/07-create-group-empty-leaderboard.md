Status: done

## What to build

A Server Action to create a Group, making the creator the founding Admin (a `membership` row with `role=admin`). A route that shows the group's Leaderboard — empty at this point, but wired end-to-end: the route calls a service, the service queries `current_rating` for the group, the route maps results to `LeaderboardRow` view-model props and composes the `ui` primitives. The app-shell (tab bar) shows the group context.

## Acceptance criteria

- [x] Authenticated Player can create a Group → becomes admin member — Tier-3 test (`createGroup` seats the founder as an active `admin` membership); the `createGroupAction` shell calls it behind `requirePlayerId`.
- [x] Group page shows the group name and an empty leaderboard state — runtime: member `GET /groups/[id]` → 200 renders "Monday Smashers", a "Leaderboard" heading, and the "No ratings yet" empty state.
- [x] Leaderboard query reads from `current_rating` for the group — `getLeaderboard` joins `current_rating` ⨝ `player`, ordered by rating desc; Tier-3 test covers empty + ordered reads.
- [x] Non-members cannot see the group page — runtime: non-member `GET /groups/[id]` → 404 (a missing group and a non-member both resolve to null, so existence isn't leaked). Unauthenticated `GET /`, `/groups/new`, `/groups/[id]` → 307 → `/login`.

## Done this session

- **`src/services/groups.ts`** — the groups application concern: `createGroup`
  (one tx: insert `group` + the founder's `admin` `membership`), `getGroupForMember`
  (the authorization gate — returns the group + role only for an active member,
  else null), `listMemberGroups` (the home landing pick), and `getLeaderboard`
  (reads the `current_rating` projection joined to `player`, rating desc; `numeric`
  → `Number`). `db` is injectable like `logMatch`, so the Tier-3 test targets
  `padelclash_test`.
- **`src/auth/session.ts`** — `requirePlayerId()`: resolves the viewing Player's id
  from the session (via the `user.player_id` FK, ADR-0004), redirecting to `/login`
  when absent. The seam route components/actions actually need, since the domain
  keys on Player not Account. Exported from `@/auth`.
- **`src/app/groups/actions.ts`** — `createGroupAction` (`"use server"`): the thin
  shell (module-structure.md) — `requirePlayerId` → validate name → `createGroup` →
  `redirect` to the new board. Shaped for `useActionState` (`{ error }` on a miss).
- **`src/app/groups/new/`** — `page.tsx` (session-guarded) + `CreateGroupForm.tsx`
  (client; `useActionState`, ui `TextInput`/`Button`).
- **`src/app/groups/[groupId]/page.tsx`** — the group board: `requirePlayerId` →
  `getGroupForMember` (null → `notFound()`) → `getLeaderboard` → maps entries to
  `LeaderboardRow` props (rank, `you`, `unranked`/threshold label) or renders the
  empty state. `generateMetadata` titles by group name.
- **`src/app/_shell/GroupHeader.tsx`** — app-shell group-context chrome (name),
  beside the `TabBar`; composes tokens only (ui fence stays strict).
- **`src/app/page.tsx`** — home resolves the viewer into their group context:
  redirect to their first group, or `/groups/new` if they have none.
- **`src/app/_shell/TabBar.tsx`** — the **Board** tab now lights up on `/groups/*`
  (home redirects into the group, so that's the Board context).
- **`src/services/groups.integration.test.ts`** (Tier-3, 6 tests) — `createGroup`
  seats an active admin + trims/rejects names; `getGroupForMember` gates
  member/non-member/missing; `listMemberGroups` scopes to the viewer; `getLeaderboard`
  is empty for a fresh group and ordered (rating desc, with names) when populated.
- **No schema/migration change** — slice 02 already created `group`, `membership`,
  and `current_rating`; this slice only wires the runtime against them.

### Notes / deferred

- **Group-scoped navigation & multi-group switching** — the group context shows as
  a header, not yet inside the tab bar; home lands a multi-group player on their
  oldest group silently. Deferred — see
  [open-question 06](../../../docs/open-questions/06-group-scoped-navigation.md).
- The empty state points at "add players / log your first match" as copy only —
  those routes arrive in slices 08–09, which will also populate the board (the
  leaderboard mapping already handles ranked/unranked rows for when they do).

## Blocked by

- 04-services-logmatch
- 05-ds-tokens-styleguide-primitives
- 06-auth-fresh-player
