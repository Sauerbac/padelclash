"use server";

import { revalidatePath } from "next/cache";
import { loginAdmin, logoutAdmin, requireAdmin } from "@/services/auth/admin";
import { listBindingHistory, type BindingRecord } from "@/services/access";
import { clientIp } from "@/services/auth/client-ip";
import { getDb } from "@/services/db";
import {
  PlayerNameError,
  PlayerNotFoundError,
  PlayerReferencedError,
} from "@/services/errors";
import {
  generateGeneralLink,
  generatePersonalLink,
  getGeneralLink,
  revokeAccess,
  revokeGeneralLink,
  revokePersonalLink,
  type LinkDetails,
} from "@/services/onboarding";
import {
  createPlayer,
  deletePlayer,
  renamePlayer,
  restorePlayer,
  retirePlayer,
} from "@/services/players";
import { adminLoginLimiter, adminMutationLimiter } from "@/services/rate-limit";

/** Every admin mutation reports the same shape; `error` is prose for the UI. */
export type AdminResult = { ok: true } | { ok: false; error: string };

export type LinkResult =
  | { ok: true; link: LinkDetails }
  | { ok: false; error: string };

export type FormState = { error?: string };

// ---- Session ---------------------------------------------------------------

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // The one endpoint here guarding a low-entropy secret, so the one worth
  // throttling hard (spec decision 55).
  if (!adminLoginLimiter.check(await clientIp()).allowed) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const password = String(formData.get("password") ?? "");
  const result = await loginAdmin(password);
  if (result === "unconfigured") {
    return {
      error:
        "Admin login isn't configured on this server (ADMIN_PASSWORD is unset).",
    };
  }
  if (result === "wrong-password") return { error: "Wrong password. Nice try." };

  revalidatePath("/admin");
  return {};
}

export async function logoutAction(): Promise<void> {
  await logoutAdmin();
  revalidatePath("/admin");
}

// ---- Roster ----------------------------------------------------------------

export async function createPlayerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  try {
    await createPlayer(getDb(), String(formData.get("name") ?? ""));
  } catch (err) {
    if (err instanceof PlayerNameError) return { error: err.message };
    throw err;
  }
  revalidateAdminViews();
  return {};
}

export async function renamePlayerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  try {
    await renamePlayer(
      getDb(),
      String(formData.get("playerId") ?? ""),
      String(formData.get("name") ?? ""),
    );
  } catch (err) {
    if (err instanceof PlayerNameError) return { error: err.message };
    if (err instanceof PlayerNotFoundError) return { error: err.message };
    throw err;
  }
  revalidateAdminViews();
  return {};
}

/** Retiring also ends access — see retirePlayer (spec decision 39). */
export async function retirePlayerAction(playerId: string): Promise<AdminResult> {
  return adminMutation(() => retirePlayer(getDb(), playerId));
}

export async function restorePlayerAction(
  playerId: string,
): Promise<AdminResult> {
  return adminMutation(() => restorePlayer(getDb(), playerId));
}

/** Refuses while the match log still references the Player (decision 31). */
export async function deletePlayerAction(
  playerId: string,
): Promise<AdminResult> {
  return adminMutation(() => deletePlayer(getDb(), playerId));
}

// ---- Onboarding links ------------------------------------------------------

/**
 * Issue a Personal Link. This is the same action behind Admin's "Replace
 * device" button for a Joined Player: the existing binding deliberately stays
 * live until the new link is actually used (decisions 32 and 45).
 */
export async function generatePersonalLinkAction(
  playerId: string,
): Promise<LinkResult> {
  await requireAdmin();
  if (!adminMutationLimiter.check(await clientIp()).allowed) {
    return { ok: false, error: "Too many link operations. Try again shortly." };
  }
  try {
    return { ok: true, link: await generatePersonalLink(getDb(), playerId) };
  } catch (err) {
    if (err instanceof PlayerNotFoundError) {
      return { ok: false, error: "That Player can't be invited." };
    }
    throw err;
  } finally {
    revalidateAdminViews();
  }
}

export async function revokePersonalLinkAction(
  playerId: string,
): Promise<AdminResult> {
  return adminMutation(() => revokePersonalLink(getDb(), playerId));
}

/**
 * "Revoke access": binding, Personal Link, and the circle's General Link all
 * fall together, so the Player can't be reclaimed through an invitation that
 * is already in the group chat (decisions 45 and 46).
 */
export async function revokeAccessAction(
  playerId: string,
): Promise<AdminResult> {
  return adminMutation(() => revokeAccess(getDb(), playerId));
}

export async function generateGeneralLinkAction(): Promise<LinkResult> {
  await requireAdmin();
  if (!adminMutationLimiter.check(await clientIp()).allowed) {
    return { ok: false, error: "Too many link operations. Try again shortly." };
  }
  const result = await generateGeneralLink(getDb());
  revalidateAdminViews();
  if (!result.ok) {
    return {
      ok: false,
      error:
        "A General Link is already active — copy that one, or revoke it first.",
    };
  }
  return { ok: true, link: result.link };
}

export async function revokeGeneralLinkAction(): Promise<AdminResult> {
  return adminMutation(() => revokeGeneralLink(getDb()));
}

/**
 * A Player's full binding history, revoked entries included (decision 53).
 * Admin-only, and hash-free: it answers "when did this device last check in,
 * and when did the previous one stop working" without handing out anything
 * that could be replayed as a credential.
 */
export async function getBindingHistoryAction(
  playerId: string,
): Promise<BindingRecord[]> {
  await requireAdmin();
  return listBindingHistory(getDb(), playerId);
}

/** The live General Link, for the Admin panel's copy button. */
export async function getGeneralLinkAction(): Promise<LinkDetails | null> {
  await requireAdmin();
  return getGeneralLink(getDb());
}

// ---- Shared plumbing -------------------------------------------------------

async function adminMutation(
  run: () => Promise<unknown>,
): Promise<AdminResult> {
  await requireAdmin();
  // Covers the onboarding mutations that reach here — revoking a Personal
  // Link, revoking the General Link, emergency "Revoke access" — as well as
  // roster lifecycle changes.
  if (!adminMutationLimiter.check(await clientIp()).allowed) {
    return { ok: false, error: "Too many changes at once. Try again shortly." };
  }
  try {
    await run();
  } catch (err) {
    // The expected refusals carry prose worth showing; anything else is a bug
    // and should surface as a real error.
    if (
      err instanceof PlayerReferencedError ||
      err instanceof PlayerNotFoundError ||
      err instanceof PlayerNameError
    ) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
  revalidateAdminViews();
  return { ok: true };
}

// Roster changes move names and access across every player-facing screen.
function revalidateAdminViews(): void {
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}
