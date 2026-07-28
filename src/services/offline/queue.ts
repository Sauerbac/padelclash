import {
  isPermanentRefusal,
} from "../../domain/sync-policy";
import { QUEUED_MATCHES_STORE, withOfflineStore } from "./db";
import {
  decodeQueuedMatch,
  type QueuedMatch,
  type QueuedMatchInput,
} from "./queue-contract";
export type { QueuedMatch, QueuedMatchInput } from "./queue-contract";

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
export async function enqueueMatch(match: QueuedMatchInput): Promise<void> {
  await withStore("readwrite", (store) => store.put(match));
  notifyQueueChanged();
}

/** All queued matches, oldest first (UUIDv7 ids are time-ordered). */
export async function listQueuedMatches(): Promise<QueuedMatch[]> {
  const all = (await withStore("readonly", (store) => store.getAll())) as unknown[];
  const queued: QueuedMatch[] = [];
  for (const stored of all) {
    const decoded = decodeQueuedMatch(stored);
    if (!decoded) continue;
    queued.push(decoded);
  }
  return queued.sort((a, b) => (a.id < b.id ? -1 : 1));
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
