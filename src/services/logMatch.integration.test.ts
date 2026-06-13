// Tier 3 — the one Postgres integration test (ADR-0008, rating-engine.md). It
// guards the WIRING, not the math: that the transactional DELETE-replay-insert
// rebuild in `logMatch` produces exactly what a pure from-scratch engine run
// produces on the same log. The formula itself is covered by the pure Tier 1/2
// tests; here a real `numeric`/`jsonb`/transaction must behave as in prod
// (ADR-0012), so this runs against the `padelclash_test` database.

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/db/ids";
import { setupTestDb, type TestDb } from "@/db/test-db";
import {
  currentRating,
  group,
  match,
  matchParticipant,
  player,
  ratingHistory,
} from "@/db/schema";
import {
  projectGroup,
  type EngineMatch,
  type MatchSide,
} from "@/domain/rating/engine";
import { logMatch } from "./logMatch";

let tdb: TestDb;

beforeAll(async () => {
  tdb = await setupTestDb();
});
afterAll(async () => {
  await tdb.close();
});
beforeEach(async () => {
  await tdb.reset();
});

/** Fixed epoch base so timestamps are deterministic (no clock read). */
function at(minute: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, minute, 0));
}

/** Seed a group with the given logical player names; returns their real ids. */
async function seedGroup(
  names: string[],
  rankedThreshold = 3,
): Promise<{ groupId: string; ids: Record<string, string> }> {
  const groupId = newId();
  await tdb.db.insert(group).values({ id: groupId, name: "Test", rankedThreshold });
  const ids: Record<string, string> = {};
  for (const name of names) {
    const id = newId();
    ids[name] = id;
    await tdb.db.insert(player).values({ id, displayName: name });
  }
  return { groupId, ids };
}

// ── Canonical, comparable forms of each projection table ─────────────────────
// String() collapses the numeric representation gap: the engine emits JS floats,
// the DB returns `numeric` text — and because the service stores String(float),
// the two coincide exactly. That coincidence IS the byte-for-byte guarantee.

interface CurrentRow {
  playerId: string;
  rating: number | string;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
  isProvisional: boolean;
  isRanked: boolean;
  lastMatchAt: Date | null;
}
function canonCurrent(rows: CurrentRow[]) {
  return rows
    .map((r) => ({
      playerId: r.playerId,
      rating: String(r.rating),
      competitiveMatchesPlayed: Number(r.competitiveMatchesPlayed),
      matchesSinceReset: Number(r.matchesSinceReset),
      isProvisional: r.isProvisional,
      isRanked: r.isRanked,
      lastMatchAt: r.lastMatchAt ? new Date(r.lastMatchAt).getTime() : null,
    }))
    .sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
}

interface HistoryRow {
  matchId: string;
  playerId: string;
  side: MatchSide;
  ratingBefore: number | string;
  delta: number | string;
  ratingAfter: number | string;
  wasProvisional: boolean;
  winProbability: number | string;
  playedAt: Date;
}
function canonHistory(rows: HistoryRow[]) {
  return rows
    .map((r) => ({
      matchId: r.matchId,
      playerId: r.playerId,
      side: r.side,
      ratingBefore: String(r.ratingBefore),
      delta: String(r.delta),
      ratingAfter: String(r.ratingAfter),
      wasProvisional: r.wasProvisional,
      winProbability: String(r.winProbability),
      playedAt: new Date(r.playedAt).getTime(),
    }))
    .sort((a, b) =>
      a.matchId !== b.matchId
        ? a.matchId < b.matchId
          ? -1
          : 1
        : a.playerId < b.playerId
          ? -1
          : 1,
    );
}

/** Re-read the group's match log from the DB into the engine's input shape. */
async function loadStreamFromDb(groupId: string): Promise<EngineMatch[]> {
  const matchRows = await tdb.db
    .select()
    .from(match)
    .where(eq(match.groupId, groupId));
  if (matchRows.length === 0) return [];
  const partRows = await tdb.db
    .select()
    .from(matchParticipant)
    .where(
      inArray(
        matchParticipant.matchId,
        matchRows.map((m) => m.id),
      ),
    );
  const sides = new Map<string, { A: string[]; B: string[] }>();
  for (const m of matchRows) sides.set(m.id, { A: [], B: [] });
  for (const p of partRows) sides.get(p.matchId)![p.side].push(p.playerId);
  return matchRows.map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    loggedAt: m.loggedAt,
    classification: m.classification,
    status: m.status,
    sides: sides.get(m.id)!,
    winnerSide: m.winnerSide!,
  }));
}

const currentFor = (groupId: string) =>
  tdb.db.select().from(currentRating).where(eq(currentRating.groupId, groupId));
const historyFor = (groupId: string) =>
  tdb.db.select().from(ratingHistory).where(eq(ratingHistory.groupId, groupId));

