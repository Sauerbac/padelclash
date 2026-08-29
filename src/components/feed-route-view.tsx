import { FeedView } from "@/components/feed-view";
import {
  RememberSavedView,
  RememberViewerScope,
} from "@/components/remember-saved-view";
import type { FeedMatch } from "@/services/matches";
import { RefreshCommitMarker } from "@/components/refresh-attempt-context";

export function FeedRouteView({
  you,
  isAdmin,
  feed,
  now,
  bindingId,
  refreshMarker,
}: {
  you: { id: string; name: string } | null;
  isAdmin: boolean;
  feed: FeedMatch[];
  now: Date;
  bindingId: string | null;
  refreshMarker: string;
}) {
  return (
    <>
      <RefreshCommitMarker marker={refreshMarker} />
      {you ? (
        <RememberSavedView
          kind="feed"
          bindingId={bindingId!}
          playerId={you.id}
          projection={{ you, feed }}
        />
      ) : (
        <RememberViewerScope bindingId={null} />
      )}
      <FeedView
        you={you}
        isAdmin={isAdmin}
        feed={feed}
        now={now}
      />
    </>
  );
}
