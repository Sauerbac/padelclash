import { MATCH_SNAPSHOT_STORE, withOfflineStore } from "./db";

export interface OfflineRosterEntry {
  id: string;
  name: string;
}

export interface OfflineMatchSnapshot {
  player: OfflineRosterEntry;
  roster: OfflineRosterEntry[];
  /** All roster names, including Retired Players, reserved against Guests. */
  reservedPlayerNames: string[];
  refreshedAt: string;
}

const SNAPSHOT_KEY = "current";

export function createOfflineMatchSnapshot<
  P extends OfflineRosterEntry,
  R extends OfflineRosterEntry,
>(
  player: P,
  roster: R[],
  reservedPlayerNames: string[],
  now = new Date(),
): OfflineMatchSnapshot {
  return {
    player: { id: player.id, name: player.name },
    roster: roster.map(({ id, name }) => ({ id, name })),
    reservedPlayerNames: [...reservedPlayerNames],
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
  if (!snapshot) return null;
  const stored = snapshot as OfflineMatchSnapshot;
  return {
    ...stored,
    // Snapshots written before Guest entry existed contain only the active
    // roster. They remain usable offline and refresh to the full reserved-name
    // set on the next successful online session check.
    reservedPlayerNames:
      stored.reservedPlayerNames ?? stored.roster.map(({ name }) => name),
  };
}

export async function clearOfflineMatchSnapshot(): Promise<void> {
  await withOfflineStore(MATCH_SNAPSHOT_STORE, "readwrite", (store) =>
    store.delete(SNAPSHOT_KEY),
  );
}
