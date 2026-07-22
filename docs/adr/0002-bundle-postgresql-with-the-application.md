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
The production topology supports one steady-state app process; horizontal
scaling would require coordinated rate limiting and migration/cache review.
