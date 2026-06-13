// Tier 1 — golden-master fixtures (ADR-0008, rating-engine.md). Hand-verified
// scenario logs with exact expected `current_rating` + `rating_history`. These
// double as the human-readable spec of the formula: a deliberate formula change
// regenerates the expected numbers, and the diff is the reviewed blast radius.

import { describe, expect, it } from "vitest";
import { projectGroup } from "./engine";
import { goldenSinglesSingleMatch, goldenSinglesUpset } from "./fixtures";

describe("golden master — one singles match (issue 03)", () => {
  const { currentRating, ratingHistory } = projectGroup(
    goldenSinglesSingleMatch.log,
  );
  const exp = goldenSinglesSingleMatch.expected;

  it("produces exact current_rating: +/-16 around 1000", () => {
    expect(currentRating.get("p1")!.rating).toBe(exp.current.p1.rating);
    expect(currentRating.get("p2")!.rating).toBe(exp.current.p2.rating);
    expect(currentRating.get("p1")!.competitiveMatchesPlayed).toBe(1);
    expect(currentRating.get("p2")!.competitiveMatchesPlayed).toBe(1);
  });

  it("is unranked after one match (threshold 3) and stamps lastMatchAt", () => {
    expect(currentRating.get("p1")!.isRanked).toBe(false);
    expect(currentRating.get("p1")!.lastMatchAt).toEqual(
      goldenSinglesSingleMatch.log[0].playedAt,
    );
  });

  it("produces exact rating_history rows", () => {
    expect(ratingHistory).toHaveLength(2);
    for (const e of exp.history) {
      const row = ratingHistory.find((r) => r.playerId === e.playerId)!;
      expect(row.matchId).toBe(e.matchId);
      expect(row.ratingBefore).toBe(e.before);
      expect(row.delta).toBe(e.delta);
      expect(row.ratingAfter).toBe(e.after);
      expect(row.winProbability).toBe(e.winProb);
      expect(row.wasProvisional).toBe(false);
    }
  });
});

describe("golden master — singles upset (exercises the 400-divisor logistic)", () => {
  const { currentRating, ratingHistory } = projectGroup(goldenSinglesUpset.log);
  const exp = goldenSinglesUpset.expected;

  it("matches the hand-computed logistic ratings to 6 dp", () => {
    expect(currentRating.get("p1")!.rating).toBeCloseTo(exp.current.p1.rating, 5);
    expect(currentRating.get("p2")!.rating).toBeCloseTo(exp.current.p2.rating, 5);
  });

  it("uses the asymmetric expected score and delta in match 2", () => {
    const winnerRow = ratingHistory.find(
      (r) => r.matchId === "m2" && r.playerId === "p2",
    )!;
    expect(winnerRow.winProbability).toBeCloseTo(exp.m2.expectedWinner, 5);
    expect(winnerRow.delta).toBeCloseTo(exp.m2.delta, 5);
  });
});
