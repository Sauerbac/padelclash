import { afterEach, describe, expect, it, vi } from "vitest";
import { submitResilientCreate } from "./resilient-create";

describe("resilient Match creation", () => {
  afterEach(() => vi.useRealTimers());

  it("releases the foreground after five seconds and reconciles a late success by Match id", async () => {
    vi.useFakeTimers();
    let resolveSubmit!: (value: { ok: true; value: string }) => void;
    const submit = vi.fn(() => new Promise<{ ok: true; value: string }>((resolve) => {
      resolveSubmit = resolve;
    }));
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const removeQueued = vi.fn().mockResolvedValue(undefined);
    const noteRefusal = vi.fn().mockResolvedValue(undefined);
    const onLateSettled = vi.fn();
    const onQueued = vi.fn();

    const resultPromise = submitResilientCreate({
      id: "match-1",
      definitelyOffline: false,
      submit,
      enqueue,
      removeQueued,
      noteRefusal,
      onQueued,
      onLateSettled,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(onQueued).toHaveBeenCalledOnce();

    await expect(resultPromise).resolves.toEqual({ kind: "queued" });

    resolveSubmit({ ok: true, value: "payoff" });
    await vi.waitFor(() => expect(removeQueued).toHaveBeenCalledWith("match-1"));
    expect(removeQueued).toHaveBeenCalledWith("match-1");
    expect(onLateSettled).toHaveBeenCalledWith({ ok: true, value: "payoff" });
  });

  it("records a late refusal on the durable queued Match", async () => {
    vi.useFakeTimers();
    let resolveSubmit!: (value: { ok: false; code: "invalid"; error: string }) => void;
    const noteRefusal = vi.fn().mockResolvedValue(undefined);
    const onLateSettled = vi.fn();
    const resultPromise = submitResilientCreate({
      id: "match-refused",
      definitelyOffline: false,
      submit: () => new Promise((resolve) => { resolveSubmit = resolve; }),
      enqueue: vi.fn().mockResolvedValue(undefined),
      removeQueued: vi.fn(),
      noteRefusal,
      onQueued: vi.fn(),
      onLateSettled,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(resultPromise).resolves.toEqual({ kind: "queued" });
    resolveSubmit({ ok: false, code: "invalid", error: "Bad score" });

    await vi.waitFor(() => expect(noteRefusal).toHaveBeenCalledWith(
      "match-refused",
      "invalid",
      "Bad score",
    ));
    expect(onLateSettled).toHaveBeenCalledWith({
      ok: false,
      code: "invalid",
      error: "Bad score",
    });
  });

  it("reports a durable enqueue failure instead of claiming the Match is queued", async () => {
    vi.useFakeTimers();
    const resultPromise = submitResilientCreate({
      id: "match-storage-failure",
      definitelyOffline: false,
      submit: () => new Promise<never>(() => undefined),
      enqueue: vi.fn().mockRejectedValue(new Error("quota")),
      removeQueued: vi.fn(),
      noteRefusal: vi.fn(),
      onQueued: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(resultPromise).resolves.toEqual({ kind: "not-durable" });
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
      noteRefusal: vi.fn(),
      onQueued: vi.fn(),
    })).resolves.toEqual({ kind: "queued" });
    expect(submit).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
