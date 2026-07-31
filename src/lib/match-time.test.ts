import { describe, expect, it } from "vitest";
import { formatPlayedAt } from "./match-time";

describe("formatPlayedAt", () => {
  it("uses Berlin summer time independently of the server timezone", () => {
    expect(formatPlayedAt(new Date("2026-07-31T12:00:00Z"))).toBe(
      "31 Jul, 14:00",
    );
  });

  it("uses Berlin winter time independently of the server timezone", () => {
    expect(formatPlayedAt(new Date("2026-01-31T12:00:00Z"))).toBe(
      "31 Jan, 13:00",
    );
  });
});
