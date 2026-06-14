Status: ready-for-human

## What to build

Extract the neo-brutalist design tokens from `docs/ui/ds/` into a Tailwind v4 `@theme` block in `src/app/globals.css`. Activate the two lint fences: no literal style values (raw hex, raw px/rem, Tailwind arbitrary-value brackets) in `src/ui/` or `src/app/`, and the import boundary rules. Build the `/dev/styleguide` route rendering the tracer-bullet UI subset at real mobile viewport. Build the primitives: `Button` (primary/secondary/confirm/disabled/icon), `TextInput`, `PlayerChip`, `RatingDelta`, `MatchResultBlock` (compact), `LeaderboardRow`, plus the `app`-layer app-shell (tab bar / navigation chrome). Validate each at 360px and 375px.

## Acceptance criteria

- [x] `@theme` block in `globals.css` contains every color, type, edge, elevation, spacing, and tilt value from the design-system binding
- [x] No raw hex, px, or arbitrary-value bracket exists in `src/ui/` or `src/app/` (lint rejects them) — verified rejecting a probe with hex + both bracket forms
- [x] `/dev/styleguide` renders every primitive in all variants
- [x] Each primitive passes mobile validation at 360px and 375px (no horizontal scroll from shadow offset) — shadow offset reserved as margin (container `px-6` > 8px hero shadow; my-row `mr/mb`); **HITL:** a human eyeball at 360/375 is the final visual confirmation
- [x] Touch targets ≥44px (`min-h-11` on buttons/inputs, `min-h-14` tab bar) — reaction-pill hit-slop is a Bucket-1 concern, not in this tracer subset
- [x] `prefers-reduced-motion: reduce` disables tilt/wobble (globals.css base layer; verified in compiled CSS)
- [x] Deltas display `+`/`−` sign alongside color (never color alone) — `RatingDelta` pairs sign + fill + border

## Done this session

Implemented (2026-06-14). All code in place; `npm run lint`, `npm run typecheck`, and `npm run build` are green.

- **Tailwind v4 wired:** `tailwindcss@4` + `@tailwindcss/postcss` + `postcss.config.mjs`. Fonts via `next/font/google` (Archivo Black / Space Grotesk / Space Mono) exposed as `--font-archivo/grotesk/space-mono` and bound in `@theme`.
- **Tokens (`src/app/globals.css`):** full `@theme` block — colors (paper/ink/primary/accents/semantic/meta tints), type scale + line-heights, radii, offset + colored shadows, 4px spacing grid. Border weights (2/2.5/3/4) and tilt/wobble as custom `@utility` classes (no Tailwind theme namespace for them). Reduced-motion base rule stills tilt + wobble.
- **Primitives (`src/ui/`):** `Button`, `TextInput`, `PlayerChip` (default/you/unclaimed/provisional/former-member), `RatingDelta`, `MatchResultBlock` (compact), `LeaderboardRow` (dense + my-row accent + unranked) + `cx` helper + barrel. Token-only, view-model props, RSC-compatible.
- **App-shell:** `src/app/_shell/TabBar.tsx` (`'use client'`, Link + usePathname), mounted in the root layout.
- **Styleguide:** `src/app/dev/styleguide/` — every primitive in all variants, fluid mobile column, noindex, `notFound()` in production (dev-only).
- **Lint fence:** `NO_LITERAL_STYLE_VALUES` no-restricted-syntax rules over `src/ui` + `src/app` (hex / px-rem / arbitrary brackets, literals + template strings) + inline-`style` ban in `src/app`. Tooling choice (no `eslint-plugin-tailwindcss`) recorded in `docs/open-questions/04-ds-lint-fence-mechanism.md`.

**Gotcha for next time:** a stale `.next/` from slice 01 (built before Tailwind existed) served unprocessed CSS — `rm -rf .next` before the first build after adding the PostCSS plugin.

**Simon's next steps:** run `npm run dev`, open `/dev/styleguide`, and eyeball the kit at 360px and 375px (DevTools device toolbar) to close the visual-validation box.

## Blocked by

- 01-skeleton-deploy-pipeline
