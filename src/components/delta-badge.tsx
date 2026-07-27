import { Badge } from "@/components/ui/badge";
import { formatRatingDelta } from "@/lib/rating-format";

/**
 * A rating-delta chip — mono "NAME +12" with a win-green or ember-red
 * outline. Rating history is persisted as exact, non-zero integers.
 */
export function DeltaBadge({
  delta,
  children,
}: {
  delta: number;
  /** Optional prefix inside the chip, e.g. the player's name on feed cards. */
  children?: React.ReactNode;
}) {
  return (
    <Badge
      variant={delta >= 0 ? "win" : "loss"}
      className="max-w-full whitespace-normal break-words"
    >
      {children}
      {formatRatingDelta(delta)}
    </Badge>
  );
}
