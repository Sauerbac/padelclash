import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { listQueuedMatches } from "./queue";
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
});

describe("offline Match-entry snapshot", () => {
  it("keeps only bound Player identity and active roster identity", () => {
    const snapshot = createOfflineMatchSnapshot(
      { id: "player-1", name: "Alex", personalToken: "must-not-leak" },
      [
        { id: "player-1", name: "Alex", rating: 1042 },
        { id: "player-2", name: "Blair", profile: { wins: 12 } },
      ],
      new Date("2026-07-22T12:00:00.000Z"),
    );

    expect(snapshot).toEqual({
      player: { id: "player-1", name: "Alex" },
      roster: [
        { id: "player-1", name: "Alex" },
        { id: "player-2", name: "Blair" },
      ],
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
        queuedAt: "2026-07-22T12:00:00.000Z",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    v1.close();

    const snapshot = createOfflineMatchSnapshot(
      { id: "player-1", name: "Alex" },
      [{ id: "player-1", name: "Alex" }],
      new Date("2026-07-22T12:00:00.000Z"),
    );
    await saveOfflineMatchSnapshot(snapshot);

    expect(await loadOfflineMatchSnapshot()).toEqual(snapshot);
    expect((await listQueuedMatches()).map(({ id }) => id)).toEqual([
      "01900000-0000-7000-8000-000000000000",
    ]);

    await clearOfflineMatchSnapshot();
    expect(await loadOfflineMatchSnapshot()).toBeNull();
  });
});
