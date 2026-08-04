# Admin Roster Redesign

**Status:** Approved design direction; not yet implemented  
**Date:** 2026-08-04  
**Primary viewport:** installed mobile PWA at 320, 390, and 430 px widths

## Brief

Redesign the roster portion of the Admin Panel so a circle with 11 or more
active Players remains easy to scan. The page should read as a compact Player
index until the Admin chooses one person to manage.

The General Onboarding Link and Add Player sections are already useful and
remain at the top in their current order. The redesign starts immediately
below them.

## Goals

- Make the full roster scannable without showing every management control at
  once.
- Let the Admin find a Player by name across every status group.
- Keep every existing Player-management capability and safety confirmation.
- Use one predictable interaction model on narrow phones and wider screens.
- Order names consistently where the Admin manages Players and where a Logger
  selects match participants.

## Non-goals

- Do not redesign Admin authentication, the page header, General Onboarding,
  or Add Player.
- Do not add a dashboard, sidebar, analytics, bulk actions, status filters, or
  new roster states.
- Do not change invitation, Device Binding, retirement, restoration, deletion,
  or authorization rules.
- Do not change Guest behavior.
- Do not alter Leaderboard, Feed, or match-history ordering.

## Page hierarchy

Keep the page as one mobile-first, constrained vertical column:

1. Existing Admin header with `Back to app` and `Log out`.
2. Existing General Onboarding Link section.
3. Existing Add Player section.
4. New roster search.
5. Joined group.
6. Not Joined group.
7. Retired group.

The roster search belongs directly above the groups it controls. It scrolls
with the page; it is not sticky.

## Roster search

### Control

- Use one full-width search field with the visible or accessible label
  `Search players` and placeholder `Search players…`.
- Filter immediately while the Admin types. There is no submit button.
- Match Player Names only, using case-insensitive substring matching.
- Ignore leading and trailing whitespace in the query.
- Show a clear control inside or beside the field whenever it contains text.
- General Onboarding, Add Player, actions, dates, and Device history are never
  search targets and never disappear because of a query.

### Results

- Search all three groups at once: Joined, Not Joined, and Retired.
- Preserve the Player's status group; do not merge results into a fourth flat
  list.
- Hide a group entirely when it has no matches during an active search.
- If no Player matches anywhere, replace all three groups with one message:
  `No players found`.
- Without a query, a heading shows its total, for example `Joined · 11`.
- During a query, a visible heading shows matching and total counts, for
  example `Joined · 2 of 11`.
- Clearing the query restores all groups and their ordinary empty states.

Search state should survive roster refreshes caused by management actions as
long as the Admin remains on the page. A full navigation or logout may reset
it.

## Group behavior

- Keep the group order `Joined`, `Not Joined`, `Retired`.
- All groups remain visibly open in the ordinary roster view. There is no
  group-level accordion.
- Sort Player Names alphabetically within each group using a locale-aware,
  case-insensitive comparison. Display the original Player Name unchanged.
- Keep the existing group descriptions and empty-state meaning, but the
  designer may shorten their presentation if the wording remains clear.

## Player row

### Collapsed state

A collapsed row contains only:

- the Player Name; and
- a small expand chevron.

Do not show a badge, timestamp, invitation state, input, action, or Device
history link while collapsed. The enclosing group already communicates the
Player's status.

The whole row is the disclosure button, not just the chevron. Give it at least
a 44 px touch target. The name truncates with an ellipsis rather than creating
horizontal page overflow. The chevron remains visible and rotates or otherwise
changes direction when the row opens.

### Accordion behavior

- At most one Player is expanded across the entire roster, including across
  different status groups.
- Opening one Player closes the previously open Player.
- Pressing the open Player's row closes it, so zero open Players is valid.
- Opening and closing must not scroll the page unexpectedly.
- If search filters the expanded Player out, close that Player. Do not reopen
  them automatically when the query is cleared.
- If the expanded Player still matches, keep them open while filtering.

### Expanded state

The expanded area is visually attached to its Player row. It exposes the same
management information and actions as the current implementation; disclosure
changes, capabilities do not.

Use this content hierarchy:

1. Rename field and `Rename` action.
2. Current status details, such as binding creation/last-seen timestamps or a
   live Personal Onboarding Link expiry.
3. `Device history` disclosure.
4. Status-appropriate management actions.
5. Inline error feedback, when an action fails.

Keep Device history as a second, on-demand disclosure. Expanding a Player must
not automatically fetch or reveal past Device Bindings.

#### Joined Player actions

- Copy a live Personal Link, when one exists.
- `Replace device`.
- Revoke a live Personal Link, when one exists.
- `Revoke access`.
- `Retire`.
- `Delete`, only when the Player is currently deletable.

