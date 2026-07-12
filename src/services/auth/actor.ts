import type { MatchActor } from "../../domain/edit-rights";
import { isAdmin } from "./admin";
import { getBoundPlayer } from "./binding";

/**
 * Who is asking, from the cookies: the bound player (if any) and whether the
 * browser holds an admin session. An unbound admin device still counts as
 * admin. The single source for edit-rights checks in actions and pages.
 */
export async function currentActor(): Promise<MatchActor> {
  const [player, admin] = await Promise.all([getBoundPlayer(), isAdmin()]);
  return { playerId: player?.id ?? null, isAdmin: admin };
}
