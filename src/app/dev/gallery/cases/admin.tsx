import type { PlayerStatus } from "@/domain/onboarding";
import type { DatabaseBackupState } from "@/components/admin/database-backup-control";
import type { AdminRoster, RosterEntry } from "@/services/players";
import {
  FixtureAdminCreateError,
  FixtureAdminCreateSuccess,
  FixtureAdminActionFailure,
  FixtureAdminLoginState,
  FixtureAdminLogoutConfirmation,
  FixtureAdminView as AdminView,
} from "../screen-fixtures-client";
import type { ScreenCase } from "../screen-cases";
import { INGRID, inert, LONG, NOW, YOU } from "./shared";

const rosterEntryForStatus = (
  status: PlayerStatus,
  overrides: Partial<RosterEntry> = {},
): RosterEntry => ({
  id:
    status === "joined"
      ? YOU.id
      : status === "not-joined"
        ? LONG.id
        : INGRID.id,
  name:
    status === "joined"
      ? YOU.name
      : status === "not-joined"
        ? LONG.name
        : INGRID.name,
  status,
  binding:
    status === "joined"
      ? {
          createdAt: new Date("2026-07-20T18:00:00Z"),
          lastSeenAt: new Date("2026-07-27T20:30:00Z"),
        }
      : null,
  personalLink:
    status === "not-joined"
      ? {
          token: "fixture-personal-token",
          expiresAt: new Date("2026-08-03T21:00:00Z"),
        }
      : null,
  deletable: status !== "joined",
  ...overrides,
});

export const ADMIN_ENTRY_BY_STATUS: Record<PlayerStatus, RosterEntry> = {
  joined: rosterEntryForStatus("joined"),
  "not-joined": rosterEntryForStatus("not-joined"),
  retired: rosterEntryForStatus("retired"),
};

const ADMIN_ROSTER: AdminRoster = {
  joined: [ADMIN_ENTRY_BY_STATUS.joined],
  notJoined: [ADMIN_ENTRY_BY_STATUS["not-joined"]],
  retired: [ADMIN_ENTRY_BY_STATUS.retired],
};

const makeJoinedEntry = (index: number, name: string): RosterEntry => ({
  id: `66666666-6666-7666-8666-${String(index).padStart(12, "0")}`,
  name,
  status: "joined",
  binding: {
    createdAt: new Date("2026-07-20T18:00:00Z"),
    lastSeenAt: new Date("2026-07-27T20:30:00Z"),
  },
  personalLink: null,
  deletable: false,
});

const MANY_JOINED_ROSTER: AdminRoster = {
  joined: [
    "Zelda",
    "alice",
    "Maya",
    "Noah",
    "Luca",
    "Rosa",
    "Theo",
    "Béa",
    "Kian",
    "Oliver",
    "Pia",
  ].map((name, index) => makeJoinedEntry(index + 1, name)),
  notJoined: [],
  retired: [],
};

const SEARCH_ROSTER: AdminRoster = {
  joined: [rosterEntryForStatus("joined", { name: "Alice Anderton" })],
  notJoined: [rosterEntryForStatus("not-joined", { name: "Alex Invitee" })],
  retired: [rosterEntryForStatus("retired", { name: "Alfred Retired" })],
};

const LONG_NAME_ROSTER: AdminRoster = {
  joined: [
    rosterEntryForStatus("joined", {
      id: LONG.id,
      name: LONG.name,
    }),
  ],
  notJoined: [],
  retired: [],
};

const FAILURE_ROSTER: AdminRoster = {
  joined: [rosterEntryForStatus("joined", { name: "Rename Failure" })],
  notJoined: [],
  retired: [],
};

const DATABASE_BACKUP_CASES: Record<DatabaseBackupState, ScreenCase> = {
  idle: {
    title: "Database backup idle",
    note: "The final Admin tools zone warns about private data, offers one download action, and keeps Log out nearby.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={{ joined: [], notJoined: [], retired: [] }}
          generalLink={null}
          now={NOW}
          initialBackupState="idle"
        />,
      ),
  },
  preparing: {
    title: "Database backup preparing",
    note: "The action is disabled and communicates that generation and validation are in progress.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={{ joined: [], notJoined: [], retired: [] }}
          generalLink={null}
          now={NOW}
          initialBackupState="preparing"
        />,
      ),
  },
  failure: {
    title: "Database backup failure",
    note: "A sanitized inline failure leaves the download action available as a retry path.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={{ joined: [], notJoined: [], retired: [] }}
          generalLink={null}
          now={NOW}
          initialBackupState="failure"
        />,
      ),
  },
};

