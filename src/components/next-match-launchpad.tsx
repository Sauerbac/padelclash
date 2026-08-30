import { Button } from "@/components/ui/button";
import {
  nextMatchLineups,
  type MatchParticipantSides,
} from "@/domain/next-match";
import type { MatchParticipant } from "@/domain/match-participant";

export const NEXT_MATCH_SLOGANS = [
  "Same court, new alliances.",
  "New teams, fresh excuses.",
  "Different players, same problems.",
  "New partners, same bragging rights.",
] as const;

export function randomNextMatchSlogan(): string {
  return NEXT_MATCH_SLOGANS[
    Math.floor(Math.random() * NEXT_MATCH_SLOGANS.length)
  ];
}

export function NextMatchLaunchpad({
  submittedSides,
  playerNames,
  slogan,
  onChoose,
  onChooseDifferent,
}: {
  submittedSides: MatchParticipantSides;
  playerNames: Readonly<Record<string, string>>;
  slogan: string;
  onChoose: (sides: MatchParticipantSides) => void;
  onChooseDifferent: () => void;
}) {
  const lineups = nextMatchLineups(submittedSides);

  return (
    <section className="space-y-3 pt-1">
      <div className="min-w-0">
        <h2 className="section-label text-accent">Next match</h2>
        <p className="mt-1 text-lg font-semibold leading-tight">{slogan}</p>
      </div>
      <div className="space-y-2.5">
        {lineups.map((lineup) => (
          <Button
            key={accessibleLineupName(lineup.sides, playerNames)}
            type="button"
            variant="outline"
            aria-label={`Choose ${accessibleLineupName(lineup.sides, playerNames)}`}
            onClick={() => onChoose(lineup.sides)}
            className="grid min-h-16 h-auto w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-border px-3 py-2.5 text-left whitespace-normal normal-case tracking-normal text-foreground hover:border-accent"
          >
            <SideNames side={lineup.sides.A} playerNames={playerNames} className="text-right" />
            <span className="self-center font-mono text-[9px] font-bold tracking-[1px] text-accent">VS</span>
            <SideNames side={lineup.sides.B} playerNames={playerNames} />
            {lineup.same && (
              <span className="col-span-3 justify-self-center border border-border px-1.5 py-0.5 font-mono text-[8px] font-semibold tracking-[1.5px] text-accent uppercase">
                {lineup.sides.A.length === 1 ? "Same players" : "Same teams"}
              </span>
            )}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={onChooseDifferent}
          className="min-h-16 h-auto w-full justify-between border-border px-3 py-2.5 text-left whitespace-normal normal-case tracking-normal text-foreground hover:border-accent"
        >
          <span className="text-[17px] font-bold uppercase">Choose different players</span>
          <span className="shrink-0 font-mono text-[8px] font-semibold tracking-[1.5px] text-accent uppercase">Full roster ›</span>
        </Button>
      </div>
    </section>
  );
}

function SideNames({
  side,
  playerNames,
  className = "",
}: {
  side: MatchParticipant[];
  playerNames: Readonly<Record<string, string>>;
  className?: string;
}) {
  return (
    <span className={`flex min-w-0 flex-col text-[17px] font-semibold uppercase ${className}`}>
      {side.map((participant, index) => (
        <span key={participantKey(participant, index)} className="min-w-0 break-words leading-[1.05]">
          {participantName(participant, playerNames)}
          {participant.kind === "guest" && (
            <span className="ml-1 font-mono text-[8px] tracking-[1px] text-accent">GUEST</span>
          )}
        </span>
      ))}
    </span>
  );
}

function accessibleLineupName(
  sides: MatchParticipantSides,
  playerNames: Readonly<Record<string, string>>,
): string {
  return `${sideName(sides.A, playerNames)} versus ${sideName(sides.B, playerNames)}`;
}

function sideName(
  side: MatchParticipant[],
  playerNames: Readonly<Record<string, string>>,
): string {
  return side.map((participant) => participantName(participant, playerNames)).join(" and ");
}

function participantName(
  participant: MatchParticipant,
  playerNames: Readonly<Record<string, string>>,
): string {
  return participant.kind === "guest"
    ? participant.name
    : playerNames[participant.playerId] ?? "Unknown";
}

function participantKey(participant: MatchParticipant, index: number): string {
  return participant.kind === "player"
    ? participant.playerId
    : `guest-${participant.name}-${index}`;
}
