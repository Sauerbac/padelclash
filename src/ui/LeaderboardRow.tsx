import { cx } from "./cx";
import { PlayerChip, type AvatarColor } from "./PlayerChip";
import { RatingDelta } from "./RatingDelta";

type LeaderboardRowProps = {
  rank: number;
  name: string;
  rating: number;
  avatarColor?: AvatarColor;
  /** Signed rating change since last match — the one place green/red appears. */
  delta?: number;
  /** Movement on the board. Ink only — never coloured (binding §8). */
  trend?: "up" | "down" | "flat";
  /** The viewing Player's own row: the single orange accent, in place. */
  you?: boolean;
  /** Hasn't played enough competitive matches to hold a Rank. */
  unranked?: boolean;
  /** e.g. "1 of 3" — shown instead of a rank number when unranked. */
  unrankedLabel?: string;
  className?: string;
};

const TREND_GLYPH: Record<NonNullable<LeaderboardRowProps["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "–",
};

// Density rule (binding §8): high-density lists use borders-as-dividers, never
// per-row elevation. A flat ~56px row with one 2px ink divider. "Alive" comes
// from trend + delta, not shadows. The viewing Player's own row is the lone
// exception — orange border + colored shadow, in place.
export function LeaderboardRow({
  rank,
  name,
  rating,
  avatarColor = "teal",
  delta,
  trend,
  you = false,
  unranked = false,
  unrankedLabel,
  className,
}: LeaderboardRowProps) {
  return (
    <div
      className={cx(
        "flex min-h-14 items-center gap-3 px-3 py-2",
        you
          ? // mr/mb reserve the offset-shadow box so it never causes h-scroll on
            // mobile (binding §9).
            "mr-1.5 mb-1.5 rounded-card border-bold border-primary bg-primary-soft shadow-primary"
          : "border-b-2 border-ink",
        unranked && "opacity-70",
        className,
      )}
    >
      <span
        className={cx(
          "w-9 flex-none font-mono text-meta font-bold tabular-nums",
          unranked ? "text-secondary" : "text-ink",
        )}
      >
        {unranked && unrankedLabel ? unrankedLabel : `#${rank}`}
      </span>

      <span className="min-w-0 flex-1">
        <PlayerChip name={name} avatarColor={avatarColor} />
      </span>

      <span className="flex flex-none items-center gap-2">
        {trend && (
          <span
            className="font-mono text-meta font-bold text-ink"
            aria-hidden
          >
            {TREND_GLYPH[trend]}
          </span>
        )}
        {delta !== undefined && <RatingDelta value={delta} />}
        <span className="w-12 text-right font-display text-title tabular-nums text-ink">
          {rating}
        </span>
      </span>
    </div>
  );
}
