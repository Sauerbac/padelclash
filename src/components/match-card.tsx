import { DeltaBadge } from "@/components/delta-badge";
import { MatchCardActions } from "@/components/match-card-actions";
import { PlayerLink } from "@/components/player-link";
import type { FeedMatch } from "@/services/matches";

// Server-rendered; formats in the server's timezone, which is fine for one
// circle in one place.
const playedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * A feed card (design "MatchCard"): winners bright, losers muted, mono meta
 * line, rating-delta chips winners-first.
 */
export function MatchCard({
  match,
  canModify,
  showLogger = false,
}: {
  match: FeedMatch;
  canModify: boolean;
  /**
   * Admin only (spec decision 53). Every Match records who logged it, and
   * Admin is the one who has to answer "who entered this?" when a result is
   * disputed. Members don't get it: inside one circle it adds nothing but a
   * way to keep score of who does the admin chores.
   */
  showLogger?: boolean;
}) {
  const winners = match.participants.filter(
    (p) => p.side === match.winnerSide,
  );
  const losers = match.participants.filter(
    (p) => p.side !== match.winnerSide,
  );
  const names = (side: typeof winners) =>
    side.map((p, i) => (
      <span key={p.playerId}>
        {i > 0 && <span className="text-muted-foreground"> & </span>}
        <PlayerLink playerId={p.playerId}>{p.name}</PlayerLink>
      </span>
    ));

  // Set scores read winner-first, matching the names next to them.
  const setsText = match.sets
    ?.map((s) => (match.winnerSide === "A" ? `${s.a}–${s.b}` : `${s.b}–${s.a}`))
    .join(", ");

  return (
    <article className="border px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-semibold uppercase">
          {names(winners)}
          <span className="font-medium text-muted-foreground lowercase">
            {" "}
            def.{" "}
          </span>
          <span className="text-muted-foreground">{names(losers)}</span>
        </p>
        {canModify && <MatchCardActions matchId={match.id} />}
      </div>
      <p className="mt-1 font-mono text-xs font-medium text-muted-foreground">
        {playedAtFormat.format(match.playedAt)}
        {setsText && <> · {setsText}</>}
        {showLogger && <> · logged by {match.loggedByName}</>}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {[...winners, ...losers].map((p) => (
          <DeltaBadge key={p.playerId} delta={p.delta}>
            {p.name}{" "}
          </DeltaBadge>
        ))}
      </div>
    </article>
  );
}
