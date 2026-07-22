import { DeltaBadge } from "@/components/delta-badge";
import { MatchCardActions } from "@/components/match-card-actions";
import {
  MatchHeadline,
  MatchPlayerNames,
  PlayedAt,
  SetsRow,
  setScores,
} from "@/components/match-card-parts";
import type { FeedMatch } from "@/services/matches";

/**
 * A feed card (design "MatchCard"): a mono timestamp, the winners-over-losers
 * headline in display type, the set scores on their own row, and the rating
 * deltas winners-first.
 *
 * Height varies with content by design (decision 67) — a doubles match with
 * three sets is taller than a scoreless singles, and short cards are not
 * padded to match.
 *
 * Server-rendered; formats in the server's timezone, which is fine for one
 * circle in one place.
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
  const sets = setScores(match.sets, match.winnerSide);

  return (
    <article className="flex flex-col gap-[11px] border px-4 py-[15px]">
      <div className="flex items-center justify-between gap-2">
        <PlayedAt at={match.playedAt} />
        {canModify && <MatchCardActions matchId={match.id} />}
      </div>

      <MatchHeadline
        winners={<MatchPlayerNames players={winners} />}
        losers={<MatchPlayerNames players={losers} />}
        singles={winners.length === 1 && losers.length === 1}
      />

      {sets && <SetsRow sets={sets} />}

      <div className="flex flex-wrap gap-1.5">
        {[...winners, ...losers].map((p) => (
          <DeltaBadge key={p.playerId} delta={p.delta}>
            {p.name}{" "}
          </DeltaBadge>
        ))}
      </div>

      {showLogger && (
        <p className="border-t pt-2.5 font-mono text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Logged by <span className="text-accent">{match.loggedByName}</span>
        </p>
      )}
    </article>
  );
}
