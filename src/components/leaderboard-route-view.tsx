import { LeaderboardView } from "@/components/leaderboard-view";
import {
  RememberSavedView,
  RememberViewerScope,
} from "@/components/remember-saved-view";
import type { LeaderboardEntry } from "@/services/matches";

export function LeaderboardRouteView({
  entries,
  youId,
  isAdmin,
}: {
  entries: LeaderboardEntry[];
  youId: string | null;
  isAdmin: boolean;
}) {
  return (
    <>
      {youId ? (
        <RememberSavedView
          kind="leaderboard"
          bindingPlayerId={youId}
          projection={{ youId, entries }}
        />
      ) : (
        <RememberViewerScope bindingPlayerId={null} />
      )}
      <LeaderboardView entries={entries} youId={youId} isAdmin={isAdmin} />
    </>
  );
}
