# Admin Panel

## Identity

- Route: `/admin` when the admin session is valid
- Main implementation: `src/app/admin/page.tsx`
- Player management UI: `src/components/admin/player-row.tsx`,
  `src/components/admin/create-player-form.tsx`
- Settings UI: `src/components/admin/name-picker-toggle.tsx`

## Purpose

Provide the admin-only management surface for the fixed circle. It manages the
roster and device-binding links, and controls whether unbound devices may use
the fallback name picker.

## Current structural layout

The page is a single constrained vertical column with:

1. A top row containing the `Admin` heading and a `Log out` action.
2. A `Players` management section.
3. A `Settings` section containing the name-picker setting.

This is a standalone admin surface and does not show the main bottom tab bar.
There is no admin dashboard, analytics summary, match-management table, or
navigation sidebar.

## Header and logout

The top row shows the page title `Admin` and a `Log out` form action. Logging out
ends the admin session and refreshes the page back to Admin Login.

## Players section

The section title is `Players`. Its description explains that an individual
join link binds a player’s device and that rotating a link invalidates the old
link.

### Create player

At the top of the section, show a compact create form with:

- A required text input with placeholder `New player name`.
- An `Add` submit action in the same horizontal control row.

On success, clear the input and refresh the player list. A blank name produces
the inline error `Name must not be blank`.

If there are no players, show `No players yet.` below the create form.

### Player list and row behavior

Render all players in creation order, including retired players. Each row
contains the following controls for an active player:

1. A text input prefilled with the player’s current name.
2. A `Rename` action beside the input. Blank rename submissions are ignored.
3. `Copy join link`, which copies the absolute `/join/:token` URL. If the
   clipboard API is unavailable, show the URL in a prompt as a fallback. The
   button briefly changes to `Copied!` after success.
4. `Rotate link`, guarded by confirmation. The confirmation must explain that
   the old link stops working but devices already bound remain bound.
5. `Retire`, guarded by confirmation. The confirmation must explain that the
   player disappears from pickers, their devices unbind, and their match
   history remains.

The rename control and link actions are independent forms/actions. The admin
can rename without rotating the token and rotate without renaming.

For a retired player:

- Keep the row visible so old history remains understandable.
- Keep the name visible but disable the name input.
- Replace the rename/link/retire controls with a `Retired` status badge.

Retirement is one-way in the current admin UI; there is no unretire action.

## Settings section

The section title is `Settings`. It contains a `Name picker` switch with:

- A label and explanatory text: unbound devices may choose a roster name when
  enabled; this is useful for onboarding evenings and should otherwise be left
  off.
- A switch reflecting the current setting.
- A pending/disabled state while the server action is running.

Changing the switch immediately persists the setting and refreshes both Admin
and the Feed, because the Feed’s unbound-device state depends on it.

## Permissions and failure behavior

All admin actions are rechecked server-side. A direct request without an admin
session must never expose the management controls. The current page has no
custom inline error presentation for every possible action failure; redesign
work should preserve the action semantics while making failures visible and
recoverable.

