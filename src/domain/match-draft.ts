import {
  normalizeGuestParticipant,
  type MatchParticipant,
  type PlayerParticipant,
} from "./match-participant";
import { normalizePlayerName } from "./player-name";
import type { MatchSide } from "./rating/engine";

export interface DraftSetScore {
  a: number;
  b: number;
}

export interface MatchDraft {
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets: DraftSetScore[] | null;
  /** Full roster, including retired Players whose names remain reserved. */
  reservedPlayerNames: string[];
}

export type MatchDraftValidation =
  | {
      ok: true;
      sides: Record<MatchSide, MatchParticipant[]>;
      sets: DraftSetScore[] | null;
    }
  | { ok: false; error: string };

/**
 * Immediate form validation for the same rules the match service enforces.
 * The server remains authoritative; this keeps correctable input mistakes
 * beside the controls instead of spending a Server Action round trip.
 */
export function validateMatchDraft(
  draft: MatchDraft,
): MatchDraftValidation {
  const sideError = validateSides(draft.sides);
  if (sideError) return { ok: false, error: sideError };

  const normalized = normalizeGuests(
    draft.sides,
    draft.reservedPlayerNames,
  );
  if (!normalized.ok) return normalized;

  const setError = validateSets(draft.sets, draft.winnerSide);
  if (setError) return { ok: false, error: setError };

  return { ok: true, sides: normalized.sides, sets: draft.sets };
}

function validateSides(
  sides: Record<MatchSide, MatchParticipant[]>,
): string | null {
  if (sides.A.length !== sides.B.length) {
    return "Sides must have the same number of participants.";
  }
  if (sides.A.length < 1 || sides.A.length > 2) {
    return "Sides must have one player in singles or two participants in doubles.";
  }

  const all = [...sides.A, ...sides.B];
  const playerIds = all
    .filter(
      (participant): participant is PlayerParticipant =>
        participant.kind === "player",
    )
    .map((participant) => participant.playerId);
  if (new Set(playerIds).size !== playerIds.length) {
    return "A player can appear on only one side, once.";
  }

  for (const side of ["A", "B"] as const) {
    const guests = sides[side].filter(
      (participant) => participant.kind === "guest",
    );
    if (sides[side].length - guests.length < 1 || guests.length > 1) {
      return "Every side needs a roster player and can have at most one Guest.";
    }
  }

  if (
    sides.A.length === 1 &&
    all.some((participant) => participant.kind === "guest")
  ) {
    return "Guests are available only in doubles.";
  }
  return null;
}

function normalizeGuests(
  sides: Record<MatchSide, MatchParticipant[]>,
  reservedPlayerNames: string[],
):
  | { ok: true; sides: Record<MatchSide, MatchParticipant[]> }
  | { ok: false; error: string } {
  const reserved = new Set(
    reservedPlayerNames.flatMap((name) => {
      const result = normalizePlayerName(name);
      return result.ok ? [result.name.normalized] : [];
    }),
  );
  const guestNames = new Set<string>();

  const normalized: Record<MatchSide, MatchParticipant[]> = { A: [], B: [] };
  for (const side of ["A", "B"] as const) {
    for (const participant of sides[side]) {
      if (participant.kind === "player") {
        normalized[side].push(participant);
        continue;
      }
      if (participant.kind !== "guest" || typeof participant.name !== "string") {
        return { ok: false, error: "Invalid match participant." };
      }

      let guest;
      try {
        guest = normalizeGuestParticipant(participant);
      } catch (error) {
        return { ok: false, error: `${(error as Error).message}.` };
      }
      if (reserved.has(guest.normalizedName)) {
        return {
          ok: false,
          error:
            "A Guest Name cannot match a roster Player Name. Add a distinguishing suffix.",
        };
      }
      if (guestNames.has(guest.normalizedName)) {
        return {
          ok: false,
          error: "Guest Names must be unique within a match.",
        };
      }
      guestNames.add(guest.normalizedName);
      normalized[side].push({ kind: "guest", name: guest.name });
    }
  }

  return { ok: true, sides: normalized };
}

function validateSets(
  sets: DraftSetScore[] | null,
  winnerSide: MatchSide,
): string | null {
  if (sets === null) return null;
  if (
    sets.length < 1 ||
    sets.length > 5 ||
    sets.some(
      (set) =>
        !Number.isInteger(set.a) ||
        !Number.isInteger(set.b) ||
        set.a < 0 ||
        set.b < 0 ||
        set.a > 99 ||
        set.b > 99,
    )
  ) {
    return "Set scores must be whole numbers from 0 to 99.";
  }

  const wins = { A: 0, B: 0 };
  for (const set of sets) {
    if (set.a === set.b) return "Every set must have a winner.";
    wins[set.a > set.b ? "A" : "B"]++;
  }
  const loserSide = winnerSide === "A" ? "B" : "A";
  if (wins[winnerSide] <= wins[loserSide]) {
    return "The selected match winner must have won more sets.";
  }
  return null;
}
