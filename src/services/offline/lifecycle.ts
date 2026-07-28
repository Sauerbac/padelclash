import { handleRefusal, isPermanentRefusal } from "../../domain/sync-policy";
import type { QueuedMatch } from "./queue-contract";

export interface OfflineSessionStatus {
  bound: boolean;
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
  contactSession(): Promise<OfflineSessionStatus>;
  cleanupLatch: {
    set(): void;
    pending(): boolean;
    clear(): void;
  };
  dropPrivateCaches(): Promise<boolean>;
  markQueueUnbound(): Promise<void>;
  clearSnapshot(): Promise<void>;
  refreshSnapshot(player: { id: string; name: string }): Promise<void>;
  listQueuedMatches(): Promise<QueuedMatch[]>;
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
  let disposed = false;

  const runPass = async () => {
    cancelRetry?.();
    cancelRetry = null;

    const status = await dependencies.contactSession();
    if (status.revoked) dependencies.cleanupLatch.set();

    if (dependencies.cleanupLatch.pending()) {
      const [caches, queue, snapshot] = await Promise.allSettled([
        dependencies.dropPrivateCaches(),
        dependencies.markQueueUnbound(),
        dependencies.clearSnapshot(),
      ]);
      if (
        caches.status === "fulfilled" &&
        caches.value &&
        queue.status === "fulfilled" &&
        snapshot.status === "fulfilled"
      ) {
        dependencies.cleanupLatch.clear();
      }
      if (status.revoked) dependencies.notifyRevoked();
      return;
    }

    if (!status.bound || !status.player) return;

    try {
      await dependencies.refreshSnapshot(status.player);
    } catch {
      // A stale snapshot is less harmful than blocking a valid queue drain.
    }

    let synced = false;
    for (const match of await dependencies.listQueuedMatches()) {
      if (isPermanentRefusal(match.syncCode)) continue;

      let result: QueueSubmissionResult;
      try {
        result = await dependencies.submitMatch(match);
      } catch {
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
  };

  const run = async () => {
    do {
      rerunRequested = false;
      try {
        await runPass();
      } catch {
        // Session/network failures leave durable state untouched. A later
        // browser signal or scheduled retry starts a fresh pass.
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
