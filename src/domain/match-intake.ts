import {
  normalizeGuestParticipant,
  type MatchParticipant,
  type NormalizedGuestParticipant,
  type PlayerParticipant,
} from "./match-participant";
import { normalizePlayerName } from "./player-name";
import type { MatchSide } from "./rating/engine";
import type { SetScore } from "./set-score";

export interface MatchIntake {
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets: SetScore[] | null;
}

export interface MatchIntakeRoster {
  /** The Players this caller accepts: current picker for UI, full roster for persistence. */
  playerIds: readonly string[];
  /** Full roster, including retired Players whose names remain reserved. */
  reservedPlayerNames: readonly string[];
}

export type MatchIntakeErrorCode =
  | "side-size"
  | "invalid-participant"
  | "duplicate-player"
  | "guest-side"
  | "unknown-player"
  | "invalid-guest-name"
  | "guest-roster-collision"
  | "duplicate-guest"
  | "invalid-sets"
  | "drawn-set"
  | "invalid-winner"
  | "winner-mismatch";

export interface MatchIntakeError {
  code: MatchIntakeErrorCode;
  message: string;
}

export type ValidatedMatchParticipant =
  | PlayerParticipant
  | NormalizedGuestParticipant;

export type MatchIntakeValidation =
  | {
      ok: true;
      sides: Record<MatchSide, ValidatedMatchParticipant[]>;
      sets: SetScore[] | null;
    }
  | { ok: false; error: MatchIntakeError };

/**
 * Canonical framework-free Match intake. Callers differ only in which Player
 * ids they supply: the form's current picker is intentionally stricter than
 * the service's authoritative full roster for late offline Matches.
 */
export function validateMatchIntake(
  intake: MatchIntake,
  roster: MatchIntakeRoster,
): MatchIntakeValidation {
  if (intake.winnerSide !== "A" && intake.winnerSide !== "B") {
    return failure("invalid-winner", "A Match must have one winning side.");
  }
  const sides = intake.sides;
  if (
    !sides ||
    !Array.isArray(sides.A) ||
    !Array.isArray(sides.B) ||
    sides.A.length !== sides.B.length
  ) {
    return failure(
      "side-size",
      "Sides must have the same number of participants.",
    );
  }
  if (sides.A.length < 1 || sides.A.length > 2) {
    return failure(
      "side-size",
      "Sides must have one player in singles or two participants in doubles.",
    );
  }

  const knownPlayers = new Set(roster.playerIds);
  const seenPlayers = new Set<string>();
  const reservedNames = new Set(
    roster.reservedPlayerNames.flatMap((name) => {
      const result = normalizePlayerName(name);
      return result.ok ? [result.name.normalized] : [];
    }),
  );
  const guestNames = new Set<string>();
  const normalized: Record<MatchSide, ValidatedMatchParticipant[]> = {
    A: [],
    B: [],
  };

  for (const side of ["A", "B"] as const) {
    let playersOnSide = 0;
    let guestsOnSide = 0;
    for (const participant of sides[side]) {
      if (
        !participant ||
        (participant.kind !== "player" && participant.kind !== "guest")
      ) {
        return failure("invalid-participant", "Invalid match participant.");
      }
      if (participant.kind === "player") {
        if (typeof participant.playerId !== "string") {
          return failure("invalid-participant", "Invalid match participant.");
        }
        if (!knownPlayers.has(participant.playerId)) {
          return failure(
            "unknown-player",
            "Every Player participant must exist on the roster.",
          );
        }
        if (seenPlayers.has(participant.playerId)) {
          return failure(
            "duplicate-player",
            "A player can appear on only one side, once.",
          );
        }
        seenPlayers.add(participant.playerId);
        playersOnSide++;
        normalized[side].push({
          kind: "player",
          playerId: participant.playerId,
        });
        continue;
      }

      if (typeof participant.name !== "string") {
        return failure("invalid-participant", "Invalid match participant.");
      }
      let guest: NormalizedGuestParticipant;
      try {
        guest = normalizeGuestParticipant(participant);
      } catch (error) {
        return failure(
          "invalid-guest-name",
          `${(error as Error).message}.`,
        );
      }
      if (reservedNames.has(guest.normalizedName)) {
        return failure(
          "guest-roster-collision",
          "A Guest Name cannot match a roster Player Name. Add a distinguishing suffix.",
        );
      }
      if (guestNames.has(guest.normalizedName)) {
        return failure(
          "duplicate-guest",
          "Guest Names must be unique within a match.",
        );
      }
      guestNames.add(guest.normalizedName);
      guestsOnSide++;
      normalized[side].push(guest);
    }
    if (playersOnSide < 1 || guestsOnSide > 1) {
      return failure(
        "guest-side",
        "Every side needs a roster player and can have at most one Guest.",
      );
    }
  }

  const setError = validateSets(intake.sets, intake.winnerSide);
  if (setError) return setError;
  return { ok: true, sides: normalized, sets: intake.sets };
}

/** Strip persistence-only normalized Guest keys before sending a payload. */
export function toMatchParticipantSides(
  sides: Record<MatchSide, ValidatedMatchParticipant[]>,
): Record<MatchSide, MatchParticipant[]> {
  return {
    A: sides.A.map(toMatchParticipant),
    B: sides.B.map(toMatchParticipant),
  };
}

function toMatchParticipant(
  participant: ValidatedMatchParticipant,
): MatchParticipant {
  return participant.kind === "player"
    ? participant
    : { kind: "guest", name: participant.name };
}

function validateSets(
  sets: SetScore[] | null,
  winnerSide: MatchSide,
): Extract<MatchIntakeValidation, { ok: false }> | null {
  if (sets === null) return null;
  if (
    !Array.isArray(sets) ||
    sets.length < 1 ||
    sets.length > 5 ||
    sets.some(
      (set) =>
        !set ||
        !Number.isInteger(set.a) ||
        !Number.isInteger(set.b) ||
        set.a < 0 ||
        set.b < 0 ||
        set.a > 99 ||
        set.b > 99,
    )
  ) {
    return failure(
      "invalid-sets",
      "Set scores must be whole numbers from 0 to 99.",
    );
  }

  const wins = { A: 0, B: 0 };
  for (const set of sets) {
    if (set.a === set.b) {
      return failure("drawn-set", "Every set must have a winner.");
    }
    wins[set.a > set.b ? "A" : "B"]++;
  }
  const loserSide = winnerSide === "A" ? "B" : "A";
  if (wins[winnerSide] <= wins[loserSide]) {
    return failure(
      "winner-mismatch",
      "The selected match winner must have won more sets.",
    );
  }
  return null;
}

function failure(
  code: MatchIntakeErrorCode,
  message: string,
): Extract<MatchIntakeValidation, { ok: false }> {
  return { ok: false, error: { code, message } };
}
