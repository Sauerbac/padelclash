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
import {
  currentRating,
  group,
  match,
  matchParticipant,
  membership,
  player,
  ratingHistory,
  user,
} from "@/db/schema";
import {
  addUnclaimedPlayer,
  createGroup,
  DuplicateMemberNameError,
  getGroupForMember,
  getLeaderboard,
  getPlayerStanding,
  getRecentMatches,
  getRoster,
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

/** Attach an auth Account to a Player — i.e. make them a claimed Player. */
async function attachAccount(playerId: string, email: string): Promise<void> {
  await tdb.db.insert(user).values({
    id: newId(),
    name: email,
    email,
    playerId,
  });
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

describe("addUnclaimedPlayer", () => {
  it("creates a Player no user references and seats them as an active member", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Smashers", founderPlayerId: founder },
      tdb.db,
    );

    const { playerId } = await addUnclaimedPlayer(
      { groupId, displayName: "Cousin Max", addedByPlayerId: founder },
      tdb.db,
    );

    // A `player` row exists…
    const [p] = await tdb.db.select().from(player).where(eq(player.id, playerId));
    expect(p.displayName).toBe("Cousin Max");

    // …with no auth `user` pointing at it (still Unclaimed — ADR-0004)…
    const accounts = await tdb.db
      .select()
      .from(user)
      .where(eq(user.playerId, playerId));
    expect(accounts).toHaveLength(0);

    // …and a membership joining them to the group as a plain active member.
    const [mem] = await tdb.db
      .select()
      .from(membership)
      .where(
        and(eq(membership.groupId, groupId), eq(membership.playerId, playerId)),
      );
    expect(mem.role).toBe("member");
    expect(mem.status).toBe("active");
  });

  it("trims the name and rejects an empty one", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Trimmers", founderPlayerId: founder },
      tdb.db,
    );

    const { playerId } = await addUnclaimedPlayer(
      { groupId, displayName: "  Padel Pete  ", addedByPlayerId: founder },
      tdb.db,
    );
    const [p] = await tdb.db.select().from(player).where(eq(player.id, playerId));
    expect(p.displayName).toBe("Padel Pete");

    await expect(
      addUnclaimedPlayer(
        { groupId, displayName: "   ", addedByPlayerId: founder },
        tdb.db,
      ),
    ).rejects.toThrow(/displayName is required/);
  });

  it("rejects a duplicate name in the same group, case-insensitively", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Dupes", founderPlayerId: founder },
      tdb.db,
    );

    await addUnclaimedPlayer(
      { groupId, displayName: "Max", addedByPlayerId: founder },
      tdb.db,
    );

    await expect(
      addUnclaimedPlayer(
        { groupId, displayName: "  max  ", addedByPlayerId: founder },
        tdb.db,
      ),
    ).rejects.toBeInstanceOf(DuplicateMemberNameError);
  });

  it("allows the same name in a different group", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const other = await seedPlayer("Grace Hopper");
    const { groupId: a } = await createGroup(
      { name: "Group A", founderPlayerId: founder },
      tdb.db,
    );
    const { groupId: b } = await createGroup(
      { name: "Group B", founderPlayerId: other },
      tdb.db,
    );

    await addUnclaimedPlayer(
      { groupId: a, displayName: "Max", addedByPlayerId: founder },
      tdb.db,
    );
    await expect(
      addUnclaimedPlayer(
        { groupId: b, displayName: "Max", addedByPlayerId: other },
        tdb.db,
      ),
    ).resolves.toMatchObject({ playerId: expect.any(String) });
  });

  it("rejects an adder who is not an active member", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const outsider = await seedPlayer("Stranger");
    const { groupId } = await createGroup(
      { name: "Members Only", founderPlayerId: founder },
      tdb.db,
    );

    await expect(
      addUnclaimedPlayer(
        { groupId, displayName: "Sneaky Sam", addedByPlayerId: outsider },
        tdb.db,
      ),
    ).rejects.toThrow(/not an active member/);

    // Nothing was inserted — the player never exists.
    const all = await tdb.db
      .select()
      .from(player)
      .where(eq(player.displayName, "Sneaky Sam"));
    expect(all).toHaveLength(0);
  });
});

describe("getRoster", () => {
  it("lists active members in join order, flagging unclaimed players", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    await attachAccount(founder, "ada@example.com"); // founder is a claimed Player
    const { groupId } = await createGroup(
      { name: "Rostered", founderPlayerId: founder },
      tdb.db,
    );

    const { playerId: maxId } = await addUnclaimedPlayer(
      { groupId, displayName: "Cousin Max", addedByPlayerId: founder },
      tdb.db,
    );

    const roster = await getRoster(groupId, tdb.db);

    expect(roster.map((m) => m.name)).toEqual(["Ada Lovelace", "Cousin Max"]);
    expect(roster[0]).toMatchObject({
      playerId: founder,
      role: "admin",
      isUnclaimed: false,
    });
    expect(roster[1]).toMatchObject({
      playerId: maxId,
      role: "member",
      isUnclaimed: true,
    });
  });

  it("excludes former members", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Departures", founderPlayerId: founder },
      tdb.db,
    );
    const { playerId: leaverId } = await addUnclaimedPlayer(
      { groupId, displayName: "Leaver Lou", addedByPlayerId: founder },
      tdb.db,
    );

    await tdb.db
      .update(membership)
      .set({ status: "former" })
      .where(
        and(eq(membership.groupId, groupId), eq(membership.playerId, leaverId)),
      );

    const roster = await getRoster(groupId, tdb.db);
    expect(roster.map((m) => m.name)).toEqual(["Ada Lovelace"]);
  });
});

