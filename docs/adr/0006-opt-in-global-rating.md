# An opt-in Global Rating exists alongside per-group Ratings

Decided by Simon, 2026-06-12 (supersedes the "no app-wide leaderboard" consequence of [ADR-0002](0002-ratings-are-per-group.md); everything else there stands). Players can opt in to a single app-wide Global Rating. A competitive, confirmed match counts toward it **only when every participant is opted in at the time it is played** — the opt-in is per player, the counting rule is per match, and nobody's results ever reach the global board without their consent.

## Why this shape

- **Player-level opt-in with an all-participants rule** is the only variant that respects the existing privacy model (profiles visible only within shared groups): opting in is the act of consenting to global visibility, and no opted-out player can be dragged onto the board as "the opponent in match X".
- **Group-level opt-in was rejected**: an admin would be consenting on behalf of members, and mixed groups would need the all-participants rule anyway.
- **Per-match opt-in was rejected**: cherry-picking which results count is rating laundering by design.

## Consequences

- The Global Rating is a second, separate Elo per player — same engine, replayed over the global match stream ordered across all groups ([ADR-0001](0001-ratings-derived-by-replay.md) extends naturally). Group ratings remain the primary mechanic and are untouched.
- No seasons, no rollovers, no admin on the global board — nobody owns it, so no one can reset it. Continuous, with the standard 10-match provisional phase.
- Unclaimed Players are never opted in, so their matches never count globally — the global board only ever contains real accounts.
- Globally-counting matches require Confirmation even in Trust Mode groups: a group may trust itself, but it can't vouch to strangers.
- Accepted limitation: friends confirming friends can inflate global numbers. The global board is bragging rights, not an official ranking — best-effort integrity is the explicit bar.
