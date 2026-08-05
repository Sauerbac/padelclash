# PadelClash — Architecture and operations

Technology choices, application boundaries, production topology, deployment, backup, and disaster recovery.

This file is one part of the [PadelClash specification](../padelclash-spec.md).

## Stack & hosting

| Layer | Choice |
|---|---|
| Language | TypeScript end-to-end |
| Framework | Next.js monolith (fresh `create-next-app` scaffold), `output: standalone` Docker |
| UI | **shadcn/ui** on Tailwind v4 — components copied into the repo, themed via CSS variables. No custom primitive system. |
| Database | PostgreSQL |
| DB access | Drizzle ORM |
| Auth | Server-managed Device Bindings + one admin credential; no user accounts — Better Auth dropped |
| Email | **none** — Resend dropped |
| Hosting | Simon's Coolify instance |
| Language/UI | English, hardcoded — no i18n layer |

Production is one self-contained Coolify Docker Compose resource: one app
container and one private PostgreSQL container with a named persistent volume.
There is exactly one steady-state app process. PostgreSQL is reachable only on
the Compose network and the app is reachable only through Coolify's HTTPS proxy.
See [the deployment runbook](../coolify-deployment.md) and
[ADR 0002](../adr/0002-bundle-postgresql-with-the-application.md).

The scaffold, deploy plumbing (Dockerfile, compose, CI), and configs are **rebuilt
from scratch** on this branch — nothing config-level is inherited from the old app.

Suggested tables: `players`, `device_bindings`, `onboarding_invitations`,
`matches`, `match_participants`, `rating_history`, and `current_rating`.
`match_participants` represents exactly one identity variant per row: either a
Player reference or a match-scoped Guest Name. Constraints enforce that exclusive
choice and the service validates the cross-row Side size and Guest participation
rules. Database constraints also enforce normalized Player Name uniqueness, at
most one active binding per Player, at most one valid Personal Link per Player,
and at most one valid General Link for the circle.
`rating_history` contains only Player participants; its Rating before/delta/after
columns and `current_rating.rating` are integers. There are no Guest, shared
Guest, or user-account tables.

## What carries over from the old app

Only these, restated here as live decisions:

- `src/domain/rating/` keeps its framework-free pure-step/replay architecture,
  golden and property test strategy, stable total ordering, projection outputs,
  and `rankMap()` boundary. The new Rating formula deliberately replaces the
  old constants, equal Side-delta split, and fixtures.
- The test strategy: fast pure-domain tests first (vitest, milliseconds, no
  infrastructure), real-DB integration tests where persistence matters.
- The layering rule: `domain/` stays framework-free, persistence in `services/`,
  UI in `app/`/`components/`.
