"use server";

import { revalidatePath } from "next/cache";
import { loginAdmin, logoutAdmin, requireAdmin } from "@/services/auth/admin";
import { getDb } from "@/services/db";
import {
  createPlayer,
  renamePlayer,
  retirePlayer,
  rotatePersonalToken,
} from "@/services/players";
import { setNamePickerEnabled } from "@/services/settings";

export type FormState = { error?: string };

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const result = await loginAdmin(password);
  if (result === "unconfigured") {
    return {
      error: "Admin login isn't configured on this server (ADMIN_PASSWORD is unset).",
    };
  }
  if (result === "wrong-password") {
    return { error: "Wrong password" };
  }
  revalidatePath("/admin");
  return {};
}

export async function logoutAction(): Promise<void> {
  await logoutAdmin();
  revalidatePath("/admin");
}

export async function createPlayerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  if (!name.trim()) return { error: "Name must not be blank" };
  await createPlayer(getDb(), name);
  revalidatePath("/admin");
  return {};
}

export async function renamePlayerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!name.trim()) return; // blank rename is a no-op, not an error page
  await renamePlayer(getDb(), playerId, name);
  revalidatePath("/admin");
}

export async function retirePlayerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await retirePlayer(getDb(), String(formData.get("playerId") ?? ""));
  revalidatePath("/admin");
}

export async function rotateTokenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await rotatePersonalToken(getDb(), String(formData.get("playerId") ?? ""));
  revalidatePath("/admin");
}

export async function setNamePickerAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await setNamePickerEnabled(getDb(), enabled);
  revalidatePath("/admin");
  revalidatePath("/");
}
