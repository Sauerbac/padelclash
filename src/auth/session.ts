// Server-side session access. Wraps Better Auth's `getSession` with the request
// headers from `next/headers`, so route components and Server Actions read the
// current Account without re-plumbing cookies each time.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

/** The current session, or null when no one is signed in. */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/**
 * The current session, or a redirect to /login. Use to guard protected routes —
 * the redirect throws, so callers can treat the return as always-present.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * The viewing Player's id, or a redirect to /login. Every Account is linked to
 * exactly one Player by the not-null `user.player_id` FK (ADR-0004), so a signed-in
 * session always resolves a player id; the guard is the fail-loud backstop. This is
 * the seam most route components and Server Actions actually need — the domain keys
 * on Player, not Account.
 */
export async function requirePlayerId(): Promise<string> {
  const session = await requireSession();
  const playerId = session.user.playerId;
  if (!playerId) redirect("/login");
  return playerId;
}
