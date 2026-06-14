# Open question 06 — group-scoped navigation & multi-group switching

**Raised:** 2026-06-14, during slice 07 (create group + empty leaderboard).
**Status:** deferred; resolve when a second group context exists in the product.

## The question

screens.md §0 specifies that the current group is "a persistent, always-visible
context (name + avatar) with a low-friction switcher", and that the four–five
top-level tabs (Board / Log / Me / …) all operate *inside* the current group.
Two things are unresolved:

1. **How is the current group carried across the tab bar?** Today the tabs are
   global (`/`, `/log`, `/profile`) and the bottom `TabBar` is route-static. Once
   Log and Stats are group-scoped, their hrefs need a group id — via the URL
   (`/groups/[id]/log`), a cookie-persisted "active group", or a layout segment.
2. **How does a player switch / pick a group** when they belong to more than one?

## What slice 07 does in the meantime

- The group context shows as a header (`_shell/GroupHeader`) on the group board,
  not yet in the tab bar itself. The bottom `TabBar`'s **Board** tab lights up on
  `/groups/*` so the shell still reads as "you are on the board".
- Home (`/`) resolves the viewer into their **first** active group (or
  `/groups/new`). A multi-group picker is not built; a player with several groups
  silently lands on the oldest.

## Why it's safe to defer

The tracer bullet is explicitly single-group (tracer-bullet.md). Group-scoped Log
and a switcher are additive: they hang off `getGroupForMember` /
`listMemberGroups`, which already exist, and the URL is the natural place to carry
the id when those routes arrive. Nothing here changes the data model or the
rating spine.
