import type { PayoffDelta } from "@/app/actions/matches";

/**
 * The celebration card after logging/editing (design "PayoffList"): gold
 * border, Anton title, then every participant's before → after rating.
 * Winners read bright, losers muted.
 */
export function RatingPayoff({
  title,
  subtitle = "Ratings have been updated. Screenshots encouraged.",
  deltas,
}: {
  title: string;
  subtitle?: string;
  deltas: PayoffDelta[];
}) {
  return (
    <section className="border border-accent px-4 pt-4 pb-1.5">
      <h2 className="font-display text-[26px] leading-none text-accent uppercase">
        {title}
      </h2>
      <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
        {subtitle}
      </p>
      <ul className="mt-2">
        {deltas.map((d) => {
          const rounded = Math.round(d.delta);
          const won = rounded >= 0;
          return (
            <li
              key={d.playerId}
              className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
            >
              <span
                className={`text-[17px] font-semibold uppercase ${won ? "" : "text-muted-foreground"}`}
              >
                {d.name}
              </span>
              <span className="font-mono text-sm font-medium text-muted-foreground">
                {Math.round(d.ratingBefore)} → {Math.round(d.ratingAfter)}{" "}
                <span className={won ? "text-win" : "text-destructive"}>
                  {won ? "+" : "−"}
                  {Math.abs(rounded)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
