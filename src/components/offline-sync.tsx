"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import {
  logMatchAction,
  type LogMatchPayload,
} from "@/app/actions/matches";
import { handleRefusal, isPermanentRefusal } from "@/domain/sync-policy";
import {
  BINDING_CHANGED_EVENT,
  enqueueMatch,
  listQueuedMatches,
  removeQueuedMatch,
  type QueuedMatch,
} from "@/lib/offline-queue";

/**
 * Flushes the offline log queue on app open and whenever connectivity returns
 * (spec "PWA & offline"). Sync order is oldest-first; the replay engine slots
 * late arrivals into history by playedAt regardless.
 *
 * The interesting part is what it does with a refusal. A queued match belongs
 * to the Player who wrote it, and the server checks that on every write
 * (decision 52) — so this loop must never treat "the server said no" as
 * "throw the match away". It records the reason, stops retrying only what can
 * never succeed, and leaves removal to the user.
 */
/**
 * How long to wait before retrying a backlog that stopped for a transient
 * reason. Comfortably longer than the match limiter's 5-minute window is
 * overkill; a minute is enough to stop hammering while still draining a large
 * catch-up backlog in one sitting.
 */
const TRANSIENT_RETRY_MS = 60_000;

export function OfflineSync() {
  const router = useRouter();
  const flushing = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<(() => void) | null>(null);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    // Any pending retry is superseded by the pass about to run.
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    let synced = 0;
    /** Set when the pass stopped early for something that resolves itself. */
    let retryLater = false;
    try {
      for (const match of await listQueuedMatches()) {
        // Already known un-syncable: retrying just burns the shared match
        // rate-limit budget that the rest of the backlog needs.
        if (isPermanentRefusal(match.syncCode)) continue;

        let result;
        try {
          result = await logMatchAction(toPayload(match));
        } catch {
          break; // no connection — the next "online" event retries, untouched
        }

        if (result.ok) {
          await removeQueuedMatch(match.id);
          synced++;
          continue;
        }

        // Refused. Keep the match, record why, and let the policy say whether
        // the rest of the backlog is worth attempting.
        await note(match, result.code, messageFor(result.code, result.error));
        const { stopBatch, permanent } = handleRefusal(result.code);
        if (stopBatch) {
          // Stopped for something that will clear on its own — a spent rate
          // limit, or a binding this device is about to regain. Nothing else
          // will wake us: the app is open and online, so neither the mount
          // nor the `online` event fires again. Without a timer the backlog
          // would sit untouched until the user relaunched the app, which is
          // not what "retry later" promises.
          retryLater = !permanent;
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
    if (synced > 0) router.refresh();
    if (retryLater) {
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        flushRef.current?.();
      }, TRANSIENT_RETRY_MS);
    }
  }, [router]);

  // The retry has to call the current flush without flush depending on
  // itself, which no dependency array can express.
  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    // A join is a client-side navigation: this component never remounts, so
    // without an explicit signal a freshly-bound device would leave a full
    // queue sitting there until the app was next opened from cold.
    window.addEventListener(BINDING_CHANGED_EVENT, flush);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener(BINDING_CHANGED_EVENT, flush);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [flush]);

  return null;
}

/**
 * The server's refusals are written for someone acting *now* — "logging a
 * match needs a joined player on this device" is the right thing to tell
 * someone pressing the button, and the wrong thing to print on a match that
 * was logged legitimately days ago and is only waiting to be sent. Those get
 * queue-appropriate prose; the rest already read correctly on a pending card.
 */
function messageFor(code: QueuedMatch["syncCode"], serverMessage: string) {
  switch (code) {
    case "not-bound":
      return "This device isn't joined to a player right now, so this match can't be sent yet.";
    case "rate-limited":
      return "Too many matches at once — this one is waiting its turn.";
    default:
      return serverMessage;
  }
}

/** Records why an item didn't sync, without a redundant write if unchanged. */
async function note(
  match: QueuedMatch,
  code: QueuedMatch["syncCode"],
  error: string,
): Promise<void> {
  if (match.syncCode === code && match.syncError === error) return;
  await enqueueMatch({ ...match, syncCode: code, syncError: error });
}

/**
 * The queued item reduced to what the action accepts — listed rather than
 * spread, so a field added for the pending card's benefit can never ride along
 * into a write. `ownerPlayerId` is the load-bearing one: it is the Player who
 * queued the match, not whoever is bound now (decision 52).
 */
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
