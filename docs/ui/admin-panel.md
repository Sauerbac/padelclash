# Admin Panel

**States: [`/dev/gallery/admin`](../../src/app/dev/gallery/[section]/page.tsx)** —
login plus empty and populated panels with an exhaustive `PlayerStatus` fixture
map.

## Identity

- Route: `/admin` when the admin session is valid
- Main implementation: `src/app/admin/page.tsx`
- Player management UI: `src/components/admin/player-row.tsx`,
  `src/components/admin/create-player-form.tsx`

## Purpose

Provide the admin-only management surface for the fixed circle. It manages the
roster, Personal Onboarding Links, the General Onboarding Link, Device Bindings,
retirement, restoration, and safe deletion.

## Current structural layout

The page is a single constrained vertical column with:

1. A top row containing the `Admin` heading and a `Log out` action.
2. General onboarding-link controls.
3. Add Player form.
4. Joined, Not Joined, and Retired roster groups.

This is a standalone admin surface and does not show the main bottom tab bar.
There is no admin dashboard, analytics summary, match-management table, or
navigation sidebar.

## Header and logout

The top row shows the page title `Admin` and a `Log out` form action. Logging out
ends the admin session and refreshes the page back to Admin Login.

### Create player

At the top of the section, show a compact create form with:

- A required text input with placeholder `New player name`.
- An `Add` submit action in the same horizontal control row.

On success, clear the input and refresh the grouped roster. A blank name
produces the inline error `Name must not be blank`.

### Player list and row behavior

Render Players in three status groups — Joined, Not Joined, Retired — preserving
roster order inside each group. Every row contains:

1. A text input prefilled with the player’s current name.
2. A `Rename` action beside it.
3. An on-demand Device history disclosure.
4. Status-specific controls.

Joined rows show active binding timestamps and offer `Replace device`, `Revoke
access`, and `Retire`. Not Joined rows offer `Invite` or `New invite`, plus Copy
and Revoke while a Personal Link is live, and `Retire`. Retired rows carry the
status badge and offer `Restore`. Any Player with no Match references also
offers permanent `Delete`.

Destructive and replacement actions use confirmation dialogs. Copy controls
write the absolute `/join/:token` URL and fall back to a prompt when the
Clipboard API is unavailable.

## Onboarding section

The General Onboarding Link card shows no link, a live countdown with Copy and
Revoke controls, or an expired state. Generating a link copies it immediately.
Personal links live on the relevant Not Joined or Joined Player row and remain
independent of names.

## Permissions and failure behavior

All admin actions are rechecked server-side. A direct request without an admin
session must never expose the management controls. The current page has no
custom inline error presentation for every possible action failure; redesign
work should preserve the action semantics while making failures visible and
recoverable.
