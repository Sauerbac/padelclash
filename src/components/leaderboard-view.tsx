import Link from "next/link";
import { RATED_THRESHOLD } from "@/domain/rating/engine";
import { LeaderboardRow } from "@/components/leaderboard-row";
import { PageHeader } from "@/components/page-header";
import { Podium, type PodiumPlace } from "@/components/podium";
import {
  PullToRefresh,
  type PullIndicatorPhase,
} from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaderboardEntry } from "@/services/matches";

export function LeaderboardView({
  entries,
  youId,
  isAdmin,
  pullToRefreshPhase,
}: {
  entries: LeaderboardEntry[];
  youId: string | null;
  isAdmin: boolean;
  /** Fixture-only phase pin; production leaves the gesture interactive. */
  pullToRefreshPhase?: PullIndicatorPhase;
}) {
  const hasUnranked = entries.some((entry) => entry.rank === null);
  const toPlace = (entry: LeaderboardEntry): PodiumPlace => ({
    playerId: entry.playerId,
    name: entry.name,
    rating: entry.rating,
    wins: entry.wins,
    losses: entry.losses,
    isYou: youId === entry.playerId,
  });
  const top3 = entries.filter(
    (entry) => entry.rank !== null && entry.rank <= 3,
  );
  const podium: [PodiumPlace, PodiumPlace, PodiumPlace] | null =
    top3.length >= 3
      ? [toPlace(top3[0]), toPlace(top3[1]), toPlace(top3[2])]
      : null;
  const rows = podium ? entries.filter((entry) => !top3.includes(entry)) : entries;

  return (
    <PullToRefresh previewPhase={pullToRefreshPhase}>
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
        <PageHeader
          kicker="The pecking order"
          title="Rankings"
          actions={
            isAdmin ? (
              <Button asChild variant="outline" size="xs">
                <Link href="/admin">Admin panel</Link>
              </Button>
            ) : undefined
          }
        />

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
                  {rows.map((entry) => (
                    <LeaderboardRow
                      key={entry.playerId}
                      rank={entry.rank}
                      playerId={entry.playerId}
                      name={entry.name}
                      rating={entry.rating}
                      wins={entry.wins}
                      losses={entry.losses}
                      isYou={youId === entry.playerId}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
            {hasUnranked && (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                — players need {RATED_THRESHOLD} matches to hold a rank. No
                shortcuts.
              </p>
            )}
          </div>
        )}
      </main>
    </PullToRefresh>
  );
}
