# Deploy PadelClash Lite to Coolify

This is the application-specific production runbook for PadelClash Lite. It
assumes Coolify, its VPS, repository connection, DNS, proxy and HTTPS use their
normal configuration. The decisions are settled; unchecked items describe the
remaining implementation or operator work before launch.

## Production shape

- One private repository deployed manually from `lite-rewrite` after CI passes.
- One production environment and no initial staging environment.
- One Docker Compose resource containing the app and PostgreSQL 17.
- One steady-state app process; horizontal scaling is unsupported.
- PostgreSQL is private inside the Compose network and persists in a named
  volume.
- Only the app is reachable through Coolify's HTTPS proxy on container port
  3000. Neither service exposes a host-wide port.
- The app applies committed Drizzle migrations before Next starts and becomes
  routable only after its database-aware health check succeeds.
- Daily PostgreSQL-aware backups leave the VPS before real Match history is
  entrusted to the deployment.

The topology trade-off is recorded in
[ADR 0002](./adr/0002-bundle-postgresql-with-the-application.md).

## Implementation readiness

- [x] Convert `docker-compose.yml` to the production Compose resource: generated
  database password, private PostgreSQL, named volume, restart policies and
  health checks.
- [x] Move development-only host ports and credentials to a Compose override.
- [x] Run migrations in an explicit container entrypoint before starting Next.
- [x] Validate required production configuration at startup and reject a missing
  or shorter-than-20-character `ADMIN_PASSWORD`.
- [x] Add the agreed low-complexity security headers and `noindex` policy.
- [x] Rework and test the versioned service-worker shell so cold offline launch
  and offline Match queueing meet decisions 81–82 without broad private-page
  caching.
- [x] Persist only the bound Player identity and active roster needed for cold
  offline Match entry; clear that snapshot when revocation is observed.
- [x] Correct or remove stale UI documentation, especially `docs/ui/join-bind.md`.
- [x] Add and locally verify append-only backup pull, PostgreSQL 17 archive
  validation, independent retention/staleness reporting and disposable restore
  tooling.
- [x] Add and verify the Admin-only fresh database download, including
  PostgreSQL 17 client tools, bounded temporary-file handling and gallery states.
- [x] Add and verify the production disaster-recovery command: PostgreSQL 17,
  empty-target refusal, single-transaction restore and current-app startup.
- [x] Stop passing `DATABASE_URL` in the fallback `pg_dump` process arguments;
  use libpq environment variables and rerun the backup-tool integration tests.
- [ ] Configure and test the off-VPS backup path described below.
- [x] Complete the local automated, Docker/Compose and headless-browser
  verification gate.
- [ ] Push the verified work and confirm the repository CI passes.

## Production variables

| Variable | Source | Rule |
|---|---|---|
| PostgreSQL password | Coolify-generated Compose magic variable | Keep stable while the database volume exists; never commit it |
| `DATABASE_URL` | Assembled inside Compose from the generated password and private PostgreSQL hostname | Runtime only |
| `ADMIN_PASSWORD` | Secret of at least 20 characters stored in Coolify and a password manager | Runtime only; rotation invalidates all Admin sessions |

No production secret is needed during `docker build`. The existing Google Font
imports do require outbound network access during the build.

## Backup contract

The backup is a PostgreSQL custom-format logical dump, not a copy of the live
volume. It must:

1. run daily;
2. retain 30 daily generations on the VPS;
3. be copied off the VPS to an encrypted Windows PC;
4. be encrypted in transit and at rest at its destination;
5. retain enough generations to recover from unnoticed corruption or an
   accidental destructive edit; and
6. be restored into a disposable PostgreSQL instance at least once before the
   backup process is considered proven.

There are two complementary ways to obtain that same archive:

- **Automated recovery baseline:** PostgreSQL creates daily generations on the
  VPS and the encrypted Windows PC catches up every missing generation over
  SSH. After the one-time configuration, this needs no manual SSH session for
  each backup.
