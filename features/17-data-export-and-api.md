# Data Export & Openness

**Rank: 17 — Trust and tinkering**

## What it is
Players and group admins can get their data out: full match history, ratings over time, tournament results.

## Core capabilities
- Export group match history and standings as CSV/JSON
- Personal data export (also sensible for GDPR if the app ever grows beyond friends)
- Printable/shareable tournament result sheets

## Ideas beyond the basics
- Read API for the stats nerds in the group who want to build their own charts
- Import: bootstrap from the spreadsheet the group inevitably kept before this app existed

## Why this rank
Low urgency, but the import path in particular ("we already have a year of results in Excel") can matter at launch, and export builds trust that the group's history is never locked in.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Import and export are bundled here — do they have the same priority?** No, and this grilling splits them. **Import is an onboarding feature**, not a data feature: a CSV template (date, four player names, score, winner) that auto-creates Unclaimed Players for unknown names and replays ratings over the whole history. Thanks to [ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md) and [ADR-0004](../docs/adr/0004-guests-are-unclaimed-players.md) this is almost free to build — a founder's spreadsheet becomes a living leaderboard in one upload. *Answered 2026-06-12: no historical data exists for the launch group, so import is deprioritized to Milestone 4 — it stays valuable for future groups joining with their own spreadsheets.*

**Q: Export scope?** Group match history + standings as CSV/JSON (any member), and a full personal data export (GDPR-shaped, even while the audience is just friends — cheap now, mandatory later). Milestone 3.

**Q: Read API?** Deferred until the audience-ambition question (open question 02) is answered. For a closed friend circle, CSV export *is* the API the group's stats nerd needs.

**Q: Printable tournament sheets?** Superseded by tournament share cards (13) — nobody prints.

**Scope: Import — Milestone 4. Export — Milestone 3. API — unscheduled.**
