# Venues & Courts

**Rank: 15 — Context for matches and scheduling**

## What it is
A lightweight registry of the places the group plays at, attached to matches and scheduled sessions.

## Core capabilities
- Group-managed venue list (name, address, indoor/outdoor, number of courts)
- Attach a venue to logged matches and scheduled matches
- Per-venue stats: "you win 70% at PadelPoint but 40% at the club" — surprisingly fun

## Ideas beyond the basics
- Link to the venue's booking site / phone number for quick court booking
- Cost-splitting note per session ("court was 40€, Max paid") — not a payment system, just a reminder ledger
- Favorite venue auto-suggested when scheduling

## Why this rank
Nice-to-have metadata. Adds flavor to stats and convenience to scheduling, but no one will miss it in version one.

## Resolved decisions (self-grill, 2026-06-12)

**Q: How heavy is the venue model?** Deliberately featherweight: name, optional address, indoor/outdoor, optional booking URL. No court-level inventory in v1 — "number of courts" is a note, not a managed resource. Venues are group-scoped (no global venue database, no geo features).

**Q: Where do venues attach?** To Sessions (18) primarily, and through them to matches; directly to a Match only when logged outside a session. Scheduled Matches (08) reference them too. Favorite venue auto-suggestion is a one-liner once usage data exists.

**Q: Per-venue stats?** Yes — "70% at PadelPoint, 40% at the club" is cheap and genuinely fun. Lands automatically once venues exist, via the same stats engine as 07.

**Q: Cost-splitting note?** Kept as exactly that — a free-text note on a Session ("court 40€, Max paid"), explicitly **not** a ledger, balance tracker, or payment feature. The moment it computes who owes whom, it's a different product.

**Scope: Milestone 4**, bundled with Sessions (18) — they share the "evening context" concept.
