#!/bin/bash
# JD Dental Lab — restore Postgres from a pg_dumpall backup (host-run)
#
# Companion to jdlab-backup.sh. Takes a gzipped pg_dumpall .sql.gz (local path
# or s3:// URL), stops the apps that hold DB connections, pipes the dump into
# the running Postgres container, then restarts the apps.
#
# DESTRUCTIVE: the dump was taken with `--clean --if-exists`, so it DROPS and
# recreates the jdlab/prostore/outline databases and roles. Current data is
# replaced. Requires --yes (or an interactive "yes") to proceed.
#
# Usage:
#   ./jdlab-restore.sh /opt/jdlab/backups/full_backup-YYYY-...-.sql.gz
#   ./jdlab-restore.sh s3://your-bucket/prefix/full_backup-YYYY-...-.sql.gz --yes
#
# List available S3 backups:
#   aws s3 ls "${S3_BUCKET_URL%/}/"
#
# Env overrides:
#   DB_CONTAINER   postgres container    (default: postgres-prostore)
#   APP_CONTAINERS containers to stop    (default: "jdlab-nextjs prostore-app outline")
set -eo pipefail

DB_CONTAINER="${DB_CONTAINER:-postgres-prostore}"
APP_CONTAINERS="${APP_CONTAINERS:-jdlab-nextjs prostore-app outline}"

SRC=""
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    *) SRC="$arg" ;;
  esac
done

if [ -z "$SRC" ]; then
  echo "usage: $0 <backup.sql.gz | s3://bucket/prefix/backup.sql.gz> [--yes]" >&2
  exit 2
fi

# Resolve an s3:// source to a local temp file.
CLEANUP=""
if [ "${SRC#s3://}" != "$SRC" ]; then
  TMP="$(mktemp /tmp/jdlab-restore.XXXXXX.sql.gz)"
  echo "downloading $SRC ..."
  aws s3 cp "$SRC" "$TMP"
  FILE="$TMP"; CLEANUP="$TMP"
else
  FILE="$SRC"
fi
[ -f "$FILE" ] || { echo "ERR: backup file not found: $FILE" >&2; exit 1; }

echo
echo "!!  RESTORE IS DESTRUCTIVE  !!"
echo "    source : $SRC"
echo "    target : container '$DB_CONTAINER' (drops & recreates jdlab/prostore/outline)"
echo "    apps stopped during restore: $APP_CONTAINERS"
echo
if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Type "yes" to proceed: '
  read -r CONFIRM
  [ "$CONFIRM" = "yes" ] || { echo "aborted."; [ -n "$CLEANUP" ] && rm -f "$CLEANUP"; exit 1; }
fi

# Stop apps so no client holds a connection to a database being dropped.
echo "stopping apps to release DB connections..."
docker stop $APP_CONTAINERS 2>/dev/null || true

echo "restoring into ${DB_CONTAINER}..."
# Restore into the 'postgres' maintenance DB (never dropped by the dump).
# pipefail ensures a truncated/corrupt gunzip fails the whole pipeline.
gunzip -c "$FILE" | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres
echo "OK restore stream completed"

echo "starting apps..."
docker start $APP_CONTAINERS 2>/dev/null || true

[ -n "$CLEANUP" ] && rm -f "$CLEANUP"
echo "done. Verify the apps come up healthy (docker ps)."
