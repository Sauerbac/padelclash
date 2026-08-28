"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/connection-status";
import { FeedView } from "@/components/feed-view";
import { LeaderboardView } from "@/components/leaderboard-view";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { createSlowConnectionClock } from "@/lib/slow-connection";
import { loadSavedView, loadViewerScope, type SavedView } from "@/services/offline/saved-views";
import { loadOfflineMatchSnapshot } from "@/services/offline/snapshot";
import type { FeedMatch, LeaderboardEntry } from "@/services/matches";
import { createLatestAttemptGate } from "@/lib/latest-attempt";

type FeedProjection = {
  you: { id: string; name: string };
  feed: FeedMatch[];
};
type LeaderboardProjection = {
  youId: string;
  entries: LeaderboardEntry[];
};

export function SavedViewFallback({
  kind,
  immediate = false,
}: {
  kind: "feed" | "leaderboard";
  immediate?: boolean;
}) {
  const [fallback, setFallback] = useState<SavedView | null>();
  const gate = useRef(createLatestAttemptGate());

  useEffect(() => {
    const current = gate.current.start();
    const reveal = async () => {
      try {
        const scope = await loadViewerScope();
        if (scope?.kind !== "player") {
          current.publish(() => setFallback(null));
          return;
        }
        const snapshot = await loadOfflineMatchSnapshot();
        const saved = snapshot?.player.id === scope.playerId
          ? await loadSavedView(kind, scope.playerId)
          : null;
        current.publish(() => setFallback(saved));
      } catch {
        current.publish(() => setFallback(null));
      }
    };
    const clock = createSlowConnectionClock({ onSlow: () => void reveal() });
    const attempt = clock.start();
    const offline = () => attempt.markDefinitelyOffline();
    if (immediate || navigator.onLine === false) offline();
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("offline", offline);
      clock.dispose();
      current.cancel();
    };
  }, [immediate, kind]);

  if (fallback === undefined) return <ScreenSkeleton kind={kind} />;
  if (!fallback) {
    return <NoSavedView />;
  }

  const refreshedAt = new Date(fallback.refreshedAt);
  if (kind === "feed") {
    const projection = fallback.projection as FeedProjection;
    return (
      <FeedView
        you={projection.you}
        isAdmin={false}
        feed={projection.feed}
        now={refreshedAt}
        queued={<></>}
        savedAt={refreshedAt}
      />
    );
  }
  const projection = fallback.projection as LeaderboardProjection;
  return (
    <LeaderboardView
      entries={projection.entries}
      youId={projection.youId}
      isAdmin={false}
      savedAt={refreshedAt}
    />
  );
}

export function NoSavedView({ reloadOnRetry = true }: { reloadOnRetry?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <ConnectionStatus />
      <section className="border p-5">
        <h1 className="font-display text-[30px] leading-none uppercase">
          Can&apos;t reach the server
        </h1>
        <p className="mt-2 font-semibold text-muted-foreground">
          No Saved View is available on this device yet.
        </p>
        <Button className="mt-4 w-full" onClick={() => reloadOnRetry && window.location.reload()}>Retry</Button>
      </section>
    </main>
  );
}
