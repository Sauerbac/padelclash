# English-first UI, with i18n-ready externalized strings from day one

Decided by Simon, 2026-06-12. The UI ships in **English** now. Every user-facing string is **externalized from day one** so the app is internationalization-ready without a retrofit; a **German translation lands when real users want it**, not before.

The driver is audience: a group can grow to ~100 (club scale, see [CONTEXT.md](../../CONTEXT.md)), and Simon's own circle may want German eventually — but translating before there is demand is wasted work. Externalizing strings is cheap if done from the start and expensive to retrofit, so the readiness is built in while the second language is not.

## Consequences

- No hardcoded user-facing copy in components; strings live in a message catalog from the first screen.
- English is the only shipped locale until demand for another appears; adding German (or any locale) is then a translation task, not a refactor.
- This pairs with the stack choice ([ADR-0010](0010-stack-and-platform.md)) — string externalization is part of the initial Next.js app structure, not a later layer.
