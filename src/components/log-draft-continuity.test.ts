import { describe, expect, it } from "vitest";
import type { PreservedMatchDraft } from "./log-draft-continuity";
import {
  logDraftContinuityReducer,
  shouldClearLogDraft,
} from "./log-draft-continuity";

describe("Log Match draft continuity", () => {
  it("carries every draft field through the snapshot-to-fresh handoff", () => {
    const draft: PreservedMatchDraft = {
      doubles: true,
      slots: {
        a1: { kind: "player", playerId: "player-1" },
        a2: { kind: "guest", name: "Mira" },
        b1: { kind: "player", playerId: "player-2" },
        b2: { kind: "player", playerId: "player-3" },
      },
      winner: "A",
      recordSets: true,
      sets: [{ a: "6", b: "4" }, { a: "7", b: "5" }],
      playedAt: "2026-08-27T20:15",
      namesByPlayerId: {
        "player-1": "Alex",
        "player-2": "Blair",
        "player-3": "Casey",
      },
    };

    const restored = logDraftContinuityReducer(null, { type: "save", draft });

    expect(restored).toEqual({
      doubles: true,
      slots: {
        a1: { kind: "player", playerId: "player-1" },
        a2: { kind: "guest", name: "Mira" },
        b1: { kind: "player", playerId: "player-2" },
        b2: { kind: "player", playerId: "player-3" },
      },
      winner: "A",
      recordSets: true,
      sets: [{ a: "6", b: "4" }, { a: "7", b: "5" }],
      playedAt: "2026-08-27T20:15",
      namesByPlayerId: {
        "player-1": "Alex",
        "player-2": "Blair",
        "player-3": "Casey",
      },
    });
  });

  it("clears continuity when the Player leaves Log Match", () => {
    expect(shouldClearLogDraft("/log", "/leaderboard")).toBe(true);
    expect(shouldClearLogDraft("/", "/leaderboard")).toBe(true);
    expect(shouldClearLogDraft("/", "/log")).toBe(false);
    expect(shouldClearLogDraft("/log", "/log")).toBe(false);
  });
});
