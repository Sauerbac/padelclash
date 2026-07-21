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
