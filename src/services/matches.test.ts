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
import { STARTING_RATING } from "../domain/rating/engine";
import {
  guestParticipant as guest,
  playerParticipant as player,
} from "../domain/match-participant";
import { createPlayer, retirePlayer } from "./players";
import {
  deleteMatch,
  editMatch,
  getFeed,
  getLeaderboard,
  getMatch,
  getPlayerDetail,
  logMatch,
  MatchValidationError,
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
    sides: { A: [player(winner.id)], B: [player(loser.id)] },
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
    // Both Players are in their first rated Match (K=80), so an even match yields ±40.
    const bySide = Object.fromEntries(result.deltas.map((d) => [d.side, d]));
    expect(bySide.A.playerId).toBe(simon.id);
    expect(bySide.A.delta).toBe(40);
    expect(bySide.A.ratingAfter).toBe(1040);
    expect(bySide.B.playerId).toBe(alex.id);
    expect(bySide.B.delta).toBe(-40);
    expect(bySide.B.ratingAfter).toBe(960);
  });

  it("a retried sync with the same id does not double-log", async () => {
    const input = singles(simon, alex);
    await logMatch(db, input);
    const retry = await logMatch(db, input);

    expect(retry.alreadyLogged).toBe(true);
    expect(retry.match.id).toBe(input.id);
    // The stored payoff still comes back so a retried submit can render it.
    const bySide = Object.fromEntries(retry.deltas.map((d) => [d.side, d]));
    expect(bySide.A.delta).toBe(40);

    // Exactly one match logged: Alex's rating dropped once, not twice.
    const leaderboard = await getLeaderboard(db);
    const alexRow = leaderboard.find((e) => e.playerId === alex.id);
    expect(alexRow?.rating).toBe(960);
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

  it("updates every doubles participant independently", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");

    const result = await logMatch(db, {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: {
        A: [player(simon.id), player(casey.id)],
        B: [player(alex.id), player(dana.id)],
      },
      winnerSide: "A",
    });

    // Four Players in their first rated Match independently move by ±40.
    expect(result.deltas).toHaveLength(4);
    for (const d of result.deltas) {
      expect(d.delta).toBe(d.side === "A" ? 40 : -40);
    }
  });

  it("persists a Guest while emitting Rating output only for Players", async () => {
    const casey = await createPlayer(db, "Casey");
    const result = await logMatch(db, {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: {
        A: [player(simon.id), guest("  Visiting   Pat  ")],
        B: [player(alex.id), player(casey.id)],
      },
      winnerSide: "A",
    });

    expect(result.deltas).toHaveLength(3);
    expect(result.deltas.map((row) => row.playerId).sort()).toEqual(
      [simon.id, alex.id, casey.id].sort(),
    );

    const feed = await getFeed(db);
    expect(feed[0].participants.map((participant) => participant.kind)).toEqual([
      "player",
      "guest",
      "player",
      "player",
    ]);
    expect(feed[0].participants[1]).toEqual({
      kind: "guest",
      name: "Visiting Pat",
      side: "A",
      slot: 1,
    });

    const simonDetail = await getPlayerDetail(db, simon.id);
    expect(simonDetail?.wins).toBe(1);
    expect(simonDetail?.partners).toEqual([]);
    expect(simonDetail?.headToHead.map((record) => record.name)).toEqual([
      "Alex",
      "Casey",
    ]);

    const alexDetail = await getPlayerDetail(db, alex.id);
    expect(alexDetail?.partners).toEqual([
      {
        playerId: casey.id,
        name: "Casey",
        wins: 0,
        losses: 1,
      },
    ]);
  });

  it("rejects invalid Guest boundaries and roster-name collisions", async () => {
    const casey = await createPlayer(db, "Casey");
    await retirePlayer(db, casey.id);

    await expect(
      logMatch(
        db,
        singles(simon, alex, {
          sides: { A: [guest("Visitor")], B: [player(alex.id)] },
        }),
      ),
    ).rejects.toThrow(/guest|player/i);

    await expect(
      logMatch(db, {
        ...singles(simon, alex),
        sides: {
          A: [guest("One"), guest("Two")],
          B: [player(simon.id), player(alex.id)],
        },
      }),
    ).rejects.toThrow(/player|guest/i);

    await expect(
      logMatch(db, {
        ...singles(simon, alex),
        sides: {
          A: [player(simon.id), guest("Visitor")],
          B: [player(alex.id), guest("  VISITOR ")],
        },
      }),
    ).rejects.toThrow(/unique/i);

    for (const reserved of ["simon", " CASEY "]) {
      await expect(
        logMatch(db, {
          ...singles(simon, alex),
          sides: {
            A: [player(simon.id), guest(reserved)],
            B: [player(alex.id), guest("Other Guest")],
          },
        }),
      ).rejects.toThrow(/roster/i);
    }
  });

  it("keeps a Guest retry idempotent and replaces Guests on edit", async () => {
    const casey = await createPlayer(db, "Casey");
    const input = {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: {
        A: [player(simon.id), guest("First Guest")],
        B: [player(alex.id), player(casey.id)],
      },
      winnerSide: "A" as const,
    };
    await logMatch(db, input);
    expect((await logMatch(db, input)).alreadyLogged).toBe(true);

    await editMatch(
      db,
      {
        id: input.id,
        playedAt: input.playedAt,
        sides: {
          A: [player(simon.id), guest("Replacement Guest")],
          B: [player(alex.id), player(casey.id)],
        },
        winnerSide: "A",
      },
      { playerId: simon.id, isAdmin: false },
    );

    const found = await getMatch(db, input.id);
    expect(found?.participants.map((participant) => participant.name)).toEqual([
      "Simon",
      "Replacement Guest",
      "Alex",
      "Casey",
    ]);
  });

  it("a late-synced earlier match slots into history by playedAt", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");

    // Day 2's match syncs first; day 1's match arrives late (offline queue).
    await logMatch(db, singles(simon, alex, { playedAt: day2 }));
    await logMatch(db, singles(casey, simon, { playedAt: day1 }));

    // Correct replay order (day 1 first): Casey reaches 1040 and Simon falls
    // to 960, then Simon gains 39 as an underdog against Alex.
    const byName = new Map(
      (await getLeaderboard(db)).map((e) => [e.name, e.rating]),
    );
    expect(byName.get("Casey")).toBe(1040);
    expect(byName.get("Simon")).toBe(999);
    expect(byName.get("Alex")).toBe(955);
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
      logMatch(
        db,
        singles(simon, alex, { sides: { A: [], B: [player(alex.id)] } }),
      ),
    ).rejects.toThrow(/side/i);
    await expect(
      logMatch(
        db,
        singles(simon, alex, {
          sides: {
            A: [player(simon.id), player(casey.id)],
            B: [player(alex.id)],
          },
        }),
      ),
    ).rejects.toThrow(/side/i);
    // …and a player appears on exactly one side, once.
    await expect(
      logMatch(
        db,
        singles(simon, alex, {
          sides: { A: [player(simon.id)], B: [player(simon.id)] },
        }),
      ),
    ).rejects.toThrow(/side/i);
    await expect(
      logMatch(db, {
        id: uuidv7(),
        playedAt: new Date(),
        loggedBy: simon.id,
        sides: {
          A: [player(simon.id), player(simon.id)],
          B: [player(alex.id), player(casey.id)],
        },
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
    await expect(
      logMatch(db, singles(simon, alex, { sets: [{ a: 6, b: 6 }] })),
    ).rejects.toThrow(/winner/i);
    await expect(
      logMatch(
        db,
        singles(simon, alex, {
          winnerSide: "A",
          sets: [
            { a: 6, b: 4 },
            { a: 3, b: 6 },
            { a: 4, b: 6 },
          ],
        }),
      ),
    ).rejects.toThrow(/declared|winner/i);
  });

  // The action layer distinguishes a permanent refusal from a transient one by
  // `instanceof` (spec decision 124): a bad payload is the Logger's problem, a
  // dropped connection is not. That only works if every rejection this service
  // raises for bad input is the typed error and not a bare Error.
  it("raises MatchValidationError, not a bare Error, for every bad payload", async () => {
    const badInputs = [
      singles(simon, alex, { sets: [{ a: 6, b: 6 }] }),
      { ...singles(simon, alex), sides: { A: [player(simon.id)], B: [] } },
      {
        ...singles(simon, alex),
        sides: { A: [player(simon.id)], B: [player(simon.id)] },
      },
      {
        ...singles(simon, alex),
        sides: {
          A: [player(simon.id), guest("Pat")],
          B: [player(alex.id), guest("Pat")],
        },
      },
    ];
    for (const input of badInputs) {
      await expect(logMatch(db, input)).rejects.toBeInstanceOf(
        MatchValidationError,
      );
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
    expect(byName.get("Casey")?.rating).toBe(1040);
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
    expect(byName.get("Simon")?.rating).toBe(1040);
    expect(byName.get("Alex")?.rating).toBe(960);
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
        sides: { A: [player(simon.id)], B: [player(alex.id)] },
        winnerSide: "B",
        sets: null,
      },
      { playerId: simon.id, isAdmin: false },
    );

    // The corrected deltas come back (for a payoff-style confirmation)…
    const bySide = Object.fromEntries(edited.deltas.map((d) => [d.side, d]));
    expect(bySide.A.delta).toBe(-40);
    expect(bySide.B.delta).toBe(40);

    // …and the projections read as if the match was always logged that way.
    const byName = new Map((await getLeaderboard(db)).map((e) => [e.name, e]));
    expect(byName.get("Alex")?.rating).toBe(1040);
    expect(byName.get("Alex")?.wins).toBe(1);
    expect(byName.get("Simon")?.rating).toBe(960);
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
        sides: { A: [player(casey.id)], B: [player(simon.id)] },
        winnerSide: "A",
        sets: null,
      },
      { playerId: casey.id, isAdmin: false },
    );

    // Same worked example as the late-sync test: with Casey's win first,
    // Casey ends at 1040 and Simon's later underdog win brings him to 999.
    const byName = new Map(
      (await getLeaderboard(db)).map((e) => [e.name, e.rating]),
    );
    expect(byName.get("Casey")).toBe(1040);
    expect(byName.get("Simon")).toBe(999);
    expect(byName.get("Alex")).toBe(955);
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
        sides: { A: [player(simon.id)], B: [player(casey.id)] },
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
    expect(byName.get("Casey")?.rating).toBe(955);
  });

  it("enforces edit rights and input validation on edit", async () => {
    const logged = await logMatch(db, singles(simon, alex));
    const correction = {
      id: logged.match.id,
      playedAt: logged.match.playedAt,
      sides: { A: [player(simon.id)], B: [player(alex.id)] },
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
        {
          ...correction,
          sides: { A: [player(simon.id)], B: [player(simon.id)] },
        },
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
    // Deltas come from rating_history: day 1 replays first, so Simon is at
    // 1043 and one step down the K taper when Casey's day-2 upset lands.
    const caseyRow = newest.participants[0];
    if (caseyRow.kind !== "player") throw new Error("Expected Player");
    expect(caseyRow.delta).toBe(45);
    expect(caseyRow.ratingAfter).toBe(1045);

    expect(oldest.sets).toEqual(sets);
    expect(oldest.participants.map((p) => p.name)).toEqual(["Simon", "Alex"]);
    const oldestWinner = oldest.participants[0];
    if (oldestWinner.kind !== "player") throw new Error("Expected Player");
    expect(oldestWinner.delta).toBe(43);
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

  it("player detail carries the headline stats: rating, rank, W–L", async () => {
    for (let i = 0; i < 3; i++) await logMatch(db, singles(simon, alex));

    const detail = await getPlayerDetail(db, simon.id);

    expect(detail?.name).toBe("Simon");
    expect(detail?.rank).toBe(1);
    expect(detail?.wins).toBe(3);
    expect(detail?.losses).toBe(0);
    // Provisional fold: 1000 → 1035 → 1063 → 1086.
    expect(detail?.rating).toBe(1086);

    const alexDetail = await getPlayerDetail(db, alex.id);
    expect(alexDetail?.rank).toBe(2);
    expect(alexDetail?.losses).toBe(3);
    expect(alexDetail?.rating).toBe(914);
  });

  it("player detail's rating series is chronological even when logged out of order", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");

    // Day 2's match syncs first; day 1's arrives late (offline queue).
    await logMatch(db, singles(simon, alex, { playedAt: day2 }));
    await logMatch(db, singles(casey, simon, { playedAt: day1 }));

    const detail = await getPlayerDetail(db, simon.id);

    // Same worked example as the late-sync test: Simon loses to Casey on
    // day 1 (1000 → 960), then beats Alex as an underdog and reaches 999.
    expect(detail?.ratingSeries.map((p) => p.playedAt)).toEqual([day1, day2]);
    expect(detail?.ratingSeries[0].ratingAfter).toBe(960);
    expect(detail?.ratingSeries[1].ratingAfter).toBe(999);
    // Each point carries its match's projection delta for the chart tooltip.
    expect(detail?.ratingSeries[0].delta).toBe(-40);
    expect(detail?.ratingSeries[1].delta).toBe(39);
  });

  it("player detail lists only that player's matches, newest first", async () => {
    const casey = await createPlayer(db, "Casey");
    const day1 = new Date("2026-07-09T18:00:00Z");
    const day2 = new Date("2026-07-10T18:00:00Z");
    const day3 = new Date("2026-07-11T18:00:00Z");

    await logMatch(db, singles(simon, alex, { playedAt: day1 }));
    await logMatch(db, singles(casey, alex, { playedAt: day2 })); // not Simon's
    await logMatch(db, singles(casey, simon, { playedAt: day3 }));

    const detail = await getPlayerDetail(db, simon.id);

    expect(detail?.matches.map((m) => m.playedAt)).toEqual([day3, day1]);
    // Feed-card shape: named, sided participants with their deltas.
    expect(
      detail?.matches[1].participants.map((p) => [p.name, p.side]),
    ).toEqual([
      ["Simon", "A"],
      ["Alex", "B"],
    ]);
    const detailWinner = detail?.matches[1].participants[0];
    expect(detailWinner?.kind).toBe("player");
    if (detailWinner?.kind === "player") {
      expect(detailWinner.delta).toBe(40);
    }
  });

  it("player detail tallies head-to-head records vs each opponent", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");

    await logMatch(db, singles(simon, alex));
    await logMatch(db, singles(simon, alex));
    // Doubles: everyone on the other side is an opponent.
    await logMatch(db, {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: {
        A: [player(simon.id), player(casey.id)],
        B: [player(alex.id), player(dana.id)],
      },
      winnerSide: "A",
    });
    await logMatch(db, singles(casey, simon));

    const detail = await getPlayerDetail(db, simon.id);

    // Most-faced first, ties by name: Alex ×3, then Casey/Dana ×1 each.
    expect(
      detail?.headToHead.map((o) => [o.name, o.wins, o.losses]),
    ).toEqual([
      ["Alex", 3, 0],
      ["Casey", 0, 1],
      ["Dana", 1, 0],
    ]);
  });

  it("player detail tallies partner records from doubles only", async () => {
    const casey = await createPlayer(db, "Casey");
    const dana = await createPlayer(db, "Dana");
    const doubles = (a: [Player, Player], b: [Player, Player]) => ({
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: {
        A: a.map((participant) => player(participant.id)),
        B: b.map((participant) => player(participant.id)),
      },
      winnerSide: "A" as const,
    });

    await logMatch(db, doubles([simon, casey], [alex, dana])); // won with Casey
    await logMatch(db, doubles([alex, casey], [simon, dana])); // lost with Dana
    await logMatch(db, singles(simon, alex)); // singles: no partner

    const detail = await getPlayerDetail(db, simon.id);

    expect(
      detail?.partners.map((p) => [p.name, p.wins, p.losses]),
    ).toEqual([
      ["Casey", 1, 0],
      ["Dana", 0, 1],
    ]);
  });

  it("retired players hold no rank and free their number", async () => {
    // Both reach the ranked threshold; Simon sits #1, Alex #2.
    for (let i = 0; i < 3; i++) await logMatch(db, singles(simon, alex));
    await retirePlayer(db, simon.id);

    // Rank belongs to the active leaderboard: the retiree shows unranked on
    // their page, and the remaining ranks close up (no gap at #1).
    expect((await getPlayerDetail(db, simon.id))?.rank).toBeNull();
    expect((await getPlayerDetail(db, alex.id))?.rank).toBe(1);
    const leaderboard = await getLeaderboard(db);
    expect(leaderboard.map((e) => [e.name, e.rank])).toEqual([["Alex", 1]]);
  });

  it("player detail covers retirees, matchless players and junk ids", async () => {
    await logMatch(db, singles(simon, alex));
    await retirePlayer(db, alex.id);

    // Retired players keep their page — history links to them.
    const retiree = await getPlayerDetail(db, alex.id);
    expect(retiree?.retired).toBe(true);
    expect(retiree?.losses).toBe(1);
    expect(retiree?.rating).toBe(960);

    // A player yet to play: starting rating, empty everything.
    const casey = await createPlayer(db, "Casey");
    const fresh = await getPlayerDetail(db, casey.id);
    expect(fresh).toMatchObject({
      rating: STARTING_RATING,
      rank: null,
      wins: 0,
      losses: 0,
      ratingSeries: [],
      matches: [],
      headToHead: [],
      partners: [],
    });

    // Unknown ids — including non-uuid junk from the URL — are just null.
    expect(await getPlayerDetail(db, uuidv7())).toBeNull();
    expect(await getPlayerDetail(db, "not-a-uuid")).toBeNull();
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