- **Admin convenience copy:** `Download backup` creates a fresh, validated dump
  for the current browser. It neither reads the scheduled dump directory nor
  replaces the automated schedule, retention, stale-copy warning or disposable
  restore test.

The full accepted design, including failure and security analysis, is in
[Admin database backup and disaster recovery](./design/admin-database-backup-and-recovery.md).

The PC runs a catch-up pull over SSH/SFTP at sign-in, when networking becomes
available, and daily while it is running. It copies every remote dump that is
missing locally; it never mirrors remote deletions. It retains 90 daily and 12
monthly generations and reports when the newest successfully verified local
copy is more than 7 days old. The pull validates that each file is non-empty and
readable by PostgreSQL 17's `pg_restore --list` before calling it successful.
The PC destination must use BitLocker, Windows Device Encryption or an
equivalent encrypted filesystem. A phone may hold an extra encrypted manual
copy but is not part of the required schedule.

Prefer Coolify's local scheduled PostgreSQL backup when the deployed Compose
database is recognized as a database service. Coolify's internal storage path
is not an application contract and must not be hard-coded in the repository:
discover and record the actual export path during deployment. If the installed
Coolify version cannot schedule that service database, use an explicit
`pg_dump --format=custom --no-acl --no-owner` job with the same retention and
pull contract. The pull account should have read-only access to the export
directory rather than general Docker or root access when practical.

The database's named volume is useful for persistence across deploys, but does
not count as a backup because VPS loss removes it and the local dump spool
together.

Before any destructive or backward-incompatible migration, create and verify a
fresh manual dump regardless of the normal schedule.

### Admin convenience download

An authenticated Admin may request a fresh
`padelclash-YYYYMMDDTHHMMSSZ.dump` from the final section of `/admin`. The app
creates it with PostgreSQL 17 client tools, validates it before delivery, and
removes its private temporary artifact afterward. The browser receives it over
HTTPS with no-store response headers.

The file contains the complete private database, including Device Binding
hashes and readable Onboarding Link tokens. It has no additional application
password or encryption layer, so it belongs only on an encrypted device. The
app deliberately records no last-download time: a server response cannot prove
that the browser kept the file.

### Repository backup tooling

The scripts under `scripts/backups/` implement the repository side of this
contract. They do not contain a VPS hostname, export path, Windows destination
or key path.

If Coolify recognizes the Compose PostgreSQL service, use its PostgreSQL-aware
scheduled backup and discover its actual export directory on the deployed VPS.
If it does not, run the fallback with PostgreSQL 17 client tools from a trusted
VPS-side scheduler:

```sh
export DATABASE_URL='postgresql://...runtime-only...'
export BACKUP_DIRECTORY='/the/export/path/discovered-on-this-vps'
sh scripts/backups/create-postgres-backup.sh
```

The fallback writes a custom-format archive through a `.partial` file, validates
it with `pg_restore --list`, then retains the 30 newest strict PadelClash dump
names. `BACKUP_DIRECTORY` is mandatory and deliberately has no repository
default.

On the encrypted Windows PC, first install OpenSSH Client. Install PostgreSQL 17
client tools and pass `-PgRestorePath`, or leave it unset to validate through the
local `postgres:17-alpine` Docker image. Test a one-off catch-up pull before
registering the schedule:

```powershell
./scripts/backups/Pull-PadelClashBackups.ps1 `
  -RemoteHost 'backup-host.example' `
  -SshUser 'padelclash-backup' `
  -RemoteDirectory '/path/discovered-during-deployment' `
  -IdentityFile 'C:\Keys\padelclash-backup' `
  -Destination 'D:\EncryptedBackups\PadelClash'
```

The pull downloads every missing `padelclash-*.dump` through SSH, never mirrors
remote deletion, validates before removing the `.partial` suffix, retains 90
daily plus 12 monthly local generations, and exits with code 2 when the newest
verified local generation is more than 7 days old. The SSH account should have
read-only access to this one export directory.

Prove one generation with the disposable restore helper:

```powershell
./scripts/backups/Test-PadelClashRestore.ps1 `
  -Archive 'D:\EncryptedBackups\PadelClash\padelclash-YYYYMMDDTHHMMSSZ.dump'
```

