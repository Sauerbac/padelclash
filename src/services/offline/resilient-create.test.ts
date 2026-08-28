import { afterEach, describe, expect, it, vi } from "vitest";
import { submitResilientCreate } from "./resilient-create";

describe("resilient Match creation", () => {
  afterEach(() => vi.useRealTimers());

  it("queues after five seconds and reconciles a late success by Match id", async () => {
    vi.useFakeTimers();
    let resolveSubmit!: (value: { ok: true; value: string }) => void;
    const submit = vi.fn(() => new Promise<{ ok: true; value: string }>((resolve) => {
      resolveSubmit = resolve;
    }));
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const removeQueued = vi.fn().mockResolvedValue(undefined);
    const onQueued = vi.fn();

    const resultPromise = submitResilientCreate({
      id: "match-1",
      definitelyOffline: false,
      submit,
      enqueue,
      removeQueued,
      onQueued,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(onQueued).toHaveBeenCalledOnce();

    resolveSubmit({ ok: true, value: "payoff" });
    await expect(resultPromise).resolves.toEqual({
      kind: "submitted",
      result: { ok: true, value: "payoff" },
    });
    expect(removeQueued).toHaveBeenCalledWith("match-1");
  });

  it("queues immediately without trusting an online signal", async () => {
    const submit = vi.fn();
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(submitResilientCreate({
      id: "match-2",
      definitelyOffline: true,
      submit,
      enqueue,
      removeQueued: vi.fn(),
      onQueued: vi.fn(),
    })).resolves.toEqual({ kind: "queued" });
    expect(submit).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
