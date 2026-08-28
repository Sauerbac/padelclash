import { FeedView } from "@/components/feed-view";
import {
  RememberSavedView,
  RememberViewerScope,
} from "@/components/remember-saved-view";
import type { FeedMatch } from "@/services/matches";

export function FeedRouteView({
  you,
  isAdmin,
  feed,
  now,
}: {
  you: { id: string; name: string } | null;
  isAdmin: boolean;
  feed: FeedMatch[];
  now: Date;
}) {
  return (
    <>
      {you ? (
        <RememberSavedView
          kind="feed"
          bindingPlayerId={you.id}
          projection={{ you, feed }}
        />
      ) : (
        <RememberViewerScope bindingPlayerId={null} />
      )}
      <FeedView you={you} isAdmin={isAdmin} feed={feed} now={now} />
    </>
  );
}
