# Feed

## Identity

- Route: `/`
- Tab: Feed
- Main implementation: `src/app/(tabs)/page.tsx`
- Main reusable UI: `src/components/match-card.tsx`,
  `src/components/queued-matches.tsx`, `src/components/name-picker.tsx`
- Shared card internals (headline, timestamp, set-score row) live in
  `src/components/match-card-parts.tsx`, so the synced and queued cards cannot
  drift apart visually.

## Purpose

The Feed is the home screen and the source of the group’s visible match
history. It shows matches newest first and exposes the rating changes produced
by each match. It also shows matches that were created offline on the current
device but have not reached the server yet.

## Current structural layout

1. Page heading: `PadelClash`.
2. Device identity area immediately below the heading. Its content depends on
   binding state.
3. Local queued matches, if any. These appear before server-synced matches.
4. The synced match feed, or the empty state when there are no matches.
5. The shared bottom tab bar.

The content is a single vertical column. Synced matches are individual match
cards separated vertically. There is no filter, search, pagination control, or
date grouping control.

## Device identity states

### Bound device

Show a short status message identifying the bound player and explain that new
matches logged from this device are credited to that player. The name is not a
separate profile control here; the name itself can lead to Player Detail only
when rendered as a player link elsewhere.

### Unbound device with name picker enabled

Show a “Who are you?” onboarding section containing:

- A short explanation that choosing a name binds this device.
- One selectable action per active roster player.
- A confirmation step before binding: “Bind this device to [player]?”
- A pending/disabled state while binding is in progress.
- On success, persist the recovery marker and refresh the screen into the
  bound-device state.
- On failure, show an inline error explaining that the picker may have been
  disabled and suggesting reload or a personal join link.

The picker is a fallback onboarding path controlled by the admin. It can bind
only an unbound device and only to an active player.

### Unbound device with name picker disabled

Show explanatory text saying that the device is not bound and that the user
should ask the admin for their personal join link. The feed remains readable,
but this state does not provide a way to identify the Logger.

## Synced match card

Each card represents one completed match, laid out as a stack of distinct rows
(spec decision 67). Top to bottom:

1. **Timestamp row.** The played date and time in mono, formatted as day,
   abbreviated month, and 24-hour time — `22 Jul, 19:30`. Edit/delete actions
   sit at the right of this row when the viewer has them.
2. **Headline.** In both singles and doubles, the winning side and ember-red
   `def.` share the first baseline, while the muted losing side occupies the
   second row. Each Player Name is a link to `/players/:id`; doubles sides join
   names with `&`. A Guest Name is plain, non-linked text followed by a
   `GUEST` marker.
3. **Set scores row**, when scores were recorded. One bordered box per set,
   with no redundant label. Scores read winner-first regardless of whether the
   winner was Side A or Side B. Absent entirely for a Simple Result.
4. **Rating deltas.** One badge per roster Player, ordered winners first and
   losers second, each carrying the Player Name plus an exact signed integer
   delta, such as `Simon +15` or `Casey −15`. Guests never receive a badge.
5. **Logged-by row**, admin viewers only (spec decision 53). Separated by a
   rule: `LOGGED BY <name>`, the name in gold.

Set scores get their own row rather than trailing the timestamp: they are the
match result, not metadata about it. Card heights vary with content — a doubles
match with three sets is taller than a scoreless singles, and short cards are
not padded to match (spec decision 67).

The match card does not show absolute ratings, avatars, match duration,
location, or an expand/collapse control.

## Edit and delete actions

If the current viewer has edit rights, the card’s top-right action area shows:

- An edit icon button that navigates to `/matches/:id/edit`.
- A circled-X delete icon button, with the same optical size and touch target
  as Edit.

Delete requires a confirmation explaining that ratings will be recomputed as if
the match had never existed. While deletion is pending, the action is
disabled. Server-side permissions are checked again even if the buttons were
visible.

The actions appear when the viewer is the Logger within the 24-hour grace
window or when the viewer is the admin. Other viewers see no action area.

## Offline queued match cards

When a new match is logged without connectivity, it is stored locally and
rendered above the synced feed on that device. A queued card reuses the synced
card’s rows and type — timestamp, headline, set scores — so it reads as the
same component in a provisional state, and differs only in that it:

- Is framed with a dashed border instead of a solid one.
- Carries a `Pending sync` status badge in the timestamp row, gold on dark.
- Has **no rating-delta row**, because the server has not replayed the match
  yet. In its place a closing line reads `Rating pending — scored when this
  syncs. Only you can see it.`, or the last transient sync error when there is
  one.

They are synced automatically when the app opens or connectivity returns. The
queue processes oldest first, while the feed eventually places a late-arriving
match according to its played time.

If the server rejects a queued match for a reason that retrying cannot fix, the
card stays in place and switches to the blocked state:

- The dashed frame and the status badge turn ember red, the badge reading
  `Can’t sync`.
- The server’s reason renders as destructive-toned text above a rule.
- An explicit `Discard` action, guarded by a confirmation. Discard permanently
  removes the queued local match; it must never happen silently.

Transient refusals (no connection, server busy) get the status line only, not
the Discard action — offering it for those invites people to delete matches
that were about to sync fine (spec decision 26).

## Empty state

When there are no server-synced matches, the page shows
`No matches yet — log the first one.` This message is rendered from the synced
feed section even if a queued local card is also present, so the current
implementation can show pending cards followed by this message. There is no
dedicated empty-state button; the user uses the Log Match tab.
