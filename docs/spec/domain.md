# PadelClash — Domain and matches

The authoritative domain model and Match rules. Rating calculation itself lives in [Rating](./rating.md).

This file is one part of the [PadelClash specification](../padelclash-spec.md).

## Domain model

Terminology carried from the old CONTEXT.md where it still applies.

### Player

A person on the roster. Core fields: `id`, `name`, `normalized_name`, `avatar` (optional),
and `retired_at` (nullable — hides from match pickers, keeps history). A Player may be
created by Admin for match tracking or by an attendee through a General Onboarding Link.
No account, email, or password exists. Player Names are compatibility-normalized,
whitespace-normalized, and case-insensitively unique across the full roster, including
Retired Players; Admin may rename them.

A non-retired Player is **Joined** when they have an active Device Binding and **Not
Joined** otherwise. Admin may permanently delete a Player only when no existing Match
references them as participant or Logger. Once referenced, the Player may only be
retired; deleting all referencing Matches makes them deletable again. Restoration moves
a Retired Player to Not Joined without restoring old access.

### Guest

A named, match-scoped participant who is not on the roster. A Guest has no
cross-Match identity, profile, Device Binding, enduring Rating, or persistent
statistics. For one Match's Rating calculation, every Guest receives the mean
pre-Match Rating of all non-Guest participants as a hidden input. The value is
never shown, and the Guest receives no Rating output. Every Side must still
contain at least one Player, so Guests are doubles-only and each Side may
contain at most one.

A Guest Name uses the same normalization and 40-character limit as a Player
Name, but is stored only on that Match. It need not be unique across Matches.
Within a Match it must not collide with another participant's normalized name,
and it must not collide with any roster Player's normalized name; the Logger
must add a distinguishing suffix instead. Match surfaces render the name as
plain text with a Guest marker, never as a Player link or Rating delta.

A rated Match containing a Guest contributes normally to every participating
Player's win/loss record and to relationship statistics between its roster
Players. No statistic is created for a relationship with the Guest.

### Match

A completed contest between two **Sides** with exactly one winner. Never a draw.

- `id` — **UUIDv7, generated on the client** (idempotency key for offline sync).
- `playedAt` — when it was played (client-supplied; defaults to "now" in the form).
- `loggedAt` — when the server accepted it.
- `loggedBy` — the Player bound to the logging device (the **Logger**).
- Sides A and B contain the same number of participants. Singles is exactly one
  Player on each Side. Doubles is exactly two participants on each Side, with at
  least one Player and at most one Guest per Side. A Player appears only once,
  and every Guest is a distinct match-scoped participant.
- `winnerSide` — A or B. Always required.
- Result detail, one of:
  - **Set Score** — games per set: `6-4, 3-6, 7-5`. Stored, shown, and used as a
    capped Rating bonus. Every set must have a winner and the declared Match
    winner must have won more sets.
  - **Simple Result** — winner only, no scores. First-class, not a degraded case.

Every match is competitive (affects ratings). No casual flag, no status field in v1 —
a deleted match is a deleted row.

### Rating

