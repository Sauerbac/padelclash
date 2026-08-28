export const POOR_CONNECTION_MS = 5_000;
export const UNCERTAIN_WRITE_MS = 15_000;

export interface SlowConnectionAttempt {
  finish(): void;
  markDefinitelyOffline(): void;
}

export function createSlowConnectionClock({
  onSlow,
  onUncertain,
}: {
  onSlow(): void;
  onUncertain?: () => void;
}) {
  let generation = 0;
  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  let uncertainTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (slowTimer) clearTimeout(slowTimer);
    if (uncertainTimer) clearTimeout(uncertainTimer);
    slowTimer = null;
    uncertainTimer = null;
  };

  return {
    start(): SlowConnectionAttempt {
      clear();
      const attempt = ++generation;
      let slowPublished = false;
      const publishSlow = () => {
        if (attempt !== generation || slowPublished) return;
        slowPublished = true;
        onSlow();
      };
      slowTimer = setTimeout(publishSlow, POOR_CONNECTION_MS);
      if (onUncertain) {
        uncertainTimer = setTimeout(() => {
          if (attempt === generation) onUncertain();
        }, UNCERTAIN_WRITE_MS);
      }
      return {
        finish() {
          if (attempt !== generation) return;
          clear();
        },
        markDefinitelyOffline() {
          if (attempt !== generation) return;
          if (slowTimer) clearTimeout(slowTimer);
          slowTimer = null;
          publishSlow();
        },
      };
    },
    dispose() {
      generation += 1;
      clear();
    },
  };
}
