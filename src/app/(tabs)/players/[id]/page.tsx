import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import { STARTING_RATING } from "@/domain/rating/engine";
import { BackButton } from "@/components/back-button";
import { MatchCard } from "@/components/match-card";
import { PlayerLink } from "@/components/player-link";
import { RatingChart } from "@/components/rating-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentActor } from "@/services/auth/actor";
import { getDb } from "@/services/db";
import { getPlayerDetail, type CompanionRecord } from "@/services/matches";

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
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <div className="space-y-2">
        <BackButton />
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {detail.name}
          {viewer.playerId === detail.playerId && (
            <Badge variant="secondary">You</Badge>
          )}
          {detail.retired && <Badge variant="outline">Retired</Badge>}
        </h1>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 divide-x">
          <StatTile label="Rating" value={`${Math.round(detail.rating)}`} />
          <StatTile
            label="Rank"
            value={detail.rank !== null ? `#${detail.rank}` : "—"}
          />
          <StatTile label="Record" value={`${detail.wins}–${detail.losses}`} />
        </CardContent>
      </Card>

      {detail.matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rating over time</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingChart points={chartPoints} />
          </CardContent>
        </Card>
      )}

      <RecordCard title="Head-to-head" records={detail.headToHead} />
      <RecordCard title="Doubles partners" records={detail.partners} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Matches</h2>
        {detail.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          detail.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              canModify={canModifyMatch(match, viewer, now)}
            />
          ))
        )}
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

/** W–L per companion (opponents faced, or partners played with). */
function RecordCard({
  title,
  records,
}: {
  title: string;
  records: CompanionRecord[];
}) {
  if (records.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">W–L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.playerId}>
                <TableCell className="font-medium">
                  <PlayerLink playerId={r.playerId}>{r.name}</PlayerLink>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.wins}–{r.losses}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
