import Link from "next/link";
import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import { MatchForm } from "@/components/match-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
        <PageHeader kicker="Corrections desk" title="Edit Match" />
        <section className="border px-5 py-6 text-center">
          <div aria-hidden className="text-3xl">
            🔒
          </div>
          <h2 className="mt-2.5 font-display text-[26px] leading-[1.1] uppercase">
            This match is locked
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed font-semibold text-muted-foreground">
            Only the player who logged a match can edit it, and only within
            24 hours. Ask the group admin to fix it — bribes optional.
          </p>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/">Back to feed</Link>
          </Button>
        </section>
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
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="Corrections desk" title="Edit Match" />

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
