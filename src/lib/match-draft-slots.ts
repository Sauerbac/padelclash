import type { MatchParticipant } from "../domain/match-participant";

export type MatchSlot = "a1" | "a2" | "b1" | "b2";
export type MatchDraftSlots = Record<MatchSlot, MatchParticipant | null>;

export function sideForSlot(slot: MatchSlot): "A" | "B" {
  return slot.startsWith("a") ? "A" : "B";
}

export function occupiedSlotFor(
  slots: MatchDraftSlots,
  activeSlots: MatchSlot[],
  playerId: string,
  except: MatchSlot,
): MatchSlot | undefined {
  return activeSlots.find(
    (candidate) =>
      candidate !== except &&
      slots[candidate]?.kind === "player" &&
      slots[candidate].playerId === playerId,
  );
}

/** Replace an unused participant or atomically rearrange an occupied Player. */
export function selectParticipantInSlot(
  current: MatchDraftSlots,
  activeSlots: MatchSlot[],
  slot: MatchSlot,
  participant: MatchParticipant | null,
): MatchDraftSlots {
  if (participant?.kind !== "player") {
    return { ...current, [slot]: participant };
  }
  const occupied = occupiedSlotFor(
    current,
    activeSlots,
    participant.playerId,
    slot,
  );
  if (!occupied) return { ...current, [slot]: participant };

  const displaced = current[slot];
  const swapped = {
    ...current,
    [slot]: participant,
    [occupied]: displaced,
  };
  if (displaced?.kind !== "guest" || sideHasPlayer(swapped, occupied)) {
    return swapped;
  }

  // With one Guest on each Side, a two-slot swap from a Guest slot would put
  // both Guests together. Rotate the current Side's Player into the vacated
  // slot instead, keeping every participant and both Sides valid.
  const currentSidePlayer = activeSlots.find(
    (candidate) =>
      candidate !== slot &&
      sideForSlot(candidate) === sideForSlot(slot) &&
      current[candidate]?.kind === "player",
  );
  if (!currentSidePlayer) return swapped;
  return {
    ...current,
    [slot]: participant,
    [occupied]: current[currentSidePlayer],
    [currentSidePlayer]: displaced,
  };
}

function sideHasPlayer(slots: MatchDraftSlots, slot: MatchSlot): boolean {
  const side = sideForSlot(slot);
  return (Object.keys(slots) as MatchSlot[]).some(
    (candidate) =>
      sideForSlot(candidate) === side && slots[candidate]?.kind === "player",
  );
}
