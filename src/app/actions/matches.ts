"use server";

import { revalidatePath } from "next/cache";
import type { MatchSide } from "@/domain/rating/engine";
import { UUIDV7_PATTERN } from "@/lib/uuidv7";
import { getBoundPlayer } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import type { SetScore } from "@/services/db/schema";
import { logMatch } from "@/services/matches";
import { listPlayers } from "@/services/players";

export interface LogMatchPayload {
  /** Client-generated UUIDv7 (see lib/uuidv7) — the idempotency key. */
  id: string;
  /** ISO timestamp of when the match was played. */
  playedAt: string;
  /** Player ids per Side. */
  sides: Record<MatchSide, string[]>;
  winnerSide: MatchSide;
  /** Set Score detail; null for a Simple Result. */
  sets: SetScore[] | null;
}

/** One player's rating change — the payoff shown after submit. */
export interface PayoffDelta {
  playerId: string;
  name: string;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
}

export type LogMatchActionResult =
  | { ok: true; deltas: PayoffDelta[]; alreadyLogged: boolean }
  | { ok: false; error: string };

export async function logMatchAction(
  payload: LogMatchPayload,
): Promise<LogMatchActionResult> {
  // The Logger is whoever this device is bound to — the binding is the only
  // identity there is (spec "Device binding").
  const logger = await getBoundPlayer();
  if (!logger) {
    return { ok: false, error: "This device isn't bound to a player." };
  }

  const playedAt = new Date(payload.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Invalid played-at time." };
  }
  if (!UUIDV7_PATTERN.test(payload.id)) {
    return { ok: false, error: "Invalid match id." };
  }

  const db = getDb();
  let logged;
  try {
    logged = await logMatch(db, {
      id: payload.id,
      playedAt,
      loggedBy: logger.id,
      sides: payload.sides,
      winnerSide: payload.winnerSide,
      sets: payload.sets,
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const nameById = new Map(
    (await listPlayers(db)).map((p) => [p.id, p.name]),
  );
  const deltas = logged.deltas.map((d) => ({
    playerId: d.playerId,
    name: nameById.get(d.playerId) ?? "Unknown",
    side: d.side,
    ratingBefore: d.ratingBefore,
    delta: d.delta,
    ratingAfter: d.ratingAfter,
  }));

  // Everything is rendered dynamically; this just drops the client router
  // cache so the other tabs show the new state immediately.
  revalidatePath("/");
  revalidatePath("/leaderboard");

  return { ok: true, deltas, alreadyLogged: logged.alreadyLogged };
}