Show the active Device Binding's creation and last-seen timestamps. Show a live
Personal Link expiry when a replacement invitation exists.

#### Not Joined Player actions

- Copy a live Personal Link, when one exists.
- `Invite`, or `New invite` when replacing a live link.
- Revoke a live Personal Link, when one exists.
- `Retire`.
- `Delete`, only when the Player is currently deletable.

Show a live Personal Link expiry when one exists.

#### Retired Player actions

- `Restore`.
- `Delete`, only when the Player is currently deletable.

The group communicates `Retired`; the expanded panel does not need to repeat a
Retired badge unless the final visual treatment requires it for clarity.

### Action outcomes

- Keep existing confirmation dialogs for destructive and device-replacement
  actions.
- An action's pending state disables the relevant controls without collapsing
  the Player.
- An action error appears inside the expanded area and leaves it open.
- After a successful rename, reapply alphabetical ordering and the current
  search query. Keep the Player expanded if the renamed Player still matches.
- After revoke, retire, or restore changes a Player's group, keep that Player
  expanded at their new alphabetical position if they still match the query.
- After deletion, remove the Player and close the disclosure. Move focus to the
  next sensible Player row, the group heading, or the roster search if no row
  remains.

## Visual direction

This brief defines structure and behavior, not a finished aesthetic. The
designer should preserve PadelClash's existing typography, color tokens,
borders, and compact mobile character.

The intended visual rhythm is:

- quiet, index-like collapsed rows;
- strong category headings and useful counts;
- one clearly active expanded management surface;
- enough separation that the expanded content cannot be mistaken for the next
  Player; and
- no extra ornament competing with destructive actions.

Use the existing Player Name casing treatment for display, without modifying
the stored name. Actions may wrap within the expanded panel on narrow phones;
the page itself must never scroll horizontally. Any opening animation should
be short and respect reduced-motion preferences.

## Accessibility and keyboard behavior

- Implement each collapsed row as a real button or an equivalent disclosure
  trigger with `aria-expanded` and `aria-controls`.
- The visible Player Name is the trigger's accessible name; the chevron is
  decorative.
- Support Enter and Space to toggle a Player.
- Keep focus on the trigger when it opens or closes. Do not move focus into the
  panel automatically.
- Give the search field a programmatic label and its clear control an
  unambiguous accessible name such as `Clear player search`.
- Announce the result count or `No players found` state without reading the
  entire result list after every keystroke.
- Preserve logical tab order through the open panel before moving to the next
  Player.
- Confirmation dialogs retain focus trapping and return focus to their
  initiating action when dismissed.

## Related Player-picker ordering

The same alphabetical principle applies to participant selection:

- Log Match participant pickers list available roster Players alphabetically.
- Edit Match uses the shared form and therefore follows the same ordering,
  including any retired historical participant added back to the available
  options.
- Removing Players already selected in another slot must not disturb the order
  of the remaining options.
- Search results inside a participant picker preserve alphabetical order.

This does not change the existing picker search, scrolling, Guest option, or
selection rules.

## Required design states

The designer should provide mobile layouts at 320, 390, and 430 px for:

1. Populated roster with at least 11 Joined Players, all rows collapsed.
2. One Joined Player expanded.
3. One Not Joined Player expanded with a live Personal Link.
4. One Retired Player expanded.
5. Search matching Players in more than one group.
6. Search matching Players in only one group.
7. Search with no results.
8. Long Player Name in collapsed and expanded states.
9. Inline Player-action failure.
10. Empty roster, preserving the existing empty-group behavior.

## Implementation and gallery handoff

When this design is implemented:

- Keep the `/admin` async loader plus pure view split.
- Keep every interactive server-action prop optional and defaulted to its real
  import; gallery fixtures continue to pass stubs.
- Add the altered search, collapsed, expanded, and empty states to
  `/dev/gallery/admin` in the same commit as the UI change.
- Retain the exhaustive `Record<PlayerStatus, RosterEntry>` coverage for
  status-specific expanded content.
- Update `docs/ui/admin-panel.md` and `docs/ui/log-match.md` in that same commit
  so those files continue to describe the implemented gallery rather than this
  future design.

## Acceptance criteria

- A roster with 11 or more Joined Players initially shows one compact name row
  per Player and no management controls.
- Exactly zero or one Player is expanded across the whole roster.
- Expanding a Player exposes every action currently available for that status.
- Search filters Player Names immediately across all three groups and never
  affects the two global actions above it.
- Zero-match groups disappear during search; a global miss shows one empty
  result state.
- Admin group names and Log/Edit Match picker options are alphabetical.
- All states fit 320, 390, and 430 px without page-level horizontal overflow.
- Authorization, confirmation, invitation, Device Binding, and lifecycle
  semantics are unchanged.