- Terminology for the concepts that survive (Player, Match, Side, Set Score,
  Simple Result, Logger, Rating, Rank, Ranked/Unranked, Leaderboard), plus the secure
  onboarding terms defined in the root `CONTEXT.md`.

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 8 | 2026-07-11 | Stack | Keep Next.js + Postgres + Drizzle on Coolify |
| 16 | 2026-07-11 | Build location | New branch `lite-rewrite` in this repo, wiped to a clean slate; `main` is the archive |
| 17 | 2026-07-11 | Scaffold | Fully fresh — deploy plumbing, CI and configs rebuilt, nothing config-level inherited |
| 18 | 2026-07-11 | UI system | shadcn/ui from the start; the old custom UI philosophy is dropped |
| 74 | 2026-07-22 | Coolify topology | Production is one Docker Compose resource containing one app container and one PostgreSQL 17 container. PostgreSQL is private, persists in a named volume, and the app is exposed only through Coolify's HTTPS proxy |
| 75 | 2026-07-22 | Process topology | Production has exactly one steady-state app process. In-process rate limits deliberately do not coordinate across replicas; brief old/new overlap during a compatible deployment is acceptable, but horizontal scaling is not supported |
| 76 | 2026-07-22 | Release policy | Production deploys are manual after CI passes. Coolify waits for the database-aware health check; stdout/stderr and Coolify health are the initial observability boundary, while external telemetry and fixed resource limits are deferred |
| 77 | 2026-07-22 | Migration and rollback policy | The container applies committed Drizzle migrations before starting Next. Normal migrations remain compatible with deployment overlap; destructive migrations require a fresh database dump, and application code is never blindly rolled back across a schema change |
| 78 | 2026-07-22 | Backups | The match log is irreplaceable, so PostgreSQL creates a daily custom-format dump and retains 30 daily generations on the VPS. An encrypted Windows PC catches up every missing dump over SSH/SFTP whenever it is online, retains 90 daily plus 12 monthly generations, never mirrors remote deletion, and warns when its newest copy is older than 7 days. The phone is not a required backup target. The internal Coolify backup path is discovered at deployment rather than hard-coded, and preserving only the Docker volume is not disaster recovery |
| 79 | 2026-07-22 | Production secrets | Coolify generates and preserves the database password. `ADMIN_PASSWORD` is a runtime-only secret of at least 20 characters, kept in Coolify and a password manager; missing or weaker production configuration fails startup, and changing the admin password deliberately invalidates admin sessions |
| 84 | 2026-07-22 | Build assets | Keep generated PNG manifest icons and the existing build-time Google Font downloads. Coolify and CI therefore need outbound build access; all resulting font assets are self-hosted by the built application at runtime |
| 136 | 2026-08-04 | Supplemental Admin download | Admin can download a backup through the application as a convenience, but this does not replace the automated off-VPS backup requirement or weaken its retention and staleness checks |
| 137 | 2026-08-04 | One recovery format | The Admin download is the same PostgreSQL custom-format full-database dump used by automated backups, not a human-readable or application-specific JSON export. Backup inspection, validation, and restoration use PostgreSQL tooling |
| 138 | 2026-08-04 | Download authorization | Any valid Admin session may download a backup without re-entering the Admin password. This accepts the bulk-export capability because the same session already grants access to all private data and destructive management operations |
| 139 | 2026-08-04 | Fresh Admin snapshot | Each Admin download generates a fresh point-in-time dump from the live database. The application does not list, reuse, or depend on the automated backup store or Coolify's internal backup path |
| 140 | 2026-08-04 | Validate before delivery | The application writes the fresh dump to request-scoped temporary storage, accepts it only when `pg_dump` succeeds and PostgreSQL can read its archive catalogue, then serves it and removes the temporary artifact. Normal reads and writes continue during generation; this validation detects failed, empty, truncated, or unreadable archives but does not replace a full disposable restore test |
| 141 | 2026-08-04 | Restore stays outside the app | The running Admin UI never uploads or applies a backup. Recovery is a separate, guided operator procedure so the application does not replace the database to which its own request, connection pool, and Admin session are attached |
| 142 | 2026-08-04 | Empty-database disaster recovery | Production restore exists only for recovery after a full server loss. It restores into a fresh PadelClash deployment with an empty PostgreSQL database; it is not an undo mechanism and never overwrites a functioning production database |
| 143 | 2026-08-04 | Restore backed-up access state | Disaster recovery preserves the dump's Device Bindings and Onboarding Links rather than revoking them after restore. Still-bound installations can continue working, with the accepted consequence that access revoked after the backup point is restored too |
| 144 | 2026-08-04 | Guided one-time recovery | Full-server recovery may require one-time command-line or SSH access. A repository-owned command validates the selected archive, refuses a target containing PadelClash data, restores into the fresh PostgreSQL database as one transaction, and leaves normal application startup to apply newer migrations and rebuild derived Rating projections. Recovery does not have to fit inside Coolify's UI |
| 145 | 2026-08-04 | Bounded dump execution | The production app image carries PostgreSQL 17 `pg_dump` and `pg_restore`, matching the database major version. A same-origin Admin-only POST starts at most one dump at a time, never places the database password in command arguments or logs, uses private request-scoped ephemeral storage, applies a bounded runtime, removes artifacts after every handled outcome, and purges stale request artifacts left by a hard process termination before a later generation |
| 146 | 2026-08-04 | Sensitive but unencrypted archive | The application does not add its own backup password or encryption format: HTTPS protects delivery and the Admin is warned to keep the dump only on encrypted device storage. This avoids making disaster recovery depend on another application-managed secret. The server records neither “last downloaded” nor “successfully backed up,” because completing an HTTP response cannot prove that the browser retained the file |
| 148 | 2026-08-04 | Restore compatibility and proof | Recovery accepts only a trusted PadelClash custom-format archive and PostgreSQL 17 tooling, restores schema, migration history, data, Device Bindings, and Onboarding Links, then runs the current application version at least as new as the backed-up deployment. Successful `pg_restore` is necessary but insufficient: migrations, Rating projection rebuild, `/api/health`, Admin login, roster, Match history, and the newest expected Match are checked before recovery is declared complete. `ADMIN_PASSWORD` remains a separately recovered Coolify/password-manager secret because it is not stored in the database |
| 149 | 2026-08-04 | Connection parser runtime boundaries | PostgreSQL URL-to-libpq parsing remains separately implemented in the TypeScript service bundled by Next and the standalone `.mjs` recovery command. Sharing it would couple the operator command to the application bundle or make Next trace outside its service boundary; matching fixtures in both test suites enforce behavioral parity instead |
