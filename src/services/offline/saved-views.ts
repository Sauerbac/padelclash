import type { FeedMatch, LeaderboardEntry } from "@/services/matches";
import { SAVED_VIEWS_STORE, withOfflineStore } from "./db";

export type SavedViewKind = "feed" | "leaderboard";

export interface SavedViewProjectionByKind {
  feed: { you: { id: string; name: string }; feed: FeedMatch[] };
  leaderboard: { youId: string; entries: LeaderboardEntry[] };
}

export interface SavedView<K extends SavedViewKind = SavedViewKind> {
  version: 1;
  kind: K;
  bindingId: string;
  refreshedAt: string;
  projection: SavedViewProjectionByKind[K];
}

export type ViewerScope =
  | { kind: "player"; playerId: string; bindingId: string }
  | { kind: "admin-unbound" };

const VIEWER_SCOPE_KEY = "viewer-scope";
const SAVED_VIEW_VERSION = 1;
let mutationChain: Promise<unknown> = Promise.resolve();

export const SAVED_VIEW_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export function saveSavedView<K extends SavedViewKind>(
  kind: K,
  bindingId: string,
  projection: SavedViewProjectionByKind[K],
  now = new Date(),
): Promise<void> {
  return serializeMutation(() => putSavedView(kind, bindingId, projection, now));
}

/** Atomically records scope and projection in the module's serialized writer. */
export function recordSavedView<K extends SavedViewKind>(
  kind: K,
  scope: Extract<ViewerScope, { kind: "player" }>,
  projection: SavedViewProjectionByKind[K],
  now = new Date(),
): Promise<void> {
  return serializeMutation(async () => {
    await saveViewerScopeUnserialized(scope);
    const current = await loadViewerScope();
    if (current?.kind !== "player" || current.bindingId !== scope.bindingId) return;
    await putSavedView(kind, scope.bindingId, projection, now);
  });
}

export async function loadSavedView<K extends SavedViewKind>(
  kind: K,
  bindingId: string,
  now = new Date(),
): Promise<SavedView<K> | null> {
  const value = await withOfflineStore(SAVED_VIEWS_STORE, "readonly", (store) => store.get(kind));
  const record = decodeSavedView(kind, value);
  const refreshedAt = record ? new Date(record.refreshedAt).getTime() : Number.NaN;
  const expired = !Number.isFinite(refreshedAt) || now.getTime() - refreshedAt > SAVED_VIEW_MAX_AGE_MS;
  if (!record || record.bindingId !== bindingId || expired) {
    if (value !== undefined) await deleteSavedView(kind);
    return null;
  }
  return record;
}

export function clearSavedViews(): Promise<void> {
  return serializeMutation(() =>
    withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) => store.clear()),
  );
}

export function saveViewerScope(scope: ViewerScope): Promise<void> {
  return serializeMutation(() => saveViewerScopeUnserialized(scope));
}

async function saveViewerScopeUnserialized(scope: ViewerScope): Promise<void> {
  const previous = await loadViewerScope();
  const identityChanged =
    scope.kind === "admin-unbound" ||
    (previous?.kind === "player" && previous.bindingId !== scope.bindingId);
  if (identityChanged) {
    await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) => store.clear());
  }
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.put({ kind: VIEWER_SCOPE_KEY, scope }),
  );
}

export async function loadViewerScope(): Promise<ViewerScope | null> {
  const record = await withOfflineStore(SAVED_VIEWS_STORE, "readonly", (store) => store.get(VIEWER_SCOPE_KEY));
  if (!isRecord(record) || !isRecord(record.scope)) return null;
  const scope = record.scope;
  if (scope.kind === "admin-unbound") return { kind: "admin-unbound" };
  if (scope.kind === "player" && typeof scope.playerId === "string" && typeof scope.bindingId === "string") {
    return { kind: "player", playerId: scope.playerId, bindingId: scope.bindingId };
  }
  return null;
}

function serializeMutation<T>(run: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(run, run);
  mutationChain = result.then(() => undefined, () => undefined);
  return result;
}

async function putSavedView<K extends SavedViewKind>(kind: K, bindingId: string, projection: SavedViewProjectionByKind[K], now: Date): Promise<void> {
  await withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) =>
    store.put({ version: SAVED_VIEW_VERSION, kind, bindingId, refreshedAt: now.toISOString(), projection } satisfies SavedView<K>),
  );
}

async function deleteSavedView(kind: SavedViewKind): Promise<void> {
  await serializeMutation(() => withOfflineStore(SAVED_VIEWS_STORE, "readwrite", (store) => store.delete(kind)));
}

function decodeSavedView<K extends SavedViewKind>(kind: K, value: unknown): SavedView<K> | null {
  if (!isRecord(value) || value.version !== SAVED_VIEW_VERSION || value.kind !== kind || typeof value.bindingId !== "string" || typeof value.refreshedAt !== "string") return null;
  const projection = kind === "feed" ? decodeFeedProjection(value.projection) : decodeLeaderboardProjection(value.projection);
  if (!projection) return null;
  return { ...value, projection } as SavedView<K>;
}

function decodeFeedProjection(value: unknown): SavedViewProjectionByKind["feed"] | null {
  if (!isRecord(value) || !isNamedId(value.you) || !Array.isArray(value.feed)) return null;
  const feed = value.feed.map(decodeFeedMatch);
  if (feed.some((match) => match === null)) return null;
  return { you: value.you, feed: feed as FeedMatch[] };
}

function decodeFeedMatch(value: unknown): FeedMatch | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.loggedBy !== "string" || typeof value.loggedByName !== "string" || (value.winnerSide !== "A" && value.winnerSide !== "B") || !Array.isArray(value.participants) || !value.participants.every(isFeedParticipant) || !isSets(value.sets)) return null;
  const playedAt = toDate(value.playedAt);
  const loggedAt = toDate(value.loggedAt);
  if (!playedAt || !loggedAt) return null;
  return { ...value, playedAt, loggedAt } as FeedMatch;
}

function decodeLeaderboardProjection(value: unknown): SavedViewProjectionByKind["leaderboard"] | null {
  if (!isRecord(value) || typeof value.youId !== "string" || !Array.isArray(value.entries) || !value.entries.every(isLeaderboardEntry)) return null;
  return { youId: value.youId, entries: value.entries };
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  return isRecord(value) && typeof value.playerId === "string" && typeof value.name === "string" && typeof value.rating === "number" && (value.rank === null || typeof value.rank === "number") && typeof value.wins === "number" && typeof value.losses === "number" && typeof value.matchesPlayed === "number";
}

function isFeedParticipant(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== "string" || (value.side !== "A" && value.side !== "B") || typeof value.slot !== "number") return false;
  if (value.kind === "guest") return true;
  return value.kind === "player" && typeof value.playerId === "string" && typeof value.ratingBefore === "number" && typeof value.delta === "number" && typeof value.ratingAfter === "number";
}

function isSets(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.every((set) => isRecord(set) && typeof set.a === "number" && typeof set.b === "number"));
}

function isNamedId(value: unknown): value is { id: string; name: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function toDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
