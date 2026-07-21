import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  getTestDb,
  hasDatabase,
  truncateAll,
} from "./db/test-db";
import type { Db } from "./db";
import { uuidv7 } from "../lib/uuidv7";
import { createBinding, resolveCredential } from "./access";
import { PlayerNameError, PlayerReferencedError } from "./errors";
import { logMatch } from "./matches";
import { generatePersonalLink } from "./onboarding";
import {
  createPlayer,
  deletePlayer,
  getAdminRoster,
  getPlayerById,
  isJoined,
  isPlayerDeletable,
  listActivePlayers,
  listNotJoinedPlayers,
  listPlayers,
  renamePlayer,
  restorePlayer,
  retirePlayer,
} from "./players";

// Real-DB integration tests; skipped when no DATABASE_URL is configured.
// File-scoped so it runs once after ALL suites — inside a describe it would
// close the shared pool between them.
afterAll(closeTestDb);

describe.skipIf(!hasDatabase)("players service", () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("creates a player who starts not joined, with no invitation", async () => {
    const player = await createPlayer(db, "Simon");
    expect(player.name).toBe("Simon");
    expect(player.normalizedName).toBe("simon");
    expect(player.retiredAt).toBeNull();

    // Spec decision 41: creating a Player issues no dormant invitation.
    expect(await isJoined(db, player.id)).toBe(false);
    const roster = await getAdminRoster(db);
    expect(roster.notJoined.map((e) => e.id)).toEqual([player.id]);
    expect(roster.notJoined[0].personalLink).toBeNull();
  });

  it("stores the display name but constrains the folded key", async () => {
    const player = await createPlayer(db, "  Síomon   McTAVISH ");
    expect(player.name).toBe("Síomon McTAVISH");
    expect(player.normalizedName).toBe("síomon mctavish");
  });

  it("rejects a name that differs only by case or whitespace", async () => {
    await createPlayer(db, "Simon");
    await expect(createPlayer(db, "simon")).rejects.toThrow(PlayerNameError);
    await expect(createPlayer(db, "  SIMON  ")).rejects.toThrow(PlayerNameError);
    await expect(createPlayer(db, "S I M O N")).resolves.toBeDefined();
  });

  it("rejects blank names", async () => {
    await expect(createPlayer(db, "   ")).rejects.toThrow(PlayerNameError);
  });

  it("a retired player keeps reserving their name", async () => {
    const alex = await createPlayer(db, "Alex");
    await retirePlayer(db, alex.id);
    // Spec decision 30: uniqueness spans the full roster, retirees included.
    await expect(createPlayer(db, "alex")).rejects.toThrow(PlayerNameError);
  });

  it("renames a player, refusing a name another player holds", async () => {
    const simon = await createPlayer(db, "Simno");
    await createPlayer(db, "Alex");

    const renamed = await renamePlayer(db, simon.id, "Simon");
    expect(renamed.name).toBe("Simon");
    expect(renamed.normalizedName).toBe("simon");

    await expect(renamePlayer(db, simon.id, "ALEX")).rejects.toThrow(
      PlayerNameError,
    );
    // Renaming to your own name in different casing is fine.
    await expect(renamePlayer(db, simon.id, "SIMON")).resolves.toBeDefined();
  });

  it("retiring revokes the binding and the outstanding invitation", async () => {
    const alex = await createPlayer(db, "Alex");
    const { credential } = await createBinding(db, alex.id, {
      now: new Date(),
    });
    await generatePersonalLink(db, alex.id);
    expect(await isJoined(db, alex.id)).toBe(true);

    await retirePlayer(db, alex.id);

    // Spec decision 39: retirement is one of the ways Admin ends access.
    expect(await isJoined(db, alex.id)).toBe(false);
    const roster = await getAdminRoster(db);
    expect(roster.retired.map((e) => e.id)).toEqual([alex.id]);
    expect(roster.retired[0].personalLink).toBeNull();
    expect(credential).toBeTruthy();
  });

  it("restores a retired player to not joined, without their old access", async () => {
    const alex = await createPlayer(db, "Alex");
    await createBinding(db, alex.id, { now: new Date() });
    await retirePlayer(db, alex.id);

    const restored = await restorePlayer(db, alex.id);
    expect(restored.retiredAt).toBeNull();
    expect(restored.name).toBe("Alex");
    // Spec decision 35: history and name return, the binding does not.
    expect(await isJoined(db, alex.id)).toBe(false);
    expect((await getAdminRoster(db)).notJoined.map((e) => e.id)).toEqual([
      alex.id,
    ]);
  });

  it("restoring never revives a binding left active on a retired player", async () => {
    const alex = await createPlayer(db, "Alex");
    await retirePlayer(db, alex.id);

    // Retirement normally revokes on the way out, but a confirmation that
    // raced it could insert a binding just afterwards. Simulate that outcome
    // directly: a retired Player holding an un-revoked binding, inert only
    // because resolveCredential refuses retired Players.
    const { credential } = await createBinding(db, alex.id, { now: new Date() });
    expect(await resolveCredential(db, credential)).toBeNull();

    await restorePlayer(db, alex.id);

    // Spec decision 35: rejoining takes a fresh invitation, always.
    expect(await resolveCredential(db, credential)).toBeNull();
    expect(await isJoined(db, alex.id)).toBe(false);
  });

  it("lists not-joined players, excluding the bound and the retired", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    const jo = await createPlayer(db, "Jo");
    await createBinding(db, alex.id, { now: new Date() });
    await retirePlayer(db, jo.id);

    const notJoined = await listNotJoinedPlayers(db);
    expect(notJoined.map((p) => p.id)).toEqual([simon.id]);
  });

  it("hides retired players from the active roster but keeps them listed", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    await retirePlayer(db, alex.id);

    expect((await listActivePlayers(db)).map((p) => p.id)).toEqual([simon.id]);
    expect((await listPlayers(db)).map((p) => p.id)).toEqual([
      simon.id,
      alex.id,
    ]);
  });

  it("resolves a player by id, tolerating junk values", async () => {
    const player = await createPlayer(db, "Simon");
    expect((await getPlayerById(db, player.id))?.name).toBe("Simon");
    expect(await getPlayerById(db, "not-a-uuid")).toBeNull();
    expect(
      await getPlayerById(db, "00000000-0000-7000-8000-000000000000"),
    ).toBeNull();
  });
});

