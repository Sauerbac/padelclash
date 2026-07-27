# Edit Match

**States: [`/dev/gallery/edit`](../../src/app/dev/gallery/[section]/page.tsx)** —
editable, locked and successful-correction states through the shared form.

## Identity

- Route: `/matches/:id/edit`
- Entry point: edit action on an editable Feed or Player Detail match card
- Main implementation: `src/app/(tabs)/matches/[id]/edit/page.tsx`
- Form implementation: `src/components/match-form.tsx`

## Purpose

Correct the recorded participants, side composition, winner, set scores, or
played-at timestamp of an existing match. Saving replays the complete match log
and can therefore change the rating history of later matches.

## Current structural layout

### Editable state

1. Page heading: `Edit Match`.
2. The same match form used by Log Match, prefilled with the existing match.
3. On successful save, the form is replaced by the rating-payoff result card.
4. The shared bottom tab bar remains visible.

There is no separate edit-specific arrangement of fields. The redesign should
keep the distinction between creating a match and correcting one in the screen
title, submit label, success title, and navigation outcome.

### Locked state

If the viewer lacks rights, do not render editable controls. Show a card titled
`This match is locked` and explain:

`Only the player who logged a match can edit it, and only within 24 hours. Ask the group admin to fix it.`

The same permission rule applies to deletion. The server enforces it even if a
client reaches this URL directly.

## Prefilled fields

- Singles/doubles mode is inferred from whether Side A has one or two players.
- All existing participant slots are filled.
- The existing winner side is selected.
- Existing set scores enable the set-score section and populate its rows;
  Simple Results leave it off.
- The existing played-at timestamp populates the native `datetime-local`
  calendar/date-and-time control in local device time.

The picker options include all active players plus any participant from this
match who has since retired. This prevents a historical slot from becoming
unrenderable after retirement.

## Save and result behavior

The submit action is labeled `Save changes`, changing to `Saving…` while the
server action is pending. Validation is the same as Log Match. On success:

- Show `Match updated` and `Ratings have been updated.`
- List every participant’s rating before, rating after, and signed delta.
- Provide `Back to feed`, which navigates to `/`.

On a server error, keep the form and show the error inline. An offline edit is
not queued; show `You’re offline — edits need a connection.`

## Missing match

An unknown or malformed match ID renders the framework’s not-found view. It is
not treated as an empty edit form.
