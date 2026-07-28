import type { MatchParticipant } from "../../domain/match-participant";
import type { MatchSide } from "../../domain/rating/engine";
import type { MatchSyncRefusal } from "../../domain/sync-policy";
import type { SetScore } from "../../domain/set-score";

export interface QueuedMatchPayload {
  id: string;
  playedAt: string;
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets: SetScore[] | null;
  ownerPlayerId: string;
}

export interface QueuedMatchInput extends QueuedMatchPayload {
  names: Record<MatchSide, string[]>;
  ownerPlayerName: string;
  queuedAt: string;
  syncError?: string;
  syncCode?: MatchSyncRefusal;
}

export interface QueuedMatch extends QueuedMatchInput {
  recordState: "queued";
}

export interface IncompatibleQueuedMatch {
  recordState: "incompatible";
  id: string;
  queuedAt: string;
  ownerPlayerName: string;
  syncCode: "invalid";
  syncError: string;
}

export type QueuedMatchRecord = QueuedMatch | IncompatibleQueuedMatch;

export function isIncompatibleQueuedMatch(
  match: QueuedMatchRecord,
): match is IncompatibleQueuedMatch {
  return match.recordState === "incompatible";
}

/**
 * Decode the durable IndexedDB contract instead of trusting the server-action
 * type. Versioning can be introduced alongside a real incompatible shape
 * change; today's deployed records already have this shape.
 */
export function decodeQueuedMatch(value: unknown): QueuedMatchRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  const id = value.id;
  if (
    typeof value.playedAt !== "string" ||
    typeof value.ownerPlayerId !== "string" ||
    typeof value.ownerPlayerName !== "string" ||
    typeof value.queuedAt !== "string" ||
    (value.winnerSide !== "A" && value.winnerSide !== "B") ||
    !isSides(value.sides) ||
    !isNames(value.names) ||
    !isSets(value.sets)
  ) {
    return incompatible(value, id);
  }
  if (
    value.syncCode !== undefined &&
    !SYNC_REFUSALS.has(value.syncCode as MatchSyncRefusal)
  ) {
    return incompatible(value, id);
  }
  if (value.syncError !== undefined && typeof value.syncError !== "string") {
    return incompatible(value, id);
  }

  return {
    recordState: "queued",
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

function incompatible(
  value: Record<string, unknown>,
  id: string,
): IncompatibleQueuedMatch {
  return {
    recordState: "incompatible",
    id,
    queuedAt:
      typeof value.queuedAt === "string"
        ? value.queuedAt
        : "1970-01-01T00:00:00.000Z",
    ownerPlayerName:
      typeof value.ownerPlayerName === "string"
        ? value.ownerPlayerName
        : "Unknown Player",
    syncCode: "invalid",
    syncError:
      "This queued match was saved by an incompatible app version and cannot be synced. Review it, then discard it explicitly.",
  };
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

function isSets(value: unknown): value is SetScore[] | null {
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
