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
    { sets: [{ a: 6, b: 3 }, { a: 6, b: 3 }], delta: 28 },
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

  // Decision 121: dropping a set costs bonus, so a straight-sets win always
  // outscores a three-setter with the same or better games ratio. The
  // games-only metric ranked these the other way round.
  it.each([
    { label: "6-4, 6-4 straight sets", sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }], delta: 27 },
    {
      label: "6-0, 0-6, 6-1 dropping a set",
      sets: [{ a: 6, b: 0 }, { a: 0, b: 6 }, { a: 6, b: 1 }],
      delta: 26,
    },
    { label: "6-3, 6-3 straight sets", sets: [{ a: 6, b: 3 }, { a: 6, b: 3 }], delta: 28 },
    {
      label: "6-0, 0-6, 6-0 dropping a set",
      sets: [{ a: 6, b: 0 }, { a: 0, b: 6 }, { a: 6, b: 0 }],
      delta: 26,
    },
  ])("weights dominance by set margin: $label pays $delta", ({ sets, delta }) => {
    const prior = new Map([
      ["winner", established(1000)],
      ["loser", established(1000)],
    ]);
    const result = replayMatch(
      prior,
      match({ id: "margin", a: ["winner"], b: ["loser"], winner: "A", sets }),
    );
    expect(result.outputs[0].delta).toBe(delta);
  });

  it("degrades a contradictory Set Score to plain win/loss movement", () => {
    const prior = new Map([
      ["winner", established(1000)],
      ["loser", established(1000)],
    ]);
    // Declared winner is behind on games and on sets.
    const result = replayMatch(
      prior,
      match({
        id: "contradictory",
        a: ["winner"],
        b: ["loser"],
        winner: "A",
        sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 4, b: 6 }],
      }),
    );
    expect(result.outputs.map((row) => row.delta)).toEqual([25, -25]);
  });

  it("lets a big upset exceed the retired 50-point cap", () => {
    const result = replayMatch(
      new Map([
        ["underdog", established(800)],
        ["favourite", established(1000)],
      ]),
      match({
        id: "uncapped",
        a: ["underdog"],
        b: ["favourite"],
        winner: "A",
        sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }],
      }),
    );
    expect(result.outputs.map((row) => row.delta)).toEqual([53, -53]);
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

  it("moves a Player in their first rated Match by 40 for a Simple Result", () => {
    const result = projectGroup([
      match({ id: "placement-simple", a: ["a"], b: ["b"], winner: "A" }),
    ]);

    expect(result.ratingHistory.map((row) => row.delta)).toEqual([40, -40]);
    expect(result.ratingHistory.every((row) => row.wasProvisional)).toBe(true);
  });

  it("moves a Player in their first rated Match by 56 for a shutout", () => {
    const result = projectGroup([
      match({
        id: "placement-shutout",
        a: ["a"],
        b: ["b"],
        winner: "A",
        sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }],
      }),
    ]);

    expect(result.ratingHistory.map((row) => row.delta)).toEqual([56, -56]);
  });

  // The whole taper in one table: K = max(50, 80 - 10n), halved at equal
  // Rating. It reaches the Established factor exactly at RATED_THRESHOLD and
  // never steps again, so there is no cliff to test on either side of.
  it.each([
    { priorMatches: 0, delta: 40, wasProvisional: true },
    { priorMatches: 1, delta: 35, wasProvisional: true },
    { priorMatches: 2, delta: 30, wasProvisional: true },
    { priorMatches: 3, delta: 25, wasProvisional: false },
    { priorMatches: 4, delta: 25, wasProvisional: false },
    { priorMatches: 9, delta: 25, wasProvisional: false },
  ])(
    "tapers to $delta after $priorMatches prior rated Matches",
    ({ priorMatches, delta, wasProvisional }) => {
      const result = replayMatch(
        new Map([
          [
            "player",
            {
              rating: 1000,
              competitiveMatchesPlayed: priorMatches,
              matchesSinceReset: priorMatches,
            },
          ],
          ["opponent", established(1000)],
        ]),
        match({
          id: `taper-${priorMatches}`,
          a: ["player"],
          b: ["opponent"],
          winner: "A",
        }),
      );
      expect(result.outputs[0]).toMatchObject({ delta, wasProvisional });
    },
  );

  it("keeps an Established Player at K=50 against a Player still in placement", () => {
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
    expect(result.outputs.map((row) => row.delta)).toEqual([25, -40]);
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
