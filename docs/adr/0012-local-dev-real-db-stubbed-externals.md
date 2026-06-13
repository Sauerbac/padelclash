# Local dev runs on a real Dockerized Postgres with external services stubbed

Decided by Simon, 2026-06-13 (a `/grill-with-docs` session on local setup). A
fresh clone must go from zero to a running, DB-backed app with **no secrets to
obtain**. Local development therefore runs against a **real Postgres** (the one
thing too lossy to fake — replay, `numeric`, `jsonb`, transactions must behave
exactly as in prod) provisioned by Docker Compose, while the two **external SaaS
dependencies — Resend (email) and Google (OAuth) — degrade to dev-safe stubs**
when their keys are absent.

Rejected: requiring real Resend + Google credentials to boot (makes the project
un-bootable for an agent and a chore for a new contributor); faking the database
with SQLite or an in-memory store (the rating engine's correctness rests on real
Postgres semantics — a fake DB would pass tests that prod would fail); a remote
shared dev database (reintroduces secrets and network coupling, the opposite of
the goal). The cost we accept is a Docker dependency for local dev and a small
amount of stub/adapter code that only runs locally.

## Consequences

- **Postgres comes from `docker-compose.yml`** (`db` service, `postgres:16`,
  persistent volume) — local only; production stays Coolify-managed
  ([ADR-0010](0010-stack-and-platform.md)). Dev is pinned to match the intended
  prod major ([open-question 01](../open-questions/01-prod-postgres-version.md)).
- **`npm run setup`** is the one-shot bootstrap: `.env` from template → compose
  up → migrate. Migrations are **manual locally** (deliberate, especially after
  `db:generate`) but **automatic on container boot** in prod — there's no human
  in the loop there.
- **Email is built behind an `EmailSender` port** from [slice 06](../../.scratch/tracer-bullet/issues/06-auth-fresh-player.md):
  a Resend adapter for deployed environments, a console adapter (prints
  verification/claim links to the server log) selected when `RESEND_API_KEY` is
  absent. Callers never branch on environment.
- **Google sign-in is conditional on its credentials being present**, so the
  primary local auth path is email+password. This is a deliberate dev-time
  narrowing of the v1 "Google from day one" scope (ADR-0010), not a reversal.
- **`.env.example` is the contract**: `DATABASE_URL` (and `BETTER_AUTH_SECRET`
  from slice 06) are required and the app fails loud without them; Resend and
  Google vars are optional and blank by default.
- **Seed data and the Tier-3 integration test follow the same posture** — the
  seed builds on the real services write path (so it exercises the replay
  engine, not raw projection inserts), and the one Postgres-backed test
  ([ADR-0008](0008-test-strategy.md)) runs against a separate `padelclash_test`
  database on the same compose instance.
