import { cx } from "./cx";

type Side = {
  /** One name (singles) or two (doubles). */
  players: string[];
  won?: boolean;
};

type MatchResultBlockProps = {
  sideA: Side;
  sideB: Side;
  /** Per-set scores like ["6-4", "7-5"], or a single points total. */
  score?: string[];
  casual?: boolean;
  className?: string;
};

function SideRow({ side }: { side: Side }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cx(
          "truncate",
          side.won
            ? "font-display text-title text-ink"
            : "font-body text-body font-bold text-secondary",
        )}
      >
        {side.players.join(" & ")}
      </span>
      {side.won && (
        <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
          W
        </span>
      )}
    </span>
  );
}

// Compact match summary (binding §7 tracer-bullet subset). Ink/paper only — the
// winner is carried by type weight + a "W" marker, never colour (green/red is
// reserved for rating deltas, binding §8). Cards stay straight (binding §8).
export function MatchResultBlock({
  sideA,
  sideB,
  score,
  casual = false,
  className,
}: MatchResultBlockProps) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 bg-surface p-4",
        "rounded-card border-bold border-ink shadow-resting",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {casual && (
          <span className="w-fit rounded-tag border-mid border-ink bg-violet px-2 py-0.5 font-mono text-meta font-bold uppercase tracking-wide text-ink">
            Casual
          </span>
        )}
        <SideRow side={sideA} />
        <SideRow side={sideB} />
      </div>

      {score && score.length > 0 && (
        <div className="flex flex-none items-center gap-2">
          {score.map((set, i) => (
            <span
              key={i}
              className="rounded-chip border-mid border-ink bg-paper px-2 py-1 font-mono text-body font-bold tabular-nums text-ink"
            >
              {set}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
