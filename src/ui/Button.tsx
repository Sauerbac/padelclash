import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "confirm" | "icon";

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Brutalist buttons: 3px ink border + hard offset shadow. min-h-11 keeps every
// variant at the ≥44px touch target (binding §9). Tilt is never applied — buttons
// stay straight (binding §8).
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-ink font-display rounded-button border-bold border-ink shadow-button px-6",
  secondary:
    "bg-surface text-ink font-body font-bold rounded-button border-bold border-ink shadow-button px-6",
  confirm:
    "bg-teal text-ink font-display rounded-button border-bold border-ink shadow-button px-6",
  icon: "bg-primary text-ink rounded-button border-bold border-ink shadow-button w-14",
};

export function Button({
  variant = "primary",
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  // The disabled look is its own treatment (a muted pill, no shadow) — it wins
  // over the variant regardless of which was requested.
  const look = disabled
    ? "bg-surface text-disabled-ink font-body font-bold rounded-pill border-mid border-disabled px-6 cursor-not-allowed"
    : VARIANTS[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-11 items-center justify-center text-title select-none",
        "active:translate-x-px active:translate-y-px",
        look,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
