import { LogMatchView } from "@/components/log-match-view";
import { NotJoined } from "@/components/not-joined";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { listPlayers } from "@/services/players";

export default async function LogMatchPage() {
  // Gate before the query — the roster is private data too.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const you = access.player;
  const allPlayers = await listPlayers(getDb());
  const roster = allPlayers.filter((player) => player.retiredAt === null);

  return (
    <LogMatchView
      roster={roster.map(({ id, name }) => ({ id, name }))}
      reservedPlayerNames={allPlayers.map(({ name }) => name)}
      logger={you ? { id: you.id, name: you.name } : null}
    />
  );
}
