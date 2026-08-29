import { handleRefusal, isPermanentRefusal } from "../../domain/sync-policy";
import {
  isIncompatibleQueuedMatch,
  type QueuedMatch,
  type QueuedMatchRecord,
} from "./queue-contract";

export interface OfflineSessionStatus {
  bound: boolean;
  bindingId: string | null;
  player: { id: string; name: string } | null;
  revoked: boolean;
}

export type QueueSubmissionResult =
  | { ok: true }
  | {
      ok: false;
      code: NonNullable<QueuedMatch["syncCode"]>;
      error: string;
    };

export interface OfflineLifecycleDependencies {
  contactSession(signal: AbortSignal): Promise<OfflineSessionStatus>;
  cleanupLatch: {
    set(): void;
    pending(): boolean;
    clear(): void;
  };
  dropPrivateCaches(): Promise<boolean>;
  markQueueUnbound(): Promise<void>;
  clearSnapshot(): Promise<void>;
  clearSavedViews(): Promise<void>;
  snapshotPlayerId(): Promise<string | null>;
  savedViewBindingId(): Promise<string | null>;
  refreshSnapshot(player: { id: string; name: string }, signal: AbortSignal): Promise<void>;
  listQueuedMatches(): Promise<QueuedMatchRecord[]>;
  submitMatch(match: QueuedMatch): Promise<QueueSubmissionResult>;
  noteRefusal(
    match: QueuedMatch,
    code: NonNullable<QueuedMatch["syncCode"]>,
    error: string,
  ): Promise<void>;
  removeQueuedMatch(id: string): Promise<void>;
  scheduleRetry(run: () => void, delayMs: number): () => void;
  notifySynced(): void;
  notifyRevoked(): void;
}

export interface OfflineLifecycle {
  trigger(): Promise<void>;
  dispose(): void;
}

export const TRANSIENT_RETRY_MS = 60_000;
export const OPERATION_TIMEOUT_MS = 30_000;

/**
 * One serialized installation lifecycle. Every browser signal enters through
 * trigger(), so session contact, cleanup, snapshot refresh, and queue drain
 * cannot race one another.
 */
export function createOfflineLifecycle(
  dependencies: OfflineLifecycleDependencies,
): OfflineLifecycle {
  let running: Promise<void> | null = null;
  let rerunRequested = false;
  let cancelRetry: (() => void) | null = null;
  let activeController: AbortController | null = null;
  const cancelActiveOperations = new Set<() => void>();
  let disposed = false;

  const bounded = <T>(operation: Promise<T>, onTimeout?: () => void) =>
    new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cancelActiveOperations.delete(cancel);
        complete();
      };
      const cancel = () => finish(() => reject(new Error("Offline lifecycle disposed")));
      const timer = setTimeout(() => {
        onTimeout?.();
        finish(() => reject(new Error("Offline operation timed out")));
      }, OPERATION_TIMEOUT_MS);
      cancelActiveOperations.add(cancel);
      operation.then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    });

  const runPass = async () => {
    cancelRetry?.();
    cancelRetry = null;

    const controller = new AbortController();
    activeController = controller;
    const status = await bounded(
      dependencies.contactSession(controller.signal),
      () => controller.abort(),
    );
    if (status.revoked) dependencies.cleanupLatch.set();
    if (status.player) {
      const snapshotPlayerId = await dependencies.snapshotPlayerId();
      if (snapshotPlayerId && snapshotPlayerId !== status.player.id) {
        dependencies.cleanupLatch.set();
      }
      const savedViewBindingId = await dependencies.savedViewBindingId();
      if (savedViewBindingId && savedViewBindingId !== status.bindingId) {
        dependencies.cleanupLatch.set();
      }
    }

    if (dependencies.cleanupLatch.pending()) {
      const [caches, queue, snapshot, savedViews] = await Promise.allSettled([
        dependencies.dropPrivateCaches(),
        dependencies.markQueueUnbound(),
        dependencies.clearSnapshot(),
        dependencies.clearSavedViews(),
      ]);
      if (
        caches.status === "fulfilled" &&
        caches.value &&
        queue.status === "fulfilled" &&
        snapshot.status === "fulfilled" &&
        savedViews.status === "fulfilled"
      ) {
        dependencies.cleanupLatch.clear();
      }
      if (status.revoked) dependencies.notifyRevoked();
      // A rebind can arrive while cleanup is still owed from the revoked
      // credential. Once cleanup succeeds, continue this same contact through
      // snapshot refresh and queue drain; waiting for another browser event
      // would leave a successfully rebound installation idle.
      if (dependencies.cleanupLatch.pending()) return;
    }

    if (!status.bound || !status.player) return;

    try {
      await bounded(
        dependencies.refreshSnapshot(status.player, controller.signal),
        () => controller.abort(),
      );
    } catch {
      // A stale snapshot is less harmful than blocking a valid queue drain.
    }

    let synced = false;
    for (const match of await dependencies.listQueuedMatches()) {
      if (isIncompatibleQueuedMatch(match)) continue;
      if (isPermanentRefusal(match.syncCode)) continue;

      let result: QueueSubmissionResult;
      try {
        result = await bounded(dependencies.submitMatch(match));
      } catch {
        if (!disposed && !cancelRetry) {
          cancelRetry = dependencies.scheduleRetry(
            () => void trigger(),
            TRANSIENT_RETRY_MS,
          );
        }
        return;
      }
      if (result.ok) {
        await dependencies.removeQueuedMatch(match.id);
        synced = true;
        continue;
      }

      await dependencies.noteRefusal(
        match,
        result.code,
        queueMessage(result.code, result.error),
      );
      const handling = handleRefusal(result.code);
      if (handling.stopBatch) {
        if (!handling.permanent && !disposed) {
          cancelRetry = dependencies.scheduleRetry(
            () => void trigger(),
            TRANSIENT_RETRY_MS,
          );
        }
        break;
      }
    }
    if (synced) dependencies.notifySynced();
    if (activeController === controller) activeController = null;
  };

  const run = async () => {
    do {
      rerunRequested = false;
      try {
        await runPass();
      } catch {
        // Contact failures must self-heal even at steady slow/offline latency;
        // relying on another browser event can strand maintenance forever.
        if (!disposed && !cancelRetry) {
          cancelRetry = dependencies.scheduleRetry(
            () => void trigger(),
            TRANSIENT_RETRY_MS,
          );
        }
      }
    } while (rerunRequested && !disposed);
  };

  function trigger(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (running) {
      rerunRequested = true;
      return running;
    }
    running = run().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    trigger,
    dispose() {
      disposed = true;
      activeController?.abort();
      activeController = null;
      for (const cancel of cancelActiveOperations) cancel();
      cancelActiveOperations.clear();
      rerunRequested = false;
      cancelRetry?.();
      cancelRetry = null;
    },
  };
}

function queueMessage(
  code: NonNullable<QueuedMatch["syncCode"]>,
  serverMessage: string,
): string {
  switch (code) {
    case "not-bound":
      return "This device isn't joined to a player right now, so this match can't be sent yet.";
    case "rate-limited":
      return "Too many matches at once — this one is waiting its turn.";
    default:
      return serverMessage;
  }
}
