import { notFound } from "next/navigation";
import { canModifyMatch } from "@/domain/edit-rights";
import {
  guestParticipant,
  playerParticipant,
  type MatchParticipant,
} from "@/domain/match-participant";
import { EditMatchView } from "@/components/edit-match-view";
import { NotJoined } from "@/components/not-joined";
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
    return <EditMatchView state="locked" />;
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
    <EditMatchView
      state="editable"
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
  );
}
