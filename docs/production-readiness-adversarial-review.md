# Production-readiness adversarial review

Reviewed 2026-07-22 against the current repository, the production decisions in
`padelclash-lite-spec.md`, the Coolify deployment model, and the intended iOS
and Android installed-PWA behavior.

## Verdict

The decision set passes at the design level. No architectural decision needs to
be reversed before implementation. The application is **not yet production
ready**: the unchecked implementation and operator gates in
`coolify-deployment.md` remain mandatory.

## Challenges and dispositions

| Challenge | Disposition |
|---|---|
| A Compose-local database volume and local dumps both disappear with the VPS | Daily logical dumps catch up to an encrypted Windows PC; the VPS keeps 30 generations only as a spool |
| A PC may be offline at the scheduled backup time | Dump creation is VPS-side and independent; the PC copies every missing retained generation whenever it next comes online |
| Synchronization could propagate accidental/ransomware deletion | The PC job is append/catch-up, never a deletion mirror; PC retention is independent at 90 daily plus 12 monthly copies |
| Coolify's internal backup directory can change between versions | No internal path is committed. Deployment discovers/records the real export path or falls back to an explicit `pg_dump` job |
| A phone is small and convenient but unreliable in the background | A phone is optional manual encrypted storage, never the scheduled or sole off-VPS destination |
| A dump can exist but still be unusable | Pull verification includes non-empty/archive checks, and launch requires a full disposable restore test with PostgreSQL 17 |
| Bundled PostgreSQL makes blind rollback unsafe after migration | Normal migrations remain overlap-compatible; destructive migrations require a fresh dump, and rollback includes a deliberate schema/data recovery plan |
| Boot-time migration and in-memory throttling conflict with horizontal scaling | Production explicitly supports one steady-state app process; multi-replica operation is out of scope |
| A database-aware health check can make the app unavailable during DB maintenance | This is desired fail-closed behavior: private reads and writes must not run without the source-of-truth database |
| A weak admin password also weakens the derived Admin session secret | Production rejects passwords shorter than 20 characters; rotation intentionally invalidates existing sessions |
| Browser-native Android installation might need Android-specific application code | The manifest, PNG sizes and maskable icon meet the install surface; remaining work is installed-mode Android verification and documentation |
| No custom install prompt may make discovery less obvious | Accepted for the private-circle workflow; Admin-provided instructions and browser-native install UI are the deliberate v1 experience |
| Pre-caching `/` would persist credential-dependent private server output | `/` is not blindly pre-cached. The implementation uses a versioned offline shell and a deliberately bounded offline snapshot |
| Cold offline Match entry cannot work without private roster data | Decision 85 explicitly permits only the bound identity and active roster snapshot, cleared on observed revocation; Feed, ratings and profiles remain online-only |
| Service-worker updates can strand old HTML with missing hashed chunks | Cache versioning and an online post-deploy launch are required and tested on both installed platforms |
| Revocation cannot erase a device that remains offline forever | Already accepted by the identity model: the server blocks new access immediately and the client clears bounded cached state on its next contact |
| Build-time Google Font downloads create an external dependency | Accepted and covered by CI plus the Docker build; runtime serves the resulting local assets |
| Private pages and bearer invitation URLs could leak through indexing/referrers | The deployment is `noindex`, invitation surfaces send no referrer, and API/Admin/Onboarding routes are excluded from service-worker caches |

## Evidence already available

- `npm test`: 162 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed with outbound access for Google Fonts.
- The production Docker image builds successfully.
- The current code already has standalone Next output, a database-aware health
  route, secure production cookies, server-side authorization, idempotent
  client-generated Match ids, and generated 192/512/maskable manifest icons.

These checks establish a sound starting point; they do not waive any unchecked
gate in the deployment runbook.
