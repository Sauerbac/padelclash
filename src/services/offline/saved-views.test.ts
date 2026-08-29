import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  clearSavedViews,
  loadSavedView,
  saveSavedView,
  loadViewerScope,
  saveViewerScope,
  recordSavedView,
} from "./saved-views";

describe("Saved Views", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("loads a binding-scoped projection within 30 days", async () => {
    await saveSavedView("feed", "binding-a", feedProjection(), new Date("2026-08-01T12:00:00Z"));

    await expect(
      loadSavedView("feed", "binding-a", new Date("2026-08-31T11:59:59Z")),
    ).resolves.toMatchObject({
      bindingId: "binding-a",
      projection: feedProjection(),
      refreshedAt: "2026-08-01T12:00:00.000Z",
    });
  });

  it("expires and deletes a projection after 30 days", async () => {
    await saveSavedView("leaderboard", "binding-a", leaderboardProjection(), new Date("2026-08-01T12:00:00Z"));

    await expect(
      loadSavedView("leaderboard", "binding-a", new Date("2026-08-31T12:00:00.001Z")),
    ).resolves.toBeNull();
    await expect(
      loadSavedView("leaderboard", "binding-a", new Date("2026-08-01T12:00:00Z")),
    ).resolves.toBeNull();
  });

  it("suppresses and clears a projection for a different binding", async () => {
    await saveSavedView("feed", "binding-a", feedProjection());

    await expect(loadSavedView("feed", "binding-b")).resolves.toBeNull();
    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
  });

  it("suppresses a Saved View after same-Player Device Binding replacement", async () => {
    await saveSavedView("feed", "binding-a", feedProjection());

    await expect(loadSavedView("feed", "binding-b")).resolves.toBeNull();
  });

  it("rejects and deletes malformed durable projections", async () => {
    await saveSavedView("feed", "binding-a", { unexpected: true } as never);

    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
  });

  it("clears every Saved View after observed revocation", async () => {
    await saveSavedView("feed", "binding-a", feedProjection());
    await saveSavedView("leaderboard", "binding-a", leaderboardProjection());

    await clearSavedViews();

    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
    await expect(loadSavedView("leaderboard", "binding-a")).resolves.toBeNull();
  });

  it("records an unbound Admin scope without exposing Player projections", async () => {
    await saveSavedView("feed", "binding-a", feedProjection());
    await saveViewerScope({ kind: "admin-unbound" });

    await expect(loadViewerScope()).resolves.toEqual({ kind: "admin-unbound" });
    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
  });

  it("makes cleanup dominate an older Saved View writer", async () => {
    const write = recordSavedView(
      "feed",
      { kind: "player", playerId: "player-a", bindingId: "binding-a" },
      feedProjection(),
    );
    const cleanup = clearSavedViews();

    await Promise.all([write, cleanup]);

    await expect(loadSavedView("feed", "binding-a")).resolves.toBeNull();
  });
});

function feedProjection() {
  return { you: { id: "player-a", name: "Alex" }, feed: [] };
}

function leaderboardProjection() {
  return { youId: "player-a", entries: [] };
}
