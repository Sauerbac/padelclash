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
import {
  deleteMatch,
  editMatch,
  getFeed,
  getLeaderboard,
  getMatch,
  logMatch,
} from "./matches";

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

  it("a delete racing a log is serialized — projections miss nothing", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");
    const doomed = await logMatch(db, singles(simon, alex));

    // One device deletes while another logs. Both writers must take the
    // advisory lock, or one commits a replay missing the other's change.
    await Promise.all([
      deleteMatch(db, doomed.match.id, { playerId: simon.id, isAdmin: false }),
      logMatch(db, singles(casey, dana)),
    ]);

    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Simon")?.matchesPlayed).toBe(0);
    expect(byName.get("Simon")?.rating).toBe(1000);
    expect(byName.get("Casey")?.matchesPlayed).toBe(1);
    expect(byName.get("Casey")?.rating).toBeCloseTo(1016);
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

  it("deleting a match replays projections as if it was never logged", async () => {
    await logMatch(db, singles(simon, alex));
    const second = await logMatch(db, singles(simon, alex));

    // The Logger deletes their own fresh match (well inside the 24 h window).
    await deleteMatch(db, second.match.id, {
      playerId: simon.id,
      isAdmin: false,
    });

    // Projections read as if only the first match exists: one match each,
    // ratings back at the single-match values.
    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Simon")?.matchesPlayed).toBe(1);
    expect(byName.get("Simon")?.rating).toBeCloseTo(1016);
    expect(byName.get("Alex")?.rating).toBeCloseTo(984);
    expect(byName.get("Simon")?.wins).toBe(1);
    expect(byName.get("Alex")?.losses).toBe(1);
  });

  it("enforces edit rights on delete: not yours / window over / admin", async () => {
    const logged = await logMatch(db, singles(simon, alex));
    const hours25 = new Date(Date.now() + 25 * 60 * 60 * 1000);

    // Someone else's match: denied, and the log is untouched.
    await expect(
      deleteMatch(db, logged.match.id, { playerId: alex.id, isAdmin: false }),
    ).rejects.toThrow(/logger|admin/i);
    // An unbound device: denied.
    await expect(
      deleteMatch(db, logged.match.id, { playerId: null, isAdmin: false }),
    ).rejects.toThrow(/logger|admin/i);
    // The Logger, but the 24 h grace window has passed: denied.
    await expect(
      deleteMatch(
        db,
        logged.match.id,
        { playerId: simon.id, isAdmin: false },
        hours25,
      ),
    ).rejects.toThrow(/logger|admin/i);

    const afterDenials = await getLeaderboard(db);
    expect(afterDenials.find((e) => e.playerId === simon.id)?.wins).toBe(1);

    // The admin can delete any match at any age.
    await deleteMatch(
      db,
      logged.match.id,
      { playerId: null, isAdmin: true },
      hours25,
    );
    const afterAdmin = await getLeaderboard(db);
    expect(afterAdmin.every((e) => e.matchesPlayed === 0)).toBe(true);
  });

  it("editing a match's winner rewrites the projections", async () => {
    // Simon logged himself as the winner by mistake; Alex actually won.
    const logged = await logMatch(db, singles(simon, alex));

    const edited = await editMatch(
      db,
      {
        id: logged.match.id,
        playedAt: logged.match.playedAt,
        sides: { A: [simon.id], B: [alex.id] },
        winnerSide: "B",
        sets: null,
      },
      { playerId: simon.id, isAdmin: false },
    );

    // The corrected deltas come back (for a payoff-style confirmation)…
    const bySide = Object.fromEntries(edited.deltas.map((d) => [d.side, d]));
    expect(bySide.A.delta).toBeCloseTo(-16);
    expect(bySide.B.delta).toBeCloseTo(16);

    // …and the projections read as if the match was always logged that way.
    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Alex")?.rating).toBeCloseTo(1016);
    expect(byName.get("Alex")?.wins).toBe(1);
    expect(byName.get("Simon")?.rating).toBeCloseTo(984);
    expect(byName.get("Simon")?.losses).toBe(1);
  });

  it("editing playedAt re-slots the match into replay order", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");

    await logMatch(db, singles(simon, alex, { playedAt: day1 }));
    const second = await logMatch(
      db,
      singles(casey, simon, { playedAt: day2 }),
    );

    // "Actually we played that before the other one" — move it to day 0.
    await editMatch(
      db,
      {
        id: second.match.id,
        playedAt: new Date("2026-07-08T18:00:00Z"),
        sides: { A: [casey.id], B: [simon.id] },
        winnerSide: "A",
        sets: null,
      },
      { playerId: casey.id, isAdmin: false },
    );

    // Same worked example as the late-sync test: with Casey's win first,
    // Casey ends at exactly 1016 and Simon beats Alex from 984 for ≈ 1000.74.
    const byName = new Map(
      (await getLeaderboard(db)).map((e) => [e.name, e.rating]),
    );
    expect(byName.get("Casey")).toBeCloseTo(1016, 5);
    expect(byName.get("Simon")).toBeCloseTo(1000.74, 1);
    expect(byName.get("Alex")).toBeCloseTo(983.26, 1);
  });

  it("editing sides and sets replaces the participants wholesale", async () => {
    // Logged against the wrong opponent: it was Casey, not Alex.
    const casey = await createPlayer(db, "Casey");
    const logged = await logMatch(db, singles(simon, alex));

    const sets = [{ a: 6, b: 3 }];
    const edited = await editMatch(
      db,
      {
        id: logged.match.id,
        playedAt: logged.match.playedAt,
        sides: { A: [simon.id], B: [casey.id] },
        winnerSide: "A",
        sets,
      },
      { playerId: simon.id, isAdmin: false },
    );

    expect(edited.match.sets).toEqual(sets);

    // Alex was never in this match: no record, no rating movement.
    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Alex")?.matchesPlayed).toBe(0);
    expect(byName.get("Alex")?.rating).toBe(1000);
    expect(byName.get("Casey")?.losses).toBe(1);
    expect(byName.get("Casey")?.rating).toBeCloseTo(984);
  });

  it("enforces edit rights and input validation on edit", async () => {
    const logged = await logMatch(db, singles(simon, alex));
    const correction = {
      id: logged.match.id,
      playedAt: logged.match.playedAt,
      sides: { A: [simon.id], B: [alex.id] },
      winnerSide: "B" as const,
      sets: null,
    };

    // Not the Logger: denied, and the match is unchanged.
    await expect(
      editMatch(db, correction, { playerId: alex.id, isAdmin: false }),
    ).rejects.toThrow(/logger|admin/i);
    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Simon")?.wins).toBe(1);

    // Malformed sides are rejected by the same rules as logMatch.
    await expect(
      editMatch(
        db,
        { ...correction, sides: { A: [simon.id], B: [simon.id] } },
        { playerId: simon.id, isAdmin: false },
      ),
    ).rejects.toThrow(/side/i);
    await expect(
      editMatch(
        db,
        { ...correction, sets: [{ a: -1, b: 6 }] },
        { playerId: simon.id, isAdmin: false },
      ),
    ).rejects.toThrow(/set/i);
  });

  it("deleting an unknown match id fails loudly", async () => {
    await expect(
      deleteMatch(db, uuidv7(), { playerId: null, isAdmin: true }),
    ).rejects.toThrow(/not found/i);
  });

  it("the feed lists matches newest-first with sides, names and deltas", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");
    const sets = [{ a: 6, b: 4 }];

    // Logged out of order — the feed sorts by when they were played.
    await logMatch(db, singles(casey, simon, { playedAt: day2 }));
    await logMatch(db, singles(simon, alex, { playedAt: day1, sets }));

    const feed = await getFeed(db);

    expect(feed.map((m) => m.playedAt)).toEqual([day2, day1]);

    const [newest, oldest] = feed;
    expect(newest.winnerSide).toBe("A");
    expect(newest.sets).toBeNull();
    expect(newest.loggedBy).toBe(casey.id);
    expect(
      newest.participants.map((p) => [p.name, p.side]),
    ).toEqual([
      ["Casey", "A"],
      ["Simon", "B"],
    ]);
    // Deltas come from rating_history: day 1 replays first, so Casey's day 2
    // win is against a 1016-rated Simon (E ≈ 0.523 for Simon → Casey +16.74).
    const caseyRow = newest.participants[0];
    expect(caseyRow.delta).toBeCloseTo(16.74, 1);
    expect(caseyRow.ratingAfter).toBeCloseTo(1016.74, 1);

    expect(oldest.sets).toEqual(sets);
    expect(oldest.participants.map((p) => p.name)).toEqual(["Simon", "Alex"]);
    expect(oldest.participants[0].delta).toBeCloseTo(16);
  });

  it("fetches a single match with named, sided participants", async () => {
    const sets = [{ a: 6, b: 4 }];
    const logged = await logMatch(db, singles(simon, alex, { sets }));

    const found = await getMatch(db, logged.match.id);
    expect(found?.match.sets).toEqual(sets);
    expect(
      found?.participants.map((p) => [p.name, p.side]),
    ).toEqual([
      ["Simon", "A"],
      ["Alex", "B"],
    ]);

    // Unknown ids — including non-uuid junk from the URL — are just null.
    expect(await getMatch(db, uuidv7())).toBeNull();
    expect(await getMatch(db, "not-a-uuid")).toBeNull();
  });

  it("the feed keeps naming retired players in their old matches", async () => {
    await logMatch(db, singles(simon, alex));
    await retirePlayer(db, alex.id);

    const feed = await getFeed(db);
    expect(feed[0].participants.map((p) => p.name)).toEqual(["Simon", "Alex"]);
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
