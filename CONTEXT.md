# PadelClash Lite

PadelClash Lite models one private padel circle, its roster, and its completed matches.

## Language

**Player**:
A person on the circle's roster. A Player exists independently of whether they have joined from a device.
_Avoid_: Account, user

**Player Name**:
The roster-wide name displayed for a Player, normalized for compatibility and whitespace and unique without regard to case. Admin may rename a Player, but Retired Players continue to reserve their names.
_Avoid_: Username, account name

**Device Binding**:
The active app credential authorizing access as one Player. A Player has at most one active Device Binding; it identifies authorization, not a provably unique physical device.
_Avoid_: Account, device identifier

**Joined Player**:
A non-retired Player with an active Device Binding.
_Avoid_: Claimed account, active account

**Not Joined Player**:
A non-retired Player without an active Device Binding and therefore available for onboarding.
_Avoid_: Unclaimed account, inactive account

**General Onboarding Link**:
A temporary shared invitation whose holder can join as any Not Joined Player or add a new Player and join immediately. It may onboard several Players before it expires or the administrator revokes it.
_Avoid_: Public name picker, permanent invite

**Personal Onboarding Link**:
A temporary invitation for one Player to create or replace their Device Binding. It is consumed by a successful join.
_Avoid_: Reusable personal link, login link

**Admin**:
The circle's sole administrator, authorized separately from any Player. Admin manages the roster, onboarding, access recovery, and historical corrections.
_Avoid_: Group admin, player admin role

**Retired Player**:
A former roster member who remains part of match history but cannot join or participate in new matches.
_Avoid_: Deleted player

**Rating**:
A Player's evolving estimate of competitive padel strength within the circle. It is a measurement, not participation credit or spendable progression, and has no lifetime floor.
_Avoid_: XP, season points, reward points

**Rating Pool**:
The sum of every Player's Rating in the circle. It may grow or shrink; it is not conserved around the Players' starting Ratings.
_Avoid_: Total points, point supply

**Expected Score**:
A Player-specific Elo input calculated from that Player's Rating and the opposing Side's mean pre-Match Rating. It is not a shared team probability.
_Avoid_: Team win probability, match odds

**Guest**:
A named, match-scoped participant who is not on the circle's roster. A Guest has no cross-Match identity, profile, Device Binding, enduring Rating, or persistent statistics. A rated Guest Match still contributes normally to each participating Player's win/loss record and to relationships between roster Players, but never creates a relationship statistic with the Guest.
_Avoid_: Temporary Player, Guest account, shared Guest

**Provisional Player**:
A Player who has completed fewer than three rated Matches. Their Rating is still being placed and follows accelerated update rules.
_Avoid_: Guest, new account

**Established Player**:
A Player who has completed at least three rated Matches. Their Rating follows the standard update rules and qualifies for leaderboard rank.
_Avoid_: Verified Player, veteran

**Rank**:
A unique position among active Established Players, ordered by Rating, wins, total competitive Matches, and then roster creation time. Higher values lead for the first three measures; earlier creation wins the final domain tie.
_Avoid_: Row number, shared placement

**Saved View**:
A timestamped, read-only copy of the last successfully received Feed or Leaderboard. A Saved View may be shown when the live service cannot answer promptly, but it is never presented as current or authoritative.
_Avoid_: Live data, offline truth, cached page
