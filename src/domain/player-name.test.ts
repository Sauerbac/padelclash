import { describe, expect, it } from "vitest";
import {
  MAX_PLAYER_NAME_LENGTH,
  normalizePlayerName,
  type PlayerName,
} from "./player-name";

function name(raw: string): PlayerName {
  const result = normalizePlayerName(raw);
  if (!result.ok) throw new Error(`expected a valid name, got ${result.problem}`);
  return result.name;
}

describe("normalizePlayerName", () => {
  it("keeps display casing and folds only the uniqueness key", () => {
    expect(name("Simon")).toEqual({ display: "Simon", normalized: "simon" });
    expect(name("McTAVISH")).toEqual({
      display: "McTAVISH",
      normalized: "mctavish",
    });
  });

  it("trims and collapses whitespace, including exotic spaces", () => {
    expect(name("  Simon   Auerbach  ").display).toBe("Simon Auerbach");
    expect(name("Simon Auerbach").display).toBe("Simon Auerbach");
    expect(name("Simon\t\nAuerbach").display).toBe("Simon Auerbach");
  });

  it("compatibility-normalizes so lookalikes collide", () => {
    // Fullwidth Latin (U+FF33 ...) is the same name to a human reader.
    expect(name("Ｓｉｍｏｎ").normalized).toBe(
      name("Simon").normalized,
    );
  });

  it("strips zero-width characters used to fake a distinct name", () => {
    // Zero-width space, zero-width joiner, right-to-left mark, BOM.
    expect(name("Si​mon").normalized).toBe("simon");
    expect(name("Simon‍").normalized).toBe("simon");
    expect(name("‏Simon﻿").normalized).toBe("simon");
  });

  it("rejects names that are blank once normalized", () => {
    expect(normalizePlayerName("")).toEqual({ ok: false, problem: "blank" });
    expect(normalizePlayerName("   ")).toEqual({ ok: false, problem: "blank" });
    expect(normalizePlayerName("​​")).toEqual({
      ok: false,
      problem: "blank",
    });
  });

  it("rejects names longer than the roster limit", () => {
    const longest = "a".repeat(MAX_PLAYER_NAME_LENGTH);
    expect(name(longest).display).toBe(longest);
    expect(normalizePlayerName(longest + "a")).toEqual({
      ok: false,
      problem: "too-long",
    });
  });

  it("measures length after normalization, not before", () => {
    const padded = `  ${"a".repeat(MAX_PLAYER_NAME_LENGTH)}  `;
    expect(normalizePlayerName(padded).ok).toBe(true);
  });
});
