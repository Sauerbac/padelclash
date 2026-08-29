# Player Detail

**States: [`/dev/gallery/player`](../../src/app/dev/gallery/[section]/page.tsx)** —
connection-required loading, active, Retired and no-history profiles through
the production loading/view components.

## Identity

- Route: `/players/:id`
- Entry points: player names in Feed, Leaderboard, and companion-stat tables
- Main implementation: `src/app/(tabs)/players/[id]/page.tsx`
- Shared pieces: `src/components/rating-chart.tsx`, `src/components/match-card.tsx`

## Purpose

Provide the complete read-only stats view for one player. It combines the
player’s current standing, rating history, opponent records, doubles-partner
records, and personal match history.

## Current structural layout

While this online-only route contacts the server, it shows a Player
Detail-titled connection-required loading card. It never inherits the Feed
Saved View.

1. Player heading and status badges.
2. Three-stat summary card.
3. Rating-over-time chart card when the player has matches.
4. Head-to-head table when there are opponents.
5. Doubles partners table when there are partners.
6. `Matches` section with the player’s match cards newest first.
7. The shared bottom tab bar, because this route is inside the tabs layout.

The view is a single long vertical page. The stats and relationship data are
separate sections; there are no tabs or collapsible panels inside Player
Detail.

## Back navigation

The screen carries **no** back control (spec decision 66). The tab bar is
present on every screen under the tab shell, and iOS standalone PWAs have
supported the edge-swipe back gesture since iOS 13. The accepted cost is that
returning via the Feed tab resets scroll position, so a player opened from deep
in the feed comes back to the top. Re-adding a back control is a deliberate
reversal, not an oversight to correct.

## Header and status

The heading is the player’s current name. Add:

- `You` when the viewer’s bound player ID matches this player.
- `Retired` when the player has been retired.

Retirement does not make the page unavailable. Historical links must continue
to resolve.

An unknown or malformed player ID renders the framework’s not-found view rather
than an empty stats screen.

## Summary statistics

The first data block is a three-column summary with:

- `Rating` — current rating, rounded to a whole number; players with no rating
  history start at 1000.
- `Rank` — `#N` when ranked, otherwise `—`. Retired players are always
  unranked because rank belongs to the active leaderboard.
- `Record` — total wins and losses as `W–L`.

These values are display-only.

## Rating over time

Render this section only when the player has at least one match. It contains a
single rating history series beginning with a synthetic `Start` point at 1000,
followed by one point per match in chronological replay order.

The current implementation uses an interactive inline chart with:

- Rating gridlines and labels selected to cover the series.
- A line and lightly filled area.
- Start and last-match labels beneath the plot.
- An ember-red dot marking the endpoint. It carries **no** rating label: the
  same value already renders in the section header and in the stat triplet, so
  a third copy was redundant.
- Pointer tracking to select the nearest point.
- A focusable hit target for every point for keyboard/touch access.
- A tooltip showing the rounded rating, signed delta for that match, and date
  label when a point is active.

There is no date-range selector, zoom control, chart legend, or second series.
The match list below remains the fully readable source for the underlying
events.

## Head-to-head

If the player has faced opponents, show a `Head-to-head` table with:

- `Player` — linked opponent name.
- `W–L` — this player’s record against that opponent.

Rows are ordered by number of matches together, most-played first, with
alphabetical name order for ties. Singles opponents and opposing doubles
players both contribute to this table.

If there are no opponents, omit the whole section rather than showing an empty
table.

## Doubles partners

If the player has played doubles with partners, show a `Doubles partners` table
with the same `Player` and `W–L` columns. The record is this player’s record on
the same side as that partner. Order by most matches together, then name.

Omit the section when there are no partners, including for a player whose
history consists only of singles.

## Match history

The final section is headed `Matches` and reuses the Feed match-card format for
only this player’s matches, newest first. It preserves:

- Winner-versus-loser sides and player links.
- Optional winner-first set scores.
- Per-player rating deltas.
- Edit/delete actions when the current viewer has rights for that match.

With no matches, show `No matches yet.` The chart, relationship tables, and
history are all derived read views; there are no local controls for editing
stats.
