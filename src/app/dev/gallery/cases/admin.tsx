import type { PlayerStatus } from "@/domain/onboarding";
import type { AdminRoster, RosterEntry } from "@/services/players";
import {
  FixtureAdminCreateError,
  FixtureAdminLoginState,
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

export const ADMIN_CASES: Record<string, ScreenCase> = {
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
  panel: {
    title: "Admin Panel with every Player status",
    note: "The exhaustive PlayerStatus fixtures render Joined, Not Joined and Retired controls together.",
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
