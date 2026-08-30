import { describe, expect, it } from "vitest";
import { guestParticipant, playerParticipant } from "../domain/match-participant";
import {
  selectParticipantInSlot,
  type MatchDraftSlots,
  type MatchSlot,
} from "./match-draft-slots";

const player = playerParticipant;
const guest = guestParticipant;
const active: MatchSlot[] = ["a1", "a2", "b1", "b2"];

describe("selectParticipantInSlot", () => {
  it("swaps two occupied Player slots", () => {
    const slots: MatchDraftSlots = {
      a1: player("a"),
      a2: player("b"),
      b1: player("c"),
      b2: player("d"),
    };
    expect(selectParticipantInSlot(slots, active, "a1", player("c"))).toEqual({
      a1: player("c"),
      a2: player("b"),
      b1: player("a"),
      b2: player("d"),
    });
  });

  it("keeps two Guests on opposing Sides when choosing from a Guest slot", () => {
    const slots: MatchDraftSlots = {
      a1: player("a"),
      a2: guest("Mira"),
      b1: player("b"),
      b2: guest("Noor"),
    };
    expect(selectParticipantInSlot(slots, active, "a2", player("b"))).toEqual({
      a1: guest("Mira"),
      a2: player("b"),
      b1: player("a"),
      b2: guest("Noor"),
    });
  });

  it("ordinarily replaces an unoccupied selection", () => {
    const slots: MatchDraftSlots = {
      a1: player("a"),
      a2: null,
      b1: player("b"),
      b2: null,
    };
    expect(selectParticipantInSlot(slots, active, "a2", player("c"))).toMatchObject({
      a1: player("a"),
      a2: player("c"),
      b1: player("b"),
    });
  });
});
