import { describe, expect, it } from "vitest";
import { reconcileDraftRoster } from "./draft-roster";

describe("draft roster reconciliation", () => {
  it("uses the fresh name for a selected Player with the same stable id", () => {
    const result = reconcileDraftRoster(
      [{ id: "player-1", name: "New name" }],
      ["player-1"],
      { "player-1": "Old name" },
    );

    expect(result.entries).toEqual([{ id: "player-1", name: "New name" }]);
    expect(result.invalidSelectedIds).toEqual([]);
  });

  it("retains a removed selected Player by saved name but marks it invalid", () => {
    const result = reconcileDraftRoster(
      [{ id: "player-2", name: "Available" }],
      ["player-1"],
      { "player-1": "Retired while drafting" },
    );

    expect(result.entries).toContainEqual({ id: "player-1", name: "Retired while drafting" });
    expect(result.invalidSelectedIds).toEqual(["player-1"]);
  });
});
