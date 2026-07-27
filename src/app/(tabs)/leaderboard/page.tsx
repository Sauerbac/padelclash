import { LeaderboardRow } from "@/components/leaderboard-row";
import { PageHeader } from "@/components/page-header";
import { Podium, type PodiumPlace } from "@/components/podium";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotJoined } from "@/components/not-joined";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getLeaderboard } from "@/services/matches";
import { RATED_THRESHOLD } from "@/domain/rating/engine";

export default async function LeaderboardPage() {
  // Gate before the query — see viewerForPrivateRead.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const you = access.player;
  const entries = await getLeaderboard(getDb());
  const hasUnranked = entries.some((e) => e.rank === null);

  // The stand replaces rows 1–3 rather than repeating them (decision 65), so
  // the table below starts at #4. With fewer than three ranked Players there
  // is no stand and the table carries everyone.
  const toPlace = (e: (typeof entries)[number]): PodiumPlace => ({
    playerId: e.playerId,
    name: e.name,
    rating: e.rating,
    wins: e.wins,
    losses: e.losses,
    isYou: you?.id === e.playerId,
  });
  const top3 = entries.filter((e) => e.rank !== null && e.rank <= 3);
  const podium: [PodiumPlace, PodiumPlace, PodiumPlace] | null =
    top3.length >= 3
      ? [toPlace(top3[0]), toPlace(top3[1]), toPlace(top3[2])]
      : null;
  const rows = podium ? entries.filter((e) => !top3.includes(e)) : entries;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="The pecking order" title="Rankings" />

      {entries.length === 0 ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          No players yet.
        </p>
      ) : (
        <div>
          {podium && (
            <div className="mb-5">
              <Podium places={podium} />
            </div>
          )}
          {/* Exactly three ranked Players and nobody else: the stand is the
              whole ranking, and a header with no rows under it is noise. */}
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="pl-3 text-right">Rating</TableHead>
                  <TableHead className="pl-3 text-right">W–L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <LeaderboardRow
                    key={e.playerId}
                    rank={e.rank}
                    playerId={e.playerId}
                    name={e.name}
                    rating={e.rating}
                    wins={e.wins}
                    losses={e.losses}
                    isYou={you?.id === e.playerId}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {hasUnranked && (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              — players need {RATED_THRESHOLD} matches to hold a
              rank. No shortcuts.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