describe.skipIf(!hasDatabase)("player deletion", () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("deletes a player the match log never mentions", async () => {
    const player = await createPlayer(db, "Simon");
    expect(await isPlayerDeletable(db, player.id)).toBe(true);

    await deletePlayer(db, player.id);
    expect(await getPlayerById(db, player.id)).toBeNull();
  });

  it("deletes a player who has a binding and an invitation", async () => {
    const player = await createPlayer(db, "Simon");
    await createBinding(db, player.id, { now: new Date() });
    await generatePersonalLink(db, player.id);

    // Spec decision 31: onboarding state doesn't block deletion — only the
    // match log does.
    expect(await isPlayerDeletable(db, player.id)).toBe(true);
    await deletePlayer(db, player.id);
    expect(await getPlayerById(db, player.id)).toBeNull();
  });

  it("refuses to delete a player the log references, then allows it again", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    const matchId = uuidv7();
    await logMatch(db, {
      id: matchId,
      playedAt: new Date(),
      loggedBy: simon.id,
      sides: { A: [simon.id], B: [alex.id] },
      winnerSide: "A",
    });

    expect(await isPlayerDeletable(db, simon.id)).toBe(false);
    expect(await isPlayerDeletable(db, alex.id)).toBe(false);
    await expect(deletePlayer(db, alex.id)).rejects.toThrow(
      PlayerReferencedError,
    );

    // Deleting every referencing Match makes them deletable again.
    const { deleteMatch } = await import("./matches");
    await deleteMatch(db, matchId, { playerId: simon.id, isAdmin: true });

    expect(await isPlayerDeletable(db, alex.id)).toBe(true);
    await deletePlayer(db, alex.id);
    expect(await getPlayerById(db, alex.id)).toBeNull();
  });

  it("blocks deletion of a player who only ever logged, never played", async () => {
    const logger = await createPlayer(db, "Simon");
    const a = await createPlayer(db, "Alex");
    const b = await createPlayer(db, "Jo");
    await logMatch(db, {
      id: uuidv7(),
      playedAt: new Date(),
      loggedBy: logger.id,
      sides: { A: [a.id], B: [b.id] },
      winnerSide: "A",
    });

    // The Logger counts as a reference even without participating
    // (spec decision 31).
    expect(await isPlayerDeletable(db, logger.id)).toBe(false);
    await expect(deletePlayer(db, logger.id)).rejects.toThrow(
      PlayerReferencedError,
    );
  });
});
