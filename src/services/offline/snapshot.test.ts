import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  enqueueMatch,
  listQueuedMatches,
  removeQueuedMatch,
} from "./queue";
import { isIncompatibleQueuedMatch } from "./queue-contract";
import { guestParticipant, playerParticipant } from "../../domain/match-participant";
import {
  clearOfflineMatchSnapshot,
  createOfflineMatchSnapshot,
  loadOfflineMatchSnapshot,
  saveOfflineMatchSnapshot,
} from "./snapshot";

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
});

describe("offline Match-entry snapshot", () => {
  it("keeps only bound Player identity and active roster identity", () => {
    const snapshot = createOfflineMatchSnapshot(
      { id: "player-1", name: "Alex", personalToken: "must-not-leak" },
      [
        { id: "player-1", name: "Alex", rating: 1042 },
        { id: "player-2", name: "Blair", profile: { wins: 12 } },
      ],
      ["Alex", "Blair", "Retired Casey"],
      new Date("2026-07-22T12:00:00.000Z"),
    );

    expect(snapshot).toEqual({
      player: { id: "player-1", name: "Alex" },
      roster: [
        { id: "player-1", name: "Alex" },
        { id: "player-2", name: "Blair" },
      ],
      reservedPlayerNames: ["Alex", "Blair", "Retired Casey"],
      refreshedAt: "2026-07-22T12:00:00.000Z",
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/token|rating|profile|wins/i);
  });

  it("upgrades a v1 queue without losing Matches and supports snapshot CRUD", async () => {
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("padelclash-offline", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("queued-matches", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = v1.transaction("queued-matches", "readwrite");
      transaction.objectStore("queued-matches").put({
        id: "01900000-0000-7000-8000-000000000000",
        playedAt: "2026-07-22T12:00:00.000Z",
        ownerPlayerId: "player-1",
        ownerPlayerName: "Alex",
        sides: {
          A: [{ kind: "player", playerId: "player-1" }],
          B: [{ kind: "player", playerId: "player-2" }],
        },
        names: { A: ["Alex"], B: ["Blair"] },
        winnerSide: "A",
        sets: null,
        queuedAt: "2026-07-22T12:00:00.000Z",
        ignoredLegacyField: "safe to ignore",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    v1.close();

    const snapshot = createOfflineMatchSnapshot(
      { id: "player-1", name: "Alex" },
      [{ id: "player-1", name: "Alex" }],
      ["Alex"],
      new Date("2026-07-22T12:00:00.000Z"),
    );
    await saveOfflineMatchSnapshot(snapshot);

    expect(await loadOfflineMatchSnapshot()).toEqual(snapshot);
    expect(await listQueuedMatches()).toEqual([
      expect.objectContaining({
        id: "01900000-0000-7000-8000-000000000000",
        ownerPlayerId: "player-1",
      }),
    ]);

    await clearOfflineMatchSnapshot();
    expect(await loadOfflineMatchSnapshot()).toBeNull();
  });

  it("round-trips the discriminated Player/Guest payload unchanged", async () => {
    await enqueueMatch({
      id: "01900000-0000-7000-8000-000000000001",
      playedAt: "2026-07-22T12:00:00.000Z",
      ownerPlayerId: "player-1",
      ownerPlayerName: "Alex",
      sides: {
        A: [playerParticipant("player-1"), guestParticipant("Visiting Pat")],
        B: [playerParticipant("player-2"), playerParticipant("player-3")],
      },
      names: {
        A: ["Alex", "Visiting Pat"],
        B: ["Blair", "Casey"],
      },
      winnerSide: "A",
      sets: null,
      queuedAt: "2026-07-22T12:01:00.000Z",
    });

    const [queued] = await listQueuedMatches();
    expect(queued).toBeDefined();
    expect(isIncompatibleQueuedMatch(queued)).toBe(false);
    if (!queued || isIncompatibleQueuedMatch(queued)) {
      throw new Error("Expected a compatible queued Match");
    }
    expect(queued.sides).toEqual({
      A: [
        { kind: "player", playerId: "player-1" },
        { kind: "guest", name: "Visiting Pat" },
      ],
      B: [
        { kind: "player", playerId: "player-2" },
        { kind: "player", playerId: "player-3" },
      ],
    });
  });

  it("surfaces an incompatible durable record for explicit discard", async () => {
    await saveOfflineMatchSnapshot(
      createOfflineMatchSnapshot(
        { id: "player-1", name: "Alex" },
        [{ id: "player-1", name: "Alex" }],
        ["Alex"],
      ),
    );
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("padelclash-offline", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("queued-matches", "readwrite");
      transaction.objectStore("queued-matches").put({
        id: "01900000-0000-7000-8000-000000000099",
        queuedAt: "2026-07-22T12:00:00.000Z",
        ownerPlayerName: "Alex",
        // Pre-discriminated participant shape: intentionally incompatible.
        sides: { A: ["player-1"], B: ["player-2"] },
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();

    expect(await listQueuedMatches()).toEqual([
      {
        incompatible: true,
        id: "01900000-0000-7000-8000-000000000099",
        queuedAt: "2026-07-22T12:00:00.000Z",
        ownerPlayerName: "Alex",
        syncCode: "invalid",
        syncError: expect.stringContaining("incompatible app version"),
      },
    ]);

    await removeQueuedMatch("01900000-0000-7000-8000-000000000099");
    expect(await listQueuedMatches()).toEqual([]);
  });
});
