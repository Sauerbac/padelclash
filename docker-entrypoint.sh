#!/bin/sh
set -e

# Apply migrations before serving (versioned, idempotent). No-op until slice 02
# adds the first migration files.
node scripts/migrate.mjs

# Hand off to the Next.js standalone server as PID 1.
exec node server.js
