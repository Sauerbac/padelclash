import { TabShell } from "@/components/tab-shell";
import type { MatchFormDraft } from "@/components/match-form";
import {
  FixtureLogActionState,
  FixtureLogMatchView as LogMatchView,
} from "../screen-fixtures-client";
import type { ScreenCase } from "../screen-cases";
import {
  CASEY,
  INGRID,
  inert,
  LONG,
  PAYOFF,
  RESERVED_NAMES,
  ROSTER,
  YOU,
} from "./shared";

const VALID_DRAFT: MatchFormDraft = {
  sides: {
    A: [
      { kind: "player", playerId: YOU.id },
      { kind: "guest", name: "Mira" },
    ],
    B: [
      { kind: "player", playerId: CASEY.id },
      { kind: "player", playerId: LONG.id },
    ],
  },
  winnerSide: "A",
  sets: null,
};

const LOG_PAYOFF = [
  ...PAYOFF,
  {
    playerId: LONG.id,
    name: LONG.name,
    side: "B" as const,
    ratingBefore: 1130,
    delta: -15,
    ratingAfter: 1115,
  },
];

const LONG_NAME_LOGGER = {
  ...YOU,
  name: "Alexandria Catherine Beaumont",
};

const LONG_NAME_ROSTER = [
  LONG_NAME_LOGGER,
  LONG,
  {
    id: "66666666-6666-7666-8666-666666666666",
    name: "Maximilian Alexander von Rosenberg",
  },
  {
    id: "77777777-7777-7777-8777-777777777777",
    name: "Christopher-Lee Montgomery-Smythe",
  },
];

const LONG_NAME_DRAFT: MatchFormDraft = {
  sides: {
    A: [
      { kind: "player", playerId: LONG_NAME_LOGGER.id },
      { kind: "player", playerId: LONG_NAME_ROSTER[2].id },
    ],
    B: [
      { kind: "player", playerId: LONG.id },
      { kind: "player", playerId: LONG_NAME_ROSTER[3].id },
    ],
  },
  winnerSide: "A",
  sets: null,
};

export const LOG_CASES: Record<string, ScreenCase> = {
  bound: {
    title: "Joined Player",
    note: "Doubles starts selected on the left; the Logger is preselected and Guests, set scores and Now remain reachable.",
    render: () => (
      <TabShell pathname="/log">
        {inert(
          <LogMatchView
            roster={ROSTER}
            reservedPlayerNames={RESERVED_NAMES}
            logger={YOU}
            sharedMatchCounts={{
              [INGRID.id]: 8,
              [LONG.id]: 5,
              [CASEY.id]: 2,
            }}
          />,
        )}
      </TabShell>
    ),
  },
  longNames: {
    title: "Long doubles team names",
    note: "All four participants deliberately have long names so Side pickers and winner controls can be checked at every gallery width.",
    render: () => (
      <TabShell pathname="/log">
        {inert(
          <LogMatchView
            roster={LONG_NAME_ROSTER}
            reservedPlayerNames={LONG_NAME_ROSTER.map((player) => player.name)}
            logger={LONG_NAME_LOGGER}
            initialDraft={LONG_NAME_DRAFT}
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
          sharedMatchCounts={{
            [INGRID.id]: 3,
            [LONG.id]: 2,
          }}
          initialDraft={VALID_DRAFT}
          scenario="success"
          payoff={LOG_PAYOFF}
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
          payoff={LOG_PAYOFF}
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
          payoff={LOG_PAYOFF}
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
          payoff={LOG_PAYOFF}
        />
      </TabShell>
    ),
  },
};
