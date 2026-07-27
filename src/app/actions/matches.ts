"use server";

import { revalidatePath } from "next/cache";
import type { MatchSide } from "@/domain/rating/engine";
import type { MatchParticipant } from "@/domain/match-participant";
export type { MatchParticipant } from "@/domain/match-participant";
import type { MatchSyncRefusal } from "@/domain/sync-policy";
import { UUIDV7_PATTERN } from "@/lib/uuidv7";
import { currentActor } from "@/services/auth/actor";
import { requireLogger, requirePrivateRead } from "@/services/auth/authz";
import { refreshBindingCookie } from "@/services/auth/binding";
import { clientIp } from "@/services/auth/client-ip";
import { getDb } from "@/services/db";
import type { RatingHistoryRow, SetScore } from "@/services/db/schema";
import { AccessDeniedError } from "@/services/errors";
import {
  deleteMatch,
  editMatch,
  logMatch,
  MatchValidationError,
} from "@/services/matches";
import { listPlayers } from "@/services/players";
import { matchMutationLimiter } from "@/services/rate-limit";

/** The played facts of a match — everything both writing paths share. */
export interface MatchPayload {
  /** Client-generated UUIDv7 (see lib/uuidv7) — the idempotency key. */
  id: string;
  /** ISO timestamp of when the match was played. */
  playedAt: string;
  /** Discriminated Player/Guest participants per Side. */
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  /** Set Score detail; null for a Simple Result. */
  sets: SetScore[] | null;
}

export interface LogMatchPayload extends MatchPayload {
  /**
   * The Player this match was written under (spec decision 52). For a live
   * submit it is simply the current Player; for an offline-queue replay it is
   * whoever was bound when the match went into IndexedDB — possibly a
   * different identity than the one syncing now, which is exactly what the
   * server has to catch.
   */
  ownerPlayerId: string;
}

/**
 * Editing carries no owner: it changes existing history rather than
 * attributing new history, `loggedBy` is immutable, and edits never queue
 * offline (decision 27), so there is no stale identity to reconcile.
 */
export type EditMatchPayload = MatchPayload;

/** One player's rating change — the payoff shown after submit. */
export interface PayoffDelta {
  playerId: string;
  name: string;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
}

/**
 * Why a write was refused. The frontend has to distinguish these, because they
 * decide whether a queued match is worth retrying or is permanently stuck and
 * needs the explicit Discard of decision 26.
 *
 * Aliased to the domain type rather than restated so the two can't drift: the
 * offline queue's classification is an exhaustive switch over this union, and
 * a code added here without a decision there would fall straight through it.
 */
export type MatchMutationError = MatchSyncRefusal;

export type LogMatchActionResult =
  | { ok: true; deltas: PayoffDelta[]; alreadyLogged: boolean }
  | { ok: false; code: MatchMutationError; error: string };

export async function logMatchAction(
  payload: LogMatchPayload,
): Promise<LogMatchActionResult> {
  if (!matchMutationLimiter.check(await clientIp()).allowed) {
    return {
      ok: false,
      code: "rate-limited",
      error: "Too many match writes just now. Try again in a moment.",
    };
  }

  // The Logger is whoever this installation is bound to. Admin rights don't
  // substitute: every Match records a Player Logger (spec decision 49).
  let logger;
  try {
    logger = await requireLogger();
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, code: "not-bound", error: err.message };
    }
    throw err;
  }

  // A queue belongs to the Player who wrote it. If this installation has since
  // been rebound to someone else, the match must not be quietly re-attributed
  // to them — it is refused and the client offers a discard (decision 52).
  if (payload.ownerPlayerId !== logger.id) {
    return {
      ok: false,
      code: "identity-mismatch",
      error:
        "This match was logged by a different player on this device and can't be synced under the current one.",
    };
  }

  const parsed = parseMatchPayload(payload);
  if (!parsed.ok) return parsed;
  const { playedAt } = parsed;

  let logged;
  try {
    logged = await logMatch(getDb(), {
      id: payload.id,
      playedAt,
      loggedBy: logger.id,
      sides: payload.sides,
      winnerSide: payload.winnerSide,
      sets: payload.sets,
    });
  } catch (err) {
    // Only a validation failure is the payload's fault. Everything else (a
    // dropped connection, a deadlock) is transient, and reporting it as
    // "invalid" would tell the queue this match is permanently refused and
    // invite the Logger to discard a perfectly good result.
    if (err instanceof MatchValidationError) {
      return { ok: false, code: "invalid", error: err.message };
    }
    throw err;
  }

  // An idempotent retry must return the stored match — but only to the Player
  // who actually logged it, so the id can't be used to probe the log.
  if (logged.alreadyLogged && logged.match.loggedBy !== logger.id) {
    return {
      ok: false,
      code: "identity-mismatch",
      error: "That match was logged by another player.",
    };
  }

  await refreshBindingCookie();
  const deltas = await toPayoffDeltas(logged.deltas);
  revalidateMatchViews();
  return { ok: true, deltas, alreadyLogged: logged.alreadyLogged };
}

