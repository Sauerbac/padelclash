import { cx } from "./cx";

type RatingDeltaProps = {
  /** Signed rating change, e.g. 14 or -13. */
  value: number;
  className?: string;
};

// The ONE place green/red appears (binding §8). Colour never carries meaning
// alone: the +/− sign and the filled, bordered pill carry it too, so the delta
// reads for colour-blind users (binding §9). Bold mono keeps the borderline
// ink-on-fill contrast legible.
export function RatingDelta({ value, className }: RatingDeltaProps) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  const tone =
    value > 0
      ? "text-win bg-win-fill border-win"
      : value < 0
        ? "text-loss bg-loss-fill border-loss"
        : "text-ink bg-paper border-ink";

  return (
    <span
      className={cx(
        "inline-flex items-center font-mono text-meta font-bold tabular-nums",
        "rounded-tag border-mid px-3 py-1",
        tone,
        className,
      )}
    >
      {sign}
      {Math.abs(value)}
    </span>
  );
}
