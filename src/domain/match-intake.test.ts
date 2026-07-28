import { describe, expect, it } from "vitest";
import { validateMatchIntake } from "./match-intake";
import {
  guestParticipant,
  playerParticipant,
  type MatchParticipant,
} from "./match-participant";

const player = playerParticipant;
const guest = guestParticipant;

function validate(
  sides: Record<"A" | "B", MatchParticipant[]>,
  options: {
    winnerSide?: "A" | "B";
    sets?: { a: number; b: number }[] | null;
    reservedPlayerNames?: string[];
  } = {},
) {
  return validateMatchIntake(
    {
      sides,
      winnerSide: options.winnerSide ?? "A",
      sets: options.sets ?? null,
    },
    {
      playerIds: ["a", "b", "c", "d"],
      reservedPlayerNames: options.reservedPlayerNames ?? [],
    },
  );
}

describe("validateMatchIntake", () => {
  it.each([
    {
      rule: "equal side sizes",
      sides: { A: [player("a")], B: [] },
      sets: null,
      code: "side-size",
    },
    {
      rule: "one or two participants per side",
      sides: { A: [], B: [] },
      sets: null,
      code: "side-size",
    },
    {
      rule: "participant discrimination",
      sides: {
        A: [{ kind: "spectator" } as unknown as MatchParticipant],
        B: [player("b")],
      },
      sets: null,
      code: "invalid-participant",
    },
    {
      rule: "Player uniqueness",
      sides: { A: [player("a")], B: [player("a")] },
      sets: null,
      code: "duplicate-player",
    },
    {
      rule: "authoritative Player existence",
      sides: { A: [player("missing")], B: [player("b")] },
      sets: null,
      code: "unknown-player",
    },
    {
      rule: "a Player on every side",
      sides: {
        A: [guest("One"), guest("Two")],
        B: [player("b"), player("c")],
      },
      sets: null,
      code: "guest-side",
    },
    {
      rule: "Guest Name validity",
      sides: {
        A: [player("a"), guest("   ")],
        B: [player("b"), player("c")],
      },
      sets: null,
      code: "invalid-guest-name",
    },
    {
      rule: "Guest and roster Name collision",
      sides: {
        A: [player("a"), guest("Alex")],
        B: [player("b"), player("c")],
      },
      sets: null,
      reservedPlayerNames: ["ＡＬＥＸ"],
      code: "guest-roster-collision",
    },
    {
      rule: "Guest Name uniqueness",
      sides: {
        A: [player("a"), guest("Pat")],
        B: [player("b"), guest(" PAT ")],
      },
      sets: null,
      code: "duplicate-guest",
    },
    {
      rule: "Set Score bounds",
      sides: { A: [player("a")], B: [player("b")] },
      sets: [{ a: -1, b: 6 }],
      code: "invalid-sets",
    },
    {
      rule: "a winner in every set",
      sides: { A: [player("a")], B: [player("b")] },
      sets: [{ a: 6, b: 6 }],
      code: "drawn-set",
    },
    {
      rule: "a declared winning side",
      sides: { A: [player("a")], B: [player("b")] },
      winnerSide: "C" as unknown as "A",
      sets: null,
      code: "invalid-winner",
    },
    {
      rule: "winner and sets consistency",
      sides: { A: [player("a")], B: [player("b")] },
      sets: [{ a: 4, b: 6 }],
      code: "winner-mismatch",
    },
  ])("classifies the shared $rule rule", (testCase) => {
    const result = validateMatchIntake(
      {
        sides: testCase.sides,
        winnerSide: testCase.winnerSide ?? "A",
        sets: testCase.sets,
      },
      {
        playerIds: ["a", "b", "c"],
        reservedPlayerNames: testCase.reservedPlayerNames ?? [],
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: testCase.code },
    });
  });

  it("accepts Player singles", () => {
    expect(validate({ A: [player("a")], B: [player("b")] }).ok).toBe(true);
  });

  it("normalizes Guest display names in valid doubles", () => {
    expect(
      validate({
        A: [player("a"), guest("  New   Guest ")],
        B: [player("b"), player("c")],
      }),
    ).toMatchObject({
      ok: true,
      sides: {
        A: [player("a"), guest("New Guest")],
      },
    });
  });

  it("allows one distinct Guest on each opposing side", () => {
    expect(
      validate({
        A: [player("a"), guest("Guest One")],
        B: [player("b"), guest("Guest Two")],
      }).ok,
    ).toBe(true);
  });

  it("rejects Guests in singles and two Guests on one side", () => {
    expect(validate({ A: [guest("G")], B: [player("b")] })).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("roster player"),
      }),
    });
    expect(
      validate({
        A: [guest("G1"), guest("G2")],
        B: [player("b"), player("c")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("roster player"),
      }),
    });
  });

  it("rejects normalized Guest collisions with the roster or another Guest", () => {
    expect(
      validate(
        {
          A: [player("a"), guest("ＳＩＭＯＮ")],
          B: [player("b"), player("c")],
        },
        { reservedPlayerNames: ["Simon"] },
      ),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("roster Player Name"),
      }),
    });
    expect(
      validate({
        A: [player("a"), guest("Casey")],
        B: [player("b"), guest(" CASEY ")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("unique"),
      }),
    });
  });

  it("rejects duplicate Players", () => {
    expect(
      validate({
        A: [player("a"), player("b")],
        B: [player("a"), player("c")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("one side"),
      }),
    });
  });

  it("requires every set and the declared result to have a winner", () => {
    expect(
      validate(
        { A: [player("a")], B: [player("b")] },
        { sets: [{ a: 6, b: 6 }] },
      ),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("Every set"),
      }),
    });
    expect(
      validate(
        { A: [player("a")], B: [player("b")] },
        {
          winnerSide: "A",
          sets: [
            { a: 6, b: 4 },
            { a: 2, b: 6 },
            { a: 1, b: 6 },
          ],
        },
      ),
    ).toMatchObject({
      ok: false,
      error: expect.objectContaining({
        message: expect.stringContaining("selected match winner"),
      }),
    });
  });

  it("makes the caller's roster policy explicit", () => {
    expect(
      validateMatchIntake(
        {
          sides: { A: [player("retired")], B: [player("active")] },
          winnerSide: "A",
          sets: null,
        },
        {
          playerIds: ["active"],
          reservedPlayerNames: ["Retired", "Active"],
        },
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "unknown-player" },
    });
    expect(
      validateMatchIntake(
        {
          sides: { A: [player("retired")], B: [player("active")] },
          winnerSide: "A",
          sets: null,
        },
        {
          playerIds: ["retired", "active"],
          reservedPlayerNames: ["Retired", "Active"],
        },
      ).ok,
    ).toBe(true);
  });
});
