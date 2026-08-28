"use client";

import { Button } from "@/components/ui/button";
import { OfflineMatchEntry } from "@/components/offline-match-entry";
import { PageHeader } from "@/components/page-header";
import { SavedViewFallback } from "@/components/saved-view-fallback";

export function PrivateFallbackContent({
  pathname,
  reset,
}: {
  pathname: string;
  reset?: () => void;
}) {
  if (pathname === "/") return <SavedViewFallback kind="feed" immediate />;
  if (pathname === "/leaderboard") {
    return <SavedViewFallback kind="leaderboard" immediate />;
  }
  if (pathname === "/log" || pathname === "/offline") {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
        <PageHeader kicker={reset ? "Connection problem" : "No connection"} title="Log Match" />
        <OfflineMatchEntry checkingRoster />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-5 pt-6 pb-10">
      <section className="border p-5">
        <h1 className="font-display text-[30px] uppercase">Connection needed</h1>
        <p className="mt-2 font-semibold text-muted-foreground">
          This private page is not stored on the device. Feed, Rankings, and Log Match remain available from the tabs.
        </p>
        {reset && <Button className="mt-4 w-full" onClick={reset}>Retry</Button>}
      </section>
    </main>
  );
}
