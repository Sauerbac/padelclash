import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * A rating-delta pill — the payoff styling shared by the log/edit
 * confirmation and the feed cards. The sign comes from the ROUNDED value so
 * a −0.3 delta reads "+0", never "−0".
 */
export function DeltaBadge({
  delta,
  children,
}: {
  delta: number;
  /** Optional prefix inside the pill, e.g. the player's name on feed cards. */
  children?: React.ReactNode;
}) {
  const rounded = Math.round(delta);
  return (
    <Badge
      variant="secondary"
      className={cn(
        rounded >= 0
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      )}
    >
      {children}
      {rounded >= 0 ? "+" : "−"}
      {Math.abs(rounded)}
    </Badge>
  );
}