A Player's evolving estimate of competitive padel strength. Derived, never
stored authoritatively — see [Rating](./rating.md). A Match result
always determines the direction of movement: every winner's Rating increases
and every loser's Rating decreases. The Player's own strength, the opposing
Side's strength, provisional state, and Set Score detail may change only the
magnitude, never reverse the direction. Rating has no lifetime floor and may
become negative.

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 5 | 2026-07-11 | Match model | Singles + doubles; Set Score or Simple Result |
| 10 | 2026-07-11 | Edit rights | Logger fixes own match ≤ 24 h; admin edits anything |
| 13 | 2026-07-11 | Stats | Full Player Detail: rating chart, H2H, partner stats |
| 22 | 2026-07-12 | Ranks & retirement | Rank is a property of the active leaderboard: retired players hold no rank and leave no numbering gap; their pages stay reachable and show unranked |
| 30 | 2026-07-21 | Player names | Player Names are case-insensitively unique across the entire roster, including Retired Players; Admin can rename them |
| 31 | 2026-07-21 | Empty Player cleanup | Admin can permanently delete a Player only when no existing Match references them as participant or Logger; onboarding and browsing do not block deletion, and deleting every referencing Match makes the Player deletable again |
| 35 | 2026-07-21 | Restore Player | Admin can restore a Retired Player to Not Joined with history and Player Name intact; any old Device Binding remains invalid and joining requires a fresh invitation |
| 53 | 2026-07-21 | Accountability | Admin can see each Match's Logger and binding creation/last-seen timestamps; revoked binding history is retained for troubleshooting without claiming physical-device identification or adding a general activity log |
| 54 | 2026-07-21 | Name normalization | Player Names are trimmed, repeated whitespace collapsed, Unicode compatibility-normalized, and case-insensitively constrained by the database while preserving display casing |
| 61 | 2026-07-21 | Legacy name collisions | The cutover migration resolves pre-existing normalized-name collisions by suffixing later duplicates " (2)", " (3)" on both the display name and the key, rather than failing the migration or dropping a Player — Admin sees exactly which rows need a real rename. Its normalization strips the complete Unicode `Cf` set (Postgres has no `\p{Cf}`), matching the runtime exactly; anything less would let a legacy name keep an invisible character and hold a key the app would never compute |
| 107 | 2026-07-23 | Set Score consistency | A scored Match is valid only when every recorded set has a winner and the declared Match winner won more sets than the loser. Nonstandard completed scores such as `9–7` or `21–15` remain allowed within the existing numeric and set-count bounds; contradictory or incomplete scores must be corrected or entered as a Simple Result and never feed the dominance bonus |
| 110 | 2026-07-23 | Guest participation boundary | Every Side must contain at least one roster Player. Guests are therefore doubles-only, with at most one Guest on each Side; singles remains Player versus Player. A doubles Match may contain zero, one, or two Guests, and two Guests must be opponents rather than partners |
| 111 | 2026-07-23 | Guest Match records | A rated Match containing one or two Guests contributes normally to every participating roster Player's win/loss record. Guests have no persistent statistics or cross-Match record, so only the roster Players' records change |
| 112 | 2026-07-23 | Guest Match relationship statistics | Guest Matches update head-to-head and partnership statistics normally wherever both members of the relationship are roster Players. No head-to-head or partnership record is created for a Guest; for example, in `Anna + Guest` versus `Ben + Carla`, Anna records Ben and Carla as opponents and Ben and Carla's partnership record updates |
| 116 | 2026-07-23 | Guest Name and presentation | A Guest Name uses Player Name normalization and its 40-character limit but has no cross-Match uniqueness. Within its Match it may not collide with another participant or any roster Player after normalization. Match surfaces show it as non-linked text with a Guest marker and never reveal a hidden Rating or Rating delta |
| 124 | 2026-07-27 | Match write failure contract | A Match write is permanently refused only when the payload itself is invalid. `logMatchAction` returns `code: "invalid"` for a `MatchValidationError` and rethrows everything else, so a dropped connection or a deadlock reaches the offline queue as a thrown action — which its flush loop already treats as "retry untouched" — instead of a permanent refusal that invites the Logger to discard a real result. This makes the typed error load-bearing: every rejection the match service raises for bad input must be a `MatchValidationError` and never a bare `Error`. No legacy payload shape is accepted; the pre-Guest `string[]` Side format is not supported, since the production log holds four Matches and re-rating them under one formula is the intended rollout (decision 106) |
| 129 | 2026-07-31 | Circle-local Match timestamps | Match timestamps are displayed in `Europe/Berlin`, including its daylight-saving rules, instead of inheriting the deployment server's timezone. Stored timestamps remain absolute ISO instants and the change is presentation-only |
