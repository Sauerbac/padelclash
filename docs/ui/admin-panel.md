# Admin Panel

**States: [`/dev/gallery/admin`](../../src/app/dev/gallery/[section]/page.tsx)** —
login, compact roster, search, disclosure, action failure, empty and populated
states, with an exhaustive `PlayerStatus` fixture map.

## Identity

- Route: `/admin` when the admin session is valid
- Main implementation: `src/app/admin/page.tsx`
- View and roster controller: `src/components/admin-view.tsx`,
  `src/components/admin/admin-roster.tsx`
- Player management panel: `src/components/admin/player-row.tsx`

## Purpose

Provide the admin-only management surface for the fixed circle. It manages the
roster, Personal Onboarding Links, the General Onboarding Link, Device Bindings,
retirement, restoration, safe deletion, and convenient database backup
downloads.

## Current structural layout

The page is a single constrained vertical column with:

1. The `Admin` header with `Back to app` and `Log out`.
2. General onboarding-link controls.
3. Add Player form.
4. A live `Search players…` field.
5. Joined, Not Joined, and Retired roster groups.
6. The `Database backup` section.

This is a standalone admin surface and does not show the main bottom tab bar.
There is no admin dashboard, analytics summary, match-management table, or
navigation sidebar.

## Search and groups

Search filters Player Names immediately using a trimmed, case-insensitive
substring match across Joined, Not Joined, and Retired. The search state does
not affect General Onboarding or Add Player. A clear control appears whenever
the field contains text, and a result count is announced without reading the
whole roster. During a search, groups with no matches are hidden; a global miss
shows `No players found`. Clearing the search restores each group and its empty
state.

Groups remain open and are ordered Joined, Not Joined, Retired. Names are
sorted alphabetically with a locale-aware, case-insensitive comparison. Group
headings show `Joined · 11` normally and `Joined · 2 of 11` while searching.

## Player rows

Rows start collapsed as compact disclosure buttons containing only the stored
Player Name and a chevron. The name truncates instead of widening the page.
Enter and Space work through the native button semantics, and `aria-expanded`
plus `aria-controls` describe the attached panel. One shared accordion permits
zero or one expanded Player across all groups; opening another closes the
previous row. Filtering an expanded Player out closes it, while a matching
Player stays expanded through roster refreshes.

The expanded panel keeps the existing management semantics and presents:

1. Rename field and `Rename` action.
2. Binding timestamps or a live Personal Link expiry.
3. On-demand `Device history` disclosure.
4. Status-appropriate invite, device, access, lifecycle and conditional Delete
   actions.
5. Inline action errors.

Joined rows show active binding timestamps and offer `Replace device`, `Revoke
access`, and `Retire`. Not Joined rows offer `Invite` or `New invite`, plus Copy
and Revoke while a Personal Link is live, and `Retire`. Retired rows offer
`Restore`. Any Player with no Match references also offers permanent `Delete`.
Pending controls are disabled without collapsing the row. Destructive and
replacement actions retain their confirmation dialogs. After deletion, focus
returns to the next remaining Player row, the previous row, or the search field
when the roster is empty.

## Onboarding section

The General Onboarding Link card shows no link, a live countdown with Copy and
Revoke controls, or an expired state. Generating a link copies it immediately.
Personal links live on the relevant Not Joined or Joined Player panel and
remain independent of names.

## Database backup

The final section is deliberately separate from roster management. It says
that the archive contains all private PadelClash data and should be kept on an
encrypted device, then offers one `Download backup` action. A valid Admin
session is sufficient; the password is not requested again.

Each click prepares a fresh PostgreSQL custom-format dump. While the server is
preparing and validating it, the action is disabled and communicates its busy
state. Failure appears inline with a retry path and no raw command output. A
successful response starts the browser download using the strict UTC filename
`padelclash-YYYYMMDDTHHMMSSZ.dump`. The UI does not claim that the browser saved
the file and does not show a last-backup date.

The section does not list automated backups and has no upload or restore
control. Idle, preparing, and failure fixtures live in the Admin gallery; the
browser's native download UI is not simulated.

## Permissions and failure behavior

All admin actions are rechecked server-side. A direct request without an admin
session must never expose the management controls. Action failures stay inside
the open Player panel and leave the current disclosure and search state usable.
