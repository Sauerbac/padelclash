# Global Ranking

**Rank: 19 — The app-wide bragging board** *(added at Simon's request, 2026-06-12)*

## What it is

An opt-in, app-wide Elo ranking across all groups. Group ratings stay the primary mechanic; the Global Rating is the "okay, but who's *actually* good?" layer on top — one number, one board, everyone who dared to opt in.

## Core capabilities

- Per-player opt-in (and opt-out at any time) from the profile
- A match counts globally only when **all participants are opted in** when it's played ([ADR-0006](../docs/adr/0006-opt-in-global-rating.md))
- Global leaderboard: display name, rating, W/L of globally-counted matches — visible to opted-in players
- Global rating shown on the profile next to group ratings, clearly distinguished
- Continuous (no seasons, no resets, no admins), standard provisional phase

## Ideas beyond the basics

- Percentile framing ("top 12% of PadelClash") — kinder than a raw rank at scale
- Regional filters (city/country) once the player base justifies them
- A "global match" indicator at log time, so players know when a result will count

## Resolved decisions (self-grill, 2026-06-12)

**Q: Is this a third rating system?** No — the same engine and replay mechanism ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)) run over a different match stream: all globally-counting matches across all groups, in played order. One engine, N group streams plus one global stream.

**Q: Why all-participants opt-in instead of something looser?** Privacy and consent: the existing model promises your results are visible only inside your groups. Any rule weaker than "everyone in the match consented" leaks opted-out players onto a global surface. Full reasoning and rejected alternatives in [ADR-0006](../docs/adr/0006-opt-in-global-rating.md).

**Q: What about Trust Mode groups?** Globally-counting matches require confirmation even there — a group can trust itself, but it can't vouch to strangers. This is the only place a group setting is overridden, and it's deliberate.

**Q: What happens on opt-out?** Your row leaves the board and your matches stop counting for *future* global calculations of others' ratings? No — simpler and fairer: past matches remain in the global replay (others earned their deltas against you fairly), but your rating and name disappear from the board. Opting back in resumes where you left off.

**Q: Can this be gamed?** Somewhat — friends confirm friends. Accepted: this is bragging rights, not a sanctioned ranking. If it ever matters, integrity tooling (minimum distinct-opponent counts, anomaly flags) can be added without changing the model.

**Q: When is it worth building?** Only once multiple groups actually exist — a global board with one friend circle on it is just the group leaderboard with worse privacy. Hence Milestone 4, late.

## Why this rank

It needs population to mean anything, and every mechanic it uses (rating engine, replay, confirmation) ships earlier. But at club scale (~100-person groups) it becomes the connective tissue between circles — the number you compare across clubs.

**Scope: Milestone 4 (late).**
