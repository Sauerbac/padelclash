import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  getTestDb,
  hasDatabase,
  truncateAll,
} from "./db/test-db";
import type { Db } from "./db";
import type { Player } from "./db/schema";
import { uuidv7 } from "../lib/uuidv7";
import { createPlayer, retirePlayer } from "./players";
import { getLeaderboard, logMatch } from "./matches";

// Real-DB integration tests; skipped when no DATABASE_URL is configured.
// File-scoped so the pool closes once, after all suites (see players.test.ts).
afterAll(closeTestDb);

function singles(
  winner: Player,
  loser: Player,
  overrides: Partial<Parameters<typeof logMatch>[1]> = {},
) {
  return {
    id: uuidv7(),
    playedAt: new Date(),
    loggedBy: winner.id,
    sides: { A: [winner.id], B: [loser.id] },
    winnerSide: "A" as const,
    ...overrides,
  };
}

describe.skipIf(!hasDatabase)("matches service", () => {
  let db: Db;
  let simon: Player;
  let alex: Player;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
    simon = await createPlayer(db, "Simon");
    alex = await createPlayer(db, "Alex");
  });

  it("logs a singles match and returns each player's rating delta", async () => {
    const result = await logMatch(db, singles(simon, alex));

    expect(result.alreadyLogged).toBe(false);
    // Two fresh 1000-rated players, K=32: expected score 0.5, so ±16.
    const bySide = Object.fromEntries(result.deltas.map((d) => [d.side, d]));
    expect(bySide.A.playerId).toBe(simon.id);
    expect(bySide.A.delta).toBeCloseTo(16);
    expect(bySide.A.ratingAfter).toBeCloseTo(1016);
    expect(bySide.B.playerId).toBe(alex.id);
    expect(bySide.B.delta).toBeCloseTo(-16);
    expect(bySide.B.ratingAfter).toBeCloseTo(984);
  });

  it("a retried sync with the same id does not double-log", async () => {
    const input = singles(simon, alex);
    await logMatch(db, input);
    const retry = await logMatch(db, input);

    expect(retry.alreadyLogged).toBe(true);
    expect(retry.match.id).toBe(input.id);
    // The stored payoff still comes back so a retried submit can render it.
    const bySide = Object.fromEntries(retry.deltas.map((d) => [d.side, d]));
    expect(bySide.A.delta).toBeCloseTo(16);

    // Exactly one match logged: Alex's rating dropped once, not twice.
    const leaderboard = await getLeaderboard(db);
    const alexRow = leaderboard.find((e) => e.playerId === alex.id);
    expect(alexRow?.rating).toBeCloseTo(984);
  });

  it("ranks players after 3 matches and reports W–L", async () => {
    // Simon beats Alex three times; both reach the ranked threshold.
    for (let i = 0; i < 3; i++) await logMatch(db, singles(simon, alex));
    // Casey has played nothing; Dana is retired mid-roster.
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");
    await retirePlayer(db, dana.id);

    const leaderboard = await getLeaderboard(db);

    expect(
      leaderboard.map((e) => [e.name, e.rank, e.wins, e.losses]),
    ).toEqual([
      ["Simon", 1, 3, 0],
      ["Alex", 2, 0, 3],
      ["Casey", null, 0, 0],
    ]);
    const caseyRow = leaderboard[2];
    expect(caseyRow.playerId).toBe(casey.id);
    expect(caseyRow.rating).toBe(1000);
    expect(caseyRow.matchesPlayed).toBe(0);
  });

  it("splits the side delta equally in doubles", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");

    const result = await logMatch(db, {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: { A: [simon.id, casey.id], B: [alex.id, dana.id] },
      winnerSide: "A",
    });

    // Four fresh 1000s: side delta 16, split equally → ±8 per player.
    expect(result.deltas).toHaveLength(4);
    for (const d of result.deltas) {
      expect(d.delta).toBeCloseTo(d.side === "A" ? 8 : -8);
    }
  });

  it("a late-synced earlier match slots into history by playedAt", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");

    // Day 2's match syncs first; day 1's match arrives late (offline queue).
    await logMatch(db, singles(simon, alex, { playedAt: day2 }));
    await logMatch(db, singles(casey, simon, { playedAt: day1 }));

    // Correct replay order (day 1 first): Casey beats a 1000-rated Simon and
    // ends at exactly 1016; Simon then beats Alex from 984, gaining 16.74
    // (E = 1/(1 + 10^((1000-984)/400)) ≈ 0.477) → ≈ 1000.74. If the log were
    // replayed in logged order instead, Casey would sit at ≈ 1016.74.
    const byName = new Map(
      (await getLeaderboard(db)).map((e) => [e.name, e.rating]),
    );
    expect(byName.get("Casey")).toBeCloseTo(1016, 5);
    expect(byName.get("Simon")).toBeCloseTo(1000.74, 1);
    expect(byName.get("Alex")).toBeCloseTo(983.26, 1);
  });

  it("stores set scores and returns them with the match", async () => {
    const sets = [
      { a: 6, b: 4 },
      { a: 3, b: 6 },
      { a: 7, b: 5 },
    ];
    const result = await logMatch(db, singles(simon, alex, { sets }));
    expect(result.match.sets).toEqual(sets);

    // Simple Result stays first-class: no sets is stored as null.
    const simple = await logMatch(db, singles(simon, alex));
    expect(simple.match.sets).toBeNull();
  });

  it("rejects malformed sides", async () => {
    const casey = await createPlayer(db, "Casey");

    // Sides must be 1v1 or 2v2 (spec "Match")…
    await expect(
      logMatch(db, singles(simon, alex, { sides: { A: [], B: [alex.id] } })),
    ).rejects.toThrow(/side/i);
    await expect(
      logMatch(
        db,
        singles(simon, alex, {
          sides: { A: [simon.id, casey.id], B: [alex.id] },
        }),
      ),
    ).rejects.toThrow(/side/i);
    // …and a player appears on exactly one side, once.
    await expect(
      logMatch(
        db,
        singles(simon, alex, { sides: { A: [simon.id], B: [simon.id] } }),
      ),
    ).rejects.toThrow(/side/i);
    await expect(
      logMatch(db, {
        id: uuidv7(),
        playedAt: new Date(),
        loggedBy: simon.id,
        sides: { A: [simon.id, simon.id], B: [alex.id, casey.id] },
        winnerSide: "A",
      }),
    ).rejects.toThrow(/side/i);

    // Nothing was logged by the failed attempts.
    const leaderboard = await getLeaderboard(db);
    expect(leaderboard.every((e) => e.matchesPlayed === 0)).toBe(true);
  });

  it("rejects malformed set scores", async () => {
    const bad = [
      [] as { a: number; b: number }[], // sets on, but none entered
      [{ a: -1, b: 6 }], // negative games
      [{ a: 6.5, b: 4 }], // fractional games
      [{ a: 100, b: 4 }], // beyond the sanity cap
      Array.from({ length: 6 }, () => ({ a: 6, b: 4 })), // too many sets
    ];
    for (const sets of bad) {
      await expect(
        logMatch(db, singles(simon, alex, { sets })),
      ).rejects.toThrow(/set/i);
    }
  });

  it("concurrent logs are serialized — both land in the projections", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");

    // Two devices submit at the same moment. Without write serialization,
    // each replay would miss the other's match and the last commit would
    // overwrite the projections with a stale replay.
    await Promise.all([
      logMatch(db, singles(simon, alex)),
      logMatch(db, singles(casey, dana)),
    ]);

    const leaderboard = await getLeaderboard(db);
    expect(leaderboard).toHaveLength(4);
    expect(leaderboard.every((e) => e.matchesPlayed === 1)).toBe(true);
  });

  it("keeps players unranked until the third match", async () => {
    await logMatch(db, singles(simon, alex));
    await logMatch(db, singles(simon, alex));

    const leaderboard = await getLeaderboard(db);
    // Two matches each: both unranked, still ordered by rating.
    expect(leaderboard.map((e) => [e.name, e.rank])).toEqual([
      ["Simon", null],
      ["Alex", null],
    ]);
    expect(leaderboard[0].matchesPlayed).toBe(2);
  });
});
