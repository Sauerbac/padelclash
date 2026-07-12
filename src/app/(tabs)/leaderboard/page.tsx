import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBoundPlayer } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { getLeaderboard } from "@/services/matches";
import { DEFAULT_RANKED_THRESHOLD } from "@/domain/rating/engine";

export default async function LeaderboardPage() {
  const db = getDb();
  const [you, entries] = await Promise.all([
    getBoundPlayer(),
    getLeaderboard(db),
  ]);
  const hasUnranked = entries.some((e) => e.rank === null);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players yet.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">W–L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.playerId}>
                  <TableCell className="text-muted-foreground">
                    {e.rank ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {e.name}
                    {you?.id === e.playerId && (
                      <Badge variant="secondary" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(e.rating)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.wins}–{e.losses}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasUnranked && (
            <p className="text-sm text-muted-foreground">
              — players need {DEFAULT_RANKED_THRESHOLD} matches to hold a rank.
            </p>
          )}
        </>
      )}
    </main>
  );
}
