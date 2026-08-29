import { LogMatchView } from "@/components/log-match-view";
import { RememberViewerScope } from "@/components/remember-saved-view";
import type { SharedMatchCounts } from "@/lib/player-roster";

export function LogMatchRouteView({
  roster,
  reservedPlayerNames,
  logger,
  sharedMatchCounts,
  bindingId,
}: {
  roster: { id: string; name: string }[];
  reservedPlayerNames: string[];
  logger: { id: string; name: string } | null;
  sharedMatchCounts: SharedMatchCounts;
  bindingId: string | null;
}) {
  return (
    <>
      <RememberViewerScope bindingId={bindingId} playerId={logger?.id} />
      <LogMatchView
        roster={roster}
        reservedPlayerNames={reservedPlayerNames}
        logger={logger}
        sharedMatchCounts={sharedMatchCounts}
      />
    </>
  );
}
