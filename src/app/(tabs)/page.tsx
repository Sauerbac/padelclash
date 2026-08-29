import { FeedRouteView } from "@/components/feed-route-view";
import { NotJoined } from "@/components/not-joined";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getFeed } from "@/services/matches";

export default async function FeedPage() {
  // Before any query: an unbound visitor must not reach the match log, not
  // even into this response's payload (spec decision 33).
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const { player: you, isAdmin } = access;
  const feed = await getFeed(getDb());

  return (
    <FeedRouteView
      you={you}
      bindingId={access.bindingId}
      isAdmin={isAdmin}
      feed={feed}
      now={new Date()}
      refreshMarker={crypto.randomUUID()}
    />
  );
}