It validates the archive, creates a randomly named ephemeral PostgreSQL 17
container, restores into a new `padelclash_restore` database, then stops the
container. It has no production database target and must not be repurposed as
one.

### Full-server recovery

Production recovery is only for a lost server and a fresh empty database. It is
not an Admin-panel operation and not an undo mechanism. Use a trusted archive
from this installation and PostgreSQL 17 client tools; catalogue readability is
not proof that an untrusted archive is safe.

1. Provision the replacement PostgreSQL 17 service and empty `padelclash`
   database. Configure the new private connection and a separately recovered
   `ADMIN_PASSWORD`, but keep the application stopped.
2. On a trusted machine with Node.js and PostgreSQL 17 client tools, make the
   private target reachable and select the verified archive. Prefer the newest
   generation from before the loss unless logical corruption requires an older
   one.
3. Run the repository-owned command. Keep the connection string in the
   environment, not on its command line:

   ```sh
   DATABASE_URL='postgresql://...fresh-target...' \
     node scripts/backups/restore-padelclash.mjs \
     /secure/path/padelclash-YYYYMMDDTHHMMSSZ.dump
   ```

   The command requires PostgreSQL 17, validates the custom archive catalogue,
   refuses a non-empty application target, restores with
   `--single-transaction --no-owner --no-acl`, and runs `ANALYZE` only after the
   restore commits. A restore error leaves the previously empty target empty.
4. Start the current application version, which must be at least as new as the
   backed-up deployment. Startup applies newer migrations and rebuilds Rating
   projections from the Match log.
5. Require HTTP 200 and `{"status":"ok"}` from `/api/health`. Log in as Admin,
   inspect the roster and Match history, and verify the newest Match expected at
   the selected recovery point.
6. Revoke again any Device Binding or Onboarding Link that was revoked after
   the backup point.
7. Reconfigure the daily VPS dump and Windows catch-up pull, create and pull a
   fresh generation, and run `Test-PadelClashRestore.ps1` against it.

The dump restores Device Bindings and Onboarding Links exactly as they existed.
Access revoked after the chosen backup point returns and must be revoked again
when relevant. `ADMIN_PASSWORD` is not in PostgreSQL and must be recovered from
the password manager/Coolify configuration separately; the new PostgreSQL
runtime password may differ from the lost server's password.

After the destination encryption and SSH key are confirmed, register sign-in,
daily and network-available catch-up triggers from an elevated PowerShell:

```powershell
./scripts/backups/Register-PadelClashBackupTasks.ps1 `
  -RemoteHost 'backup-host.example' `
  -SshUser 'padelclash-backup' `
  -RemoteDirectory '/path/discovered-during-deployment' `
  -IdentityFile 'C:\Keys\padelclash-backup' `
  -Destination 'D:\EncryptedBackups\PadelClash'
