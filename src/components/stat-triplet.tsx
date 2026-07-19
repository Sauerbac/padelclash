import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string;
  /** Extra classes for the value, e.g. "text-primary" for the rank. */
  valueClassName?: string;
}

/** Three-up stat band (design "StatTriplet"): Anton values over muted labels. */
export function StatTriplet({ stats }: { stats: [Stat, Stat, Stat] }) {
  return (
    <div className="flex divide-x border">
      {stats.map((stat) => (
        <div key={stat.label} className="flex-1 py-3.5 text-center">
          <div
            className={cn(
              "font-display text-[28px] leading-tight",
              stat.valueClassName,
            )}
          >
            {stat.value}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold tracking-[2px] text-muted-foreground uppercase">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
