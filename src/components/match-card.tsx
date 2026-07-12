import { Card, CardContent } from "@/components/ui/card";
import { DeltaBadge } from "@/components/delta-badge";
import { MatchCardActions } from "@/components/match-card-actions";
import type { FeedMatch } from "@/services/matches";

// Server-rendered; formats in the server's timezone, which is fine for one
// circle in one place.
const playedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** A feed card (spec "Screens"): sides, result, per-player rating deltas. */
export function MatchCard({
  match,
  canModify,
}: {
  match: FeedMatch;
  canModify: boolean;
}) {
  const winners = match.participants.filter(
    (p) => p.side === match.winnerSide,
  );
  const losers = match.participants.filter(
    (p) => p.side !== match.winnerSide,
  );
  const names = (side: typeof winners) => side.map((p) => p.name).join(" & ");

  // Set scores read winner-first, matching the names next to them.
  const setsText = match.sets
    ?.map((s) => (match.winnerSide === "A" ? `${s.a}–${s.b}` : `${s.b}–${s.a}`))
    .join(", ");

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{names(winners)}</span>
              <span className="text-muted-foreground"> def. </span>
              <span className="font-medium">{names(losers)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {playedAtFormat.format(match.playedAt)}
              {setsText && <> · {setsText}</>}
            </p>
          </div>
          {canModify && <MatchCardActions matchId={match.id} />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[...winners, ...losers].map((p) => (
            <DeltaBadge key={p.playerId} delta={p.delta}>
              {p.name}{" "}
            </DeltaBadge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
