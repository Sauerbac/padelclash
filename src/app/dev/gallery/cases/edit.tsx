import type { EditableMatch } from "@/components/match-form";
import { TabShell } from "@/components/tab-shell";
import {
  FixtureEditActionState,
  FixtureEditMatchView as EditMatchView,
} from "../screen-fixtures-client";
import type { ScreenCase } from "../screen-cases";
import {
  CASEY,
  FEED,
  inert,
  LONG,
  PAYOFF,
  RESERVED_NAMES,
  ROSTER,
  YOU,
} from "./shared";

const EDITING: EditableMatch = {
  id: FEED[0].id,
  playedAtIso: FEED[0].playedAt.toISOString(),
  sides: {
    A: [
      { kind: "player", playerId: YOU.id },
      { kind: "player", playerId: LONG.id },
    ],
    B: [
      { kind: "player", playerId: CASEY.id },
      { kind: "guest", name: "Mira" },
    ],
  },
  winnerSide: "A",
  sets: [
    { a: 6, b: 4 },
    { a: 7, b: 5 },
  ],
};

const editable = () => (
  <EditMatchView
    state="editable"
    roster={ROSTER}
    reservedPlayerNames={RESERVED_NAMES}
    editing={EDITING}
  />
);

const actionState = (
  scenario: "pending" | "refused" | "success" | "offline",
) => (
  <FixtureEditActionState
    scenario={scenario}
    payoff={PAYOFF}
    roster={ROSTER}
    reservedPlayerNames={RESERVED_NAMES}
    editing={EDITING}
  />
);

export const EDIT_CASES: Record<string, ScreenCase> = {
  editable: {
    title: "Editable Match",
    note: "The shared form is prefilled with doubles, a Guest, winner, sets and played time.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        {inert(editable())}
      </TabShell>
    ),
  },
  locked: {
    title: "Permission-locked Match",
    note: "Direct navigation without edit rights exposes no form controls.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        <EditMatchView state="locked" />
      </TabShell>
    ),
  },
  updated: {
    title: "Successful correction",
    note: "The edit payoff uses Match updated and returns to the Feed.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        {actionState("success")}
      </TabShell>
    ),
  },
  pending: {
    title: "Correction pending",
    note: "The shared form freezes on Saving… while the online edit is in flight.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        {actionState("pending")}
      </TabShell>
    ),
  },
  "server-error": {
    title: "Correction refused by the server",
    note: "The prefilled form stays visible with its actionable inline error.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        {actionState("refused")}
      </TabShell>
    ),
  },
  "offline-error": {
    title: "Offline correction refused",
    note: "Edits never enter the offline queue; the form explains that a connection is required.",
    render: () => (
      <TabShell pathname={`/matches/${EDITING.id}/edit`}>
        {actionState("offline")}
      </TabShell>
    ),
  },
};
