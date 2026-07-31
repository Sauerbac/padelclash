export const PULL_THRESHOLD = 72;
export const MAX_PULL_DISTANCE = 128;

export type PullPhase = "idle" | "pulling" | "ready";

export interface PullPoint {
  x: number;
  y: number;
}

export interface PullState {
  phase: PullPhase;
  start: PullPoint | null;
  distance: number;
}

export const IDLE_PULL_STATE: PullState = {
  phase: "idle",
  start: null,
  distance: 0,
};

export function beginPull(start: PullPoint, isAtTop: boolean): PullState {
  if (!isAtTop) return IDLE_PULL_STATE;

  return { phase: "pulling", start, distance: 0 };
}

export function movePull(state: PullState, current: PullPoint): PullState {
  if (state.start === null) return state;

  const rawDistance = current.y - state.start.y;
  if (rawDistance <= 0) return IDLE_PULL_STATE;

  // Claim only a predominantly vertical gesture. Rankings owns horizontal
  // swipes for its table and must not lose them to a small downward wobble.
  if (Math.abs(current.x - state.start.x) >= rawDistance) {
    return IDLE_PULL_STATE;
  }

  // Resistance keeps the indicator attached to the finger without letting the
  // whole screen travel indefinitely. The threshold remains based on the
  // physical gesture, so users do not need an exaggerated swipe.
  const distance = Math.min(MAX_PULL_DISTANCE, rawDistance * 0.65);
  return {
    phase: rawDistance >= PULL_THRESHOLD ? "ready" : "pulling",
    start: state.start,
    distance,
  };
}

export function finishPull(state: PullState): {
  state: PullState;
  shouldRefresh: boolean;
} {
  return {
    state: IDLE_PULL_STATE,
    shouldRefresh: state.phase === "ready",
  };
}
