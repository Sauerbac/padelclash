# Admin database backup and disaster recovery

Status: accepted and implemented; repository verification is recorded in the
deployment runbook.

This design adds a convenient Admin download without weakening the existing
automated off-VPS backup contract. The accepted product decisions are 136–148
in the Lite spec.

## Two complementary paths

The automated path remains the recovery baseline:

1. PostgreSQL creates one custom-format dump each day.
2. The VPS retains 30 daily generations.
3. Windows Task Scheduler pulls every missing generation over SSH whenever the
   encrypted PC is available.
4. The PC validates each archive, retains 90 daily plus 12 monthly generations,
   and warns when the newest verified copy is more than seven days old.
5. The disposable restore test periodically proves more than archive
   readability.

The Admin path is deliberately smaller: pressing `Download backup` creates one
fresh archive and sends it to that browser. It does not read the scheduled
backup directory, create retention state, or prove that the browser kept the
file. It is a convenient extra copy, not the scheduled safety net.

## Admin experience

`Database backup` is the final section of `/admin`, after the roster. It contains:

- a warning that the dump contains all private PadelClash data and belongs on
  an encrypted device;
- one `Download backup` action;
- a disabled `Preparing backup…` state while the request runs; and
- a concise inline failure with a retry path.

The UI has no archive list, last-backup timestamp, upload field, or restore
action. A completed HTTP response cannot prove that a browser retained the
file, so the application never claims that the database is now backed up.

The download uses the existing strict UTC name:
`padelclash-YYYYMMDDTHHMMSSZ.dump`.

## Download endpoint contract

The client calls a same-origin `POST /api/admin/backup` endpoint. The endpoint:

1. verifies the Admin session and same-origin request before doing work;
2. admits only one generation at a time in the single production process;
3. creates a private request-scoped temporary directory and file;
4. invokes PostgreSQL 17 `pg_dump --format=custom --no-acl --no-owner` with a
   short lock-wait timeout and a 60-second process deadline;
5. spawns the tools directly without a shell and passes connection secrets
   through the child environment, never command arguments, client errors, or
   logs;
6. requires a successful exit, a non-empty file, and a successful PostgreSQL 17
   `pg_restore --list` validation;
7. serves the validated file as an attachment with `Cache-Control: no-store`;
   and
8. removes the temporary directory after delivery, cancellation, or any handled
   error and purges stale private request directories before a later generation.

Normal Match writes and reads continue during `pg_dump`. Its consistent
snapshot may omit a transaction that commits after the snapshot begins, but it
cannot contain half of that transaction. The short lock wait makes a concurrent
schema deployment fail the download instead of allowing either operation to
wait indefinitely; the Admin can retry after deployment.

The final app image must contain the PostgreSQL 17 client tools. Exact-major
matching avoids a floating client becoming older than the PostgreSQL server.
The app container does not receive Docker control or access to the scheduled
backup directory.

The existing VPS fallback script currently passes `DATABASE_URL` through a
`--dbname` process argument. The implementation must move that connection data
to libpq environment variables too, then rerun the backup-tool tests; otherwise
the convenient path would be safer with secrets than the recovery baseline.

## Archive contents and handling

This is a full logical database dump. It includes:

- schema and Drizzle migration history;
- Players, Matches, Match Participants, and derived Rating projections;
- Device Binding history and active credential hashes; and
- Onboarding Links, including any still-readable live tokens.

It does not contain `ADMIN_PASSWORD`, the PostgreSQL runtime password, Coolify
configuration, the Git repository, or uploaded files outside PostgreSQL. The
Admin password therefore remains separately recoverable from the password
manager. A new PostgreSQL runtime password may be generated after server loss.

The download is protected in transit by HTTPS. PadelClash does not wrap the dump
in another password or encryption format: losing that extra secret would turn
a good archive into an unusable one. The destination device and any later copy
must provide encryption at rest.

Only an archive obtained from this PadelClash installation or its automated
backup path is trusted. Catalogue validation proves readability, not
authenticity; PostgreSQL archives from an untrusted source must never be
restored.

## Full-server recovery

