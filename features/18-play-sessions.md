# Play Sessions

**Rank: 18 — The container that matches actually happen in** *(added during the self-grill, 2026-06-12)*

## What it is

A Session is one real-world meetup — "Thursday evening at PadelPoint, 6 people, 4 matches" — as a first-class thing. Padel nights are not isolated matches: a group of 4–8 people plays several matches over two hours, rotating who sits out and who partners whom. Today's feature set models the matches but not the evening; this feature closes that gap.

## Why it was added

Three already-planned ideas turn out to be the *same* idea wearing different hats: rotation schedules for 5+ players (10), the venue and cost note (15), and recurring weekly slots (08). Each needs an "evening" concept to attach to. Rather than three half-versions of it, Sessions makes it explicit — and unlocks the best quick-log experience in the process.

## Core capabilities

- Start a Session (ad hoc courtside, or from a Scheduled Match): who's here, where
- Quick-log inside a session is pre-filled with present players — logging match 3 of the evening takes two taps
- For 5+ players: rotation suggestions so court time is even and sit-outs are fair, powered by the Balancer (10)
- Session summary when it ends: matches, biggest rating swing, "king of the evening" — a natural share card (13)
- Venue (15) and the cost note attach here, not to individual matches

## Ideas beyond the basics

- Recurring sessions ("every Wednesday 18:00") as the natural home for feature 08's recurring idea
- Session streaks ("12 Wednesdays in a row") as badge fodder (14)
- "Evening Americano": a casual rotation mode inside a session, lighter than a formal tournament

## Resolved decisions (self-grill, 2026-06-12)

**Q: Is a Session required to log a match?** **No, never.** A single match logged with no session stays exactly as cheap as today. Sessions are an optional wrapper that makes multi-match evenings *easier*, not a mandatory ceremony. The moment sessions add a required step to quick-log, they've failed.

**Q: Session vs Tournament — where's the boundary?** A Tournament has a format, a draw and standings; a Session is just presence and convenience. The "Evening Americano" idea deliberately stays a *casual rotation helper* inside a session — if people want scored standings, that's a real Americano tournament (06), which can itself run inside a session.

**Q: Do sessions affect ratings?** No. Sessions contain matches; only matches carry competitive weight. A session is social metadata.

## Why this rank

Ranked last among real features because everything in it is convenience on top of existing mechanics — but it's the feature that makes the app match how padel evenings actually unfold, and several Milestone-4 features (15, parts of 08 and 10) dock onto it.

**Scope: Milestone 4**, built before the features that attach to it (venues, recurring scheduling, rotation).
