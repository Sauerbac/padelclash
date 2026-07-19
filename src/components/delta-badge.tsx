import { Badge } from "@/components/ui/badge";

/**
 * A rating-delta chip — mono "NAME +12" with a win-green or ember-red
 * outline. The sign comes from the ROUNDED value so a −0.3 delta reads
 * "+0", never "−0".
 */
export function DeltaBadge({
  delta,
  children,
}: {
  delta: number;
  /** Optional prefix inside the chip, e.g. the player's name on feed cards. */
  children?: React.ReactNode;
}) {
  const rounded = Math.round(delta);
  return (
    <Badge variant={rounded >= 0 ? "win" : "loss"}>
      {children}
      {rounded >= 0 ? "+" : "−"}
      {Math.abs(rounded)}
    </Badge>
  );
}
