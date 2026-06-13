# Design-system binding — from visual spec to code that can't drift

How PadelClash's neo-brutalist design system (the frozen origin spec in [`docs/ui/ds/`](../ui/ds/)) becomes live, enforced code. From **Session E** of the architecture grilling (2026-06-13). This doc is the single page a builder reads before writing any UI: where tokens live, where primitives live, what keeps them honest, what's designed when, and the design rules the cards don't state.

The chain, in one line:
**tokens in `@theme` ([ADR-0009](../adr/0009-tailwind-v4-tokens-as-source-of-truth.md)) → primitives in `src/ui/` ([module-structure](./module-structure.md)) → lint fence + living styleguide guardrails → claude.ai frozen, code wins.**

---

## 1. Source of truth — tokens in `@theme`

Every value lives once in a Tailwind v4 `@theme` block in `src/app/globals.css`. That block *is* the CSS-variable layer: declaring `--color-ink: #17120D` yields both the `bg-ink`/`border-ink` utilities and `var(--color-ink)`. **No raw hex or px value exists anywhere else.** Extracting the inline-style values from the six `.dc.html` cards into this block is the first DS-binding task. The values to extract:

- **Color.** `paper #F7EFE6`, `ink #17120D`, `primary #F6601A` (orange). Accents (sparing, player/data identity): `teal #1FB9A6`, `violet #7B6CF6`, `butter #F5C518`. Semantic, **rating deltas only**: `win #0E7A43` / `win-fill #D5F0DF`, `loss #D42A1E` / `loss-fill #FBDAD6`. Text: `text #17120D`, `text-secondary #5a5043` (use for all small meta — see §9 a11y), `text-muted #8a7f70` (**large/display sizes only**).
- **Type.** `font-display: 'Archivo Black'` (titles, names, the big number), `font-body: 'Space Grotesk'` 400–700 (UI, sentences, buttons), `font-mono: 'Space Mono'` 400/700 (numbers, scores, ALL-CAPS meta). Scale: display 42–60 / heading 24–26 / title 17–20 / body 15–17 / meta 10–13 caps.
- **Edges.** Border weights `2 / 2.5 / 3 / 4`px (always `ink`). Radii `8` score-chips / `13` buttons / `16–20` cards / `30` pills / `40` device-frame.
- **Elevation** (zero blur, solid ink, offset): `shadow-resting: 3px 3px 0`, `shadow-raised: 5px 5px 0`, `shadow-hero: 8px 8px 0`. Colored-shadow variants (`5px 5px 0 var(--color-primary)` etc.) flag special cards — upsets, rivalries, confirm panels, my-row.
- **Spacing.** 4px base grid; steps `8 · 12 · 18 · 24 · 30`.
- **Tilt** (accents only, never structure): sticker range `−5°…+2°`, logo wobble `±5°`.

---

## 2. Where primitives live — the `src/ui/` layer

