import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import { MatchForm } from "@/components/match-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currentActor } from "@/services/auth/actor";
import { getDb } from "@/services/db";
import { getMatch } from "@/services/matches";
import { listActivePlayers } from "@/services/players";

export const metadata = { title: "Edit Match · PadelClash" };

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [viewer, roster, found] = await Promise.all([
    currentActor(),
    listActivePlayers(db),
    getMatch(db, id),
  ]);

  if (!found) notFound();
  const { match, participants } = found;

  if (!canModifyMatch(match, viewer, new Date())) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>This match is locked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Only the player who logged a match can edit it, and only within
            24 hours. Ask the group admin to fix it.
          </CardContent>
        </Card>
      </main>
    );
  }

  // Pickers show the active roster, plus this match's own participants even
  // if they have since retired — their slot must still render.
  const options = new Map(roster.map(({ id, name }) => [id, name]));
  for (const p of participants) {
    if (!options.has(p.playerId)) options.set(p.playerId, p.name);
  }

  const sides = { A: [] as string[], B: [] as string[] };
  for (const p of participants) sides[p.side].push(p.playerId);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Match</h1>

      <MatchForm
        roster={[...options].map(([id, name]) => ({ id, name }))}
        editing={{
          id: match.id,
          playedAtIso: match.playedAt.toISOString(),
          sides,
          winnerSide: match.winnerSide,
          sets: match.sets,
        }}
      />
    </main>
  );
}
