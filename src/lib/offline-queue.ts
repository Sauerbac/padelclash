import type { LogMatchPayload } from "@/app/actions/matches";

/**
 * Offline log queue (spec "PWA & offline"): a match logged without a
 * connection waits in IndexedDB until the network returns. The client-side
 * UUIDv7 id doubles as the idempotency key, so a retried sync can't
 * double-log. Browser-only — every caller is a client component.
 */
export interface QueuedMatch extends LogMatchPayload {
  /** Player names per side at queue time, so the pending card renders offline. */
  names: Record<"A" | "B", string[]>;
  queuedAt: string;
  /** Last server-side rejection, if any — surfaced on the pending card. */
  syncError?: string;
}

const DB_NAME = "padelclash-offline";
const STORE = "queued-matches";

/** Fired on window whenever the queue's contents change. */
export const QUEUE_CHANGED_EVENT = "padelclash:queue-changed";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
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
