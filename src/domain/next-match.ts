import type { MatchParticipant } from "./match-participant";
import type { MatchSide } from "./rating/engine";

export type MatchParticipantSides = Record<MatchSide, MatchParticipant[]>;

export interface NextMatchLineup {
  sides: MatchParticipantSides;
  same: boolean;
}

/**
 * Enumerate every valid way to replay the submitted participants.
 * Changed doubles pairings lead; the submitted teams are always last.
 */
export function nextMatchLineups(
  submitted: MatchParticipantSides,
): NextMatchLineup[] {
  if (submitted.A.length === 1 && submitted.B.length === 1) {
    return [{ sides: submitted, same: true }];
  }
  if (submitted.A.length !== 2 || submitted.B.length !== 2) return [];

  const [a1, a2] = submitted.A;
  const [b1, b2] = submitted.B;
  return [
    { sides: { A: [a1, b1], B: [a2, b2] }, same: false },
    { sides: { A: [a1, b2], B: [a2, b1] }, same: false },
    { sides: submitted, same: true },
  ].filter(({ sides }) => sideHasPlayer(sides.A) && sideHasPlayer(sides.B));
}

function sideHasPlayer(side: MatchParticipant[]): boolean {
  return side.some((participant) => participant.kind === "player");
}
