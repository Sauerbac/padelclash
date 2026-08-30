import { describe, expect, it } from "vitest";
import { guestParticipant, playerParticipant } from "./match-participant";
import { nextMatchLineups } from "./next-match";

const player = playerParticipant;
const guest = guestParticipant;

describe("nextMatchLineups", () => {
  it("puts both changed doubles pairings before the submitted teams", () => {
    expect(
      nextMatchLineups({
        A: [player("a"), player("b")],
        B: [player("c"), player("d")],
      }),
    ).toEqual([
      { sides: { A: [player("a"), player("c")], B: [player("b"), player("d")] }, same: false },
      { sides: { A: [player("a"), player("d")], B: [player("b"), player("c")] }, same: false },
      { sides: { A: [player("a"), player("b")], B: [player("c"), player("d")] }, same: true },
    ]);
  });

  it("omits the pairing that would put two Guests on one Side", () => {
    expect(
      nextMatchLineups({
        A: [player("a"), guest("Mira")],
        B: [player("b"), guest("Noor")],
      }),
    ).toEqual([
      {
        sides: { A: [player("a"), guest("Noor")], B: [guest("Mira"), player("b")] },
        same: false,
      },
      {
        sides: { A: [player("a"), guest("Mira")], B: [player("b"), guest("Noor")] },
        same: true,
      },
    ]);
  });

  it("offers the submitted participants once for singles", () => {
    expect(nextMatchLineups({ A: [player("a")], B: [player("b")] })).toEqual([
      { sides: { A: [player("a")], B: [player("b")] }, same: true },
    ]);
  });
});
