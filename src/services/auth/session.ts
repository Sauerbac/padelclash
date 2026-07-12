import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless admin session: `<expiresAtMs>.<hmac(secret, expiresAtMs)>`.
// No session table — possession of a valid signature is the session.

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// Timing-safe equality via HMAC of both sides: handles unequal lengths
// without leaking length info through an early return.
function timingSafeCompare(a: string, b: string): boolean {
  const key = "timing-safe-compare";
  return timingSafeEqual(
    Buffer.from(sign(key, a)),
    Buffer.from(sign(key, b)),
  );
}

export function createAdminSessionToken(
  secret: string,
  expiresAt: Date,
): string {
  const payload = String(expiresAt.getTime());
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyAdminPassword(
  supplied: string,
  expected: string,
): boolean {
  return timingSafeCompare(supplied, expected);
}

export function verifyAdminSessionToken(
  secret: string,
  token: string,
  now: Date,
): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!timingSafeCompare(signature, sign(secret, payload))) return false;
  const expiresAtMs = Number(payload);
  return Number.isFinite(expiresAtMs) && now.getTime() < expiresAtMs;
}
