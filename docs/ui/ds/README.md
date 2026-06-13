# Design-system origin snapshot — frozen

These six `*.dc.html` files (+ `support.js`) are a **claude.ai/design export**: the *origin* visual spec for PadelClash's neo-brutalist design system (Brand, Colors, Typography, Spacing, Components, Stickers). They were the starting point, and they remain a useful at-a-glance reference for the intended aesthetic.

**They are not the source of truth.** Per [ADR-0009](../../adr/0009-tailwind-v4-tokens-as-source-of-truth.md), the single source of truth for every token is the Tailwind v4 `@theme` block in the app; the living visual catalog is the in-app `/dev/styleguide` route rendering the real `src/ui/` primitives. See [design-system-binding.md](../../architecture/design-system-binding.md) for how the values here were extracted and how the kit is built and kept honest.

**Workflow:** treat this folder as a frozen snapshot. claude.ai/design may still be used as a *sketchpad* for exploring a new screen or variant, but the moment a visual decision is real it lands in `@theme` / `src/ui/`, and **code wins any disagreement** with these cards. Do not re-sync these files back over the code.
