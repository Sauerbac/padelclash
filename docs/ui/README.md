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
| [Join / Bind Device](join-bind.md) | `/join/:token` | Bind a device to a player through a personal invite link |
| [Admin Login](admin-login.md) | `/admin` when signed out | Authenticate the single administrator |
| [Admin Panel](admin-panel.md) | `/admin` when signed in | Manage players, join links, retirement, and the name-picker setting |

## Shared shell and global behavior

- The three main tabs are Feed, Log Match, and Leaderboard. They are represented
  by a bottom navigation bar with an icon and label for each tab.
- The tab bar is rendered by the `(tabs)` route layout. Consequently it also
  appears on Player Detail and Edit Match, because those routes live inside the
  same route group. Join and Admin are outside that group and do not show the
  tab bar.
- Main tab content is a single centered column with a constrained maximum
  width. Each screen starts with a page heading and then stacks its content
  vertically. On larger screens the column remains narrow rather than becoming
  a multi-column desktop dashboard.
- There is no separate global header, profile menu, or app-level settings
  screen. The page heading and the bottom tab bar form the primary shell.
- Player names are navigation targets wherever they appear in match cards,
  tables, and companion-stat tables. Selecting one opens Player Detail.
- The device binding is convenience identity. A bound device identifies the
  Logger for newly logged matches and marks that player as “You”; it is not a
  permission boundary.
- A lost binding cookie can be silently restored from a local recovery marker.
  This happens globally and has no visible screen of its own unless the repair
  fails and the user remains unbound.
- The app has a service worker for the app shell and an offline write queue.
  Reading the feed, leaderboard, and player statistics still requires the
  server in v1.

## Domain rules that affect UI

- A match is either singles (1 player per side) or doubles (2 players per side).
- There is always exactly one winner. Draws are not supported.
- A match can store either no score detail (Simple Result) or 1–5 set scores.
  Set scores are displayed but do not affect Elo in v1.
- Every match affects ratings. Ratings are derived by replaying the complete
  match log, so editing or deleting a match can change later ratings too.
- A player becomes ranked after 3 competitive matches. Players below that
  threshold still appear in the leaderboard but have no numeric rank.
- Active players appear in pickers and the leaderboard. Retired players remain
  reachable through history and player links, but disappear from active pickers
  and do not hold a leaderboard rank.
- The Logger may edit or delete their own match for 24 hours after it was
  logged. The admin may edit or delete any match at any age.

