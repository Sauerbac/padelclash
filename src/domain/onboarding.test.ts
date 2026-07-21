import { describe, expect, it } from "vitest";
import {
  GENERAL_LINK_TTL_MS,
  PERSONAL_LINK_TTL_MS,
  invitationExpiryFrom,
  invitationState,
  isInvitationValid,
  playerStatus,
} from "./onboarding";

const NOW = new Date("2026-07-21T12:00:00Z");

function invitation(overrides: Partial<Parameters<typeof invitationState>[0]> = {}) {
  return {
    expiresAt: new Date(NOW.getTime() + 60_000),
    revokedAt: null,
    consumedAt: null,
    ...overrides,
  };
}

describe("invitationState", () => {
  it("is valid before expiry when neither revoked nor consumed", () => {
    expect(invitationState(invitation(), NOW)).toBe("valid");
    expect(isInvitationValid(invitation(), NOW)).toBe(true);
  });

  it("expires exactly at expiresAt, not a millisecond later", () => {
    const expiring = invitation({ expiresAt: NOW });
    expect(invitationState(expiring, NOW)).toBe("expired");
  });

  it("reports revocation ahead of consumption and expiry", () => {
    const dead = invitation({
      expiresAt: new Date(NOW.getTime() - 60_000),
      revokedAt: NOW,
      consumedAt: NOW,
    });
    expect(invitationState(dead, NOW)).toBe("revoked");
  });

  it("reports consumption ahead of expiry", () => {
    const used = invitation({
      expiresAt: new Date(NOW.getTime() - 60_000),
      consumedAt: NOW,
    });
    expect(invitationState(used, NOW)).toBe("consumed");
  });
});

describe("invitationExpiryFrom", () => {
  it("gives a Personal Link 7 days and a General Link 12 hours", () => {
    expect(invitationExpiryFrom("personal", NOW).getTime()).toBe(
      NOW.getTime() + PERSONAL_LINK_TTL_MS,
    );
    expect(invitationExpiryFrom("general", NOW).getTime()).toBe(
      NOW.getTime() + GENERAL_LINK_TTL_MS,
    );
  });
});

describe("playerStatus", () => {
  it("splits non-retired players by whether they hold a binding", () => {
    expect(playerStatus({ retiredAt: null }, true)).toBe("joined");
    expect(playerStatus({ retiredAt: null }, false)).toBe("not-joined");
  });

  it("reports retirement regardless of any leftover binding", () => {
    expect(playerStatus({ retiredAt: NOW }, true)).toBe("retired");
    expect(playerStatus({ retiredAt: NOW }, false)).toBe("retired");
  });
});
