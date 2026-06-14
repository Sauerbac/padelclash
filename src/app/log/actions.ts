"use server";

// The log-match mutation's thin shell (module-structure.md, "The mutation path"):
// resolve the viewer, parse + validate the picks, gate on membership, call the
// service, then send the logger to the board to see the leaderboard move. The
// transaction, replay, and projection rewrite all live in services.logMatch — the
// payoff of the whole tracer bullet (tracer-bullet.md). No DB or domain logic here.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlayerId } from "@/auth";
import { getGroupForMember } from "@/services/groups";
import { logMatch } from "@/services/logMatch";

export interface LogMatchState {
  error?: string;
}

/**
 * Log a singles match and rebuild the group's ratings. Shaped for `useActionState`:
 * returns `{ error }` on a validation miss; on success it redirects to the board
 * (which throws), so the caller never sees a success state — the moved leaderboard
 * is the confirmation.
 */
export async function logMatchAction(
  _prev: LogMatchState,
  formData: FormData,
): Promise<LogMatchState> {
  const playerId = await requirePlayerId();

  const groupId = String(formData.get("groupId") ?? "");
  const playerA = String(formData.get("playerA") ?? "");
  const playerB = String(formData.get("playerB") ?? "");
  const winner = String(formData.get("winner") ?? "");
  const classification = String(formData.get("classification") ?? "competitive");

  if (!playerA || !playerB) return { error: "Pick a player for each side." };
  if (playerA === playerB) {
    return { error: "A player can't be on both sides." };
  }
  if (winner !== "A" && winner !== "B") return { error: "Pick the winner." };
  if (classification !== "competitive" && classification !== "casual") {
    return { error: "Pick competitive or casual." };
  }

  // Same gate as the board: a non-member can't log into a group they can't see.
  const group = await getGroupForMember({ groupId, playerId });
  if (!group) return { error: "You're not a member of this group." };

  await logMatch({
    groupId,
    players: [
      { side: "A", playerId: playerA },
      { side: "B", playerId: playerB },
    ],
    winnerSide: winner,
    loggedBy: playerId,
    classification,
  });

  // The board reads the freshly-rebuilt projection; refresh it before we land there.
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
