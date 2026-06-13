# Groups (Friend Circles / Clubs)

**Rank: 4 — The social container everything lives in**

## What it is
A private group of friends (or a club, or coworkers) that shares a leaderboard, match feed, and competitions. The app is built around closed circles, not a global public ranking.

## Core capabilities
- Create a group, invite via link or code
- A player can belong to multiple groups (work group, friend group, club)
- Group leaderboard, group match history, group competitions
- Roles: admin (manage members, settings, fix disputed results) and member

## Ideas beyond the basics
- Group settings that admins control: which Elo variant is used, whether casual matches count, season length
- Group avatar/name/motto for identity ("Monday Night Smashers")
- Public groups as an optional later step (find players in your city)
- Cross-group play: a match between players of different groups counts in both, or only where all four are members

## Why this rank
"Friends and I" is the stated use case. The group is what scopes leaderboards and competitions and makes the data feel personal rather than anonymous. It needs to exist before leaderboards and tournaments make sense.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Invite mechanics?** Invite link plus a short join code (for "just type X into the app" across the court). Admins can rotate or disable both. Claim links for unclaimed players are personal variants of the same mechanism.

**Q: Role model?** Two roles only: **Admin** and **Member**. Multiple admins allowed; the founder is the first admin; the last admin must hand over before leaving. More granular permissions are complexity nobody asked for.

**Q: What happens when someone leaves or is removed?** They become a **Former Member**: their matches and rating history stay (deleting them would corrupt everyone else's history and replay), but they drop off the leaderboard and lose access. Re-joining reactivates the same player.

**Q: Cross-group play — automatic or opt-in?** Resolved against the file's original idea: a match belongs to **exactly one group**. Counting it in other qualifying groups becomes an opt-in checkbox at log time, in v1.2 — never automatic, so your work-group rating can't be moved by a club match nobody at work saw. See [ADR-0002](../docs/adr/0002-ratings-are-per-group.md).

**Q: Group settings in v1?** Identity (name, avatar, motto) and **Trust Mode** (confirmation on/off, default on). Season configuration arrives with feature 11; rating-formula options much later, applied only from season boundaries.

**Q: Public groups?** Deferred entirely. The app is closed-circles-first by design — though circles can be large (groups up to ~100 people are in scope, per Simon).

**Scope: Milestone 1 (MVP).**
