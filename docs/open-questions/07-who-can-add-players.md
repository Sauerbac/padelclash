# Open question 07 — who may add players to a group

**Raised:** 2026-06-14, during slice 08 (add an Unclaimed Player).
**Status:** deferred; resolve when group settings and roles get real teeth (M2).

## The question

Issue 08's acceptance criterion reads "**Admin** (or member, *if group allows*)
can add an Unclaimed Player." Two things are unresolved:

1. **Is adding players admin-only, or open to any member?** screens.md pulls both
   ways: §1/§3 frame inline player-create as an everyman courtside action
   ("someone's cousin shows up unannounced"), while §"Secondary surfaces" lists
   member management under **Group settings (admin)**.
2. **What is the "if group allows" toggle?** There is no group setting governing
   member permissions yet — `group` carries only `trust_mode`, `season_config`
   and `ranked_threshold`.

## What slice 08 does in the meantime

- **Any active member** of the group may add an Unclaimed Player. The service
  (`addUnclaimedPlayer`) authorizes on active membership only; `role` is read but
  not gated on.
- This matches the tracer bullet's single founder bootstrapping a roster alone,
  and the courtside inline-create framing. Tightening to admin-only (or adding a
  `members_can_add` group setting) is a pure narrowing later — no data-model or
  call-site change beyond one extra predicate.

## Why it's safe to defer

The bullet's group is a single founding admin (tracer-bullet.md), so "any active
member" and "admin only" are indistinguishable in practice today. The decision
only bites once a group has non-admin members *and* a reason to restrict them —
which is the same moment roles and group settings get built out (M2). Nothing
here changes the schema: a future toggle is a column on `group`, and the role is
already on `membership`.
