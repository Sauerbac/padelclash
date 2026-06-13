# Tailwind v4 `@theme` is the single source of truth for every design-system value

The design system in [`docs/ui/ds/`](../ui/ds/) is a static visual spec — every color, font, border weight, radius, shadow and spacing step lives in inline styles on preview cards. The build needs one machine-readable home for those values that components reference and cannot drift from. We use **Tailwind v4's `@theme` block**: every DS token is declared there once, which simultaneously generates the utility classes (`bg-ink`, `border-ink`, `text-win`) and exposes the same value as a CSS variable (`var(--color-ink)`) for the few idioms utilities can't express. No raw hex or px value is permitted anywhere outside `@theme`. Decided 2026-06-13; applies to the whole `app` layer ([module-structure.md](../architecture/module-structure.md)).

## Considered Options

**Tailwind v4 `@theme` (chosen)** — In v4 the theme *is* the CSS-variable layer; there is no separate JS config to keep in sync with a hand-written `:root` block. The DS is a small, rigid, hard-edged token set (3 fonts, ~8 colors, 4 border weights, 5 radii, 3 shadow elevations, a 4px grid) with no gradients or blur — exactly what utilities express well. The genuinely custom idioms (the `3px 3px 0` zero-blur offset shadow, the −5°…+2° tilt) become *named* tokens (`shadow-resting`, `shadow-raised`, `shadow-hero`) rather than arbitrary per-component values. Tailwind purges unused CSS to near-zero, which serves the mobile-first / courtside performance constraint, and the build-fast DX matters for a solo developer shipping ten screens.

**Vanilla CSS Modules + hand-rolled CSS variables** — rejected. Pure and dependency-free, but every rule is hand-written and the utility velocity is lost. For a solo dev building the full screen inventory, this is slower with no offsetting benefit — the token discipline this ADR wants is achievable in Tailwind without giving up speed.

**Zero-runtime CSS-in-JS (vanilla-extract / Panda CSS)** — rejected. Genuinely strong for design systems and offers type-safe token access, but it adds ceremony and conceptual load (especially Panda) against a far smaller ecosystem, and runtime CSS-in-JS variants carry App Router / RSC friction. The type-safety upside is marginal for a token set this small and stable.

## Consequences

- **Tokens are declared once, in `@theme`.** A single CSS entry point (e.g. `src/app/globals.css`) holds the `@theme` block. This file is the literal realization of the six `*.dc.html` spec cards — extracting the inline-style values into named tokens is a discrete, one-time task (the first DS-binding issue).
- **Raw hex / px outside `@theme` is banned and lint-enforced.** Components read tokens only (`border-ink`, `shadow-raised`, `text-win`), never `#17120D`. The enforcement rule and its scope are specced separately, but this ADR is what makes that rule possible: there is exactly one legal place for a literal value.
- **The custom offset-shadow and tilt idioms are tokens, not magic numbers.** They live in `@theme` as named values so a component never re-types `3px 3px 0 #17120D`.
- **Reversal cost is high.** Every primitive and screen depends on the utility/token vocabulary, so switching styling approaches later is a full re-skin. This is accepted deliberately — the token *names* (semantic: `ink`, `paper`, `primary`, `win`, `loss`) are the stable contract, and a future re-platform would re-map names to a new engine rather than re-decide them.
