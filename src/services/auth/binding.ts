import { cookies } from "next/headers";
import { authCookieOptions } from "./cookie-options";
import { getDb } from "../db";
import type { Player } from "../db/schema";
import { getPlayerById } from "../players";

// Device binding: a long-lived cookie carrying the bound player's id.
// Convenience-grade identity (any player can log any match), not security.

export const PLAYER_COOKIE = "pc_player";

// Browsers cap cookie lifetime at ~400 days; refreshed on every re-bind.
export const PLAYER_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export async function setPlayerBinding(playerId: string): Promise<void> {
  const store = await cookies();
  store.set(
    PLAYER_COOKIE,
    playerId,
    authCookieOptions(PLAYER_COOKIE_MAX_AGE_SECONDS),
  );
}

/** Cookie presence only — no DB. For guards that just need "is bound?". */
export async function hasPlayerBinding(): Promise<boolean> {
  const store = await cookies();
  return store.has(PLAYER_COOKIE);
}

export async function getBoundPlayer(): Promise<Player | null> {
  const store = await cookies();
  const playerId = store.get(PLAYER_COOKIE)?.value;
  if (!playerId) return null;
  const player = await getPlayerById(getDb(), playerId);
  // Retirement revokes the binding, matching the join-link behavior
  // (getPlayerByToken also refuses retired players).
  if (!player || player.retiredAt) return null;
  return player;
}
