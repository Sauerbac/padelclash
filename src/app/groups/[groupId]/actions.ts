"use server";

// The add-player mutation's thin shell (module-structure.md, "The mutation path"):
// resolve the viewer, gate on membership, call the service, refresh the board. No
// DB or domain logic lives here — that is the service's job.

import { revalidatePath } from "next/cache";
import { requirePlayerId } from "@/auth";
import {
  addUnclaimedPlayer,
  DuplicateMemberNameError,
  getGroupForMember,
} from "@/services/groups";

export interface AddPlayerState {
  error?: string;
  /** The name just added — lets the form show a brief confirmation. */
  addedName?: string;
}

/**
 * Add an Unclaimed Player to a group by display name. Shaped for `useActionState`:
 * returns `{ error }` on a miss, `{ addedName }` on success. Stays on the board
 * (no redirect) and revalidates it so the new roster chip appears.
 */
export async function addUnclaimedPlayerAction(
  _prev: AddPlayerState,
  formData: FormData,
): Promise<AddPlayerState> {
  const playerId = await requirePlayerId();

  const groupId = String(formData.get("groupId") ?? "");
  const displayName = String(formData.get("name") ?? "").trim();
  if (!displayName) return { error: "Enter a name for the new player." };

  // Same gate as the board page: a non-member can't add to a group they can't see.
  const group = await getGroupForMember({ groupId, playerId });
  if (!group) return { error: "You're not a member of this group." };

  try {
    await addUnclaimedPlayer({ groupId, displayName, addedByPlayerId: playerId });
  } catch (err) {
    // A name clash is an expected user error — surface it inline, not as a 500.
    if (err instanceof DuplicateMemberNameError) {
      return { error: `${displayName} is already in this group.` };
    }
    throw err;
  }

  revalidatePath(`/groups/${groupId}`);
  return { addedName: displayName };
}