describe("logMatch — transactional write + projection rebuild", () => {
  it("writes correct projection rows for one singles match", async () => {
    const { groupId, ids } = await seedGroup(["p1", "p2"]);

    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(0),
      },
      tdb.db,
    );

    const current = await currentFor(groupId);
    const p1 = current.find((r) => r.playerId === ids.p1)!;
    const p2 = current.find((r) => r.playerId === ids.p2)!;
    expect(p1.rating).toBe("1016");
    expect(p2.rating).toBe("984");
    expect(p1.competitiveMatchesPlayed).toBe(1);
    expect(p1.isRanked).toBe(false); // threshold 3

    const history = await historyFor(groupId);
    expect(history).toHaveLength(2);
  });

  it("tx rebuild equals a pure from-scratch engine run, byte-for-byte", async () => {
    const { groupId, ids } = await seedGroup(["p1", "p2", "p3", "p4"]);

    // A varied log: singles, doubles, a repeat pairing, and a BACKDATED match
    // (logged last but played first) so the (played-at, …) re-sort is exercised.
    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(10),
      },
      tdb.db,
    );
    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "A", playerId: ids.p2 },
          { side: "B", playerId: ids.p3 },
          { side: "B", playerId: ids.p4 },
        ],
        winnerSide: "B",
        loggedBy: ids.p3,
        playedAt: at(20),
      },
      tdb.db,
    );
    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p3 },
          { side: "B", playerId: ids.p1 },
        ],
        winnerSide: "A",
        loggedBy: ids.p3,
        playedAt: at(30),
      },
      tdb.db,
    );
    // Backdated: played before all of the above, logged now.
    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p4 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p4,
        playedAt: at(5),
      },
      tdb.db,
    );

    // Pure run over the same persisted log = the reference.
    const pure = projectGroup(await loadStreamFromDb(groupId), {
      rankedThreshold: 3,
    });

    const dbCurrent = await currentFor(groupId);
    const dbHistory = await historyFor(groupId);

    expect(canonCurrent(dbCurrent)).toEqual(
      canonCurrent([...pure.currentRating.values()]),
    );
    expect(canonHistory(dbHistory)).toEqual(canonHistory(pure.ratingHistory));
  });

  it("rolls back fully on failure — no partial match or projection", async () => {
    const { groupId, ids } = await seedGroup(["p1", "p2"]);

    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(0),
      },
      tdb.db,
    );

    const before = canonCurrent(await currentFor(groupId));

    // Second match references a player id with no `player` row → FK violation on
    // the participant insert, aborting the whole transaction.
    await expect(
      logMatch(
        {
          groupId,
          players: [
            { side: "A", playerId: ids.p1 },
            { side: "B", playerId: newId() }, // does not exist
          ],
          winnerSide: "A",
          loggedBy: ids.p1,
          playedAt: at(1),
        },
        tdb.db,
      ),
    ).rejects.toThrow();

    // The good first match is untouched; the failed one left nothing behind.
    expect(await tdb.db.select().from(match).where(eq(match.groupId, groupId))).toHaveLength(1);
    expect(canonCurrent(await currentFor(groupId))).toEqual(before);
  });

  it("stores casual matches but excludes them from replay", async () => {
    const { groupId, ids } = await seedGroup(["p1", "p2"]);

    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(0),
      },
      tdb.db,
    );
    const afterCompetitive = canonCurrent(await currentFor(groupId));

    await logMatch(
      {
        groupId,
        classification: "casual",
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "B", // would move ratings if it counted
        loggedBy: ids.p2,
        playedAt: at(1),
      },
      tdb.db,
    );

    // Both matches are stored…
    expect(await tdb.db.select().from(match).where(eq(match.groupId, groupId))).toHaveLength(2);
    // …but ratings and history reflect only the competitive one.
    expect(canonCurrent(await currentFor(groupId))).toEqual(afterCompetitive);
    expect(await historyFor(groupId)).toHaveLength(2);
  });

  it("excludes voided matches from replay on the next rebuild", async () => {
    const { groupId, ids } = await seedGroup(["p1", "p2", "p3"]);

    const first = await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p2 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(0),
      },
      tdb.db,
    );

    // Simulate a prior void of the first match (the void mutation is a later
    // slice; what matters here is that the replay stream skips it).
    await tdb.db
      .update(match)
      .set({ status: "voided" })
      .where(eq(match.id, first.matchId));

    // A new match triggers a full rebuild that must exclude the voided one.
    await logMatch(
      {
        groupId,
        players: [
          { side: "A", playerId: ids.p1 },
          { side: "B", playerId: ids.p3 },
        ],
        winnerSide: "A",
        loggedBy: ids.p1,
        playedAt: at(1),
      },
      tdb.db,
    );

    const current = await currentFor(groupId);
    // p2 only ever appeared in the voided match → no current_rating row at all.
    expect(current.find((r) => r.playerId === ids.p2)).toBeUndefined();
    // p1 reflects only the second match: beat a fresh p3 from 1000 → 1016.
    expect(current.find((r) => r.playerId === ids.p1)!.rating).toBe("1016");
    expect(current.find((r) => r.playerId === ids.p3)!.rating).toBe("984");
    // History holds only the surviving match's two rows.
    const history = await historyFor(groupId);
    expect(history).toHaveLength(2);
    expect(history.every((h) => h.matchId !== first.matchId)).toBe(true);
  });
});
