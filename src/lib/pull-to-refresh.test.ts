import { describe, expect, it } from "vitest";
import {
  beginPull,
  finishPull,
  movePull,
  PULL_THRESHOLD,
} from "./pull-to-refresh";

describe("pull-to-refresh gesture", () => {
  it("requests a refresh after a downward pull crosses the threshold", () => {
    const started = beginPull({ x: 40, y: 120 }, true);
    const pulled = movePull(started, {
      x: 42,
      y: 120 + PULL_THRESHOLD,
    });

    expect(pulled.phase).toBe("ready");
    expect(finishPull(pulled)).toMatchObject({ shouldRefresh: true });
  });

  it("settles without refreshing when the pull is too short", () => {
    const started = beginPull({ x: 40, y: 120 }, true);
    const pulled = movePull(started, {
      x: 42,
      y: 120 + PULL_THRESHOLD - 1,
    });

    expect(pulled.phase).toBe("pulling");
    expect(finishPull(pulled)).toEqual({
      state: { phase: "idle", start: null, distance: 0 },
      shouldRefresh: false,
    });
  });

  it("does not start away from the top of the app scroller", () => {
    const started = beginPull({ x: 40, y: 120 }, false);

    expect(movePull(started, { x: 40, y: 240 })).toEqual(started);
    expect(finishPull(started).shouldRefresh).toBe(false);
  });

  it("cancels a pull when the finger reverses above its starting point", () => {
    const started = beginPull({ x: 40, y: 120 }, true);
    const pulled = movePull(started, { x: 40, y: 200 });

    expect(movePull(pulled, { x: 40, y: 110 })).toEqual({
      phase: "idle",
      start: null,
      distance: 0,
    });
  });

  it("leaves a mostly horizontal swipe to horizontally scrollable content", () => {
    const started = beginPull({ x: 40, y: 120 }, true);

    expect(movePull(started, { x: 120, y: 135 })).toEqual({
      phase: "idle",
      start: null,
      distance: 0,
    });
  });
});
