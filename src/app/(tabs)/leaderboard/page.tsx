import { LeaderboardRouteView } from "@/components/leaderboard-route-view";
import { NotJoined } from "@/components/not-joined";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getLeaderboard } from "@/services/matches";

export default async function LeaderboardPage() {
  // Gate before the query — see viewerForPrivateRead.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const entries = await getLeaderboard(getDb());
  return (
    <LeaderboardRouteView
      entries={entries}
      youId={access.player?.id ?? null}
      isAdmin={access.isAdmin}
    />
  );
}
