import { PlayerLink } from "@/components/player-link";

/**
 * The shared innards of a feed match card, so the synced card (`MatchCard`)
 * and the offline-queue cards (`QueuedMatches`) stay one visual language.
 * Decision 67: the result gets its own rows, and card height follows content.
 *
 * These are plain presentational components — no hooks — so the client-side
 * queue can import them as freely as the server-rendered feed.
 */

/**
 * Day, abbreviated month, 24h time — "22 Jul, 19:30". No fixed zone: the
 * synced feed renders on the server and formats in the server's timezone
 * (fine for one circle in one place), while queued cards only ever render on
 * the device that logged them, where device-local is the right zone.
 */
const playedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** The mono timestamp opening every card. */
export function PlayedAt({ at }: { at: Date }) {
  return (
    <span className="font-mono text-[11px] font-medium tracking-[1px] text-muted-foreground uppercase">
      {playedAtFormat.format(at)}
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
    <div>
      <div className="font-display text-[25px] leading-[1.02] tracking-[0.5px] uppercase">
        {winners}
      </div>
      <div className="my-[5px] font-mono text-[10px] font-semibold tracking-[2px] text-primary uppercase">
        def.
      </div>
      <div className="font-display text-[20px] leading-[1.02] tracking-[0.5px] text-muted-foreground uppercase">
        {losers}
      </div>
    </div>
  );
}

/** Linked names with the same separator in synced and queued cards. */
export function MatchPlayerNames({
  players,
}: {
  players: { playerId: string; name: string }[];
}) {
  return players.map((player, index) => (
    <span key={player.playerId}>
      {index > 0 && <span className="text-muted-foreground"> & </span>}
      <PlayerLink playerId={player.playerId}>{player.name}</PlayerLink>
    </span>
  ));
}

/**
 * The set scores on their own row (decision 67) — they are the match result,
 * not metadata about it. Winner-first, one box per set. Absent entirely when
 * the logger skipped them.
 */
export function SetsRow({ sets }: { sets: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] font-semibold tracking-[2px] text-muted-foreground uppercase">
        Sets
      </span>
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
