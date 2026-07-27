import { describe, expect, it } from "vitest";
import { validateMatchDraft } from "./match-draft";
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
  return validateMatchDraft({
    sides,
    winnerSide: options.winnerSide ?? "A",
    sets: options.sets ?? null,
    reservedPlayerNames: options.reservedPlayerNames ?? [],
  });
}

describe("validateMatchDraft", () => {
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
      error: expect.stringContaining("roster player"),
    });
    expect(
      validate({
        A: [guest("G1"), guest("G2")],
        B: [player("b"), player("c")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("roster player"),
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
      error: expect.stringContaining("roster Player Name"),
    });
    expect(
      validate({
        A: [player("a"), guest("Casey")],
        B: [player("b"), guest(" CASEY ")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("unique"),
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
      error: expect.stringContaining("one side"),
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
      error: expect.stringContaining("Every set"),
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
      error: expect.stringContaining("selected match winner"),
    });
  });
});
