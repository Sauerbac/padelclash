Status: ready-for-agent

## What to build

A Server Action to create a Group, making the creator the founding Admin (a `membership` row with `role=admin`). A route that shows the group's Leaderboard — empty at this point, but wired end-to-end: the route calls a service, the service queries `current_rating` for the group, the route maps results to `LeaderboardRow` view-model props and composes the `ui` primitives. The app-shell (tab bar) shows the group context.

## Acceptance criteria

- [ ] Authenticated Player can create a Group → becomes admin member
- [ ] Group page shows the group name and an empty leaderboard state
- [ ] Leaderboard query reads from `current_rating` for the group
- [ ] Non-members cannot see the group page

## Blocked by

- 04-services-logmatch
- 05-ds-tokens-styleguide-primitives
- 06-auth-fresh-player
