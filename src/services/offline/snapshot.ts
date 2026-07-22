import { MATCH_SNAPSHOT_STORE, withOfflineStore } from "./db";

export interface OfflineRosterEntry {
  id: string;
  name: string;
}

export interface OfflineMatchSnapshot {
  player: OfflineRosterEntry;
  roster: OfflineRosterEntry[];
  refreshedAt: string;
}

const SNAPSHOT_KEY = "current";

export function createOfflineMatchSnapshot<
  P extends OfflineRosterEntry,
  R extends OfflineRosterEntry,
>(player: P, roster: R[], now = new Date()): OfflineMatchSnapshot {
  return {
    player: { id: player.id, name: player.name },
    roster: roster.map(({ id, name }) => ({ id, name })),
    refreshedAt: now.toISOString(),
  };
}

export async function saveOfflineMatchSnapshot(
  snapshot: OfflineMatchSnapshot,
): Promise<void> {
  await withOfflineStore(MATCH_SNAPSHOT_STORE, "readwrite", (store) =>
    store.put(snapshot, SNAPSHOT_KEY),
  );
}

export async function loadOfflineMatchSnapshot(): Promise<OfflineMatchSnapshot | null> {
  const snapshot = await withOfflineStore(MATCH_SNAPSHOT_STORE, "readonly", (store) =>
    store.get(SNAPSHOT_KEY),
  );
  return (snapshot as OfflineMatchSnapshot | undefined) ?? null;
}

export async function clearOfflineMatchSnapshot(): Promise<void> {
  await withOfflineStore(MATCH_SNAPSHOT_STORE, "readwrite", (store) =>
    store.delete(SNAPSHOT_KEY),
  );
}
