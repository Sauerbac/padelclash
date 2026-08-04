# Bundle PostgreSQL with the application

Production deploys PadelClash and PostgreSQL together as one Coolify Docker
Compose resource. PostgreSQL remains private inside the Compose network and
stores the authoritative Match log in a named persistent volume. This keeps a
single-circle installation self-contained and portable instead of coupling it
to a separately managed Coolify database resource.

## Consequences

The Compose stack owns database startup, health, migrations and persistence,
but its local volume is not a disaster-recovery copy. PostgreSQL-aware daily
backups must leave the VPS before real Matches are entrusted to the deployment.
An Admin may also generate and download a fresh PostgreSQL archive through the
application, but that convenience copy supplements rather than replaces the
automated off-VPS path. Restore remains an operator procedure against a fresh
database after server loss; the live application never restores itself.
The production topology supports one steady-state app process; horizontal
scaling would require coordinated rate limiting and migration/cache review.
