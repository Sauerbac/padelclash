# One Rating per Player per Group, not a global rating

A Player's Elo lives inside each Group separately; joining a new group starts a fresh provisional rating there. Decided because group-level policies — season rollovers, trust mode, future rating-formula options — are incompatible with a single shared number, and a fresh start per circle matches the social reality (the work group and the club are different worlds).

## Considered Options

One global rating with group-scoped leaderboard views — rejected for two reasons: a group admin's season reset would mutate a number other groups depend on, and matches played among strangers in one group would silently move your standing in front of your friends in another.

## Consequences

- A Player can hold several Ratings; the Balancer and Win Probability always operate inside one group context.
- A Match belongs to exactly one Group. Counting a match in multiple groups (where all participants are members) is a later, opt-in-at-log-time extension — never automatic, to avoid surprise rating swings in groups that weren't "in the room".
- Head-to-head and chemistry stats are computed per group.
- ~~There is no app-wide leaderboard, by design.~~ Superseded by [ADR-0006](0006-opt-in-global-rating.md): an opt-in Global Rating exists alongside (not instead of) per-group ratings.