Primitives are a dedicated, lint-fenced layer (`src/ui/`), the second pure leaf of the app alongside `src/domain/`. Full rules in [module-structure.md](./module-structure.md#the-five-layers). Essentials:

- **Pure & presentational.** `src/ui/` may **not** import `services`, `db`, `domain`, or `next` — the **one exception is `next/image`**. Primitives take **plain view-model props** (`<RatingDelta value={14} />`), never a domain entity.
- **Client components are fine.** Interactive primitives (`TextInput`, `SegmentedToggle`, `BottomSheet`) are `'use client'`; they still only take props and never fetch.
- **The seam is `app`.** Route components (server) call `services`, map results to view-model props, and compose `ui` primitives. Screens compose only `ui` + layout.
- **App shell / tab-bar are `app`-layer, not `ui`.** Navigation chrome is inherently route-aware (`Link`, `usePathname`), so it lives in `src/app/` layout and is *composed from* `ui` primitives — it is not itself a primitive. This keeps the `ui` fence strict.

---

## 3. Guardrails against drift

Two layers, both from the first DS PR.

**Lint fence (CI-gated, same machinery as the domain boundary):**
1. **No literal style values** in `src/ui/` or `src/app/`: ban raw hex colors, raw px/rem, **and Tailwind arbitrary-value brackets** (`border-[3px]`, `shadow-[…]`, `bg-[#…]`). Via `eslint-plugin-tailwindcss` (no-arbitrary-value) + a custom no-restricted-syntax rule for hex/px in `className`/JSX. Allowlist: a small, commented set of genuinely computed values (§4).
2. **Import boundaries:** `ui` ✗ `services`/`db`/`domain`/`next` (except `next/image`); `domain` ✗ `ui`/`db`/`next`.
3. **No inline `style={{…}}`** in `src/app/` screens (everything goes through tokens/primitives).

**Living styleguide — `/dev/styleguide`:** an in-app route rendering every `ui` primitive in all variants with fake props — the in-code twin of the `.dc.html` cards, but with the real tokens, real fonts, at a real mobile viewport. Catches the *semantic* drift a linter can't ("the Pending tag lost its tilt"). Chosen over Storybook: zero new tooling, and it validates at true mobile size. Dev-only / noindex in prod.

**Visual snapshot tests: deferred.** Highest-maintenance, lowest-yield right now. Add Playwright snapshots *against `/dev/styleguide`* later if drift actually bites.

---

## 4. The one inline-`style` carve-out

`ui` primitives may use `style` **only for computed numeric geometry** — the win-probability bar's split width, a graph point's x/y, a progress fill. **Never** for color, border, radius, shadow, or spacing (those are always tokens). Each use is commented. This is the allowlist the lint rule in §3.1 honors.

---

## 5. claude.ai/design relationship — frozen, code wins

Per ADR-0009 there is exactly one source of truth, so the claude.ai export is the **origin spec, now frozen** (see [`docs/ui/ds/README.md`](../ui/ds/README.md)). The living visual catalog is `/dev/styleguide`. claude.ai may be used as a *sketchpad* for exploring a new screen, but the moment a decision is real it lands in `@theme`/`src/ui/`, and **code wins any disagreement**. No ongoing `design-sync` into the codebase. (Optional later: push `/dev/styleguide` renders *up* as a shareable catalog — a nice-to-have, not pipeline.)

---

## 6. Light mode only — by decision

The system is **light-only**. No dark mode, no speculative alias tokens (we don't abstract for a feature we've declined). If ever reversed, the remap is scoped to two values (`paper`, `ink`), the two delta fills, and a shadow-color rethink — but that is out of scope, not deferred work.

---

## 7. Primitive inventory — the DS's definition of done

Three buckets. The DS is "done" when Buckets 1–2 are built and styleguide-rendered; Bucket 3 lands per-consumer.

| Bucket | Primitives | When |
|---|---|---|
| **1 — In the cards; extract & build** | `Button` (primary/secondary/confirm/disabled/icon), `Tag` (Ranked/Pending/Casual/score-chip/delta/streak), `StatTile`, `SegmentedToggle`, `TextInput`, `AttentionStrip`, `Logo` | M1 |
| **2 — M1-critical, NOT in the cards** | `PlayerChip` (rating/rank/former-member/unclaimed/provisional variants), `MatchResultBlock` (compact + full), `RatingDelta` (pill *is* specced), `WinProbability` (§8), `RatingGraph` (§8), `LeaderboardRow` / dense-list-row (§8) | M1 |
| **3 — Cross-cutting infra; design per first consumer** | `BottomSheet`/`Modal`, `Toast`, `LoadingSkeleton`, per-screen `EmptyState`, `ShareCard` | M2+ |

**Tracer-bullet subset (first `src/ui/` PR):** `Button`, `TextInput`, `PlayerChip`, `RatingDelta`, `MatchResultBlock` (compact), `LeaderboardRow`, and the `app`-layer app-shell. Everything else follows as screens arrive.

---

## 8. Design rules the cards don't state

The `.dc.html` cards only show *standalone* components. These rules govern composition and the un-specced M1 visualizations.

**Color discipline (the spine of the aesthetic):**
- **Green/red = rating deltas only.** Never decorative, never status, never data viz.
- **Orange = the one action / live-active state.** At most one orange *action* dominant per screen.
- **Teal / violet / butter = player & data identity, sparing.**
- **Structural data viz (win-prob, graph) spends no semantic color** — ink/paper + type weight carry it. This is why the two viz below are ink, not colored.

**Density rule (fixes leaderboard, match history, tournament standings, chemistry):**
> **Offset shadows are for hero / standalone cards. High-density lists use borders-as-dividers only — no per-row elevation.** Borders are the brand; shadows are what doesn't scale.
- Leaderboard: **Top 3** = full brutalist podium (#1 gets a colored shadow). **Ranks 4–N** = flat dense rows (~56px, single 2px ink divider, no per-row shadow/fill); "alive" comes from trend/delta colors + movement arrows, not elevation. **My row** = the one accent: orange border + colored shadow *in place*, plus a compact `you: #47 · 1124 · ↑` bar pinned to the bottom edge **only when my row is scrolled off-screen**. **Unranked** = lighter, muted, smaller, "1 of 3" in mono.

**Win probability** (`52%:48%`, retrospective `64%`, Chaos `87%:13%`) — one idiom everywhere: a horizontal **tug-of-war bar, ink fill (Side A) vs paper (Side B)**, hard ink border, 2.5px ink divider at the split, percentages in mono with the **favored side in Archivo Black**. No orange, no green/red — drama from type weight and the lopsided fill. Width is the §4 computed-style carve-out.

**Rating-over-time graph** (profile centerpiece) — a **brutalist line chart, not an analytics chart**: 3px **ink** line (orange permitted only for "my" rating on my own profile), **straight segments** (no bezier), **no gradient fill**, hairline ink axes + mono labels, minimal/no gridlines. Point markers thinned at high match counts; **season rollovers = always-visible vertical ink breaks** with mono labels. Tapping a point opens a popover built from existing primitives (compact `MatchResultBlock` + `RatingDelta` pill) — the delta pill is where green/red appears.

**Tilt** is accent-only: stickers/badges/logo may tilt within range; **cards, inputs, buttons, tables, rows stay straight**.

---

## 9. Mobile & a11y — acceptance criteria for every primitive

A primitive isn't done until it passes these in `/dev/styleguide`:

- **Validate at 360px and 375px**, not just desktop. Offset shadows extend the visual box right/down — **layouts must reserve the shadow offset as margin** (≥ the shadow's px) so right-edge shadows don't cause horizontal scroll on mobile.
- **Touch targets ≥44px.** Buttons/rows already clear it; **reaction pills (~30px visual) need a ≥44px hit area** (hit-slop padding). Score/delta chips are display, not tap targets.
- **Contrast (WCAG AA):** small meta uses `text-secondary #5a5043` (~6.7:1) — **never `#8a7f70` (~3.3:1, fails)** below display size. Win/loss **delta inks on their fills are borderline (~4.0 / ~3.5:1)** — keep deltas **bold mono** and verify at build; darken the inks a notch if a check fails. Ink-on-orange (~5.1:1) and ink-on-paper (~15:1) pass.
- **`prefers-reduced-motion: reduce` disables** the logo/sticker wobble and the match-log celebration (fall back to a static delta reveal). Motion is never load-bearing for meaning.
- **Colorblind safety:** deltas always pair color with the `+/−` sign and the filled+bordered pill (already correct) — preserve this; never rely on red/green hue alone.

---

## 10. Definition of done

The design system is bound and live when: tokens are extracted into `@theme`; the lint fence (§3) is green in CI; `src/ui/` holds Buckets 1–2 (§7), each passing §9; `/dev/styleguide` renders them all; and `docs/ui/ds/` is marked frozen. After that, every new screen composes existing primitives — and a raw hex anywhere fails the build.
