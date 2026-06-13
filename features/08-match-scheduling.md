# Match Scheduling & Invitations

**Rank: 8 — Gets games organized inside the app**

## What it is
Planning future matches, not just recording past ones: propose a time, see who's in, fill the court.

## Core capabilities
- Create a planned match: date, time, venue, open slots
- Invite specific players or post it open to the group ("2 spots left Thursday 19:00")
- RSVP: in / out / maybe; waitlist when full
- After the scheduled time, the planned match converts into a result-entry prompt

## Ideas beyond the basics
- Availability polls ("who can play this week?") with best-slot detection
- Calendar export (iCal) for scheduled matches
- Recurring sessions ("every Wednesday 18:00, first 4 to confirm play")
- Auto-suggest balanced teams from the confirmed players using Elo (see [10])

## Why this rank
Valuable glue between the social group and the match log, but groups already organize via WhatsApp — the app must coexist with that, not replace it on day one.

## Resolved decisions (self-grill, 2026-06-12)

**Q: What is a Scheduled Match, precisely?** Its own entity (date/time, venue, capacity — default 4, visibility: invited players or open to the whole group), never a "match without a result". It produces a Match only when someone logs the result; the link between the two is kept for the prompt flow.

**Q: RSVP model?** In / out / maybe, with an automatic waitlist that promotes when someone drops. "Maybe" deliberately exists — banning it doesn't change human behavior, it just moves the ambiguity to WhatsApp.

**Q: How does it coexist with WhatsApp instead of fighting it?** Every Scheduled Match has share text + link designed to be pasted into the group chat ("2 spots left, Thursday 19:00 — tap to join"). The chat stays the conversation surface; the app is the source of truth for who's in. This is the same strategy as result share cards (13).

**Q: The conversion flow?** After the scheduled end time, participants who RSVP'd "in" get a result-entry prompt pre-filled with the players — and the Balancer's suggested teams if it was used. Smart-timed with notifications (12).

**Q: Availability polls, iCal, recurring sessions?** All deferred behind the basic flow. Recurring sessions ("every Wednesday 18:00") is the most requested-in-spirit and comes first of the three, but still after Sessions (18) exists, since a recurring slot is really a recurring Session.

**Scope: Milestone 4.** Painful to rank this low — but WhatsApp already solves 80% of it, while nothing else solves the rating. Quick-log must not wait for scheduling.
