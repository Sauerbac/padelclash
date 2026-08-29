import { LogMatchRouteView } from "@/components/log-match-route-view";
import { NotJoined } from "@/components/not-joined";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getSharedMatchCounts } from "@/services/matches";
import { listPlayers } from "@/services/players";

export default async function LogMatchPage() {
  // Gate before the query — the roster is private data too.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const you = access.player;
  const db = getDb();
  const [allPlayers, sharedMatchCounts] = await Promise.all([
    listPlayers(db),
    you ? getSharedMatchCounts(db, you.id) : {},
  ]);
  const roster = allPlayers.filter((player) => player.retiredAt === null);

  return (
    <LogMatchRouteView
      roster={roster.map(({ id, name }) => ({ id, name }))}
      reservedPlayerNames={allPlayers.map(({ name }) => name)}
      logger={you ? { id: you.id, name: you.name } : null}
      sharedMatchCounts={sharedMatchCounts}
      bindingId={access.bindingId}
    />
  );
}
