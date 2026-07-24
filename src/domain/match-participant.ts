import { normalizePlayerName } from "./player-name";

export interface PlayerParticipant {
  kind: "player";
  playerId: string;
}

export interface GuestParticipant {
  kind: "guest";
  name: string;
}

/** Stable input/serialization contract shared by actions and the offline queue. */
export type MatchParticipant = PlayerParticipant | GuestParticipant;

export function playerParticipant(playerId: string): PlayerParticipant {
  return { kind: "player", playerId };
}

export function guestParticipant(name: string): GuestParticipant {
  return { kind: "guest", name };
}

export interface NormalizedGuestParticipant extends GuestParticipant {
  normalizedName: string;
}

export function normalizeGuestParticipant(
  participant: GuestParticipant,
): NormalizedGuestParticipant {
  const result = normalizePlayerName(participant.name);
  if (!result.ok) {
    throw new Error(
      result.problem === "blank"
        ? "Guest Name cannot be blank"
        : "Guest Name must be at most 40 characters",
    );
  }
  return {
    kind: "guest",
    name: result.name.display,
    normalizedName: result.name.normalized,
  };
}