```

Run both registered tasks manually once and inspect Task Scheduler history.
Task registration, the real paths/account/key, destination encryption and the
Coolify backup schedule remain operator steps.

### Local artifact verification (baseline 2026-07-22; backup recovery 2026-08-04)

- [x] Fresh PostgreSQL 17 volume migrated before Next started; the app became
  healthy and returned healthy again after restart.
- [x] The production Compose expansion has a named database volume and no host
  port for either service; the development override owns local ports.
- [x] Missing/weak production secrets fail before database migration or Next
  startup.
- [x] Manifest, generated worker, PNG icons, robots and security/referrer
  headers returned the expected local production responses.
- [x] Headless Chromium proved unbound authorization, onboarding, normal Match
  logging, bounded offline snapshot, cold offline queueing, reconnection,
  duplicate-id sync, worker replacement and revocation cleanup.
- [x] Disposable PostgreSQL 17 fixtures proved multi-generation catch-up,
  remote rotation without local deletion, corrupt/empty rejection, staleness
  detection and full restore.
- [x] Admin backup service and route tests proved authorization/origin refusal,
  one-process admission, bounded shell-free PostgreSQL calls, sanitized errors,
  strict response headers, and artifact cleanup after delivery or cancellation.
- [x] The fallback dump tests proved the connection string is absent from
  `pg_dump` arguments and removed from its inherited environment name.
- [x] A disposable PostgreSQL 17 recovery exercise proved non-empty refusal, transactional
  rollback on forced restore failure, `ANALYZE`, current-app startup, Rating
  projection rebuild, health, roster, and Match-history inspection.

These checks prove the repository artifact. They do not check the boxes below
that require the real domain, VPS, scheduled PC job or physical installed PWA.

## First deployment

1. Complete every implementation-readiness item.
2. Run `npm ci`, `npm run lint`, `npm test`, and `npm run build` locally.
3. Push the verified commit and wait for CI, including the Docker-image job.
4. Create the Coolify Docker Compose resource from `lite-rewrite`.
5. Set the strong `ADMIN_PASSWORD`; leave generated database values stable.
6. Configure the HTTPS domain and confirm PostgreSQL has no public domain or
   host port.
7. Configure the off-VPS backup schedule and run the initial restore test.
8. Trigger deployment and watch PostgreSQL health, migrations and app health.

## Production verification

- [ ] `/api/health` returns HTTP 200 with `{"status":"ok"}` over HTTPS.
- [ ] `/manifest.webmanifest`, `/sw.js`, and every manifest icon return HTTP 200
  with the expected content type.
- [ ] The app is inaccessible over plain HTTP except for the HTTPS redirect.
- [ ] PostgreSQL has its named volume and no public exposure.
- [ ] An unbound browser cannot read private circle data.
- [ ] Player onboarding, Admin login and Match logging work in a normal browser.
- [ ] Desktop Chromium downloads an actual Admin backup with the strict
  `padelclash-YYYYMMDDTHHMMSSZ.dump` filename. Repeat with a representative
  production-size archive and watch browser memory because the current
  fetch/Blob path buffers the archive before triggering the object-URL click.
- [ ] A failed/repeated offline sync cannot create a duplicate Match.
- [ ] Revoking a Device Binding clears private caches on its next online contact.
- [ ] The latest scheduled dump exists off the VPS and restores successfully.
- [ ] Deleting/rotating a VPS dump does not delete the PC copy on its next pull.
- [ ] A PC that was offline for several days catches up every retained dump.
- [ ] The PC warns when its newest verified dump is more than 7 days old.

### iOS installed PWA

- Install from Safari using Share → Add to Home Screen.
- [ ] From both Safari and the installed PWA, download an actual Admin backup
  and confirm that the asynchronous Blob/object-URL click opens or saves the
  complete archive with the strict `padelclash-YYYYMMDDTHHMMSSZ.dump` filename.
  This remains a physical-device check; desktop/headless Chromium is not a
  substitute.
- Confirm the binding survives opening the installed app.
- Verify the tab bar, dialogs, keyboard and safe-area spacing.
- After one successful online launch, reopen offline and queue a Match; reconnect
  and confirm it syncs once.

### Android installed PWA

- Install using Chrome's browser install flow.
- Confirm the binding survives opening the installed app.
- Verify 360 px and 412 px layouts, keyboard behavior, the bottom tab bar,
  dialogs, and system Back navigation.
- After one successful online launch, reopen offline and queue a Match; reconnect
  and confirm it syncs once.

## Update and rollback procedure

1. Run the local verification gate and review new migrations.
2. Push and wait for CI.
3. For a destructive migration, make and verify a fresh manual database dump.
4. Trigger the Coolify deployment manually.
5. Confirm migration completion and `/api/health` before opening the PWA.
6. Launch once online on each installed platform so it receives the current
   service-worker shell.

Do not blindly roll application code back across a database migration. First
confirm the older code is compatible with the migrated schema or restore the
corresponding database backup as part of a deliberate recovery.

## Initial observability boundary

Application and migration messages go to stdout/stderr. Coolify container state
and the database-aware health check are the initial monitoring surface. External
telemetry and fixed CPU/memory limits are deferred until real usage shows a need.
