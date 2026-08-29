import { LeaderboardView } from "@/components/leaderboard-view";
import {
  RememberSavedView,
  RememberViewerScope,
} from "@/components/remember-saved-view";
import type { LeaderboardEntry } from "@/services/matches";
import { RefreshCommitMarker } from "@/components/refresh-attempt-context";

export function LeaderboardRouteView({
  entries,
  youId,
  isAdmin,
  bindingId,
  refreshMarker,
}: {
  entries: LeaderboardEntry[];
  youId: string | null;
  isAdmin: boolean;
  bindingId: string | null;
  refreshMarker: string;
}) {
  return (
    <>
      <RefreshCommitMarker marker={refreshMarker} />
      {youId ? (
        <RememberSavedView
          kind="leaderboard"
          bindingId={bindingId!}
          playerId={youId}
          projection={{ youId, entries }}
        />
      ) : (
        <RememberViewerScope bindingId={null} />
      )}
      <LeaderboardView
        entries={entries}
        youId={youId}
        isAdmin={isAdmin}
      />
    </>
  );
}
