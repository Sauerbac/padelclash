import { afterEach, describe, expect, it, vi } from "vitest";
import { createSlowConnectionClock } from "./slow-connection";

describe("slow connection clock", () => {
  afterEach(() => vi.useRealTimers());

  it("announces poor connection at five seconds and uncertainty at fifteen", () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const onUncertain = vi.fn();
    const clock = createSlowConnectionClock({ onSlow, onUncertain });

    clock.start();
    vi.advanceTimersByTime(4_999);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSlow).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(9_999);
    expect(onUncertain).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onUncertain).toHaveBeenCalledOnce();
  });

  it("only lets the latest attempt publish timer transitions", () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const clock = createSlowConnectionClock({ onSlow });

    const first = clock.start();
    vi.advanceTimersByTime(4_000);
    const second = clock.start();
    first.finish();
    vi.advanceTimersByTime(1_000);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4_000);
    expect(onSlow).toHaveBeenCalledOnce();
    second.finish();
  });

  it("can accelerate the five-second fallback on a definite offline signal", () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const clock = createSlowConnectionClock({ onSlow });

    const attempt = clock.start();
    attempt.markDefinitelyOffline();

    expect(onSlow).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5_000);
    expect(onSlow).toHaveBeenCalledOnce();
  });
});