export const ADMIN_CASES: Record<string, ScreenCase> = {
  "backup-idle": DATABASE_BACKUP_CASES.idle,
  "backup-preparing": DATABASE_BACKUP_CASES.preparing,
  "backup-failure": DATABASE_BACKUP_CASES.failure,
  login: {
    title: "Signed out",
    note: "Standalone password form with no application tab bar.",
    render: () => inert(<AdminView state="login" />),
  },
  "login-wrong-password": {
    title: "Wrong Admin password",
    note: "The password stays available and the server refusal is inline.",
    render: () => <FixtureAdminLoginState scenario="wrong-password" />,
  },
  "login-not-configured": {
    title: "Admin login not configured",
    note: "Missing ADMIN_PASSWORD is distinct from an incorrect password.",
    render: () => <FixtureAdminLoginState scenario="not-configured" />,
  },
  "login-pending": {
    title: "Admin authentication pending",
    note: "Checking… replaces the submit label and the action is disabled.",
    render: () => <FixtureAdminLoginState scenario="pending" />,
  },
  "logout-confirmation": {
    title: "Log out confirmation",
    note: "Log out requires an explicit confirmation and warns that the Admin password is needed to return.",
    render: () => (
      <FixtureAdminLogoutConfirmation
        state="panel"
        roster={ADMIN_ROSTER}
        generalLink={null}
        now={NOW}
      />
    ),
  },
  panel: {
    title: "Admin Panel with every Player status",
    note: "The exhaustive PlayerStatus fixtures render Joined, Not Joined and Retired rows together, initially collapsed.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={{
            token: "fixture-general-token",
            expiresAt: new Date("2026-07-28T09:00:00Z"),
          }}
          now={NOW}
        />,
      ),
  },
  "many-joined-collapsed": {
    title: "Admin roster with 11 Joined Players",
    note: "The ordinary roster view is a compact alphabetical Player index with every row collapsed.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={MANY_JOINED_ROSTER}
          generalLink={null}
          now={NOW}
        />,
      ),
  },
  interactive: {
    title: "Interactive Admin roster",
    note: "Stubbed gallery actions keep this case safe to drive while checking the shared accordion, search and keyboard behavior.",
    render: () => (
      <AdminView
        state="panel"
        roster={MANY_JOINED_ROSTER}
        generalLink={null}
        now={NOW}
      />
    ),
  },
  "joined-expanded": {
    title: "Expanded Joined Player",
    note: "The shared accordion exposes binding details, Device history and Joined actions.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={null}
          now={NOW}
          initialExpandedPlayerId={ADMIN_ENTRY_BY_STATUS.joined.id}
        />,
      ),
  },
  "not-joined-expanded": {
    title: "Expanded Not Joined Player",
    note: "A live Personal Link and invite controls remain inside the expanded panel.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={null}
          now={NOW}
          initialExpandedPlayerId={ADMIN_ENTRY_BY_STATUS["not-joined"].id}
        />,
      ),
  },
  "retired-expanded": {
    title: "Expanded Retired Player",
    note: "Retired Players keep their history and expose Restore plus conditional Delete.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={null}
          now={NOW}
          initialExpandedPlayerId={ADMIN_ENTRY_BY_STATUS.retired.id}
        />,
      ),
  },
  "search-multiple-groups": {
    title: "Roster search across groups",
    note: "One case-insensitive query matches Joined, Not Joined and Retired without merging their groups.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={SEARCH_ROSTER}
          generalLink={null}
          now={NOW}
          initialRosterSearch="al"
        />,
      ),
  },
  "search-single-group": {
    title: "Roster search with one matching group",
    note: "Groups with no matching Players disappear while the matching group keeps its total count.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={SEARCH_ROSTER}
          generalLink={null}
          now={NOW}
          initialRosterSearch="alice"
        />
      ),
  },
  "search-no-results": {
    title: "Roster search with no results",
    note: "A global miss replaces all three status groups with one no-results message.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={null}
          now={NOW}
          initialRosterSearch="nobody"
        />
      ),
  },
  "long-name": {
    title: "Long Player Name in the roster",
    note: "Collapsed names truncate while the expanded management surface remains within the phone width.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={LONG_NAME_ROSTER}
          generalLink={null}
          now={NOW}
          initialExpandedPlayerId={LONG.id}
        />
      ),
  },
  "long-name-collapsed": {
    title: "Collapsed long Player Name",
    note: "The same long stored name truncates in the compact disclosure row before it is opened.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={LONG_NAME_ROSTER}
          generalLink={null}
          now={NOW}
        />
      ),
  },
  "action-failure": {
    title: "Inline Player action failure",
    note: "A failed rename stays inside the expanded Player panel without closing it.",
    render: () => (
      <FixtureAdminActionFailure
        state="panel"
        roster={FAILURE_ROSTER}
        generalLink={null}
        now={NOW}
        initialExpandedPlayerId={FAILURE_ROSTER.joined[0].id}
      />
    ),
  },
  empty: {
    title: "Admin Panel without Players or a live link",
    note: "Every roster group and the onboarding control show their empty state.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={{ joined: [], notJoined: [], retired: [] }}
          generalLink={null}
          now={NOW}
        />,
      ),
  },
  "blank-player-name": {
    title: "Create Player validation failure",
    note: "The Add form keeps its controls and shows Name must not be blank inline.",
    render: () => (
      <FixtureAdminCreateError
        state="panel"
        roster={ADMIN_ROSTER}
        generalLink={null}
        now={NOW}
      />
    ),
  },
  "new-player-created": {
    title: "Newly created Player",
    note: "The new Player stays beneath Add a player in a permanently open management panel and is absent from the ordinary roster until the next page visit.",
    render: () => (
      <FixtureAdminCreateSuccess
        state="panel"
        roster={ADMIN_ROSTER}
        generalLink={null}
        now={NOW}
        player={{
          id: ADMIN_ENTRY_BY_STATUS["not-joined"].id,
          name: ADMIN_ENTRY_BY_STATUS["not-joined"].name,
        }}
      />
    ),
  },
  "expired-general-link": {
    title: "Expired General Onboarding Link",
    note: "Copy and Revoke disappear once the server-measured lifetime reaches zero.",
    render: () =>
      inert(
        <AdminView
          state="panel"
          roster={ADMIN_ROSTER}
          generalLink={{
            token: "fixture-expired-general-token",
            expiresAt: new Date("2026-07-27T20:00:00Z"),
          }}
          now={NOW}
        />,
      ),
  },
};
