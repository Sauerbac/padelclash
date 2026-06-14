# Open question 04 — how is the literal-style-value fence enforced?

**Raised:** 2026-06-14, during slice 05 (ds-tokens-styleguide-primitives).
**Status:** decided autonomously for now; revisit if the fence proves leaky.

## The question

`design-system-binding.md` §3.1 specs the no-literal-style-values fence as
"`eslint-plugin-tailwindcss` (no-arbitrary-value) + a custom no-restricted-syntax
rule for hex/px in `className`/JSX." Which mechanism do we actually ship?

## Decision

**No-restricted-syntax only — `eslint-plugin-tailwindcss` is NOT installed.**

Reasons:
- As of this slice `eslint-plugin-tailwindcss` has no stable flat-config / Tailwind
  **v4** release; wiring it against v4's CSS-first `@theme` (no JS config to point
  it at) is unreliable.
- A small set of `no-restricted-syntax` selectors covers all three banned forms
  in one mechanism, on both string literals and template strings:
  raw hex (`#F6601A`), raw px/rem (`3px`, `1.5rem`), and arbitrary-value brackets
  (`bg-[#fff]`, `border-[3px]`). See `NO_LITERAL_STYLE_VALUES` in
  `eslint.config.mjs`. Plus a `JSXAttribute[name.name='style']` ban in `src/app`
  (the §4 computed-geometry carve-out lives in `src/ui`).
- Verified rejecting a real violation file (hex + both bracket forms) during the
  slice.

## Known limits (why this might be revisited)

- The fence matches *any* string literal in `src/ui` / `src/app`, so a stray hex
  in non-className text (e.g. copy) is also rejected. Acceptable — desirable, even
  — but worth knowing.
- It does not validate that a Tailwind class references a real token (a typo like
  `bg-inkk` lints clean and just renders nothing). If that bites, add
  `eslint-plugin-tailwindcss` once its v4 support lands, layered on top.
