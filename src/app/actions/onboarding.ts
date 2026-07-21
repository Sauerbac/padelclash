"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { clientIp } from "@/services/auth/client-ip";
import {
  BINDING_COOKIE,
  isBound,
  setBindingCookie,
} from "@/services/auth/binding";
import { getDb } from "@/services/db";
import {
  confirmJoin,
  previewInvitation,
  type InvitationPreview,
  type InvitationProblem,
  type JoinProblem,
} from "@/services/onboarding";
import { onboardingLimiter } from "@/services/rate-limit";

/**
 * The visitor-facing half of onboarding. Everything here is reachable without
 * any credential, so it is rate-limited and says as little as possible about
 * what it rejected.
 */

export type PreviewActionResult =
  | { ok: true; preview: InvitationPreview }
  | { ok: false; error: PreviewProblem };

/**
 * `already-bound` is the redirect signal of spec decision 38: this installation
 * already belongs to a Player, so the link is neither shown nor consumed and
 * the frontend sends them to `/`.
 */
export type PreviewProblem =
  | InvitationProblem
  | "already-bound"
  | "rate-limited";

/** Read-only: opening or refreshing a link never changes anything. */
export async function previewInvitationAction(
  token: string,
): Promise<PreviewActionResult> {
  if (await isBound()) return { ok: false, error: "already-bound" };

  if (!onboardingLimiter.check(await clientIp()).allowed) {
    return { ok: false, error: "rate-limited" };
  }

  const result = await previewInvitation(getDb(), token);
  return result.ok
    ? { ok: true, preview: result.preview }
    : { ok: false, error: result.error };
}

export type JoinActionResult =
  | { ok: true; playerId: string; playerName: string }
  | { ok: false; error: JoinProblem | "rate-limited" };

export type JoinConfirmation =
  | { via: "personal"; token: string }
  | { via: "general-existing"; token: string; playerId: string }
  | { via: "general-new"; token: string; name: string };

/**
 * Confirm a join and hand this installation its credential.
 *
 * The bound-installation check happens here rather than in the service because
 * it reads a cookie: a bound installation may not switch Players, and must not
 * consume the invitation on the way to being told so (decision 38).
 */
export async function confirmJoinAction(
  confirmation: JoinConfirmation,
): Promise<JoinActionResult> {
  if (!onboardingLimiter.check(await clientIp()).allowed) {
    return { ok: false, error: "rate-limited" };
  }

  // The credential goes *into* the transaction rather than being checked
  // against here: confirmJoin re-resolves it under the onboarding lock, so a
  // bound installation can't slip a join through between check and commit.
  const presented = (await cookies()).get(BINDING_COOKIE)?.value ?? null;

  const result = await confirmJoin(getDb(), confirmation, new Date(), presented);
  if (!result.ok) return { ok: false, error: result.error };

  await setBindingCookie(result.credential);

  // The whole app was rendering the Not Joined screen a moment ago.
  revalidatePath("/", "layout");

  return {
    ok: true,
    playerId: result.playerId,
    playerName: result.playerName,
  };
}
