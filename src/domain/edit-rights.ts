// Edit rights (spec "Edit rights (players)"): who may edit or delete a match.
// Pure and framework-free — enforced by the services layer inside the write
// transaction, and consulted by the UI to show edit/delete affordances.

/** The 24 h grace window in which the Logger can fix their own match. */
export const EDIT_GRACE_MS = 24 * 60 * 60 * 1000;

/** The parts of a match that edit rights depend on. */
export interface ModifiableMatch {
  loggedBy: string;
  loggedAt: Date;
}

/** Who is asking: the bound player (if any) and whether they hold an admin session. */
export interface MatchActor {
  playerId: string | null;
  isAdmin: boolean;
}

export function canModifyMatch(
  match: ModifiableMatch,
  actor: MatchActor,
  now: Date,
): boolean {
  // Admin may edit or delete any match, at any age (spec "Admin").
  if (actor.isAdmin) return true;
  if (actor.playerId === null || actor.playerId !== match.loggedBy) {
    return false;
  }
  return now.getTime() - match.loggedAt.getTime() <= EDIT_GRACE_MS;
}
