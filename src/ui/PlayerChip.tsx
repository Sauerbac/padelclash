import { cx } from "./cx";

export type AvatarColor = "teal" | "violet" | "butter" | "primary";
type PlayerVariant = "default" | "former-member" | "unclaimed" | "provisional";

type PlayerChipProps = {
  name: string;
  rating?: number;
  rank?: number;
  variant?: PlayerVariant;
  avatarColor?: AvatarColor;
  /** The viewing Player's own chip — the one orange accent. */
  you?: boolean;
  className?: string;
};

// Static class strings so Tailwind's scanner sees every accent (no dynamic
// interpolation). Accents are player identity, used sparingly (binding §8).
const AVATAR_BG: Record<AvatarColor, string> = {
  teal: "bg-teal",
  violet: "bg-violet",
  butter: "bg-butter",
  primary: "bg-primary",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

// A small mono status tag. Tilt is accent-only (binding §8) — passed in per use.
function StatusTag({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={cx(
        "font-mono text-meta font-bold uppercase tracking-wide",
        "rounded-tag border-mid border-ink px-2 py-0.5",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function PlayerChip({
  name,
  rating,
  rank,
  variant = "default",
  avatarColor = "teal",
  you = false,
  className,
}: PlayerChipProps) {
  const former = variant === "former-member";

  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span
        className={cx(
          "flex size-11 flex-none items-center justify-center font-display text-title text-ink",
          "rounded-tag border-bold border-ink",
          variant === "unclaimed"
            ? "border-dashed bg-surface text-secondary"
            : AVATAR_BG[avatarColor],
          former && "opacity-60",
        )}
        aria-hidden
      >
        {initials(name)}
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span
            className={cx(
              "truncate font-display text-title",
              former ? "text-secondary" : "text-ink",
            )}
          >
            {name}
          </span>
          {you && (
            <span className="tilt-new">
              <StatusTag label="You" tone="bg-primary text-ink" />
            </span>
          )}
          {variant === "unclaimed" && (
            <StatusTag label="Unclaimed" tone="bg-violet text-ink" />
          )}
          {variant === "provisional" && (
            <StatusTag label="Prov" tone="bg-butter text-ink" />
          )}
          {former && <StatusTag label="Former" tone="bg-surface text-secondary" />}
        </span>

        {(rating !== undefined || rank !== undefined) && (
          <span className="flex items-center gap-2 font-mono text-meta font-bold uppercase tracking-wide text-secondary">
            {rank !== undefined && <span>#{rank}</span>}
            {rating !== undefined && <span>{rating}</span>}
          </span>
        )}
      </span>
    </span>
  );
}
