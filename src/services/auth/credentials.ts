import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Bearer secrets for Device Bindings and Onboarding Links. Both are the whole
// secret of whoever holds them, so both are CSPRNG output, never derived from
// a Player id or any other guessable value (spec decision 47).

/** 256 bits — far past guessing, still a short-enough URL segment. */
const TOKEN_BYTES = 32;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * The stored form of a Device Binding credential. SHA-256 rather than scrypt
 * is the right call here: the input is 256 bits of randomness, so there is no
 * low-entropy password for an attacker to grind — a slow KDF would only tax
 * every request. Hashing still means a leaked database grants no access.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests of equal length. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
