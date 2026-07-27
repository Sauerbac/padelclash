"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { SessionStatus } from "@/app/api/session/route";
import { dropPrivatePageCaches } from "@/lib/private-cache";
import {
  BINDING_CHANGED_EVENT,
  markQueueUnbound,
} from "@/services/offline/queue";
import {
  clearOfflineMatchSnapshot,
  createOfflineMatchSnapshot,
  saveOfflineMatchSnapshot,
} from "@/services/offline/snapshot";

/**
 * The app-open contact with the server, and the client half of spec decision
 * 52. Mounted once in the root layout; renders nothing.
 *
 * It exists for two jobs that look unrelated and aren't:
 *
 * 1. **Revocation discovery.** Revocation is authoritative on the server the
 *    instant Admin acts, but an installed PWA holding cached pages and a
 *    populated IndexedDB queue has no reason to notice. This is the contact
 *    that tells it, and the trigger for dropping the private page caches and
 *    flagging the queue.
 *
 * 2. **Cookie refresh.** "Ordinary use refreshes the credential" is only true
 *    if something actually re-issues it. Server Components cannot set cookies,
 *    so a member who reads the Feed daily but never logs a match would drift
 *    into the browser's ~400-day cookie cap and lose access while using the app
 *    normally. GET /api/session re-issues on every resolve, so this component
 *    running on open is what keeps that promise — the reason it must not be
 *    treated as an optional nicety.
 *
 * Fires on mount, when connectivity returns, and when a long-lived installed
 * tab is brought back to the foreground — an installed PWA can go weeks between
 * cold starts, which would make "on open" alone almost never happen.
 */
/**
 * A durable "this installation still owes a revocation cleanup" latch.
 *
 * Revocation is announced once and then indistinguishable from a fresh
 * visitor, so an in-memory flag would lose the obligation on reload — exactly
 * when a failed purge needs retrying. Not a credential and not private: a
 * single boolean saying housekeeping is outstanding, which decision 47's ban
 * on client-side identity does not cover.
 */
const CLEANUP_OWED_KEY = "pc_cleanup_owed";

/**
 * Mirrored in memory so the latch degrades rather than disappears: where
 * localStorage throws (private mode, storage disabled) cleanup still happens
 * for as long as the page lives — it just can't survive a reload.
 */
let owedInMemory = false;

const owedCleanup = {
  set() {
    owedInMemory = true;
    try {
      localStorage.setItem(CLEANUP_OWED_KEY, "1");
    } catch {
      /* memory-only for this session */
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
      /* nothing to do */
    }
  },
};

export function SessionWatch() {
  const router = useRouter();
  const checking = useRef(false);
  // Cleaning up is idempotent, but refreshing the router in a loop is not
  // free; only the transition into revoked should drive the UI.
  const announcedRevocation = useRef(false);

  const check = useCallback(async () => {
    if (checking.current || !navigator.onLine) return;
    checking.current = true;
    try {
      const response = await fetch("/api/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const status = (await response.json()) as SessionStatus;

      if (status.bound && status.player) {
        const snapshotResponse = await fetch("/api/offline-snapshot", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (snapshotResponse.ok) {
          const snapshot = (await snapshotResponse.json()) as {
            player: { id: string; name: string };
            roster: { id: string; name: string }[];
            reservedPlayerNames: string[];
          };
          if (snapshot.player.id === status.player.id) {
            await saveOfflineMatchSnapshot(
              createOfflineMatchSnapshot(
                snapshot.player,
                snapshot.roster,
                snapshot.reservedPlayerNames,
              ),
            );
          }
        }
      }

      // `revoked` is reported exactly once — the route clears the dead cookie
      // as it answers, so every later contact looks like an ordinary visitor.
      // Latch it durably before doing any work, so a purge that fails
      // (storage error, quota) is retried on the next contact instead of
      // being forgotten with cached private pages still on disk.
      //
      // Note this cannot key off `bound === false` instead: an Admin session
      // is unbound and fully entitled to read (decision 49), so treating
      // "not bound" as "not entitled" would wipe an Admin's caches on every
      // app open.
      if (status.revoked) owedCleanup.set();
      if (!owedCleanup.pending()) {
        announcedRevocation.current = false;
        return;
      }

      // Neither step deletes a queued match — that stays an explicit user
      // action (decision 26).
      const [purged] = await Promise.all([
        dropPrivatePageCaches(),
        markQueueUnbound(),
        clearOfflineMatchSnapshot(),
      ]);
      if (purged) owedCleanup.clear();

      // Tell the UI once, and only when a credential was actually lost;
      // re-rendering on every poll would be noise.
      if (status.revoked && !announcedRevocation.current) {
        announcedRevocation.current = true;
        router.refresh();
      }
    } catch {
      // Offline or a blip. The credential is unchanged either way, and the
      // next trigger tries again.
    } finally {
      checking.current = false;
    }
  }, [router]);

  useEffect(() => {
    check();

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("online", check);
    window.addEventListener(BINDING_CHANGED_EVENT, check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener(BINDING_CHANGED_EVENT, check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  return null;
}
