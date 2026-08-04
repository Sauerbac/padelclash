# Log Match

**States: [`/dev/gallery/log`](../../src/app/dev/gallery/[section]/page.tsx)** —
bound, long-name doubles, unbound, refused, queued and successful-payoff states
use the real prop-driven view and form.

## Identity

- Route: `/log`
- Tab: Log Match
- Main implementation: `src/app/(tabs)/log/page.tsx`
- Main reusable UI: `src/components/match-form.tsx`

## Purpose

Log a completed singles or doubles match. The form records the players, the
winning side, optional set-score detail, and when the match was played. On a
successful online submission it immediately shows the rating changes. On an
offline submission it stores the match locally for later sync.

## Current structural layout

1. Page heading: `Log Match`.
2. Either an unbound-device explanation card or the match form.
3. The shared bottom tab bar.

The bound form is a vertical sequence of control groups rather than one large
outer card. Its order is:

1. Singles/doubles mode switch.
2. Side A player picker group.
3. Side B player picker group.
4. Winner selection.
5. Optional set-score section.
6. Played-at date/time control.
7. Inline validation error, when present.
8. Full-width submit button.

## Unbound state

If the device is not bound, do not render the form. Show a card titled
`Who’s logging?` explaining that matches cannot be credited until the device is
bound. Tell the user to open their personal join link or ask the admin for one.
There is no alternate Logger input in this screen.

## Match form controls

### Singles / doubles switch

The form starts in doubles mode, and `Doubles` is the left-hand option in the
mode switch. Choosing `Singles` changes the number of player slots:

- Singles: one picker under Side A and one picker under Side B.
- Doubles: two pickers under each side.

Turning doubles off clears the second picker on both sides. Turning it on does
not invent additional player selections.

Long participant names truncate in both the closed picker and its option list
without widening the screen. The gallery includes a doubles fixture with four
deliberately long names at every supported review width.

### Participant pickers

Each slot is a full-width select control with the placeholder
`Pick a participant`. The active roster is the Player option source. A Player
already selected in another slot is removed from the other slot’s options,
preventing a Player from appearing twice or on both sides.

Available Player options are sorted alphabetically using a locale-aware,
case-insensitive comparison. Removing selected Players or adding a retired
historical participant for Edit Match does not disturb that order. Guest remains
the separate final option when the current doubles rules allow it.

Opening a picker puts a Player search field first. The option list has a fixed
maximum height beneath that field and scrolls locally once the roster exceeds
it; the search remains visible while the results scroll. The native scrollbar
is hidden. A shadow appears at each edge only when more results exist in that
direction, disappearing at the full top or bottom. The popup is bounded to the
phone viewport and long option labels use an ellipsis.

In doubles, a slot may instead be changed to `Guest`, which reveals a
40-character Guest Name input. At most one Guest is available on each Side and
the other participant on that Side must remain a roster Player. Guests are not
offered in singles. A Guest Name is normalized like a Player Name and may not
collide with another Guest or any active or Retired roster Player.

When creating a match, the bound Logger is preselected in Side A’s first slot.
The Logger can still be changed because device binding is convenience identity,
not a restriction on who played.

When editing, the existing participants are prefilled. If one of those players
has since retired, that participant is added to the edit screen’s options so the
historical match remains editable.

### Winner selection

Show a `Winner` label and two side-by-side team actions around a centered `VS`.
Each participant occupies one single-line row inside their Side's action, so a
doubles team has exactly two name rows. A name that exceeds the available
half-width truncates with an ellipsis instead of wrapping or breaking. Empty
slots retain their row with a `Player 1` or `Player 2` placeholder. A Guest's
marker remains visible even when the Guest Name truncates.

Exactly one side must be selected. The selected side uses the selected-button
state; the other side remains unselected. There is no draw option.

### Set scores

Show a `Set scores` switch. It starts off, meaning the match is stored as a
Simple Result with only the winner.

When off, show helper text that only the winner will be recorded. When on,
show one score row initially. Each row contains:

- A set number label (`Set 1`, `Set 2`, etc.).
- A numeric games input for Side A.
- A separator.
- A numeric games input for Side B.
- A remove action once more than one set exists.

Provide an `Add set` action until five sets exist. Each score input accepts
whole numeric values from 0 through 99. Every visible score must be filled and
have a winner, and the selected Match winner must have won more sets. Set
scores are displayed later and produce the capped, sign-preserving Rating
dominance bonus.

### Played-at date and time

Show a `Played at` field using the browser’s native `datetime-local` input. On
new matches it defaults to the current device-local date and time. In a browser
or mobile OS this is the calendar/date-and-time picker affordance; there is no
separate calendar screen or date-range calendar in the current app.

Between the label and the input sits a `Now` button that resets the value to
the current device-local moment. It is always visible, never conditional: the
common case is logging courtside right after the match, and a shortcut that
appears only sometimes is one you have to hunt for.

When editing, prefill the existing match’s played timestamp, converted to the
device’s local time for the control. The saved value is sent back as an ISO
timestamp.

### Validation and submit

Before calling the server, the form checks:

- Every active participant slot has a selection.
- A winning side is selected.
- If set scores are enabled, every score row is complete.
- Every Side contains a Player and at most one Guest.
- Guest Names are valid and do not collide after normalization.
- Every set has a winner and agrees with the selected Match winner.

Show validation errors inline near the bottom of the form. The submit action is
full width and changes its label while pending:

- New match: `Logging…` then `Log match`.
- Edit: `Saving…` then `Save changes`.

Server validation can additionally reject invalid match IDs, timestamps,
duplicate players, unbalanced sides, or invalid score arrays. Surface the
returned message inline.

## Successful online submission: rating payoff

After a successful new match, replace the form with a result card:

- Title: `Match logged`.
- Subtitle: `Ratings have been updated.`
- One row per roster Player containing the name, exact integer Rating before,
  an arrow, exact integer Rating after, and the signed integer delta. Guests
  receive no Rating output and never appear in the payoff.
- A `Log another match` action that resets the form to its initial state. The
  Logger is prefilled again and the played-at value returns to now.

After a successful edit, use `Match updated` as the title. The payoff list is
the same, but the primary action is `Back to feed`, which navigates to `/`.

## Offline submission

Only creating a new match can be queued offline. Editing requires a connection.

When the create action is attempted while offline, or the action fails because
the server cannot be reached:

- Store the full match payload locally, including player names for rendering.
- Replace the form with a card titled `Match queued` and subtitle
  `You’re offline right now.`
- Explain that the match is safe on the device, will sync automatically when
  online, and will appear as pending sync in the Feed.
- Provide `Log another match`, which resets the form and permits another local
  match to be queued.

If an edit fails while offline, keep the form visible and show
`You’re offline — edits need a connection.`
