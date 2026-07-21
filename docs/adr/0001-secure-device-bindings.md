# Authorize Players with server-managed Device Bindings

PadelClash has no user accounts but still needs to keep outsiders from reading the private circle or submitting results. Each Player therefore has at most one active, unguessable server-managed Device Binding, obtained through short-lived Admin-controlled onboarding links; recovery and identity changes require Admin involvement. This deliberately favors persistent, low-friction access for a trusted private group over self-service recovery, while acknowledging that a PWA cannot identify a unique physical device or remotely erase data already held offline.

## Consequences

The General Onboarding Link is a time-bounded bearer capability whose holder is trusted to join and then log matches. The server remains authoritative for access and revocation, credentials are never Player ids or localStorage secrets, and existing convenience-grade cookies and reusable links must be invalidated during migration.
