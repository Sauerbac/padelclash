import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRefreshAttemptCoordinator,
  type RefreshAttemptPhase,
} from "./refresh-attempt";

function setup() {
  const phases: RefreshAttemptPhase[] = [];
  const onRequest = vi.fn();
  const onCommitPulse = vi.fn();
  const coordinator = createRefreshAttemptCoordinator({
    initialMarker: "render-1",
    onPhaseChange: (phase) => phases.push(phase),
    onRequest,
    onCommitPulse,
  });
  return { coordinator, phases, onRequest, onCommitPulse };
}

describe("pull-to-refresh attempt coordinator", () => {
  afterEach(() => vi.useRealTimers());

  it("finishes a fast refresh before the five-second slow state", () => {
    vi.useFakeTimers();
    const { coordinator, phases, onRequest } = setup();

    expect(coordinator.begin()).toBe(true);
    vi.advanceTimersByTime(100);
    coordinator.acknowledge("render-2");
    vi.advanceTimersByTime(5_000);

    expect(onRequest).toHaveBeenCalledOnce();
    expect(phases).toEqual(["refreshing", "idle"]);
    coordinator.dispose();
  });

  it("reports and retains a poor connection while no new render commits", () => {
    vi.useFakeTimers();
    const { coordinator, phases, onCommitPulse } = setup();

    coordinator.begin();
    vi.advanceTimersByTime(5_000);
    coordinator.acknowledge("render-1");
    vi.advanceTimersByTime(5_000);

    expect(phases).toEqual(["refreshing", "poor-connection"]);
    expect(onCommitPulse).toHaveBeenCalled();
    coordinator.dispose();
  });

  it("acknowledges a new render marker even when its projection is identical", () => {
    vi.useFakeTimers();
    const { coordinator, phases } = setup();

    coordinator.begin();
    coordinator.acknowledge("render-2");

    expect(phases.at(-1)).toBe("idle");
    coordinator.dispose();
  });

  it("does not issue an overlapping refresh request", () => {
    vi.useFakeTimers();
    const { coordinator, onRequest } = setup();

    expect(coordinator.begin()).toBe(true);
    expect(coordinator.begin()).toBe(false);

    expect(onRequest).toHaveBeenCalledOnce();
    coordinator.dispose();
  });
});
