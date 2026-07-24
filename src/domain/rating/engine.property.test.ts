import { describe, expect, it } from "vitest";
import { projectGroup, replayMatch, type PlayerState } from "./engine";
import {
  guest,
  match,
  player,
  randomSinglesLog,
  serializeProjection,
  shuffle,
} from "./fixtures";

const SEEDS = [1, 2, 7, 42, 1337, 99999];

describe("replay invariants", () => {
  it.each(SEEDS)("is deterministic and insertion-order independent for seed %i", (seed) => {
    const log = randomSinglesLog(seed);
    const reference = serializeProjection(projectGroup(log));
    expect(serializeProjection(projectGroup(log))).toBe(reference);
    expect(serializeProjection(projectGroup(shuffle(log, seed + 11)))).toBe(reference);
  });

  it.each(SEEDS)("always emits signed integer changes in the range 1…50 for seed %i", (seed) => {
    const log = randomSinglesLog(seed);
    const winnerByMatch = new Map(log.map((entry) => [entry.id, entry.winnerSide]));
    const { ratingHistory } = projectGroup(log);
    for (const row of ratingHistory) {
      expect(Number.isInteger(row.delta)).toBe(true);
      expect(Math.abs(row.delta)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(row.delta)).toBeLessThanOrEqual(50);
      expect(row.side === winnerByMatch.get(row.matchId) ? row.delta : -row.delta).toBeGreaterThan(0);
      expect(row.ratingAfter).toBe(row.ratingBefore + row.delta);
    }
  });

  it("uses one immutable snapshot regardless of participant iteration order", () => {
    const state = (rating: number): PlayerState => ({
      rating,
      competitiveMatchesPlayed: 3,
      matchesSinceReset: 3,
    });
    const prior = new Map([
      ["p1", state(800)],
      ["p2", state(1200)],
      ["p3", state(900)],
      ["p4", state(1100)],
    ]);
    const base = match({
      id: "ordered",
      a: ["p1", "p2"],
      b: ["p3", "p4"],
      winner: "A",
    });
    const reversed = {
      ...base,
      sides: {
        A: [...base.sides.A].reverse(),
        B: [...base.sides.B].reverse(),
      },
    };
    const canonical = (outputs: ReturnType<typeof replayMatch>["outputs"]) =>
      outputs.map((row) => [row.playerId, row.delta]).sort();
    expect(canonical(replayMatch(prior, reversed).outputs)).toEqual(
      canonical(replayMatch(prior, base).outputs),
    );
  });

  it("uses the same hidden rating for two opposing Guests", () => {
    const prior = new Map([
      ["p1", { rating: 800, competitiveMatchesPlayed: 3, matchesSinceReset: 3 }],
      ["p2", { rating: 1200, competitiveMatchesPlayed: 3, matchesSinceReset: 3 }],
    ]);
    const result = replayMatch(prior, {
      ...match({ id: "two-guests", a: [], b: [], winner: "A" }),
      sides: {
        A: [player("p1"), guest("One")],
        B: [player("p2"), guest("Two")],
      },
    });
    expect(result.outputs.map((row) => row.delta)).toEqual([42, -42]);
  });

  it("filters casual and voided matches from replay", () => {
    const base = randomSinglesLog(3, 4, 10);
    const reference = serializeProjection(projectGroup(base));
    expect(
      serializeProjection(projectGroup(base.concat({ ...base[0], id: "casual", classification: "casual" }))),
    ).toBe(reference);
    expect(
      serializeProjection(projectGroup(base.concat({ ...base[0], id: "voided", status: "voided" }))),
    ).toBe(reference);
  });
});
