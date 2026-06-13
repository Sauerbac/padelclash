# Stack & platform — a Next.js TypeScript monolith, self-hosted on Coolify

Decided by Simon, 2026-06-12 (platform in the morning session, stack in a follow-up grill the same day). PadelClash ships first as a **web app optimized for mobile** — responsive, mobile-first layouts, quick-log designed for a phone courtside. **v2 upgrades it to a PWA** (installable, web push). Building web-first keeps the PWA upgrade a packaging step, not a rewrite.

The stack is a single TypeScript full-stack monolith:

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** end-to-end | Simon's ecosystem of choice; one language for the whole monolith |
| Framework | **Next.js** (full-stack monolith) | Largest ecosystem/component libraries for a mobile-first UI; self-hosts cleanly as a Docker container (`output: standalone`); the PWA upgrade is config |
| Database | **PostgreSQL** | One-click service on Coolify; handles match-log replay ([ADR-0001](0001-ratings-derived-by-replay.md)), tournament writes, and future search |
| DB access | **Drizzle ORM** | TS-first schema-in-code, SQL-like queries, lightweight migrations |
| Auth | **Better Auth** | First-class email+password with verification, Drizzle adapter, and **Google sign-in from v1** |
| Transactional email | **Resend** | Verification/claim/critical emails; free tier covers this scale; mail delivery is the one thing not worth self-hosting |
| Hosting | **Simon's own Coolify instance** | Docker deploys, fixed cost, EU data residency, no serverless constraints |

## Consequences

- **Push notifications arrive with the v2 PWA upgrade.** Until then the in-app inbox — plus email for the few critical prompts — carries [feature 12](../../features/12-notifications.md).
- **Google sign-in is in v1**, not deferred (upgraded from the original "deferred" call). Other social providers remain config-level additions later. See [feature 01](../../features/01-user-accounts-and-profiles.md).
- **Invite/claim links work in a plain web app**, so the bootstrap onboarding flow ([ADR-0004](0004-guests-are-unclaimed-players.md)) is unaffected by the web-first choice.
- **No serverless constraints.** A long-lived container on a strong server means the synchronous materialized projection ([ADR-0007](0007-synchronous-materialized-projection.md)) and replay-on-write rating model carry no cold-start or execution-time penalty.
- UI strings are externalized from day one — see [ADR-0011](0011-english-first-i18n-ready.md).
