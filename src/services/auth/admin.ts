import { scryptSync } from "node:crypto";
import { cookies } from "next/headers";
import { authCookieOptions } from "./cookie-options";
import {
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "./session";

// Single admin credential from the environment; no user table. The session
// cookie is a signed expiry timestamp — changing ADMIN_PASSWORD invalidates
// all admin sessions, which is exactly what you want.

export const ADMIN_COOKIE = "pc_admin";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// scrypt (not a plain hash) so a captured session cookie can't be used as a
// fast offline password-cracking oracle. Memoized: scrypt is deliberately slow.
let cachedSecret: { password: string; secret: string } | null = null;
function sessionSecret(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  if (cachedSecret?.password !== password) {
    cachedSecret = {
      password,
      secret: scryptSync(password, "padelclash-admin-session", 32).toString(
        "hex",
      ),
    };
  }
  return cachedSecret.secret;
}

export async function isAdmin(): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSessionToken(secret, token, new Date());
}

/** For server actions: fail loudly instead of silently doing admin work. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Admin session required");
}

export type LoginResult = "ok" | "wrong-password" | "unconfigured";

export async function loginAdmin(password: string): Promise<LoginResult> {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = sessionSecret();
  if (!expected || !secret) {
    console.error(
      "Admin login attempted but ADMIN_PASSWORD is not set — admin is disabled.",
    );
    return "unconfigured";
  }
  if (!verifyAdminPassword(password, expected)) return "wrong-password";

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const store = await cookies();
  store.set(
    ADMIN_COOKIE,
    createAdminSessionToken(secret, expiresAt),
    authCookieOptions(SESSION_MAX_AGE_SECONDS),
  );
  return "ok";
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
