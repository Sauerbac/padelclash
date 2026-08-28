"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  logMatchAction,
  type LogMatchPayload,
} from "@/app/actions/matches";
import type { SessionStatus } from "@/app/api/session/route";
import { dropPrivatePageCaches } from "@/lib/private-cache";
import {
  createOfflineLifecycle,
  type OfflineLifecycleDependencies,
} from "@/services/offline/lifecycle";
import {
  BINDING_CHANGED_EVENT,
  enqueueMatch,
  listQueuedMatches,
  markQueueUnbound,
  removeQueuedMatch,
} from "@/services/offline/queue";
import type { QueuedMatch } from "@/services/offline/queue-contract";
import {
  clearOfflineMatchSnapshot,
  createOfflineMatchSnapshot,
  loadOfflineMatchSnapshot,
  saveOfflineMatchSnapshot,
} from "@/services/offline/snapshot";
import { clearSavedViews } from "@/services/offline/saved-views";
import { fetchWithDeadline } from "@/lib/fetch-deadline";

const CLEANUP_OWED_KEY = "pc_cleanup_owed";
let owedInMemory = false;

const cleanupLatch = {
  set() {
    owedInMemory = true;
    try {
      localStorage.setItem(CLEANUP_OWED_KEY, "1");
    } catch {
      // Memory-only for this page lifetime.
    }
  },
  pending(): boolean {
    if (owedInMemory) return true;
    try {
      return localStorage.getItem(CLEANUP_OWED_KEY) === "1";
    } catch {
      return false;
    }
  },
  clear() {
    owedInMemory = false;
    try {
      localStorage.removeItem(CLEANUP_OWED_KEY);
    } catch {
      // Cleanup succeeded even if removing the redundant latch did not.
    }
  },
};

/**
 * Thin browser mounting glue for the installation lifecycle. The testable
 * controller owns all ordering, retry, and coalescing decisions.
 */
export function OfflineLifecycle() {
  const router = useRouter();

  useEffect(() => {
    const dependencies: OfflineLifecycleDependencies = {
      contactSession,
      cleanupLatch,
      dropPrivateCaches: dropPrivatePageCaches,
      markQueueUnbound,
      clearSnapshot: clearOfflineMatchSnapshot,
      clearSavedViews,
      snapshotPlayerId: async () =>
        (await loadOfflineMatchSnapshot())?.player.id ?? null,
      refreshSnapshot,
      listQueuedMatches,
      submitMatch: async (match) => logMatchAction(toPayload(match)),
      noteRefusal: async (match, syncCode, syncError) => {
        if (match.syncCode === syncCode && match.syncError === syncError) return;
        await enqueueMatch({ ...match, syncCode, syncError });
      },
      removeQueuedMatch,
      scheduleRetry(run, delayMs) {
        const timer = setTimeout(run, delayMs);
        return () => clearTimeout(timer);
      },
      notifySynced: () => router.refresh(),
      notifyRevoked: () => router.refresh(),
    };
    const lifecycle = createOfflineLifecycle(dependencies);
    const trigger = () => void lifecycle.trigger();
    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };

    trigger();
    window.addEventListener("online", trigger);
    window.addEventListener(BINDING_CHANGED_EVENT, trigger);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", trigger);
      window.removeEventListener(BINDING_CHANGED_EVENT, trigger);
      document.removeEventListener("visibilitychange", onVisible);
      lifecycle.dispose();
    };
  }, [router]);

  return null;
}

async function contactSession(): Promise<SessionStatus> {
  const response = await fetchWithDeadline("/api/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Session contact failed");
  return (await response.json()) as SessionStatus;
}

async function refreshSnapshot(player: {
  id: string;
  name: string;
}): Promise<void> {
  const response = await fetchWithDeadline("/api/offline-snapshot", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Snapshot refresh failed");
  const snapshot = (await response.json()) as {
    player: { id: string; name: string };
    roster: { id: string; name: string }[];
    reservedPlayerNames: string[];
    sharedMatchCounts: Record<string, number>;
  };
  if (snapshot.player.id !== player.id) {
    throw new Error("Snapshot identity changed during refresh");
  }
  await saveOfflineMatchSnapshot(
    createOfflineMatchSnapshot(
      snapshot.player,
      snapshot.roster,
      snapshot.reservedPlayerNames,
      snapshot.sharedMatchCounts,
    ),
  );
}

function toPayload(match: QueuedMatch): LogMatchPayload {
  return {
    id: match.id,
    playedAt: match.playedAt,
    sides: match.sides,
    winnerSide: match.winnerSide,
    sets: match.sets,
    ownerPlayerId: match.ownerPlayerId,
  };
}
