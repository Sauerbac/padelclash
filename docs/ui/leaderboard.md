# Leaderboard

## Identity

- Route: `/leaderboard`
- Tab: Leaderboard
- Main implementation: `src/app/(tabs)/leaderboard/page.tsx`

## Purpose

Show the current competitive standing of every active player. Ratings and
records are read-side projections derived from the match log; the screen does
not provide controls to adjust them directly.

## Current structural layout

1. Page heading: `Leaderboard`.
2. A four-column data table.
3. A note explaining the ranked threshold when at least one player is
   unranked.
4. The shared bottom tab bar.

The table is not wrapped in a per-row card. It is a compact, horizontally
scrollable table container, so the redesign must keep all four data fields
available on narrow screens.

## Table content

Columns, in order:

1. `#` — numeric rank, or `—` for an unranked player.
2. `Player` — player name linked to `/players/:id`.
3. `Rating` — current rating rounded to a whole number.
4. `W–L` — wins and losses, for example `3–1`.

Active players are sorted ranked-first by the shared rank order. Unranked
players follow, ordered by rating and then name. A player with no matches still
appears as unranked at the starting rating of 1000 with a `0–0` record.

When the viewer’s device is bound to one of the listed players, append a `You`
badge to that player’s name. This is an identification marker, not a filter or
special row.

Players need 3 competitive matches to hold a rank. If any row is unranked,
show the explanatory note:

`— players need 3 matches to hold a rank.`

Retired players are excluded entirely from this screen. Their historical
ratings and pages remain available through other routes.

## Empty state

If there are no active players, omit the table and show `No players yet.` The
bottom tab bar remains available.

## Navigation and non-functionality

- Tapping a player name opens Player Detail.
- There are no sorting controls, filters, search, date selectors, or manual
  refresh controls.
- The leaderboard requires a server read in v1; it is not populated from the
  offline match queue.

