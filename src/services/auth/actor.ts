import type { MatchActor } from "../../domain/edit-rights";
import { currentViewer } from "./authz";

/**
 * Who is asking, in the shape the edit-rights rules want: the bound Player (if
 * any) and whether this browser holds an Admin session. An unbound Admin device
 * still counts as Admin. The single source for edit-rights checks in actions
 * and pages.
 */
export async function currentActor(): Promise<MatchActor> {
  const viewer = await currentViewer();
  return { playerId: viewer.player?.id ?? null, isAdmin: viewer.isAdmin };
}
