import Link from "next/link";
import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import {
  guestParticipant,
  playerParticipant,
  type MatchParticipant,
} from "@/domain/match-participant";
import { MatchForm } from "@/components/match-form";
import { NotJoined } from "@/components/not-joined";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { currentActor } from "@/services/auth/actor";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getMatch } from "@/services/matches";
import { listPlayers } from "@/services/players";

export const metadata = { title: "Edit Match · PadelClash" };

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Gate before the query — see viewerForPrivateRead.
  if (!(await viewerForPrivateRead())) return <NotJoined />;

  const db = getDb();
  const [viewer, allPlayers, found] = await Promise.all([
    currentActor(),
    listPlayers(db),
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
  const options = new Map(
    allPlayers
      .filter((player) => player.retiredAt === null)
      .map(({ id, name }) => [id, name]),
  );
  for (const p of participants) {
    if (p.kind === "guest") continue;
    if (!options.has(p.playerId)) options.set(p.playerId, p.name);
  }

  const sides: Record<"A" | "B", MatchParticipant[]> = { A: [], B: [] };
  for (const p of participants) {
    sides[p.side].push(
      p.kind === "player"
        ? playerParticipant(p.playerId)
        : guestParticipant(p.name),
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="Corrections desk" title="Edit Match" />

      <MatchForm
        roster={[...options].map(([id, name]) => ({ id, name }))}
        reservedPlayerNames={allPlayers.map(({ name }) => name)}
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
