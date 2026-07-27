import { canModifyMatch, type MatchActor } from "@/domain/edit-rights";
import { STARTING_RATING } from "@/domain/rating/engine";
import { MatchCard } from "@/components/match-card";
import { RatingChart } from "@/components/rating-chart";
import { RecordTable } from "@/components/record-table";
import { StatTriplet } from "@/components/stat-triplet";
import { Badge } from "@/components/ui/badge";
import type { PlayerDetail } from "@/services/matches";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export function PlayerDetailView({
  detail,
  viewer,
  now,
}: {
  detail: PlayerDetail;
  viewer: MatchActor;
  now: Date;
}) {
  const chartPoints = [
    { label: "Start", rating: STARTING_RATING, delta: null },
    ...detail.ratingSeries.map((point) => ({
      label: dateFormat.format(point.playedAt),
      rating: point.ratingAfter,
      delta: point.delta,
    })),
  ];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-5 pt-5 pb-10">
      <header>
        <p className="kicker">Player profile</p>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[52px] leading-[1.05] uppercase">
            {detail.name}
          </h1>
          {viewer.playerId === detail.playerId && (
            <Badge variant="you">You</Badge>
          )}
          {detail.retired && <Badge variant="retired">Retired</Badge>}
        </div>
      </header>

      <StatTriplet
        stats={[
          { label: "Rating", value: `${detail.rating}` },
          {
            label: "Rank",
            value: detail.rank !== null ? `#${detail.rank}` : "—",
            valueClassName: "text-primary",
          },
          { label: "Record", value: `${detail.wins}–${detail.losses}` },
        ]}
      />

      {detail.matches.length > 0 && (
        <section className="border p-3.5">
          <div className="flex justify-between">
            <h2 className="section-label">The Climb</h2>
            <span className="font-mono text-sm font-semibold text-accent">
              {detail.rating}
            </span>
          </div>
          <div className="mt-2">
            <RatingChart points={chartPoints} />
          </div>
        </section>
      )}

      <RecordTable
        title="Grudge list"
        tone="primary"
        records={detail.headToHead}
      />
      <RecordTable title="Doubles partners" records={detail.partners} />

      <section className="space-y-2.5">
        <h2 className="section-label">Match history</h2>
        {detail.matches.length === 0 ? (
          <p className="text-[15px] font-semibold text-muted-foreground">
            No matches yet.
          </p>
        ) : (
          detail.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              canModify={canModifyMatch(match, viewer, now)}
              showLogger={viewer.isAdmin}
            />
          ))
        )}
      </section>
    </main>
  );
}
