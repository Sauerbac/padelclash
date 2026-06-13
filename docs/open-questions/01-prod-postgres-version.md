# 01 — Production Postgres major version

**Status:** open — to confirm when Coolify is set up (slice 01 deploy, still HITL).

Local dev pins **`postgres:16`** (`docker-compose.yml`). The Coolify instance's
Postgres major version isn't confirmed yet. Dev/prod drift on the database major
is a real footgun (collation, default types, `numeric`/`jsonb` behavior, replay
determinism), so when Coolify is provisioned:

- If Coolify offers a choice, pick **16** to match dev.
- If it pins a different major, change `docker-compose.yml` (and re-verify the
  slice 02 migration) so dev matches prod.

Until then, 16 is the assumed target. No code depends on a version-specific
feature today.
