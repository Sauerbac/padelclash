"use client";

import { useEffect, useState } from "react";
import { MatchForm } from "@/components/match-form";
import {
  loadOfflineMatchSnapshot,
  type OfflineMatchSnapshot,
} from "@/services/offline/snapshot";

export function OfflineMatchEntry() {
  const [snapshot, setSnapshot] = useState<OfflineMatchSnapshot | null>();

  useEffect(() => {
    loadOfflineMatchSnapshot().then(setSnapshot).catch(() => setSnapshot(null));
  }, []);

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
    <MatchForm
      roster={snapshot.roster}
      reservedPlayerNames={snapshot.reservedPlayerNames}
      loggerId={snapshot.player.id}
    />
  );
}
