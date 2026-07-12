"use server";

import { hasPlayerBinding, setPlayerBinding } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { getPlayerById, getPlayerByToken } from "@/services/players";
import { getSettings } from "@/services/settings";

// token is included so the client can store the localStorage recovery marker
// (see binding-storage.ts) for every bind path, not just join links.
export type BindResult = {
  playerId: string;
  name: string;
  token: string;
} | null;

/** Bind this device via a personal join link. Null = invalid/revoked token. */
export async function bindDevice(token: string): Promise<BindResult> {
  const player = await getPlayerByToken(getDb(), token);
  if (!player) return null;
  await setPlayerBinding(player.id);
  return { playerId: player.id, name: player.name, token };
}

/**
 * Bind via the name picker. Only allowed while the admin has the picker
 * toggled on, and only onto an unbound device (a bound one keeps its player).
 */
export async function bindByName(playerId: string): Promise<BindResult> {
  const db = getDb();
  const [settings, alreadyBound] = await Promise.all([
    getSettings(db),
    hasPlayerBinding(),
  ]);
  if (!settings.namePickerEnabled || alreadyBound) return null;
  const player = await getPlayerById(db, playerId);
  if (!player || player.retiredAt) return null;
  await setPlayerBinding(player.id);
  return {
    playerId: player.id,
    name: player.name,
    token: player.personalToken,
  };
}