export type EditMatchActionResult =
  | { ok: true; deltas: PayoffDelta[] }
  | { ok: false; code: MatchMutationError; error: string };

/**
 * Correct a logged match. Edit rights (Logger ≤ 24 h / Admin always) are
 * enforced by the service inside the write transaction; this resolves who is
 * asking and checks they may touch private data at all.
 */
export async function editMatchAction(
  payload: EditMatchPayload,
): Promise<EditMatchActionResult> {
  const gate = await guardMatchMutation();
  if (gate) return gate;

  const parsed = parseMatchPayload(payload);
  if (!parsed.ok) return parsed;
  const { playedAt } = parsed;

  let edited;
  try {
    edited = await editMatch(
      getDb(),
      {
        id: payload.id,
        playedAt,
        sides: payload.sides,
        winnerSide: payload.winnerSide,
        sets: payload.sets,
      },
      await currentActor(),
    );
  } catch (err) {
    return {
      ok: false,
      code: err instanceof MatchValidationError ? "invalid" : "not-allowed",
      error: (err as Error).message,
    };
  }

  await refreshBindingCookie();
  const deltas = await toPayoffDeltas(edited.deltas);
  revalidateMatchViews();
  return { ok: true, deltas };
}

export type DeleteMatchActionResult =
  | { ok: true }
  | { ok: false; code: MatchMutationError; error: string };

export async function deleteMatchAction(
  matchId: string,
): Promise<DeleteMatchActionResult> {
  const gate = await guardMatchMutation();
  if (gate) return gate;

  if (!UUIDV7_PATTERN.test(matchId)) {
    return { ok: false, code: "invalid", error: "Invalid match id." };
  }
  try {
    await deleteMatch(getDb(), matchId, await currentActor());
  } catch (err) {
    return { ok: false, code: "not-allowed", error: (err as Error).message };
  }

  await refreshBindingCookie();
  revalidateMatchViews();
  return { ok: true };
}

type MatchRefusal = { ok: false; code: MatchMutationError; error: string };

/**
 * The client-supplied fields both writing paths share, validated in one place
 * so the two can't drift apart. The id must be a UUIDv7 because it doubles as
 * the offline queue's idempotency key.
 */
function parseMatchPayload(
  payload: MatchPayload,
): ({ ok: true; playedAt: Date }) | MatchRefusal {
  if (!UUIDV7_PATTERN.test(payload.id)) {
    return { ok: false, code: "invalid", error: "Invalid match id." };
  }
  const playedAt = new Date(payload.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, code: "invalid", error: "Invalid played-at time." };
  }
  return { ok: true, playedAt };
}

/**
 * The shared preamble for editing and deleting: rate limit, then the read gate.
 * Unlike logging, these are open to an Admin without a binding — they change
 * existing history rather than attributing new history to a Player.
 * Returns the refusal to hand back, or null to proceed.
 */
async function guardMatchMutation(): Promise<MatchRefusal | null> {
  if (!matchMutationLimiter.check(await clientIp()).allowed) {
    return {
      ok: false,
      code: "rate-limited",
      error: "Too many match writes just now. Try again in a moment.",
    };
  }
  try {
    await requirePrivateRead();
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, code: "not-bound", error: err.message };
    }
    throw err;
  }
  return null;
}

async function toPayoffDeltas(
  rows: RatingHistoryRow[],
): Promise<PayoffDelta[]> {
  const nameById = new Map(
    (await listPlayers(getDb())).map((p) => [p.id, p.name]),
  );
  return rows.map((d) => ({
    playerId: d.playerId,
    name: nameById.get(d.playerId) ?? "Unknown",
    side: d.side,
    ratingBefore: d.ratingBefore,
    delta: d.delta,
    ratingAfter: d.ratingAfter,
  }));
}

// Everything is rendered dynamically; this just drops the client router
// cache so the other tabs show the new state immediately.
function revalidateMatchViews(): void {
  revalidatePath("/");
  revalidatePath("/leaderboard");
}
