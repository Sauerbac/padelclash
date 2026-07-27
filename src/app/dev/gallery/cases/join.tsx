import type { InvitationState } from "@/domain/onboarding";
import type {
  InvitationProblem,
  PreviewResult,
} from "@/services/onboarding";
import {
  FixtureGeneralConfirmation,
  FixtureJoinActionState,
  FixtureJoinView as JoinView,
} from "../screen-fixtures-client";
import type { ScreenCase } from "../screen-cases";
import { CASEY, inert, LONG, YOU } from "./shared";

const invitationProblem = (
  problem: InvitationProblem,
): PreviewResult => ({ ok: false, error: problem });

export const INVITATION_CASES: Record<InvitationState, ScreenCase> = {
  valid: {
    title: "Valid Personal invitation",
    note: "Explicit confirmation is required; previewing alone changes nothing.",
    render: () =>
      inert(
        <JoinView
          token="fixture-valid-personal"
          result={{
            ok: true,
            preview: {
              kind: "personal",
              player: YOU,
              replacesBinding: true,
            },
          }}
        />,
      ),
  },
  revoked: {
    title: "Revoked invitation",
    note: "A kind-agnostic dead-link explanation asks for a fresh invitation.",
    render: () => (
      <JoinView token="fixture-revoked" result={invitationProblem("revoked")} />
    ),
  },
  consumed: {
    title: "Consumed Personal invitation",
    note: "Single-use invitations explain that they have already been used.",
    render: () => (
      <JoinView
        token="fixture-consumed"
        result={invitationProblem("consumed")}
      />
    ),
  },
  expired: {
    title: "Expired invitation",
    note: "Expiry is distinct from revocation while sharing the same recovery path.",
    render: () => (
      <JoinView token="fixture-expired" result={invitationProblem("expired")} />
    ),
  },
};

export const JOIN_CASES: Record<string, ScreenCase> = {
  ...INVITATION_CASES,
  general: {
    title: "Valid General invitation",
    note: "Pick a Not Joined Player or add a new roster name before confirming.",
    render: () =>
      inert(
        <JoinView
          token="fixture-valid-general"
          result={{
            ok: true,
            preview: {
              kind: "general",
              notJoined: [YOU, LONG, CASEY],
            },
          }}
        />,
      ),
  },
  "general-confirmation": {
    title: "General invitation confirmation",
    note: "Picking a Player reveals the mandatory warning and explicit final confirmation.",
    render: () => (
      <FixtureGeneralConfirmation
        token="fixture-general-confirmation"
        result={{
          ok: true,
          preview: {
            kind: "general",
            notJoined: [YOU, LONG, CASEY],
          },
        }}
      />
    ),
  },
  "not-found": {
    title: "Unknown invitation",
    note: "Malformed and unknown tokens render the standalone dead-link card.",
    render: () => (
      <JoinView
        token="fixture-unknown"
        result={invitationProblem("not-found")}
      />
    ),
  },
  "player-unavailable": {
    title: "Personal invitation for an unavailable Player",
    note: "Retirement invalidates the invitation without exposing roster details.",
    render: () => (
      <JoinView
        token="fixture-player-unavailable"
        result={invitationProblem("player-unavailable")}
      />
    ),
  },
  refused: {
    title: "Confirmation refused after preview",
    note: "A race or server refusal stays inline on the invitation being confirmed.",
    render: () => (
      <FixtureJoinActionState
        scenario="refused"
        token="fixture-refused"
        result={{
          ok: true,
          preview: {
            kind: "personal",
            player: YOU,
            replacesBinding: false,
          },
        }}
      />
    ),
  },
  pending: {
    title: "Confirmation pending",
    note: "The binding action reads Joining… and cannot be double-submitted.",
    render: () => (
      <FixtureJoinActionState
        scenario="pending"
        token="fixture-pending"
        result={{
          ok: true,
          preview: {
            kind: "personal",
            player: YOU,
            replacesBinding: false,
          },
        }}
      />
    ),
  },
  "ios-browser-guidance": {
    title: "Invitation opened in an iOS browser",
    note: "The recovery panel is pinned above the ordinary invitation without consulting the reviewer's browser.",
    render: () =>
      inert(
        <JoinView
          token="fixture-ios-guidance"
          result={{
            ok: true,
            preview: {
              kind: "personal",
              player: YOU,
              replacesBinding: false,
            },
          }}
          showRecoveryGuidance
        />,
      ),
  },
};
