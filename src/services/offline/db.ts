export const OFFLINE_DB_NAME = "padelclash-offline";
export const OFFLINE_DB_VERSION = 3;
export const QUEUED_MATCHES_STORE = "queued-matches";
export const MATCH_SNAPSHOT_STORE = "match-snapshot";
export const SAVED_VIEWS_STORE = "saved-views";

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUED_MATCHES_STORE)) {
        db.createObjectStore(QUEUED_MATCHES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MATCH_SNAPSHOT_STORE)) {
        db.createObjectStore(MATCH_SNAPSHOT_STORE);
      }
      if (!db.objectStoreNames.contains(SAVED_VIEWS_STORE)) {
        db.createObjectStore(SAVED_VIEWS_STORE, { keyPath: "kind" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function withOfflineStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openOfflineDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(storeName, mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
