import { LeaderboardRow } from "@/components/leaderboard-row";
import { PageHeader } from "@/components/page-header";
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
import { DEFAULT_RANKED_THRESHOLD } from "@/domain/rating/engine";

export default async function LeaderboardPage() {
  // Gate before the query — see viewerForPrivateRead.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const you = access.player;
  const entries = await getLeaderboard(getDb());
  const hasUnranked = entries.some((e) => e.rank === null);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="The pecking order" title="Rankings" />

      {entries.length === 0 ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          No players yet.
        </p>
      ) : (
        <div>
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
              {entries.map((e) => (
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
          {hasUnranked && (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              — players need {DEFAULT_RANKED_THRESHOLD} matches to hold a
              rank. No shortcuts.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
