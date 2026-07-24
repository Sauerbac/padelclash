import { describe, expect, it } from "vitest";
import {
  projectGroup,
  replayMatch,
  type PlayerState,
} from "./engine";
import { guest, match, player } from "./fixtures";

const established = (rating: number): PlayerState => ({
  rating,
  competitiveMatchesPlayed: 3,
  matchesSinceReset: 3,
});

describe("rating acceptance anchors", () => {
  it("moves equal established players by 25 for a Simple Result", () => {
    const prior = new Map([
      ["winner", established(1000)],
      ["loser", established(1000)],
    ]);
    const result = replayMatch(
      prior,
      match({ id: "m1", a: ["winner"], b: ["loser"], winner: "A" }),
    );

    expect(result.outputs.map((row) => row.delta)).toEqual([25, -25]);
    expect(result.outputs.map((row) => row.expectedScore)).toEqual([0.5, 0.5]);
  });

  it("applies the 1.4 shutout bonus to equal established players", () => {
    const prior = new Map([
      ["winner", established(1000)],
      ["loser", established(1000)],
    ]);
    const result = replayMatch(
      prior,
      match({
        id: "m1",
        a: ["winner"],
        b: ["loser"],
        winner: "A",
        sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }],
      }),
    );

    expect(result.outputs.map((row) => row.delta)).toEqual([35, -35]);
  });

  it.each([
    {
      sets: [
        { a: 7, b: 6 },
        { a: 6, b: 7 },
        { a: 7, b: 6 },
      ],
      delta: 25,
    },
    { sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }], delta: 27 },
    { sets: [{ a: 6, b: 2 }, { a: 6, b: 2 }], delta: 30 },
    { sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }], delta: 35 },
  ])("matches the representative Set Score curve at $delta", ({ sets, delta }) => {
    const prior = new Map([
      ["winner", established(1000)],
      ["loser", established(1000)],
    ]);
    const result = replayMatch(
      prior,
      match({ id: `score-${delta}`, a: ["winner"], b: ["loser"], winner: "A", sets }),
    );
    expect(result.outputs.map((row) => row.delta)).toEqual([delta, -delta]);
  });

  it("updates each doubles player independently against the opposing mean", () => {
    const prior = new Map([
      ["weak", established(800)],
      ["strong", established(1200)],
      ["opponent-1", established(1000)],
      ["opponent-2", established(1000)],
    ]);

    const win = replayMatch(
      prior,
      match({
        id: "win",
        a: ["weak", "strong"],
        b: ["opponent-1", "opponent-2"],
        winner: "A",
      }),
    );
    expect(win.outputs.map((row) => row.delta)).toEqual([38, 12, -25, -25]);

    const loss = replayMatch(
      prior,
      match({
        id: "loss",
        a: ["opponent-1", "opponent-2"],
        b: ["weak", "strong"],
        winner: "A",
      }),
    );
    expect(loss.outputs.map((row) => row.delta)).toEqual([25, 25, -12, -38]);
  });

  it("caps equal provisional players at 50 with or without a score", () => {
    for (const sets of [null, [{ a: 6, b: 0 }, { a: 6, b: 0 }]]) {
      const result = projectGroup([
        match({ id: `m-${sets ? "score" : "simple"}`, a: ["a"], b: ["b"], winner: "A", sets }),
      ]);
      expect(result.ratingHistory.map((row) => row.delta)).toEqual([50, -50]);
      expect(result.ratingHistory.every((row) => row.wasProvisional)).toBe(true);
    }
  });

  it("uses Provisional rules through Match three and Established rules on Match four", () => {
    const opponent = established(1000);
    const third = replayMatch(
      new Map([
        [
          "player",
          {
            rating: 1000,
            competitiveMatchesPlayed: 2,
            matchesSinceReset: 2,
          },
        ],
        ["opponent", opponent],
      ]),
      match({ id: "third", a: ["player"], b: ["opponent"], winner: "A" }),
    );
    const fourth = replayMatch(
      new Map([
        ["player", established(1000)],
        ["opponent", opponent],
      ]),
      match({ id: "fourth", a: ["player"], b: ["opponent"], winner: "A" }),
    );

    expect(third.outputs[0]).toMatchObject({ delta: 50, wasProvisional: true });
    expect(fourth.outputs[0]).toMatchObject({
      delta: 25,
      wasProvisional: false,
    });
  });

  it("keeps an Established Player at K=50 against a Provisional Player", () => {
    const result = replayMatch(
      new Map([
        ["established", established(1000)],
        [
          "provisional",
          {
            rating: 1000,
            competitiveMatchesPlayed: 0,
            matchesSinceReset: 0,
          },
        ],
      ]),
      match({
        id: "mixed-placement",
        a: ["established"],
        b: ["provisional"],
        winner: "A",
      }),
    );
    expect(result.outputs.map((row) => row.delta)).toEqual([25, -50]);
  });

  it("allows a lifetime Rating to cross below zero", () => {
    const result = replayMatch(
      new Map([
        ["winner", established(0)],
        ["loser", established(0)],
      ]),
      match({ id: "negative", a: ["winner"], b: ["loser"], winner: "A" }),
    );
    expect(result.next.get("loser")?.rating).toBe(-25);
  });
});

describe("Guest rating boundary", () => {
  it("uses the participating Players' mean as input and emits only Player rows", () => {
    const prior = new Map([
      ["a", established(800)],
      ["b", established(1000)],
      ["c", established(1200)],
    ]);
    const result = replayMatch(prior, {
      ...match({ id: "guest", a: [], b: [], winner: "A" }),
      sides: {
        A: [player("a"), guest("Visitor")],
        B: [player("b"), player("c")],
      },
    });

    expect(result.outputs.map((row) => row.playerId)).toEqual(["a", "b", "c"]);
    expect(result.outputs.map((row) => row.delta)).toEqual([42, -32, -42]);
    expect(result.next.has("Visitor")).toBe(false);
    expect(result.next.get("a")?.competitiveMatchesPlayed).toBe(4);
  });
});