/** Fixed epoch base so timestamps are deterministic (no clock read). */
function at(minute: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, minute, 0));
}

/** Insert one singles `match` + its two participants directly (source of truth). */
async function seedMatch(args: {
  groupId: string;
  a: string;
  b: string;
  winner: "A" | "B";
  loggedBy: string;
  playedAt: Date;
  classification?: "competitive" | "casual";
  status?: "confirmed" | "voided";
}): Promise<string> {
  const id = newId();
  await tdb.db.insert(match).values({
    id,
    groupId: args.groupId,
    playedAt: args.playedAt,
    loggedBy: args.loggedBy,
    classification: args.classification ?? "competitive",
    status: args.status ?? "confirmed",
    resultFormat: "simple",
    result: {},
    winnerSide: args.winner,
  });
  await tdb.db.insert(matchParticipant).values([
    { matchId: id, playerId: args.a, side: "A" },
    { matchId: id, playerId: args.b, side: "B" },
  ]);
  return id;
}

describe("getRecentMatches — reads the source-of-truth match log", () => {
  it("is empty for a group with no matches", async () => {
    const founder = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Quiet", founderPlayerId: founder },
      tdb.db,
    );
    expect(await getRecentMatches(groupId, 20, tdb.db)).toEqual([]);
  });

  it("returns matches newest first with side names, winner, and the casual flag", async () => {
    const ada = await seedPlayer("Ada Lovelace");
    const babbage = await seedPlayer("Charles Babbage");
    const { groupId } = await createGroup(
      { name: "Logged", founderPlayerId: ada },
      tdb.db,
    );

    await seedMatch({
      groupId,
      a: ada,
      b: babbage,
      winner: "A",
      loggedBy: ada,
      playedAt: at(0),
    });
    await seedMatch({
      groupId,
      a: ada,
      b: babbage,
      winner: "B",
      loggedBy: babbage,
      playedAt: at(10),
      classification: "casual",
    });

    const recent = await getRecentMatches(groupId, 20, tdb.db);
    expect(recent).toHaveLength(2);

    // Newest (the casual one, played at minute 10) comes first.
    expect(recent[0]).toMatchObject({
      classification: "casual",
      sideA: ["Ada Lovelace"],
      sideB: ["Charles Babbage"],
      winnerSide: "B",
    });
    expect(recent[1]).toMatchObject({
      classification: "competitive",
      winnerSide: "A",
    });
  });

  it("excludes voided matches and honors the limit", async () => {
    const ada = await seedPlayer("Ada Lovelace");
    const babbage = await seedPlayer("Charles Babbage");
    const { groupId } = await createGroup(
      { name: "Pruned", founderPlayerId: ada },
      tdb.db,
    );

    await seedMatch({ groupId, a: ada, b: babbage, winner: "A", loggedBy: ada, playedAt: at(0) });
    await seedMatch({ groupId, a: ada, b: babbage, winner: "B", loggedBy: ada, playedAt: at(1) });
    await seedMatch({
      groupId,
      a: ada,
      b: babbage,
      winner: "A",
      loggedBy: ada,
      playedAt: at(2),
      status: "voided",
    });

    // Voided one is gone; the limit caps the rest.
    expect(await getRecentMatches(groupId, 20, tdb.db)).toHaveLength(2);
    expect(await getRecentMatches(groupId, 1, tdb.db)).toHaveLength(1);
  });
});

describe("getPlayerStanding — the profile's group standing", () => {
  it("returns null when the player has no rated match yet", async () => {
    const ada = await seedPlayer("Ada Lovelace");
    const { groupId } = await createGroup(
      { name: "Fresh", founderPlayerId: ada },
      tdb.db,
    );
    expect(
      await getPlayerStanding({ groupId, playerId: ada }, tdb.db),
    ).toBeNull();
  });

  it("returns the rating and the most recent match's delta", async () => {
    const ada = await seedPlayer("Ada Lovelace");
    const babbage = await seedPlayer("Charles Babbage");
    const { groupId } = await createGroup(
      { name: "Rated", founderPlayerId: ada },
      tdb.db,
    );

    await tdb.db.insert(currentRating).values({
      groupId,
      playerId: ada,
      rating: "1032.5",
      competitiveMatchesPlayed: 2,
      isProvisional: true,
      isRanked: false,
    });

    // Two history rows; the standing's delta must be the later one (minute 10).
    const older = await seedMatch({ groupId, a: ada, b: babbage, winner: "A", loggedBy: ada, playedAt: at(0) });
    const newer = await seedMatch({ groupId, a: ada, b: babbage, winner: "A", loggedBy: ada, playedAt: at(10) });
    await tdb.db.insert(ratingHistory).values([
      {
        groupId,
        matchId: older,
        playerId: ada,
        side: "A",
        ratingBefore: "1000",
        delta: "16",
        ratingAfter: "1016",
        wasProvisional: true,
        winProbability: "0.5",
        playedAt: at(0),
      },
      {
        groupId,
        matchId: newer,
        playerId: ada,
        side: "A",
        ratingBefore: "1016",
        delta: "16.5",
        ratingAfter: "1032.5",
        wasProvisional: true,
        winProbability: "0.5",
        playedAt: at(10),
      },
    ]);

    const standing = await getPlayerStanding({ groupId, playerId: ada }, tdb.db);
    expect(standing).toMatchObject({
      rating: 1032.5,
      competitiveMatchesPlayed: 2,
      isRanked: false,
      isProvisional: true,
      lastDelta: 16.5,
    });
  });
});
