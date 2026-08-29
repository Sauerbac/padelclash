import { cache } from "react";
import type { Player } from "../db/schema";
import { AccessDeniedError } from "../errors";
import { isAdmin } from "./admin";
import { currentBinding } from "./binding";

/**
 * The authorization boundary of spec decision 49. Every player-facing read and
 * mutation goes through here on the server; the client's opinion about who it
 * is never enters into it.
 *
 * Two ways in, deliberately asymmetric:
 *   - a Device Binding — the ordinary Player identity
 *   - an Admin session — may bypass the read gate and edit/delete, but still
 *     cannot *log* a Match, because every Match needs a Player Logger
 */
export interface Viewer {
  /** The bound Player, or null for an Admin browsing without a binding. */
  player: Player | null;
  bindingId: string | null;
  isAdmin: boolean;
}

/**
 * Request-scoped: the layout and the page it wraps both need the viewer, and
 * React's cache() collapses that into one credential lookup per request.
 */
export const currentViewer = cache(async function currentViewer(): Promise<Viewer> {
  const [binding, admin] = await Promise.all([currentBinding(), isAdmin()]);
  return { player: binding?.player ?? null, bindingId: binding?.binding.id ?? null, isAdmin: admin };
});

/** Whether this viewer may see private circle data (decisions 33 and 49). */
export function canReadPrivate(viewer: Viewer): boolean {
  return viewer.player !== null || viewer.isAdmin;
}

/**
 * The read gate for pages: the viewer when they're allowed in, null when the
 * Not Joined screen should render instead — pages need to render, not throw.
 *
 * Every player-facing page must call this BEFORE it queries anything. Gating
 * in the layout alone is not enough: Next renders the page segment regardless
 * of what its layout chooses to render, so a page that fetches unguarded ships
 * private data in the RSC payload even when the screen says "Not joined".
 */
export async function viewerForPrivateRead(): Promise<Viewer | null> {
  const viewer = await currentViewer();
  return canReadPrivate(viewer) ? viewer : null;
}

/** The read gate for server actions, where failing loudly is the right move. */
export async function requirePrivateRead(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!canReadPrivate(viewer)) {
    throw new AccessDeniedError(
      "not-bound",
      "This installation isn't joined to the circle.",
    );
  }
  return viewer;
}

/**
 * The Logger for a new Match. Admin rights do not substitute: a Match records
 * which Player logged it, and an Admin session names no Player (decision 49).
 */
export async function requireLogger(): Promise<Player> {
  const binding = await currentBinding();
  if (!binding) {
    throw new AccessDeniedError(
      "not-bound",
      "Logging a match needs a joined Player on this device.",
    );
  }
  return binding.player;
}
