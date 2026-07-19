import { PlayerLink } from "@/components/player-link";
import { cn } from "@/lib/utils";
import type { CompanionRecord } from "@/services/matches";

/**
 * W–L per companion (design "RecordTable") — one component for head-to-head
 * ("GRUDGE LIST", red label) and doubles partners (muted label). W–L reads
 * gold when winning, red when losing, muted when even. Omitted when empty.
 */
export function RecordTable({
  title,
  tone = "muted",
  records,
}: {
  title: string;
  tone?: "primary" | "muted";
  records: CompanionRecord[];
}) {
  if (records.length === 0) return null;
  return (
    <section>
      <h2
        className={cn(
          "section-label mb-2",
          tone === "primary" && "text-primary",
        )}
      >
        {title}
      </h2>
      <ul>
        {records.map((r) => (
          <li
            key={r.playerId}
            className="flex items-center justify-between border-b border-hairline py-2 text-[17px] font-semibold uppercase last:border-b-0"
          >
            <PlayerLink playerId={r.playerId}>{r.name}</PlayerLink>
            <span
              className={cn(
                "font-mono text-sm font-medium",
                r.wins > r.losses
                  ? "text-accent"
                  : r.wins < r.losses
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {r.wins}–{r.losses}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
