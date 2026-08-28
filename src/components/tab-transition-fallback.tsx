"use client";

import { useLinkStatus } from "next/link";
import { OfflineMatchEntry } from "@/components/offline-match-entry";
import { PageHeader } from "@/components/page-header";
import { SavedViewFallback } from "@/components/saved-view-fallback";

export function TabTransitionFallback({
  destination,
}: {
  destination: "feed" | "log" | "leaderboard";
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-30 overflow-y-auto bg-background">
      {destination === "log" ? (
        <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
          <PageHeader kicker="New match" title="Log Match" />
          <OfflineMatchEntry checkingRoster />
        </main>
      ) : (
        <SavedViewFallback kind={destination} />
      )}
    </div>
  );
}
