import { TabShell } from "@/components/tab-shell";
import type { MatchFormDraft } from "@/components/match-form";
import {
  FixtureLogActionState,
  FixtureLogMatchView as LogMatchView,
} from "../screen-fixtures-client";
import type { ScreenCase } from "../screen-cases";
import {
  CASEY,
  inert,
  PAYOFF,
  RESERVED_NAMES,
  ROSTER,
  YOU,
} from "./shared";

const VALID_DRAFT: MatchFormDraft = {
  sides: {
    A: [{ kind: "player", playerId: YOU.id }],
    B: [{ kind: "player", playerId: CASEY.id }],
  },
  winnerSide: "A",
  sets: null,
};

export const LOG_CASES: Record<string, ScreenCase> = {
  bound: {
    title: "Joined Player",
    note: "The Logger is preselected; doubles, Guests, set scores and Now are reachable in the real form.",
    render: () => (
      <TabShell pathname="/log">
        {inert(
          <LogMatchView
            roster={ROSTER}
            reservedPlayerNames={RESERVED_NAMES}
            logger={YOU}
          />,
        )}
      </TabShell>
    ),
  },
  unbound: {
    title: "Admin without a Player binding",
    note: "No form is exposed because every Match needs a Player Logger.",
    render: () => (
      <TabShell pathname="/log">
        <LogMatchView
          roster={ROSTER}
          reservedPlayerNames={RESERVED_NAMES}
          logger={null}
        />
      </TabShell>
    ),
  },
  payoff: {
    title: "Successful online submission",
    note: "The form is replaced by the rating payoff and Log another match action.",
    render: () => (
      <TabShell pathname="/log">
        <FixtureLogActionState
          roster={ROSTER}
          reservedPlayerNames={RESERVED_NAMES}
          logger={YOU}
          initialDraft={VALID_DRAFT}
          scenario="success"
          payoff={PAYOFF}
        />
      </TabShell>
    ),
  },
  queued: {
    title: "Successful offline queue",
    note: "The device-safe queued confirmation replaces the form until another Match is started.",
    render: () => (
      <TabShell pathname="/log">
        <FixtureLogActionState
          roster={ROSTER}
          reservedPlayerNames={RESERVED_NAMES}
          logger={YOU}
          initialDraft={VALID_DRAFT}
          scenario="offline"
          payoff={PAYOFF}
        />
      </TabShell>
    ),
  },
  refused: {
    title: "Inline validation or server refusal",
    note: "The form remains intact and presents the error near its submit action.",
    render: () => (
      <TabShell pathname="/log">
        <FixtureLogActionState
          roster={ROSTER}
          reservedPlayerNames={RESERVED_NAMES}
          logger={YOU}
          initialDraft={VALID_DRAFT}
          scenario="refused"
          payoff={PAYOFF}
        />
      </TabShell>
    ),
  },
  pending: {
    title: "Submission pending",
    note: "The full-width action freezes on Logging… and cannot be submitted twice.",
    render: () => (
      <TabShell pathname="/log">
        <FixtureLogActionState
          roster={ROSTER}
          reservedPlayerNames={RESERVED_NAMES}
          logger={YOU}
          initialDraft={VALID_DRAFT}
          scenario="pending"
          payoff={PAYOFF}
        />
      </TabShell>
    ),
  },
};
