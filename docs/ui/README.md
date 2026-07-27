# PadelClash Lite UI inventory

This folder documents the UI that is currently implemented in the codebase. It
is intended as functional input for a redesign: preserve the behavior and
states described here, but do not treat the current typography, colors,
spacing, borders, or component styling as design requirements.

## Screen inventory

| Screen/view | Route | Purpose |
| --- | --- | --- |
| [Feed](feed.md) | `/` | Reverse-chronological match log and local pending-sync matches |
| [Log Match](log-match.md) | `/log` | Create a singles or doubles match, optionally record set scores, and show the rating payoff |
| [Leaderboard](leaderboard.md) | `/leaderboard` | Show active players, ratings, ranks, and W–L records |
| [Player Detail](player-detail.md) | `/players/:id` | Show one player’s rating, history, head-to-head, and doubles-partner statistics |
| [Edit Match](edit-match.md) | `/matches/:id/edit` | Correct a previously logged match or explain why it is locked |
| [Join / Bind Device](join-bind.md) | `/join/:token` | Explicitly join through a Personal or General Onboarding Link |
| [Admin Login](admin-login.md) | `/admin` when signed out | Authenticate the single administrator |
| [Admin Panel](admin-panel.md) | `/admin` when signed in | Manage Players, onboarding links, Device Bindings, and retirement |

## Reviewing these states

The states described in this folder are rendered from fixtures at `/dev/gallery`,
a route that exists only outside production (decisions 126–128,
[ADR 0004](../adr/0004-dev-only-ui-state-gallery.md)). It is the way to see a
blocked-sync card, an expired invitation, or a pending binding without
contriving server conditions.

| Section | Contents |
| --- | --- |
| `/dev/gallery/ds` | Every `src/components/ui/` primitive: variants × sizes × rest/focus/disabled/invalid, plus token swatches |
| `/dev/gallery/<screen>` | One screen's states, each in an iframe at 320 / 390 / 430 px |
| `/dev/gallery` | Index, plus component-level cases rendered inline |

The overview links the design system and every main view. Each screen document
names its gallery section, and the section renders its named states from
fixtures without querying application data.

Conventions:

- Each screen page here carries a **States** link to its gallery section, and
  each gallery section names this source document in its header. The two are
  written and reviewed together; a named state added in one without the other
  is a defect.
- Screen cases render in iframes because the tab bar is anchored to the viewport
  (decision 86) and horizontal page scroll is a defect (decision 88) — neither
  reports truthfully inline.
- Fixtures are deliberately abusive (very long names, three-digit deltas, five
  sets). They stress layout; they are not a truthful Rating history.
- Cases have stable ids in their URLs, so screenshot automation can be layered on
  later without redesigning the catalogue.

## Shared shell and global behavior

- The three main tabs are Feed, Log Match, and Leaderboard. They are represented
  by a bottom navigation bar with an icon and label for each tab.
- The tab bar is rendered by the `(tabs)` route layout. Consequently it also
  appears on Player Detail and Edit Match, because those routes live inside the
  same route group. Join and Admin are outside that group and do not show the
  tab bar.
- The bar’s geometry never changes between routes (spec decision 68). Every
  text tab reserves the active red band as a transparent top border, so
  switching sections changes colour only — including on Log Match, where
  neither text tab is active. One short upward shadow follows the combined
  silhouette of the bar and raised centre Log plate, rising around the plate
  before rejoining the bar. It is knowingly the one soft shadow treatment in
  an otherwise flat theme, kept tight so it reads as a lip rather than a glow.
- Spec decision 86 anchors the tab bar to the
  viewport rather than letting it participate in page scroll. Its controls sit
  above the bottom safe area and the tab shell reserves the full occupied
  height. Feed and Rankings use 14 px labels. Per decision 89, the active red
  rail reaches from the active outer tab to the navigation centreline beneath
  the raised Log plate, so the plate masks its inner end.
- Main tab content is a single centered column with a constrained maximum
  width. Each screen starts with a page heading and then stacks its content
  vertically. On larger screens the column remains narrow rather than becoming
  a multi-column desktop dashboard.
- Page-level horizontal scrolling is a mobile defect (spec decision 88).
  Individual controls may scroll only when that is an explicit part of their
  interaction; otherwise the overflowing element must be corrected at the
  supported phone widths.
- There is no separate global header, profile menu, or app-level settings
  screen. The page heading and the bottom tab bar form the primary shell.
- Player names are navigation targets wherever they appear in match cards,
  tables, and companion-stat tables. Selecting one opens Player Detail.
- The Device Binding is the Player authorization boundary. It identifies the
  Logger for newly logged Matches and marks that Player as “You”.
- A lost binding cookie requires Admin-assisted onboarding again; credentials
  and recovery markers are never stored in localStorage.
- The app has a service worker for the app shell and an offline write queue.
  Reading the feed, leaderboard, and player statistics still requires the
  server in v1.

## Domain rules that affect UI

- A match is either singles (1 player per side) or doubles (2 players per side).
- There is always exactly one winner. Draws are not supported.
- A match can store either no score detail (Simple Result) or 1–5 set scores.
  Set scores are displayed and contribute the sign-preserving dominance
  multiplier defined by the rating engine; the final rounded Player delta has
  no per-Match cap.
- Every match affects ratings. Ratings are derived by replaying the complete
  match log, so editing or deleting a match can change later ratings too.
- A player becomes ranked after 3 competitive matches. Players below that
  threshold still appear in the leaderboard but have no numeric rank.
- Active players appear in pickers and the leaderboard. Retired players remain
  reachable through history and player links, but disappear from active pickers
  and do not hold a leaderboard rank.
- The Logger may edit or delete their own match for 24 hours after it was
  logged. The admin may edit or delete any match at any age.
