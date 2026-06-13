# User Accounts & Profiles

**Rank: 1 — Foundation, nothing works without it**

## What it is
Every player has a personal account they log in with. The profile is the player's identity across the whole app: display name, avatar, and their personal record.

## Core capabilities
- Registration and login (email/password at minimum; social login as a convenience)
- Profile page showing: current Elo rating, win/loss record, recent matches, trophies
- Editable details: display name, avatar, preferred playing side (left/right court — relevant in padel doubles), handedness
- Privacy: profiles visible only within the groups a player belongs to

## Ideas beyond the basics
- "Guest players" — log a match against someone who hasn't signed up yet; they inherit their history if they register later
- A short bio / trash-talk status line ("Current king of the smash")
- Account merging if someone accidentally creates two accounts

## Why this rank
Authentication and identity are the prerequisite for everything else: match attribution, ratings, and competition entries all hang off the player profile.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Is a "user" one thing, or is identity split?** Split: a **Player** (the domain identity that matches, ratings and stats attach to) is separate from an **Account** (login credentials). This is what makes guest players, claiming and merging clean instead of hacky. See [ADR-0004](../docs/adr/0004-guests-are-unclaimed-players.md).

**Q: How do guest players work exactly?** They are **Unclaimed Players** — full players without an account, created by any group member. Claiming happens via a personal invite link; the new account attaches to the existing player and inherits everything. A wrong claim can be detached by an admin within 7 days. Crucially, this makes the primary onboarding flow: one founder creates the group, adds friends as unclaimed players, logs (even historical) matches, then sends claim links — the app is already alive when friends arrive.

**Q: Auth scope for v1?** Email + password with email verification, **plus Google sign-in from the start** (Simon's call, 2026-06-12 — the auth library supports it as configuration, so it costs little). Other social providers can follow the same way if wanted. Magic-link login is a nice later convenience, not v1.

**Q: Account merging — when and how?** Self-service with explicit confirmation, v1.2. Merging re-points all matches to the surviving player and replays ratings ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md) makes this cheap). Not needed at launch because claiming prevents most duplicate accounts in the first place.

**Q: Privacy boundary?** A profile is visible only to players who share at least one group with you. No public profiles in v1 (revisit with open question 02).

**Q: Preferred side / handedness — does anything consume it?** Informational on the profile in v1. The Balancer may consume preferred side later (avoid proposing two left-side players as partners), but that's an enhancement, not a dependency.

**Q: Bio / trash-talk line?** Yes — one line, ~80 chars, costs nothing, adds personality. In v1.

## Claim invite — token model (architecture grill, 2026-06-13)

The claim invite is a **bearer link carrying a token**: whoever opens it can claim, matching the real act of DMing a link to a friend. The token is **single-use** (redeeming kills it), **stored hashed** (a DB leak exposes no live links), **revocable / re-issuable** by the inviter or an Admin, and carries a **moderate expiry (~30 days)**. The safety net for a wrong claim is the existing **7-day Admin detach window** ([ADR-0004](../docs/adr/0004-guests-are-unclaimed-players.md)) — detach just unlinks the auth user; the `player` row and its history are untouched. Rejected: email-bound invites (the inviter often doesn't know the buddy's email, and it collides with Google sign-in) — the friction wasn't worth a risk the detach window already covers.

Claiming attaches an auth user to an existing `player` row; match `player_id`s do not change, so **claiming triggers no replay** (contrast account *merge*, which re-points match participants and does replay — feature behavior is v1.2). In **v1, a claim link opened by someone who is already a Player is refused** with a clear message ("you already have an account — merging is coming"), and the target stays Unclaimed; this avoids silently minting a duplicate Player before self-service merge ships in v1.2.

**Scope: Milestone 1 (MVP).** Unclaimed players are *in* the MVP — they are the onboarding strategy, not a luxury.
