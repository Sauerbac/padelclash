import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  clearSavedViews,
  loadSavedView,
  saveSavedView,
  loadViewerScope,
  saveViewerScope,
} from "./saved-views";

describe("Saved Views", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("loads a binding-scoped projection within 30 days", async () => {
    await saveSavedView("feed", "player-a", { matches: ["match-a"] }, new Date("2026-08-01T12:00:00Z"));

    await expect(
      loadSavedView("feed", "player-a", new Date("2026-08-31T11:59:59Z")),
    ).resolves.toMatchObject({
      bindingPlayerId: "player-a",
      projection: { matches: ["match-a"] },
      refreshedAt: "2026-08-01T12:00:00.000Z",
    });
  });

  it("expires and deletes a projection after 30 days", async () => {
    await saveSavedView("leaderboard", "player-a", [1, 2, 3], new Date("2026-08-01T12:00:00Z"));

    await expect(
      loadSavedView("leaderboard", "player-a", new Date("2026-08-31T12:00:00.001Z")),
    ).resolves.toBeNull();
    await expect(
      loadSavedView("leaderboard", "player-a", new Date("2026-08-01T12:00:00Z")),
    ).resolves.toBeNull();
  });

  it("suppresses and clears a projection for a different binding", async () => {
    await saveSavedView("feed", "player-a", { private: true });

    await expect(loadSavedView("feed", "player-b")).resolves.toBeNull();
    await expect(loadSavedView("feed", "player-a")).resolves.toBeNull();
  });

  it("clears every Saved View after observed revocation", async () => {
    await saveSavedView("feed", "player-a", { feed: true });
    await saveSavedView("leaderboard", "player-a", { leaderboard: true });

    await clearSavedViews();

    await expect(loadSavedView("feed", "player-a")).resolves.toBeNull();
    await expect(loadSavedView("leaderboard", "player-a")).resolves.toBeNull();
  });

  it("records an unbound Admin scope without exposing Player projections", async () => {
    await saveSavedView("feed", "player-a", { private: true });
    await saveViewerScope({ kind: "admin-unbound" });

    await expect(loadViewerScope()).resolves.toEqual({ kind: "admin-unbound" });
    await expect(loadSavedView("feed", "player-a")).resolves.toBeNull();
  });
});
