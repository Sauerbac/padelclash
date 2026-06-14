import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

type TextInputProps = {
  label?: string;
} & InputHTMLAttributes<HTMLInputElement>;

// A single straight, bordered field (binding §8 — inputs never tilt). The label
// is mono uppercase meta in text-secondary for AA contrast (binding §9).
export function TextInput({ label, id, className, ...rest }: TextInputProps) {
  return (
    <label className="flex flex-col gap-2">
      {label && (
        <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
          {label}
        </span>
      )}
      <input
        id={id}
        className={cx(
          "min-h-11 w-full bg-surface px-3.5 py-3 font-body text-body font-bold text-ink",
          "rounded-button border-bold border-ink",
          "placeholder:text-disabled-ink focus:outline-none focus:shadow-button",
          className,
        )}
        {...rest}
      />
    </label>
  );
}
