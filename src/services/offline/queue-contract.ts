import type { MatchParticipant } from "../../domain/match-participant";
import type { MatchSide } from "../../domain/rating/engine";
import type { MatchSyncRefusal } from "../../domain/sync-policy";

export interface QueuedMatchPayload {
  id: string;
  playedAt: string;
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets: { a: number; b: number }[] | null;
  ownerPlayerId: string;
}

export interface QueuedMatch extends QueuedMatchPayload {
  names: Record<MatchSide, string[]>;
  ownerPlayerName: string;
  queuedAt: string;
  syncError?: string;
  syncCode?: MatchSyncRefusal;
}

export type QueuedMatchInput = QueuedMatch;

/**
 * Decode the durable IndexedDB contract instead of trusting the server-action
 * type. Versioning can be introduced alongside a real incompatible shape
 * change; today's deployed records already have this shape.
 */
export function decodeQueuedMatch(value: unknown): QueuedMatch | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.playedAt !== "string" ||
    typeof value.ownerPlayerId !== "string" ||
    typeof value.ownerPlayerName !== "string" ||
    typeof value.queuedAt !== "string" ||
    (value.winnerSide !== "A" && value.winnerSide !== "B") ||
    !isSides(value.sides) ||
    !isNames(value.names) ||
    !isSets(value.sets)
  ) {
    return null;
  }
  if (
    value.syncCode !== undefined &&
    !SYNC_REFUSALS.has(value.syncCode as MatchSyncRefusal)
  ) {
    return null;
  }
  if (value.syncError !== undefined && typeof value.syncError !== "string") {
    return null;
  }

  return {
    id: value.id,
    playedAt: value.playedAt,
    ownerPlayerId: value.ownerPlayerId,
    ownerPlayerName: value.ownerPlayerName,
    sides: value.sides,
    names: value.names,
    winnerSide: value.winnerSide,
    sets: value.sets,
    queuedAt: value.queuedAt,
    ...(value.syncCode === undefined ? {} : { syncCode: value.syncCode }),
    ...(value.syncError === undefined ? {} : { syncError: value.syncError }),
  } as QueuedMatch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isParticipant(value: unknown): value is MatchParticipant {
  if (!isRecord(value)) return false;
  return (
    (value.kind === "player" && typeof value.playerId === "string") ||
    (value.kind === "guest" && typeof value.name === "string")
  );
}

function isSides(
  value: unknown,
): value is Record<MatchSide, MatchParticipant[]> {
  return (
    isRecord(value) &&
    Array.isArray(value.A) &&
    value.A.every(isParticipant) &&
    Array.isArray(value.B) &&
    value.B.every(isParticipant)
  );
}

function isNames(value: unknown): value is Record<MatchSide, string[]> {
  return (
    isRecord(value) &&
    Array.isArray(value.A) &&
    value.A.every((name) => typeof name === "string") &&
    Array.isArray(value.B) &&
    value.B.every((name) => typeof name === "string")
  );
}

function isSets(value: unknown): value is { a: number; b: number }[] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every(
        (set) =>
          isRecord(set) &&
          typeof set.a === "number" &&
          typeof set.b === "number",
      ))
  );
}

const SYNC_REFUSALS = new Set<MatchSyncRefusal>([
  "not-bound",
  "identity-mismatch",
  "not-allowed",
  "rate-limited",
  "invalid",
]);
