# Leaderboard

**States: [`/dev/gallery/leaderboard`](../../src/app/dev/gallery/[section]/page.tsx)** —
pulling, release-ready and refreshing gestures, plus empty, early-table,
exactly-three and mixed podium/table standings.

## Identity

- Route: `/leaderboard`
- Tab: Leaderboard
- Main implementation: `src/app/(tabs)/leaderboard/page.tsx`
- Main reusable UI: `src/components/podium.tsx`,
  `src/components/leaderboard-row.tsx`

## Purpose

Show the current competitive standing of every active player. Ratings and
records are read-side projections derived from the match log; the screen does
not provide controls to adjust them directly.

## Current structural layout

1. Page heading: `Rankings`.
2. The Top 3 stand, when three ranked players exist.
3. A four-column data table, starting at rank 4 whenever the stand is shown.
4. A note explaining the ranked threshold when at least one player is
   unranked.
5. The shared bottom tab bar.

## Pull to refresh

When the Rankings app scroller is already at the top, dragging downward reveals
a `Pull to refresh` indicator. Crossing the threshold changes it to `Release to
refresh`; releasing then refreshes the current route and shows `Refreshing`
until the new server-rendered standings arrive. A short pull settles without a
request. The indicator stays hidden through the beginning of the gesture, then
the centered label fades subtly upward as the content follows the finger. Fixed
arrow positions on both sides keep the indicator still; crossing the threshold
rotates both arrows while the pull/release copy cross-fades over the same
interval. Refreshing replaces them with one centered spinner-and-label group.
A successful release settles into the loading offset before the content eases
back to normal. The bottom tab bar remains fixed throughout.

The table is not wrapped in a per-row card. It is a compact, horizontally
scrollable table container, so the redesign must keep all four data fields
available on narrow screens.

## Top 3 stand

The stand **replaces** rows 1–3 rather than sitting above a complete table: in
a circle of ~8–12 players a duplicated top three costs a third of the screen to
say nothing twice (spec decision 65). Ranks stay absolute, so the table below
simply starts at `#4`.

Three plinths, ordered #2, #1, #3 from left to right, bottom-aligned so the
plinth heights read as a podium. Each plinth carries, above the block: the
player name (linked, display type) and a mono `rating · W–L` line; and inside
the block: the rank numeral. #1 additionally carries a `TOP DOG` kicker.

Colour and size do the ranking work: #1 is gold and tallest, #2 plain muted,
#3 bronze and shortest. Bronze is the one medal colour in the theme
(`--podium-bronze`); #2 deliberately gets no silver.

Player-name type scales down fluidly on narrow phones so ordinary long names
stay on one line; balanced wrapping is the fallback for names that still do
not fit. Every rank numeral remains fully inside its plinth, with visible
clearance below the coloured top rail.

The stand renders **only when three ranked players exist**. Below that the
plain table stands alone, because a one-player podium reads as breakage rather
than as an early state. When the viewer is in the top three, the `You` badge
moves onto their plinth — otherwise it would vanish with the row that carried
it. When exactly three ranked players exist and nobody else, the table is
omitted entirely rather than rendering a header with no rows.

DOM order is #1, #2, #3 so the stand reads in rank order; CSS `order` places #1
on the centre plinth visually.

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
badge to that player’s name — on their table row, or on their plinth when they
are in the top three. This is an identification marker, not a filter or special
row.

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
- There are no sorting controls, filters, search, date selectors, or refresh
  buttons. Pulling down from the top refreshes the standings.
- The leaderboard requires a server read in v1; it is not populated from the
  offline match queue.
