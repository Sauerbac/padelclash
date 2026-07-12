import { describe, expect, it } from "vitest";
import { canModifyMatch } from "./edit-rights";

// Spec "Edit rights (players)": the Logger can edit or delete their own match
// within a 24 h grace window; older matches, or matches logged by someone
// else, are admin-only.

const LOGGED_AT = new Date("2026-07-12T10:00:00Z");
const match = { loggedBy: "player-1", loggedAt: LOGGED_AT };

function hoursLater(hours: number): Date {
  return new Date(LOGGED_AT.getTime() + hours * 60 * 60 * 1000);
}

describe("canModifyMatch", () => {
  it("lets the Logger modify their own match within the 24 h grace window", () => {
    const logger = { playerId: "player-1", isAdmin: false };
    expect(canModifyMatch(match, logger, hoursLater(1))).toBe(true);
    expect(canModifyMatch(match, logger, hoursLater(23.9))).toBe(true);
  });

  it("denies the Logger once the grace window has passed", () => {
    const logger = { playerId: "player-1", isAdmin: false };
    expect(canModifyMatch(match, logger, hoursLater(24.1))).toBe(false);
  });

  it("denies matches logged by someone else, and unbound devices", () => {
    const other = { playerId: "player-2", isAdmin: false };
    const unbound = { playerId: null, isAdmin: false };
    expect(canModifyMatch(match, other, hoursLater(1))).toBe(false);
    expect(canModifyMatch(match, unbound, hoursLater(1))).toBe(false);
  });

  it("lets the admin modify any match at any age", () => {
    const admin = { playerId: null, isAdmin: true };
    const adminWhoIsAlsoBound = { playerId: "player-2", isAdmin: true };
    expect(canModifyMatch(match, admin, hoursLater(1000))).toBe(true);
    expect(canModifyMatch(match, adminWhoIsAlsoBound, hoursLater(1000))).toBe(
      true,
    );
  });
});
