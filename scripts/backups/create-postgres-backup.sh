#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY must be the discovered VPS export directory}"

case "$(pg_dump --version)" in
  *" 17."*) ;;
  *) echo "pg_dump must be PostgreSQL 17" >&2; exit 1 ;;
esac
case "$(pg_restore --version)" in
  *" 17."*) ;;
  *) echo "pg_restore must be PostgreSQL 17" >&2; exit 1 ;;
esac

umask 077
mkdir -p "$BACKUP_DIRECTORY"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$BACKUP_DIRECTORY/padelclash-$stamp.dump"
partial="$archive.partial"

trap 'rm -f "$partial"' EXIT
PGDATABASE="$DATABASE_URL"
export PGDATABASE
unset DATABASE_URL
if ! pg_dump --format=custom --no-acl --no-owner --file="$partial" 2>/dev/null; then
  echo "PostgreSQL backup generation failed" >&2
  exit 1
fi
test -s "$partial"
if ! pg_restore --list "$partial" >/dev/null 2>&1; then
  echo "PostgreSQL backup validation failed" >&2
  exit 1
fi
mv "$partial" "$archive"
trap - EXIT

# The VPS spool is independent of the PC archive: only the 30 newest strict
# PadelClash dump names are removed here.
find "$BACKUP_DIRECTORY" -maxdepth 1 -type f -name 'padelclash-*.dump' -printf '%T@ %p\n' \
  | sort -rn \
  | tail -n +31 \
  | cut -d' ' -f2- \
  | while IFS= read -r old; do rm -f -- "$old"; done

printf '%s\n' "$archive"
