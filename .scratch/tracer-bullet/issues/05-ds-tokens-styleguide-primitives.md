Status: ready-for-agent

## What to build

Extract the neo-brutalist design tokens from `docs/ui/ds/` into a Tailwind v4 `@theme` block in `src/app/globals.css`. Activate the two lint fences: no literal style values (raw hex, raw px/rem, Tailwind arbitrary-value brackets) in `src/ui/` or `src/app/`, and the import boundary rules. Build the `/dev/styleguide` route rendering the tracer-bullet UI subset at real mobile viewport. Build the primitives: `Button` (primary/secondary/confirm/disabled/icon), `TextInput`, `PlayerChip`, `RatingDelta`, `MatchResultBlock` (compact), `LeaderboardRow`, plus the `app`-layer app-shell (tab bar / navigation chrome). Validate each at 360px and 375px.

## Acceptance criteria

- [ ] `@theme` block in `globals.css` contains every color, type, edge, elevation, spacing, and tilt value from the design-system binding
- [ ] No raw hex, px, or arbitrary-value bracket exists in `src/ui/` or `src/app/` (lint rejects them)
- [ ] `/dev/styleguide` renders every primitive in all variants
- [ ] Each primitive passes mobile validation at 360px and 375px (no horizontal scroll from shadow offset)
- [ ] Touch targets ≥44px (reaction pills use hit-slop padding)
- [ ] `prefers-reduced-motion: reduce` disables tilt/wobble
- [ ] Deltas display `+`/`−` sign alongside color (never color alone)

## Blocked by

- 01-skeleton-deploy-pipeline
