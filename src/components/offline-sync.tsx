"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { logMatchAction } from "@/app/actions/matches";
import {
  enqueueMatch,
  listQueuedMatches,
  removeQueuedMatch,
} from "@/lib/offline-queue";

/**
 * Flushes the offline log queue on app open and whenever connectivity
 * returns (spec "PWA & offline"). Sync order is oldest-first; the replay
 * engine slots late arrivals into history by playedAt regardless.
 */
export function OfflineSync() {
  const router = useRouter();
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let synced = 0;
    try {
      for (const match of await listQueuedMatches()) {
        const { names, queuedAt, syncError, ...payload } = match;
        void names;
        void queuedAt;
        let result;
        try {
          result = await logMatchAction(payload);
        } catch {
          break; // still offline — the next "online" event retries
        }
        if (result.ok) {
          await removeQueuedMatch(match.id);
          synced++;
        } else if (result.error !== syncError) {
          // Server said no (not a connectivity failure). Keep the match —
          // silently dropping data is worse — and show why on its card.
          await enqueueMatch({ ...match, syncError: result.error });
        }
      }
    } finally {
      flushing.current = false;
    }
    if (synced > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  return null;
}
