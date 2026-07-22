import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import { STARTING_RATING } from "@/domain/rating/engine";
import { MatchCard } from "@/components/match-card";
import { RatingChart } from "@/components/rating-chart";
import { RecordTable } from "@/components/record-table";
import { StatTriplet } from "@/components/stat-triplet";
import { Badge } from "@/components/ui/badge";
import { NotJoined } from "@/components/not-joined";
import { currentActor } from "@/services/auth/actor";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getPlayerDetail } from "@/services/matches";

export const metadata = { title: "Player · PadelClash" };

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Gate before the query — see viewerForPrivateRead.
  if (!(await viewerForPrivateRead())) return <NotJoined />;

  const db = getDb();
  const [viewer, detail] = await Promise.all([
    currentActor(),
    getPlayerDetail(db, id),
  ]);
  if (!detail) notFound();
  const now = new Date();

  // Everyone starts at 1000, so the chart leads with that baseline.
  const chartPoints = [
    { label: "Start", rating: STARTING_RATING, delta: null },
    ...detail.ratingSeries.map((p) => ({
      label: dateFormat.format(p.playedAt),
      rating: p.ratingAfter,
      delta: p.delta,
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
          { label: "Rating", value: `${Math.round(detail.rating)}` },
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
              {Math.round(detail.rating)}
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