Recovery is for a lost server and a fresh PostgreSQL 17 target, not for undoing
an ordinary edit. It is intentionally outside the live application and may use
one-time SSH or command-line access.

The repository-owned recovery command accepts an archive and a destination
connection. It must:

1. require PostgreSQL 17 client tools and validate the archive catalogue;
2. refuse a destination containing any PadelClash application data or objects;
3. restore schema and data with `pg_restore --single-transaction --no-owner
   --no-acl`, leaving the target unchanged if any restore statement fails;
4. run `ANALYZE` after the committed restore; and
5. exit clearly without printing credentials.

The operational sequence is:

1. Provision the replacement server, private PostgreSQL 17 service, domain,
   and runtime secrets, but do not start the app against the empty database.
2. Select a trusted verified generation from the encrypted PC. Prefer the
   newest generation from before the loss unless suspected logical corruption
   requires an older one.
3. Place the archive where the recovery command can read it and run that command
   once against the empty target.
4. Start the current PadelClash version, which must be at least as new as the
   version that created the dump. Startup applies any newer migrations and
   rebuilds Rating projections from the Match log.
5. Require a healthy `/api/health`, then verify Admin login, the roster, Match
   history, and the newest Match expected at the chosen recovery point.
6. Reconfigure the daily VPS dump and Windows catch-up pull for the replacement
   server, take a fresh generation, pull it off-server, and run the disposable
   restore test.

The restored Device Bindings and Onboarding Links remain as they were at the
backup point. This preserves working phones, but access revoked after that point
also returns and must be revoked again if relevant.

## Adversarial safeguards

| Failure or attack | Design response |
|---|---|
| Stolen valid Admin session downloads the database | Accepted: that session already has full private and destructive Admin access (decision 138) |
| Cross-site page triggers expensive generation | Same-origin POST and Admin verification happen before process creation |
| Double click or concurrent request amplifies load | One in-process generation lease; later attempts receive a retryable refusal |
| `pg_dump` loses its connection or fills temporary storage | Non-zero exit or invalid/empty archive produces no download; partial files are removed |
| Browser cancels during delivery | Response cleanup removes the request-scoped file |
| App process is killed before cleanup runs | Artifact remains private in ephemeral storage and is purged before the next generation |
| Database password leaks through diagnostics | Connection fields stay in child environment; logs and user errors are sanitized |
| Deployment requests an exclusive schema lock | Dump lock acquisition times out quickly and the Admin retries after deployment |
| Archive is readable but cannot fully restore | Automated disposable restore testing remains required |
| Wrong archive is selected during disaster recovery | Filename/time is shown, target must be empty, restore is transactional, and post-restore data checks are mandatory |
| Old snapshot resurrects revoked access | Accepted and documented; Admin re-revokes access when relevant |
| Browser download is mistaken for a durable backup | No “last backup” or “saved successfully” claim; automated staleness monitoring remains authoritative |

## Verification required with implementation

- Unit-test argument construction, secret redaction, timeout, single-flight
  behavior, and cleanup across success, subprocess failure, validation failure,
  cancellation, and stale-artifact recovery.
- Route-test unauthenticated and cross-origin refusal before process creation,
  plus attachment name, content type, and no-store headers.
- Add Admin gallery cases for idle, preparing, and failure states alongside the
  documented UI change.
- In Docker against PostgreSQL 17, generate an archive while normal writes
  remain available, validate it, restore it into a fresh disposable database,
  and compare canonical table contents.
- Re-test the hardened scheduled fallback and prove that its database password
  is absent from `pg_dump` process arguments and diagnostics.
- Test that the production recovery command refuses a non-empty target and that
  a forced restore error rolls the empty target back completely.
- Complete an end-to-end disposable recovery: restore, start the current app,
  run migrations and projection rebuild, pass health, and inspect roster and
  Match history.
- Verify the real download behavior and filename in desktop Chromium and iOS
  Safari/the installed PWA; do not assume a programmatic Blob download behaves
  identically on both.

No new domain-glossary term or ADR is created. Backup and restore are general
infrastructure concepts, and the durable topology trade-off is already captured
by ADR 0002.
