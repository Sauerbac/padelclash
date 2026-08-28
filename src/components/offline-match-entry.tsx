"use client";

import { useEffect, useState } from "react";
import { MatchForm } from "@/components/match-form";
import { createSlowConnectionClock } from "@/lib/slow-connection";
import {
  loadOfflineMatchSnapshot,
  type OfflineMatchSnapshot,
} from "@/services/offline/snapshot";

export function OfflineMatchEntry({ checkingRoster = false }: { checkingRoster?: boolean }) {
  const [snapshot, setSnapshot] = useState<OfflineMatchSnapshot | null>();
  const [staleRoster, setStaleRoster] = useState(false);

  useEffect(() => {
    loadOfflineMatchSnapshot().then(setSnapshot).catch(() => setSnapshot(null));
  }, []);

  useEffect(() => {
    if (!checkingRoster) return;
    const clock = createSlowConnectionClock({ onSlow: () => setStaleRoster(true) });
    const attempt = clock.start();
    const offline = () => attempt.markDefinitelyOffline();
    if (navigator.onLine === false) offline();
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("offline", offline);
      clock.dispose();
    };
  }, [checkingRoster]);

  if (snapshot === undefined) {
    return <p className="font-semibold text-muted-foreground">Opening…</p>;
  }
  if (!snapshot) {
    return (
      <section className="border p-4">
        <h2 className="font-display text-[26px] leading-none uppercase">
          Offline setup needed
        </h2>
        <p className="mt-2 font-semibold text-muted-foreground">
          Open PadelClash once while joined and online before logging a Match
          offline.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {checkingRoster && (
        <p role="status" aria-live="polite" className="font-mono text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          {staleRoster
            ? `Using saved roster from ${new Date(snapshot.refreshedAt).toLocaleString()}`
            : "Checking for roster updates…"}
        </p>
      )}
      <MatchForm
        roster={snapshot.roster}
        reservedPlayerNames={snapshot.reservedPlayerNames}
        loggerId={snapshot.player.id}
        sharedMatchCounts={snapshot.sharedMatchCounts}
        draftContinuity="snapshot"
      />
    </div>
  );
}
