// Tier-3 (ADR-0008 / ADR-0012): the groups service against a real Postgres.
//
// Proves slice 07's wiring: creating a Group seats the founder as an admin member,
// the membership gate distinguishes members from outsiders, and the leaderboard
// reads off the `current_rating` projection — empty for a fresh group, ordered by
// rating once populated. Runs against `padelclash_test`.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { newId } from "@/db/ids";
import { setupTestDb, type TestDb } from "@/db/test-db";
import { currentRating, group, membership, player } from "@/db/schema";
import {
  createGroup,
  getGroupForMember,
  getLeaderboard,
  listMemberGroups,
} from "./groups";

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

/** Insert a bare Player and return its id. */
async function seedPlayer(displayName: string): Promise<string> {
  const id = newId();
  await tdb.db.insert(player).values({ id, displayName });
  return id;
}

describe("createGroup", () => {
  it("creates the group and seats the founder as an active admin", async () => {
    const founder = await seedPlayer("Ada Lovelace");

    const { groupId } = await createGroup(
      { name: "Monday Smashers", founderPlayerId: founder },
      tdb.db,
    );

    const [grp] = await tdb.db.select().from(group).where(eq(group.id, groupId));
    expect(grp.name).toBe("Monday Smashers");

    const [mem] = await tdb.db
      .select()
      .from(membership)
      .where(
        and(eq(membership.groupId, groupId), eq(membership.playerId, founder)),
      );
    expect(mem.role).toBe("admin");
    expect(mem.status).toBe("active");
  });

  it("trims the name and rejects an empty one", async () => {
    const founder = await seedPlayer("Grace Hopper");

    const { groupId } = await createGroup(
      { name: "  Padel Pals  ", founderPlayerId: founder },
      tdb.db,
    );
    const [grp] = await tdb.db.select().from(group).where(eq(group.id, groupId));
    expect(grp.name).toBe("Padel Pals");

    await expect(
      createGroup({ name: "   ", founderPlayerId: founder }, tdb.db),
    ).rejects.toThrow(/name is required/);
  });
});

describe("getGroupForMember — the authorization gate", () => {
  it("returns the group for a member and null for a non-member or missing group", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const outsider = await seedPlayer("Stranger");
    const { groupId } = await createGroup(
      { name: "Members Only", founderPlayerId: founder },
      tdb.db,
    );

    const asMember = await getGroupForMember(
      { groupId, playerId: founder },
      tdb.db,
    );
    expect(asMember).not.toBeNull();
    expect(asMember!.name).toBe("Members Only");
    expect(asMember!.role).toBe("admin");

    const asOutsider = await getGroupForMember(
      { groupId, playerId: outsider },
      tdb.db,
    );
    expect(asOutsider).toBeNull();

    const missing = await getGroupForMember(
      { groupId: newId(), playerId: founder },
      tdb.db,
    );
    expect(missing).toBeNull();
  });

  it("lists only the groups a player actively belongs to", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const other = await seedPlayer("Someone Else");
    const { groupId } = await createGroup(
      { name: "Mine", founderPlayerId: founder },
      tdb.db,
    );
    await createGroup({ name: "Theirs", founderPlayerId: other }, tdb.db);

    const mine = await listMemberGroups(founder, tdb.db);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(groupId);
  });
});

describe("getLeaderboard — reads current_rating", () => {
  it("is empty for a brand-new group", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Fresh", founderPlayerId: founder },
      tdb.db,
    );

    expect(await getLeaderboard(groupId, tdb.db)).toEqual([]);
  });

  it("returns rated players ordered by rating, highest first", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const rival = await seedPlayer("Charles Babbage");
    const { groupId } = await createGroup(
      { name: "Rated", founderPlayerId: founder },
      tdb.db,
    );

    // Seed the projection directly: this slice proves the read, not the replay
    // (the engine's write path is covered by logMatch.integration.test.ts).
    await tdb.db.insert(currentRating).values([
      {
        groupId,
        playerId: founder,
        rating: "1016",
        competitiveMatchesPlayed: 1,
        isProvisional: true,
        isRanked: false,
      },
      {
        groupId,
        playerId: rival,
        rating: "1042.5",
        competitiveMatchesPlayed: 4,
        isProvisional: false,
        isRanked: true,
      },
    ]);

    const board = await getLeaderboard(groupId, tdb.db);
    expect(board.map((e) => e.name)).toEqual([
      "Charles Babbage",
      "Ada Lovelace",
    ]);
    expect(board[0].rating).toBe(1042.5);
    expect(board[0].isRanked).toBe(true);
    expect(board[1].rating).toBe(1016);
    expect(board[1].competitiveMatchesPlayed).toBe(1);
  });
});
