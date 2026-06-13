# Module structure — design reference

How the monolith is layered, from Session C of the architecture grilling (2026-06-13). Realizes [ADR-0008](../adr/0008-test-strategy.md)'s framework-free core. One Next.js app, one Docker image, deployed on Coolify.

## The boundary: single app, lint-enforced

One Next.js project — **not** a monorepo. The framework-free core is a *folder* (`src/domain/`), and an **ESLint boundary rule** forbids it from importing `next`, `drizzle`, or `src/db`. CI fails on a violation, so the barrier is real without pnpm-workspace overhead. The same mechanism fences `src/ui/` (the presentational design-system kit) off from `services`, `db`, and `domain` — see [the five layers](#the-five-layers) — so the two pure leaves of the app are both lint-guaranteed, not merely conventional. Rejected: workspace packages (`packages/core` + `apps/web`) — a structurally harder wall, but monorepo tooling a solo project would carry forever. If the core is ever shared (mobile app, public SDK), promoting `src/domain/` to a package is a mechanical move done *then*.

## The five layers

```
src/
├── domain/      pure: rating engine, projections, result discriminated-union, policy rules
│                  → NO imports of next, drizzle, or src/db (lint-enforced)
│                  → tested in milliseconds, no DB (ADR-0008 tiers 1–2)
├── services/    application layer: owns transactions, calls domain, reads/writes via src/db
│                  → the ONLY layer that knows both the domain and the database
│                  → e.g. logMatch(input) = write match + replay + rewrite projections, one tx
├── db/          Drizzle schema + repository adapters
├── ui/          presentational primitives: the design-system kit (Button, Tag, StatTile,
│                  PlayerChip, RatingDelta, WinProbability, MatchResultBlock, …)
│                  → NO imports of next, services, db, or domain (lint-enforced)
│                  → plain view-model props only (<RatingDelta value={14} />), never a
│                    domain entity → renders in isolation (styleguide, snapshot tests)
│                  → consumes design tokens only; no raw hex/px (ADR-0009)
└── app/         Next.js: routes + Server Actions (thin). The ONLY place data meets
                   presentation: a route calls services, maps results to view-model props,
                   composes ui primitives. Screens compose only ui + layout.
```

Dependency direction: `app → { services, ui }`, `services → { domain, db }`, and both `domain` and `ui` depend on nothing of the others. `domain` and `ui` are the two pure leaves — one is logic with no framework, the other is presentation with no data. Neither knows the other exists; `app` (route components) is the seam that maps domain results into `ui` view-model props.

## The mutation path

- **Server Actions** handle the app's own mutations (log match, confirm, contest, create group, claim). A Server Action is a thin shell: parse/validate input → call a `services` function → return the result.
- **Route Handlers** are reserved for real HTTP surfaces: Better Auth endpoints, Resend webhooks, the future public read API (feature 17), v2 PWA push-subscription endpoints.

### Replay orchestration lives in `services/`

The transaction is the dangerous part, so it lives in exactly one place per mutation. `services.logMatch(input)`:

1. validate
2. open DB transaction
3. insert `match` + `match_participant` (source of truth)
4. invoke the pure replay engine over the group's stream (`src/domain`)
5. `DELETE` + bulk-insert the group's `rating_history` + `current_rating` (projection)
6. commit

This is fully unit-testable without Next.js, and it keeps ADR-0008's boundary honest: the domain stays pure, the action stays thin, the transaction has one home.
