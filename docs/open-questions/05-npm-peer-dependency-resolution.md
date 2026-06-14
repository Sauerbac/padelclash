# Open question 05 — how do we resolve Better Auth's peer-dependency conflict?

**Raised:** 2026-06-14, during slice 06 (auth-fresh-player).
**Status:** provisionally resolved with `.npmrc legacy-peer-deps=true`; awaiting Simon's ratification or a narrower fix.

## The question

Installing `better-auth` (1.6) errors under npm's strict peer resolver:

```
better-auth → peerOptional @tanstack/react-start → peerOptional vite >= 7
                                              ✗ vs
vitest 2 → vite ^5
```

`@tanstack/react-start` is an **optional** peer of Better Auth (it only matters if
you use Better Auth's TanStack Start integration — we don't), and the `vite>=7` it
wants collides with the `vite@5` that vitest 2 pins. We use neither
`@tanstack/react-start` nor that vite, so the conflict is spurious — but npm
`install`/`ci` still refuse to resolve it, which would break the Docker build's
`npm ci`.

How should the repo resolve this long-term?

## Decision (for now)

**`.npmrc` with `legacy-peer-deps=true`** — repo-wide, committed so local installs,
CI, and the Docker `npm ci` all resolve identically. Verified: `npm ci` succeeds and
all gates (lint, typecheck, unit, Tier-3) are green.

Cost: `legacy-peer-deps` disables peer-dependency checking across the **whole** tree,
not just this one edge — so a genuinely incompatible peer added later would install
silently instead of erroring. It is the bluntest of the available fixes.

## Alternatives, if the blunt fix bothers us

- **`overrides` in `package.json`** — pin/elide only the offending transitive, keeping
  strict peer checks everywhere else. More surgical; slightly more fragile (the pin
  must track version bumps).
- **Upgrade vitest to a vite@7-compatible line (vitest 3.x)** — removes the conflict at
  its root rather than silencing it. Cleanest end state, but a test-tooling major bump
  with its own (small) migration, so out of scope for an auth slice.

## Why it's safe to defer

This is a build-/tooling-resolution choice with **no runtime or app-code impact** — it
changes only how `node_modules` is assembled. Swapping `.npmrc` for `overrides` or a
vitest upgrade later is a mechanical change. Recommendation: revisit the next time test
tooling is touched; prefer the vitest upgrade if painless, otherwise narrow to
`overrides`, otherwise keep as-is.
