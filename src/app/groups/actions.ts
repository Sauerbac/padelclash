"use server";

// The create-group mutation's thin shell (module-structure.md, "The mutation
// path"): resolve the viewer, validate input, call the service, redirect to the
// new group. No DB or domain logic lives here — that is the service's job.

import { redirect } from "next/navigation";
import { requirePlayerId } from "@/auth";
import { createGroup } from "@/services/groups";

export interface CreateGroupState {
  error?: string;
}

/**
 * Create a Group owned by the signed-in Player. Shaped for `useActionState`:
 * returns `{ error }` on a validation miss; on success it redirects (which throws)
 * so the caller never sees a success state.
 */
export async function createGroupAction(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const founderPlayerId = await requirePlayerId();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give your group a name." };

  const { groupId } = await createGroup({ name, founderPlayerId });
  redirect(`/groups/${groupId}`);
}
