import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  getTestDb,
  hasDatabase,
  truncateAll,
} from "./db/test-db";
import type { Db } from "./db";
import {
  createPlayer,
  getPlayerById,
  getPlayerByToken,
  listActivePlayers,
  listPlayers,
  renamePlayer,
  retirePlayer,
  rotatePersonalToken,
} from "./players";
import { getSettings, setNamePickerEnabled } from "./settings";

// Real-DB integration tests; skipped when no DATABASE_URL is configured.
// File-scoped so it runs once after BOTH suites — inside a describe it would
// close the shared pool between them.
afterAll(closeTestDb);

describe.skipIf(!hasDatabase)("players service", () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("creates a player with a personal token and lists them", async () => {
    const player = await createPlayer(db, "Simon");
    expect(player.name).toBe("Simon");
    expect(player.personalToken.length).toBeGreaterThanOrEqual(16);
    expect(player.retiredAt).toBeNull();

    const roster = await listPlayers(db);
    expect(roster.map((p) => p.id)).toEqual([player.id]);
  });

  it("resolves a player by their personal token", async () => {
    const player = await createPlayer(db, "Simon");
    const found = await getPlayerByToken(db, player.personalToken);
    expect(found?.id).toBe(player.id);
    expect(await getPlayerByToken(db, "not-a-real-token")).toBeNull();
  });

  it("resolves a player by id, tolerating junk cookie values", async () => {
    const player = await createPlayer(db, "Simon");
    expect((await getPlayerById(db, player.id))?.name).toBe("Simon");
    expect(await getPlayerById(db, "not-a-uuid")).toBeNull();
    expect(
      await getPlayerById(db, "00000000-0000-7000-8000-000000000000"),
    ).toBeNull();
  });

  it("rotating a personal token invalidates the old link", async () => {
    const player = await createPlayer(db, "Simon");
    const oldToken = player.personalToken;

    const rotated = await rotatePersonalToken(db, player.id);
    expect(rotated.personalToken).not.toBe(oldToken);
    expect(await getPlayerByToken(db, oldToken)).toBeNull();
    expect((await getPlayerByToken(db, rotated.personalToken))?.id).toBe(
      player.id,
    );
  });

  it("retiring hides a player from the active roster but keeps them listed", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");

    const retired = await retirePlayer(db, alex.id);
    expect(retired.retiredAt).not.toBeNull();

    const active = await listActivePlayers(db);
    expect(active.map((p) => p.id)).toEqual([simon.id]);
    const all = await listPlayers(db);
    expect(all.map((p) => p.id)).toEqual([simon.id, alex.id]);
  });

  it("a retired player's join link no longer binds", async () => {
    const alex = await createPlayer(db, "Alex");
    await retirePlayer(db, alex.id);
    expect(await getPlayerByToken(db, alex.personalToken)).toBeNull();
  });

  it("renames a player", async () => {
    const player = await createPlayer(db, "Simno");
    const renamed = await renamePlayer(db, player.id, "Simon");
    expect(renamed.name).toBe("Simon");
  });

  it("trims names and rejects blank ones", async () => {
    const player = await createPlayer(db, "  Simon  ");
    expect(player.name).toBe("Simon");
    await expect(createPlayer(db, "   ")).rejects.toThrow();
    await expect(renamePlayer(db, player.id, "")).rejects.toThrow();
  });
});

describe.skipIf(!hasDatabase)("settings service", () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("name picker defaults to off and the toggle persists", async () => {
    expect((await getSettings(db)).namePickerEnabled).toBe(false);

    await setNamePickerEnabled(db, true);
    expect((await getSettings(db)).namePickerEnabled).toBe(true);

    await setNamePickerEnabled(db, false);
    expect((await getSettings(db)).namePickerEnabled).toBe(false);
  });
});
