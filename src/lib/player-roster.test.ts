import { describe, expect, it } from "vitest";
import {
  filterPlayersByName,
  removeSelectedPlayers,
  retainExpandedPlayer,
  sortPlayersByName,
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

  it("toggles one shared expanded player and closes an open row", () => {
    expect(toggleExpandedPlayer(null, "a1")).toBe("a1");
    expect(toggleExpandedPlayer("a1", "z")).toBe("z");
    expect(toggleExpandedPlayer("a1", "a1")).toBeNull();
  });

  it("closes the expanded player when filtering removes it", () => {
    expect(retainExpandedPlayer("a1", ["a2", "z"])).toBeNull();
    expect(retainExpandedPlayer("a1", ["a1", "z"])).toBe("a1");
  });

  it("keeps picker options alphabetical after removing selections", () => {
    const ordered = sortPlayersByName(players);
    expect(
      removeSelectedPlayers(ordered, new Set(["a1"]), "a1").map(
        (player) => player.name,
      ),
    ).toEqual(["Alex", "alexander", "zoe"]);
    expect(
      removeSelectedPlayers(ordered, new Set(["a1", "a2"])).map(
        (player) => player.name,
      ),
    ).toEqual(["zoe"]);
  });
});
