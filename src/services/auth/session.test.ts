import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "./session";

const secret = "test-secret";

describe("admin session token", () => {
  it("verifies a token it created before expiry", () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const expiresAt = new Date("2026-08-10T12:00:00Z");
    const token = createAdminSessionToken(secret, expiresAt);
    expect(verifyAdminSessionToken(secret, token, now)).toBe(true);
  });

  it("rejects a token past its expiry", () => {
    const expiresAt = new Date("2026-07-11T12:00:00Z");
    const token = createAdminSessionToken(secret, expiresAt);
    const later = new Date("2026-07-11T12:00:01Z");
    expect(verifyAdminSessionToken(secret, token, later)).toBe(false);
  });

  it("rejects a token whose expiry was tampered with", () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const token = createAdminSessionToken(secret, new Date("2026-07-12T12:00:00Z"));
    const [, signature] = token.split(".");
    const farFuture = new Date("2036-07-11T12:00:00Z").getTime();
    expect(
      verifyAdminSessionToken(secret, `${farFuture}.${signature}`, now),
    ).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const token = createAdminSessionToken("other-secret", new Date("2026-08-10T12:00:00Z"));
    expect(verifyAdminSessionToken(secret, token, now)).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    const now = new Date("2026-07-11T12:00:00Z");
    for (const garbage of ["", "no-dot", ".", "123.", ".abc", "a.b.c"]) {
      expect(verifyAdminSessionToken(secret, garbage, now)).toBe(false);
    }
  });
});

describe("admin password check", () => {
  it("accepts the configured password and rejects everything else", () => {
    expect(verifyAdminPassword("hunter2", "hunter2")).toBe(true);
    expect(verifyAdminPassword("hunter3", "hunter2")).toBe(false);
    expect(verifyAdminPassword("", "hunter2")).toBe(false);
    expect(verifyAdminPassword("hunter22", "hunter2")).toBe(false);
  });
});
