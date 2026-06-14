Status: done

## What to build

A form inside the group that creates an Unclaimed Player (a `player` row with no auth `user` pointing at it yet) and adds them as a Member of the group (`membership` row). The new player appears in the group's roster. Claiming is out of scope (follows the spine).

## Acceptance criteria

- [x] Admin (or member, if group allows) can add an Unclaimed Player by display name — any **active member** may add (`addUnclaimedPlayer` authorizes on active membership); admin-vs-member restriction deferred to [open-question 07](../../../docs/open-questions/07-who-can-add-players.md).
- [x] A `player` row is created; no `user` row references it — Tier-3 test asserts the `player` exists and zero `user` rows point at it (ADR-0004; the auth tables are never touched).
- [x] A `membership` row links the new player to the group — inserted in the same transaction as the player, `role=member`, `status=active`.
- [x] The new player appears in the group roster — `getRoster` lists active members (incl. rating-less Unclaimed Players, unlike the leaderboard); the board page renders a Roster section and revalidates on add.
- [x] Duplicate name in the same group is rejected — case-insensitive check among active members inside the tx → `DuplicateMemberNameError`; the action maps it to an inline message. Same name in a *different* group is allowed (Tier-3 covers both).

## Done this session

- **`src/services/groups.ts`** — two additions:
  - `addUnclaimedPlayer({ groupId, displayName, addedByPlayerId })` — one tx:
    authorize the adder (active member), reject a duplicate active-member name
    (case-insensitive, `lower()`), then insert the `player` + its `member`
    `membership`. An Unclaimed Player is just a `player` no `user` references
    (ADR-0004) — auth tables untouched. Exports `DuplicateMemberNameError` so the
    Server Action can surface a clash inline instead of as a 500.
  - `getRoster(groupId)` — active members in join order (founder first), with
    `isUnclaimed` derived from a left join to `user` being null. Distinct from
    `getLeaderboard`, which reads `current_rating` and so omits players with no
    rated match yet.
- **`src/app/groups/[groupId]/actions.ts`** — `addUnclaimedPlayerAction`
  (`"use server"`): the thin shell — `requirePlayerId` → validate name →
  `getGroupForMember` gate → `addUnclaimedPlayer` → `revalidatePath` the board.
  Shaped for `useActionState` (`{ error }` on a miss, `{ addedName }` on success).
- **`src/app/groups/[groupId]/AddPlayerForm.tsx`** — client; `useActionState`,
  ui `TextInput`/`Button`. Stays on the board (no redirect); the uncontrolled
  field resets after each add.
- **`src/app/groups/[groupId]/page.tsx`** — the board now reads leaderboard +
  roster in parallel and renders a **Roster** section (ui `PlayerChip`,
  `unclaimed` variant for unclaimed members, `you` marker) above the add-player
  form.
- **`src/services/groups.integration.test.ts`** (Tier-3, +7 tests = 13) —
  `addUnclaimedPlayer`: creates an unreferenced `player` + active member, trims /
  rejects empty, rejects a case-insensitive dup in-group, allows the dup
  cross-group, rejects a non-member adder (and inserts nothing). `getRoster`:
  active members in join order with `isUnclaimed` flags; excludes former members.
- **No schema/migration change** — slice 02's `player` / `membership` and slice
  06's `user.player_id` FK already carry the whole shape; this slice only wires
  the runtime against them.

### Notes / deferred

- **Who may add players** — slice 08 allows any active member; admin-only and a
  potential `members_can_add` group setting are deferred to
  [open-question 07](../../../docs/open-questions/07-who-can-add-players.md). Safe
  to defer: the bullet's group is a lone founding admin, so the two policies are
  indistinguishable today.
- **Claiming is out of scope** (per the spine) — the roster shows the "Unclaimed"
  marker but no *send claim link* action yet; that is its own later slice.
- The duplicate check scopes to **active** members, so a name freed by a Former
  Member can be reused. Revisit if/when removal + re-add semantics get specified.

## Blocked by

- 07-create-group-empty-leaderboard
