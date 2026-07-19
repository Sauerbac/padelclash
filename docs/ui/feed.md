# Feed

## Identity

- Route: `/`
- Tab: Feed
- Main implementation: `src/app/(tabs)/page.tsx`
- Main reusable UI: `src/components/match-card.tsx`,
  `src/components/queued-matches.tsx`, `src/components/name-picker.tsx`

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

Each card represents one completed match. It contains:

- The winning side first, then the literal relationship “def.”, then the
  losing side.
- Each player name is a link to `/players/:id`.
- Doubles sides join player names with `&`; singles sides contain one name.
- A metadata line with the played date and time, formatted as day, abbreviated
  month, and 24-hour time. If set scores exist, append them in the same line.
  Scores are shown winner-first, regardless of whether the winner was Side A or
  Side B. Example: `12 Jul, 10:43 · 6–4, 6–3`.
- One rating-delta badge for every participant. The badges are ordered winners
  first and losers second, and include the player name plus a signed rounded
  delta, such as `Simon +15` or `Casey −15`.

The match card does not show absolute ratings, a logged-by label, or an
expand/collapse control.

## Edit and delete actions

If the current viewer has edit rights, the card’s top-right action area shows:

- An edit icon button that navigates to `/matches/:id/edit`.
- A delete icon button.

Delete requires a confirmation explaining that ratings will be recomputed as if
the match had never existed. While deletion is pending, the action is
disabled. Server-side permissions are checked again even if the buttons were
visible.

The actions appear when the viewer is the Logger within the 24-hour grace
window or when the viewer is the admin. Other viewers see no action area.

## Offline queued match cards

When a new match is logged without connectivity, it is stored locally and
rendered above the synced feed on that device. A queued card contains:

- The same winner-versus-loser summary as a synced card.
- The local played date/time and optional winner-first set scores.
- A `Pending sync` status marker.

Queued matches do not have rating deltas because the server has not replayed
the match yet. They are synced automatically when the app opens or connectivity
returns. The queue processes oldest first, while the feed eventually places a
late-arriving match according to its played time.

If the server rejects a queued match for a non-connectivity reason, keep the
card in place and show:

- An inline destructive error beginning with `Couldn’t sync:` and the server
  reason.
- An explicit `Discard` action guarded by a confirmation. Discard permanently
  removes the queued local match; it must never happen silently.

## Empty state

When there are no server-synced matches, the page shows
`No matches yet — log the first one.` This message is rendered from the synced
feed section even if a queued local card is also present, so the current
implementation can show pending cards followed by this message. There is no
dedicated empty-state button; the user uses the Log Match tab.
