/** Exact signed integer display for persisted Rating deltas. */
export function formatRatingDelta(delta: number): string {
  return `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}`;
}
