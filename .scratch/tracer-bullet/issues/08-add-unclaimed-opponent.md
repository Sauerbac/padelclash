Status: ready-for-agent

## What to build

A form inside the group that creates an Unclaimed Player (a `player` row with no auth `user` pointing at it yet) and adds them as a Member of the group (`membership` row). The new player appears in the group's roster. Claiming is out of scope (follows the spine).

## Acceptance criteria

- [ ] Admin (or member, if group allows) can add an Unclaimed Player by display name
- [ ] A `player` row is created; no `user` row references it
- [ ] A `membership` row links the new player to the group
- [ ] The new player appears in the group roster
- [ ] Duplicate name in the same group is rejected

## Blocked by

- 07-create-group-empty-leaderboard
