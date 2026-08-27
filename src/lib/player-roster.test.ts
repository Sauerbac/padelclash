import { describe, expect, it } from "vitest";
import {
  addSharedMatchToCounts,
  countSharedMatches,
  filterPlayersByName,
  removePlayersById,
  removeSelectedPlayers,
  retainExpandedPlayer,
  sortPlayersByName,
  sortPlayersBySharedMatches,
  toggleExpandedPlayer,
} from "./player-roster";

const players = [
  { id: "z", name: "zoe" },
  { id: "a2", name: "alexander" },
  { id: "a1", name: "Alex" },
];

describe("player roster helpers", () => {
  it("sorts names alphabetically without changing the input array", () => {
    expect(sortPlayersByName(players).map((player) => player.name)).toEqual([
      "Alex",
      "alexander",
      "zoe",
    ]);
    expect(players.map((player) => player.id)).toEqual(["z", "a2", "a1"]);
  });

  it("filters names case-insensitively and ignores surrounding whitespace", () => {
    expect(filterPlayersByName(players, "  ALEX ").map((p) => p.id)).toEqual([
      "a2",
      "a1",
    ]);
  });

  it("combines partner and opponent Matches into one frequency", () => {
    expect(
      countSharedMatches(
        [{ playerId: "z", wins: 2, losses: 1 }],
        [
          { playerId: "z", wins: 0, losses: 2 },
          { playerId: "a1", wins: 1, losses: 0 },
        ],
      ),
    ).toEqual({ z: 5, a1: 1 });
  });

  it("sorts by shared Matches and breaks ties alphabetically", () => {
    expect(
      sortPlayersBySharedMatches(players, { z: 4, a2: 1, a1: 1 }).map(
        (player) => player.id,
      ),
    ).toEqual(["z", "a1", "a2"]);
    expect(players.map((player) => player.id)).toEqual(["z", "a2", "a1"]);
  });

  it("adds a successful Match to every roster co-participant of the bound Player", () => {
    expect(
      addSharedMatchToCounts(
        { opponent: 4, partner: 1 },
        "viewer",
        ["viewer", "opponent", "partner", "opponent"],
      ),
    ).toEqual({ opponent: 5, partner: 2 });

    expect(
      addSharedMatchToCounts(
        { opponent: 4 },
        "viewer",
        ["opponent", "someone-else"],
      ),
    ).toEqual({ opponent: 4 });
  });

  it("toggles one shared expanded player and closes an open row", () => {
    expect(toggleExpandedPlayer(null, "a1")).toBe("a1");
    expect(toggleExpandedPlayer("a1", "z")).toBe("z");
    expect(toggleExpandedPlayer("a1", "a1")).toBeNull();
  });

  it("closes the expanded player when filtering removes it", () => {
    expect(retainExpandedPlayer("a1", ["a2", "z"])).toBeNull();
    expect(retainExpandedPlayer("a1", ["a1", "z"])).toBe("a1");
  });

  it("keeps picker frequency order after removing selections", () => {
    const ordered = sortPlayersBySharedMatches(players, {
      z: 4,
      a2: 1,
      a1: 1,
    });
    expect(
      removeSelectedPlayers(ordered, new Set(["a1"]), "a1").map(
        (player) => player.name,
      ),
    ).toEqual(["zoe", "Alex", "alexander"]);
    expect(
      removeSelectedPlayers(ordered, new Set(["a1", "a2"])).map(
        (player) => player.name,
      ),
    ).toEqual(["zoe"]);
  });

  it("removes every Player kept in a transient management section", () => {
    expect(
      removePlayersById(players, new Set(["a1", "z"])).map(
        (player) => player.id,
      ),
    ).toEqual(["a2"]);
  });
});
