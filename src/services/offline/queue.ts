import type { LogMatchPayload } from "@/app/actions/matches";
import {
  isPermanentRefusal,
  type MatchSyncRefusal,
} from "../../domain/sync-policy";
import { QUEUED_MATCHES_STORE, withOfflineStore } from "./db";

/**
 * Offline log queue (spec "PWA & offline"): a match logged without a
 * connection waits in IndexedDB until the network returns. The client-side
 * UUIDv7 id doubles as the idempotency key, so a retried sync can't
 * double-log. Browser-only — every caller is a client component.
 *
 * Each item carries `ownerPlayerId` (inherited from LogMatchPayload): the
 * Player who queued it. The server refuses to accept it under any other
 * identity (spec decision 52), so a device rebound to someone else gets an
 * `identity-mismatch` refusal rather than silent re-attribution.
 */
export interface QueuedMatch extends LogMatchPayload {
  /** Player names per side at queue time, so the pending card renders offline. */
  names: Record<"A" | "B", string[]>;
  /**
   * Display name of `ownerPlayerId` at queue time. The card has to be able to
   * say *whose* match is stuck when this installation is now bound to someone
   * else — and at that point the roster query behind the name is gone.
   */
  ownerPlayerName: string;
  queuedAt: string;
  /** Last server-side rejection, if any — surfaced on the pending card. */
  syncError?: string;
  /** Its code, which decides whether retrying can ever help. */
  syncCode?: MatchSyncRefusal;
}

/** Fired on window whenever the queue's contents change. */
export const QUEUE_CHANGED_EVENT = "padelclash:queue-changed";

/**
 * Fired when this installation gains a binding — i.e. a join succeeded.
 *
 * Joining is a client-side navigation, so nothing in the app remounts and the
 * queue's flush-on-open never fires again. Without this signal, a device that
 * was re-invited after losing access would sit on a full queue until the user
 * happened to close and reopen the app, even though it is online and entitled
 * the whole time.
 */
export const BINDING_CHANGED_EVENT = "padelclash:binding-changed";

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withOfflineStore(QUEUED_MATCHES_STORE, mode, run);
}

function notifyQueueChanged(): void {
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

/** Adds a match to the queue; an existing record with the same id is replaced. */
export async function enqueueMatch(match: QueuedMatch): Promise<void> {
  await withStore("readwrite", (store) => store.put(match));
  notifyQueueChanged();
}

/** All queued matches, oldest first (UUIDv7 ids are time-ordered). */
export async function listQueuedMatches(): Promise<QueuedMatch[]> {
  const all = await withStore("readonly", (store) =>
    store.getAll(),
  ) as QueuedMatch[];
  return all.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export async function removeQueuedMatch(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  notifyQueueChanged();
}

/**
 * Revocation cleanup (spec decision 52). The credential this installation held
 * is gone, so nothing in the queue can sync right now — say so on every card.
 *
 * It deliberately annotates rather than deletes. Discarding a member's queued
 * matches because an Admin revoked a *device* would destroy data the user never
 * agreed to lose, and the guarantee is explicit: matches only leave this device
 * when someone presses Discard. If Admin re-invites the same Player, the
 * backlog flushes on the next open as though nothing happened.
 */
export async function markQueueUnbound(): Promise<void> {
  const queued = await listQueuedMatches();
  if (queued.length === 0) return;
  for (const match of queued) {
    // Don't overwrite a permanent refusal with a vaguer one.
    if (isPermanentRefusal(match.syncCode)) continue;
    await withStore("readwrite", (store) =>
      store.put({
        ...match,
        syncCode: "not-bound" as const,
        syncError:
          "This device is no longer joined, so this match can't be sent yet.",
      }),
    );
  }
  notifyQueueChanged();
}
