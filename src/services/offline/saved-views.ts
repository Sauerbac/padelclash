import { SAVED_VIEWS_STORE, withOfflineStore } from "./db";

export type SavedViewKind = "feed" | "leaderboard";

export interface SavedView<T = unknown> {
  kind: SavedViewKind;
  bindingPlayerId: string;
  refreshedAt: string;
  projection: T;
}

export type ViewerScope =
  | { kind: "player"; playerId: string }
  | { kind: "admin-unbound" };

const VIEWER_SCOPE_KEY = "viewer-scope";

export const SAVED_VIEW_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export async function saveSavedView<T>(
  kind: SavedViewKind,
  bindingPlayerId: string,
  projection: T,
  now = new Date(),
): Promise<void> {
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.put({
      kind,
      bindingPlayerId,
      refreshedAt: now.toISOString(),
      projection,
    } satisfies SavedView<T>),
  );
}

export async function loadSavedView<T>(
  kind: SavedViewKind,
  bindingPlayerId: string,
  now = new Date(),
): Promise<SavedView<T> | null> {
  const record = (await withOfflineStore(
    SAVED_VIEWS_STORE,
    "readonly",
    (store) => store.get(kind),
  )) as SavedView<T> | undefined;
  if (!record) return null;

  const refreshedAt = new Date(record.refreshedAt).getTime();
  const expired =
    !Number.isFinite(refreshedAt) ||
    now.getTime() - refreshedAt > SAVED_VIEW_MAX_AGE_MS;
  if (record.bindingPlayerId !== bindingPlayerId || expired) {
    await deleteSavedView(kind);
    return null;
  }
  return record;
}

export async function clearSavedViews(): Promise<void> {
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.clear(),
  );
}

export async function saveViewerScope(scope: ViewerScope): Promise<void> {
  const previous = await loadViewerScope();
  const identityChanged =
    scope.kind === "admin-unbound" ||
    (previous?.kind === "player" && previous.playerId !== scope.playerId);
  if (identityChanged) await clearSavedViews();
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.put({ kind: VIEWER_SCOPE_KEY, scope }),
  );
}

export async function loadViewerScope(): Promise<ViewerScope | null> {
  const record = (await withOfflineStore(
    SAVED_VIEWS_STORE,
    "readonly",
    (store) => store.get(VIEWER_SCOPE_KEY),
  )) as { scope?: ViewerScope } | undefined;
  return record?.scope ?? null;
}

async function deleteSavedView(kind: SavedViewKind): Promise<void> {
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.delete(kind),
  );
}
