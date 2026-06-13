# Guests are Unclaimed Players, not a separate guest entity

Anyone can appear in matches without having an Account: an Unclaimed Player is a full Player (rating, stats, leaderboard presence) created by a group member, later claimed via a personal invite that attaches a new Account while keeping all history.

## Considered Options

A separate lightweight "guest" record merged into a real account on registration — rejected because a second identity type forks every rating, stats and leaderboard code path, and the merge-on-registration machinery it requires is exactly the generic account-merge we want anyway.

## Consequences

- One founder can bootstrap an entire group — members, historical matches, ratings — before anyone else signs up. This is the primary onboarding flow, not an edge case.
- Confirmation logic must handle sides with no one able to confirm (all unclaimed): such matches auto-confirm immediately.
- A wrongly claimed Player can be detached from the Account by a group admin within a grace window.

## Schema realization (decided 2026-06-13)

Two tables, with **Player as the domain anchor**. The `player` table carries no auth columns and is what every match, rating and membership references. An **Unclaimed Player is a `player` row that no auth user references yet** — it never touches the auth system. The **Account is Better Auth's `user` table**, extended with a `player_id` that is **unique and not-null**: every authenticated user maps to exactly one Player, and the FK lives on the user row (the side that only exists once the link does). **Claiming** creates a fresh auth user and points its `player_id` at the *existing* unclaimed `player` row — no data move, so all history carries over by construction. Rejected: unifying Player with the auth user (credential-less Unclaimed Players would pollute Better Auth's `user` table and its session/verification/OAuth flows). Consequence: two sign-up paths — fresh registration creates `player` + `user` together; claim-via-invite creates only a `user` and links it to a pre-existing `player`.
