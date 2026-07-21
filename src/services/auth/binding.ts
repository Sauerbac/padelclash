import { cookies } from "next/headers";
import { authCookieOptions } from "./cookie-options";
import { getDb } from "../db";
import type { DeviceBinding, Player } from "../db/schema";
import { resolveCredential, touchBinding } from "../access";

/**
 * The bridge between the browser's cookie and a Device Binding row. The cookie
 * carries an opaque 256-bit credential and nothing else — no Player id, no
 * invitation token, and nothing mirrored into localStorage (spec decision 47).
 */

export const BINDING_COOKIE = "pc_binding";

/**
 * The convenience-grade cookie this replaced, which held a raw Player id.
 * Deleted on sight during the cutover (decision 55): it must never be treated
 * as evidence of anything, least of all upgraded into a real binding.
 */
export const LEGACY_PLAYER_COOKIE = "pc_player";

// Browsers cap cookie lifetime near 400 days; ordinary use re-sets it, so the
// only thing that actually ends access is a server-side revoke (decision 34).
export const BINDING_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export interface BoundInstallation {
  player: Player;
  binding: DeviceBinding;
}

/**
 * Who this installation is, according to its credential. Read-only: safe from
 * a Server Component, where Next forbids setting cookies. A revoked credential,
 * a retired Player, or no cookie at all all come back as null — the Not Joined
 * screen's single source of truth.
 */
export async function currentBinding(): Promise<BoundInstallation | null> {
  const store = await cookies();
  const credential = store.get(BINDING_COOKIE)?.value;
  if (!credential) return null;

  const resolved = await resolveCredential(getDb(), credential);
  if (!resolved) return null;

  // Best-effort, throttled to one write an hour (spec decision 53). Never let
  // an accountability nicety break the request that triggered it.
  try {
    await touchBinding(getDb(), resolved.binding, new Date());
  } catch (err) {
    console.error("Failed to record device binding last-seen:", err);
  }

  return resolved;
}

/** The bound Player, or null. The common case, for pages and actions. */
export async function getBoundPlayer(): Promise<Player | null> {
  return (await currentBinding())?.player ?? null;
}

/**
 * Whether this installation holds a *valid* binding. Unlike the cookie-presence
 * check this replaced, it costs a query — presence of a cookie is not evidence
 * of authorization, which was the whole problem with the old scheme.
 */
export async function isBound(): Promise<boolean> {
  return (await currentBinding()) !== null;
}

/**
 * Hand a freshly minted credential to the browser. Server Actions and Route
 * Handlers only — Next cannot set cookies once a Server Component has begun
 * streaming.
 */
export async function setBindingCookie(credential: string): Promise<void> {
  const store = await cookies();
  store.set(
    BINDING_COOKIE,
    credential,
    authCookieOptions(BINDING_COOKIE_MAX_AGE_SECONDS),
  );
  store.delete(LEGACY_PLAYER_COOKIE);
}

/**
 * Drop this installation's credential. Called when the server observes a
 * credential that no longer resolves — the moment an offline device discovers
 * it was revoked (decision 52) — not as a Player-facing logout, which doesn't
 * exist (decision 39).
 */
export async function clearBindingCookie(): Promise<void> {
  const store = await cookies();
  store.delete(BINDING_COOKIE);
  store.delete(LEGACY_PLAYER_COOKIE);
}

/**
 * Re-set the cookie so ordinary use keeps pushing the browser's expiry out
 * (spec "Device Binding"). Server Actions and Route Handlers only.
 */
export async function refreshBindingCookie(): Promise<void> {
  const store = await cookies();
  const credential = store.get(BINDING_COOKIE)?.value;
  if (!credential) return;
  store.set(
    BINDING_COOKIE,
    credential,
    authCookieOptions(BINDING_COOKIE_MAX_AGE_SECONDS),
  );
}
