import { describe, expect, it, vi } from "vitest";
import {
  createOfflineLifecycle,
  type OfflineLifecycleDependencies,
} from "./lifecycle";

function dependencies(
  overrides: Partial<OfflineLifecycleDependencies> = {},
): OfflineLifecycleDependencies {
  return {
    contactSession: vi.fn().mockResolvedValue({
      bound: true,
      player: { id: "player-1", name: "Alex" },
      revoked: false,
    }),
    cleanupLatch: {
      set: vi.fn(),
      pending: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    },
    dropPrivateCaches: vi.fn().mockResolvedValue(true),
    markQueueUnbound: vi.fn().mockResolvedValue(undefined),
    clearSnapshot: vi.fn().mockResolvedValue(undefined),
    refreshSnapshot: vi.fn().mockResolvedValue(undefined),
    listQueuedMatches: vi.fn().mockResolvedValue([]),
    submitMatch: vi.fn(),
    noteRefusal: vi.fn().mockResolvedValue(undefined),
    removeQueuedMatch: vi.fn().mockResolvedValue(undefined),
    scheduleRetry: vi.fn().mockReturnValue(() => undefined),
    notifySynced: vi.fn(),
    notifyRevoked: vi.fn(),
    ...overrides,
  };
}

describe("offline lifecycle", () => {
  it("waits for session contact before attempting queued submissions", async () => {
    let resolveContact!: (
      status: Awaited<
        ReturnType<OfflineLifecycleDependencies["contactSession"]>
      >,
    ) => void;
    const contactSession = vi.fn(
      () =>
        new Promise<
          Awaited<ReturnType<OfflineLifecycleDependencies["contactSession"]>>
        >((resolve) => {
          resolveContact = resolve;
        }),
    );
    const submitMatch = vi.fn();
    const lifecycle = createOfflineLifecycle(
      dependencies({
        contactSession,
        listQueuedMatches: vi.fn().mockResolvedValue([
          {
            id: "01900000-0000-7000-8000-000000000001",
            playedAt: "2026-07-22T12:00:00.000Z",
            ownerPlayerId: "player-1",
            ownerPlayerName: "Alex",
            sides: {
              A: [{ kind: "player", playerId: "player-1" }],
              B: [{ kind: "player", playerId: "player-2" }],
            },
            names: { A: ["Alex"], B: ["Blair"] },
            winnerSide: "A",
            sets: null,
            queuedAt: "2026-07-22T12:01:00.000Z",
          },
        ]),
        submitMatch,
      }),
    );

    const triggered = lifecycle.trigger();
    await Promise.resolve();
    expect(submitMatch).not.toHaveBeenCalled();

    resolveContact({
      bound: true,
      player: { id: "player-1", name: "Alex" },
      revoked: false,
    });
    await triggered;

    expect(submitMatch).toHaveBeenCalledOnce();
  });

  it("latches revocation before cleanup and retries a failed cleanup later", async () => {
    let owed = false;
    const cleanupLatch = {
      set: vi.fn(() => {
        owed = true;
      }),
      pending: vi.fn(() => owed),
      clear: vi.fn(() => {
        owed = false;
      }),
    };
    const dropPrivateCaches = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const listQueuedMatches = vi.fn();
    const contactSession = vi
      .fn()
      .mockResolvedValueOnce({ bound: false, player: null, revoked: true })
      .mockResolvedValueOnce({ bound: false, player: null, revoked: false });
    const lifecycle = createOfflineLifecycle(
      dependencies({
        contactSession,
        cleanupLatch,
        dropPrivateCaches,
        listQueuedMatches,
      }),
    );

    await lifecycle.trigger();
    expect(cleanupLatch.set).toHaveBeenCalledBefore(dropPrivateCaches);
    expect(owed).toBe(true);
    expect(listQueuedMatches).not.toHaveBeenCalled();

    await lifecycle.trigger();
    expect(dropPrivateCaches).toHaveBeenCalledTimes(2);
    expect(cleanupLatch.clear).toHaveBeenCalledOnce();
    expect(owed).toBe(false);
  });

  it("refreshes the rebound Player snapshot and retries not-bound Matches", async () => {
    const match = queuedMatch({ syncCode: "not-bound" });
    const refreshSnapshot = vi.fn().mockResolvedValue(undefined);
    const submitMatch = vi.fn().mockResolvedValue({ ok: true });
    const removeQueuedMatch = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createOfflineLifecycle(
      dependencies({
        contactSession: vi.fn().mockResolvedValue({
          bound: true,
          player: { id: "player-1", name: "Alex" },
          revoked: false,
        }),
        refreshSnapshot,
        listQueuedMatches: vi.fn().mockResolvedValue([match]),
        submitMatch,
        removeQueuedMatch,
      }),
    );

    await lifecycle.trigger();

    expect(refreshSnapshot).toHaveBeenCalledWith({
      id: "player-1",
      name: "Alex",
    });
    expect(submitMatch).toHaveBeenCalledWith(match);
    expect(removeQueuedMatch).toHaveBeenCalledWith(match.id);
  });

  it("preserves ownership when a different Player receives identity-mismatch", async () => {
    const match = queuedMatch({ ownerPlayerId: "player-before-rebind" });
    const noteRefusal = vi.fn().mockResolvedValue(undefined);
    const removeQueuedMatch = vi.fn();
    const submitMatch = vi.fn().mockImplementation(async (submitted) => {
      expect(submitted.ownerPlayerId).toBe("player-before-rebind");
      return {
        ok: false,
        code: "identity-mismatch",
        error: "different Player",
      };
    });
    const lifecycle = createOfflineLifecycle(
      dependencies({
        contactSession: vi.fn().mockResolvedValue({
          bound: true,
          player: { id: "player-after-rebind", name: "Blair" },
          revoked: false,
        }),
        listQueuedMatches: vi.fn().mockResolvedValue([match]),
        submitMatch,
        noteRefusal,
        removeQueuedMatch,
      }),
    );

    await lifecycle.trigger();

    expect(noteRefusal).toHaveBeenCalledWith(
      match,
      "identity-mismatch",
      "different Player",
    );
    expect(removeQueuedMatch).not.toHaveBeenCalled();
  });

  it("skips permanently refused Matches on every automatic pass", async () => {
    const submitMatch = vi.fn();
    const lifecycle = createOfflineLifecycle(
      dependencies({
        listQueuedMatches: vi
          .fn()
          .mockResolvedValue([queuedMatch({ syncCode: "invalid" })]),
        submitMatch,
      }),
    );

    await lifecycle.trigger();
    await lifecycle.trigger();

    expect(submitMatch).not.toHaveBeenCalled();
  });

  it("stops on a transient refusal and schedules exactly one retry", async () => {
    const scheduleRetry = vi.fn().mockReturnValue(() => undefined);
    const submitMatch = vi.fn().mockResolvedValue({
      ok: false,
      code: "rate-limited",
      error: "server prose",
    });
    const lifecycle = createOfflineLifecycle(
      dependencies({
        listQueuedMatches: vi
          .fn()
          .mockResolvedValue([queuedMatch(), queuedMatch({ id: "later" })]),
        submitMatch,
        scheduleRetry,
      }),
    );

    await lifecycle.trigger();

    expect(submitMatch).toHaveBeenCalledOnce();
    expect(scheduleRetry).toHaveBeenCalledOnce();
    expect(scheduleRetry.mock.calls[0][1]).toBe(60_000);
  });

  it("leaves queue records untouched when session contact or submission is offline", async () => {
    const listQueuedMatches = vi.fn();
    const removeQueuedMatch = vi.fn();
    const noteRefusal = vi.fn();
    const contactFailure = createOfflineLifecycle(
      dependencies({
        contactSession: vi.fn().mockRejectedValue(new Error("offline")),
        listQueuedMatches,
        removeQueuedMatch,
        noteRefusal,
      }),
    );
    await contactFailure.trigger();
    expect(listQueuedMatches).not.toHaveBeenCalled();

    const submissionFailure = createOfflineLifecycle(
      dependencies({
        listQueuedMatches: vi.fn().mockResolvedValue([queuedMatch()]),
        submitMatch: vi.fn().mockRejectedValue(new Error("offline")),
        removeQueuedMatch,
        noteRefusal,
      }),
    );
    await submissionFailure.trigger();

    expect(removeQueuedMatch).not.toHaveBeenCalled();
    expect(noteRefusal).not.toHaveBeenCalled();
  });

  it("coalesces concurrent triggers without overlapping submissions", async () => {
    let release!: () => void;
    let active = 0;
    let maxActive = 0;
    let queued = [queuedMatch()];
    const submitMatch = vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      active--;
      return { ok: true as const };
    });
    const lifecycle = createOfflineLifecycle(
      dependencies({
        listQueuedMatches: vi.fn(async () => queued),
        submitMatch,
        removeQueuedMatch: vi.fn(async () => {
          queued = [];
        }),
      }),
    );

    const first = lifecycle.trigger();
    await vi.waitFor(() => expect(submitMatch).toHaveBeenCalledOnce());
    const concurrent = lifecycle.trigger();
    release();
    await Promise.all([first, concurrent]);

    expect(maxActive).toBe(1);
    expect(submitMatch).toHaveBeenCalledOnce();
  });
});

function queuedMatch(
  overrides: Partial<
    Awaited<ReturnType<OfflineLifecycleDependencies["listQueuedMatches"]>>[number]
  > = {},
) {
  return {
    id: "01900000-0000-7000-8000-000000000001",
    playedAt: "2026-07-22T12:00:00.000Z",
    ownerPlayerId: "player-1",
    ownerPlayerName: "Alex",
    sides: {
      A: [{ kind: "player" as const, playerId: "player-1" }],
      B: [{ kind: "player" as const, playerId: "player-2" }],
    },
    names: { A: ["Alex"], B: ["Blair"] },
    winnerSide: "A" as const,
    sets: null,
    queuedAt: "2026-07-22T12:01:00.000Z",
    ...overrides,
  };
}
