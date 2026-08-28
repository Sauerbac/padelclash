export function createLatestAttemptGate() {
  let generation = 0;
  return {
    start() {
      const attempt = ++generation;
      return {
        publish(run: () => void) {
          if (attempt === generation) run();
        },
        cancel() {
          if (attempt === generation) generation += 1;
        },
      };
    },
  };
}
