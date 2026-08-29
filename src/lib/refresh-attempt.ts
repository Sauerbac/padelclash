import { createSlowConnectionClock } from "./slow-connection";

export type RefreshAttemptPhase = "idle" | "refreshing" | "poor-connection";

export type RefreshAttemptState = {
  phase: RefreshAttemptPhase;
  committedMarker: string | undefined;
  startedFromMarker?: string;
};

export function createRefreshAttemptState(
  committedMarker: string | undefined,
): RefreshAttemptState {
  return { phase: "idle", committedMarker };
}

export function beginRefreshAttempt(state: RefreshAttemptState): {
  state: RefreshAttemptState;
  shouldRequest: boolean;
} {
  if (state.phase !== "idle") return { state, shouldRequest: false };

  return {
    state: {
      phase: "refreshing",
      committedMarker: state.committedMarker,
      startedFromMarker: state.committedMarker,
    },
    shouldRequest: true,
  };
}

export function commitRefreshMarker(
  state: RefreshAttemptState,
  committedMarker: string | undefined,
): RefreshAttemptState {
  if (state.phase === "idle") {
    return committedMarker === state.committedMarker
      ? state
      : createRefreshAttemptState(committedMarker);
  }

  return committedMarker !== state.startedFromMarker
    ? createRefreshAttemptState(committedMarker)
    : state;
}

export function markRefreshAttemptSlow(
  state: RefreshAttemptState,
): RefreshAttemptState {
  return state.phase === "refreshing"
    ? { ...state, phase: "poor-connection" }
    : state;
}

export function createRefreshAttemptCoordinator({
  initialMarker,
  onPhaseChange,
  onRequest,
  onCommitPulse,
}: {
  initialMarker?: string;
  onPhaseChange: (phase: RefreshAttemptPhase) => void;
  onRequest: () => void;
  onCommitPulse: () => void;
}) {
  let state = createRefreshAttemptState(initialMarker);
  let slowClock: ReturnType<typeof createSlowConnectionClock> | null = null;
  let commitPulse: ReturnType<typeof setInterval> | null = null;
  const completionListeners = new Set<() => void>();
  const pulse = () => onCommitPulse();
  const replacePulse = (delay: number) => {
    if (commitPulse) clearInterval(commitPulse);
    commitPulse = setInterval(pulse, delay);
  };

  return {
    begin() {
      const begun = beginRefreshAttempt(state);
      if (!begun.shouldRequest) return false;

      state = begun.state;
      onPhaseChange(state.phase);
      slowClock = createSlowConnectionClock({
        onSlow: () => {
          const next = markRefreshAttemptSlow(state);
          if (next === state) return;
          state = next;
          onPhaseChange(state.phase);
          replacePulse(1_000);
        },
      });
      slowClock.start();
      // Next's optimized router transition can remain parked after its RSC
      // response. Pulses let React commit ready work; only acknowledge() ends
      // the attempt, so a response that has not committed stays pending.
      replacePulse(250);
      onRequest();
      return true;
    },

    acknowledge(marker: string) {
      const wasRefreshing = state.phase !== "idle";
      const next = commitRefreshMarker(state, marker);
      if (next === state) return;
      state = next;
      if (!wasRefreshing || state.phase !== "idle") return;

      slowClock?.dispose();
      slowClock = null;
      if (commitPulse) clearInterval(commitPulse);
      commitPulse = null;
      completionListeners.forEach((listener) => listener());
      onPhaseChange("idle");
    },

    subscribeToCompletion(listener: () => void) {
      completionListeners.add(listener);
      return () => completionListeners.delete(listener);
    },

    dispose() {
      slowClock?.dispose();
      if (commitPulse) clearInterval(commitPulse);
      slowClock = null;
      commitPulse = null;
      completionListeners.clear();
    },
  };
}
