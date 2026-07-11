// Property tests: hold over any random valid log. A seeded generator keeps
// failures reproducible without pulling in a property-testing dependency.
// Several seeds stand in for "any log".

import { describe, expect, it } from "vitest";
import { projectGroup } from "./engine";
import { randomSinglesLog, serializeProjection, shuffle } from "./fixtures";

const SEEDS = [1, 2, 7, 42, 1337, 99999];

describe("determinism — same log yields byte-identical projection", () => {
  it.each(SEEDS)("seed %i", (seed) => {
    const log = randomSinglesLog(seed);
    expect(serializeProjection(projectGroup(log))).toBe(
      serializeProjection(projectGroup(log)),
    );
  });
});

describe("insertion-order independence — any order yields identical projection", () => {
  it.each(SEEDS)("seed %i", (seed) => {
    const log = randomSinglesLog(seed);
    const reference = serializeProjection(projectGroup(log));
    // Three independent shuffles of the same log must all project identically.
    for (const s of [seed + 1, seed * 3 + 5, seed ^ 0x5a5a]) {
      expect(serializeProjection(projectGroup(shuffle(log, s)))).toBe(reference);
    }
  });
});

describe("per-match conservation — deltas across both Sides sum to zero", () => {
  it.each(SEEDS)("seed %i", (seed) => {
    const { ratingHistory } = projectGroup(randomSinglesLog(seed));
    const byMatch = new Map<string, number>();
    for (const r of ratingHistory) {
      byMatch.set(r.matchId, (byMatch.get(r.matchId) ?? 0) + r.delta);
    }
    expect(byMatch.size).toBeGreaterThan(0);
    for (const sum of byMatch.values()) {
      expect(sum).toBeCloseTo(0, 10);
    }
  });
});

describe("idempotent rebuild — replaying twice yields identical rows", () => {
  it.each(SEEDS)("seed %i", (seed) => {
    const log = randomSinglesLog(seed);
    // A fresh from-scratch projection of an already-projected log must match:
    // there is no snapshot that could drift.
    const once = serializeProjection(projectGroup(log));
    const twice = serializeProjection(projectGroup(log.slice()));
    expect(twice).toBe(once);
  });
});

describe("non-competitive and voided matches are excluded from the stream", () => {
  it("a casual or voided match does not move ratings", () => {
    const base = randomSinglesLog(3, 4, 10);
    const ratings = (log: ReturnType<typeof randomSinglesLog>) =>
      serializeProjection(projectGroup(log));
    const withCasual = base.concat({
      ...base[0],
      id: "casual1",
      classification: "casual",
    });
    const withVoided = base.concat({
      ...base[0],
      id: "voided1",
      status: "voided",
    });
    expect(ratings(withCasual)).toBe(ratings(base));
    expect(ratings(withVoided)).toBe(ratings(base));
  });
});
