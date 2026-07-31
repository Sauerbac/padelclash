import { PlayerLink } from "@/components/player-link";
import { formatPlayedAt } from "@/lib/match-time";

/**
 * The shared innards of a feed match card, so the synced card (`MatchCard`)
 * and the offline-queue cards (`QueuedMatches`) stay one visual language.
 * Decision 67: the result gets its own rows, and card height follows content.
 *
 * These are plain presentational components — no hooks — so the client-side
 * queue can import them as freely as the server-rendered feed.
 */

/** The mono timestamp opening every card. */
export function PlayedAt({ at }: { at: Date }) {
  return (
    <span className="font-mono text-[11px] font-medium tracking-[1px] text-muted-foreground uppercase">
      {formatPlayedAt(at)}
    </span>
  );
}

/**
 * Who beat whom — the bragging layer, and the one thing that has to land
 * while scrolling fast. Winners big and bright, losers a size down and
 * muted; that contrast is load-bearing.
 */
export function MatchHeadline({
  winners,
  losers,
}: {
  winners: React.ReactNode;
  losers: React.ReactNode;
}) {
  return (
    <div className="[overflow-wrap:anywhere]">
      <div className="font-display text-[25px] leading-[1.02] tracking-[0.5px] uppercase">
        {winners}
        <span className="ml-2 font-mono text-[10px] font-semibold tracking-[2px] text-primary uppercase">
          def.
        </span>
      </div>
      <div className="mt-[5px] font-display text-[20px] leading-[1.02] tracking-[0.5px] text-muted-foreground uppercase">
        {losers}
      </div>
    </div>
  );
}

/** Linked names with the same separator in synced and queued cards. */
export function MatchPlayerNames({
  players,
}: {
  players: (
    | { kind: "player"; playerId: string; name: string }
    | { kind: "guest"; name: string }
  )[];
}) {
  return players.map((player, index) => (
    <span
      key={
        player.kind === "player"
          ? player.playerId
          : `guest-${index}-${player.name}`
      }
    >
      {index > 0 && <span className="text-muted-foreground"> & </span>}
      {player.kind === "player" ? (
        <PlayerLink playerId={player.playerId}>{player.name}</PlayerLink>
      ) : (
        <>
          {player.name}{" "}
          <span className="font-mono text-[9px] tracking-[1px] text-accent">
            GUEST
          </span>
        </>
      )}
    </span>
  ));
}

/**
 * The set scores on their own row (decision 67) — they are the match result,
 * not metadata about it. Winner-first, one self-explanatory box per set;
 * absent entirely when the logger skipped them.
 */
export function SetsRow({ sets }: { sets: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sets.map((score, i) => (
        <span
          key={i}
          className="border px-2 py-[3px] font-mono text-[13px] font-semibold"
        >
          {score}
        </span>
      ))}
    </div>
  );
}

/** Winner-first set scores, matching the names next to them. */
export function setScores(
  sets: { a: number | string; b: number | string }[] | null | undefined,
  winnerSide: "A" | "B",
): string[] | null {
  if (!sets || sets.length === 0) return null;
  return sets.map((s) =>
    winnerSide === "A" ? `${s.a}–${s.b}` : `${s.b}–${s.a}`,
  );
}
