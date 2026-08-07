#!/bin/bash
# JD Dental Lab — Postgres backup -> S3 (host-run, cron-driven)
#
# Runs ON THE EC2 HOST (not a container). Dumps ALL databases (jdlab + prostore
# + outline) from the running Postgres container via `docker exec`, gzips it,
# and uploads to S3. No always-on backup container, and no per-boot aws-cli
# install — the host already has aws-cli (jdlab-env.sh uses it), and the dump
# comes from the LIVE db container, so pg_dumpall always matches the server.
#
# Auth: `docker exec -u postgres` dumps over the container's local socket
# (trust/peer), so no password is handled anywhere.
#
# Install on the box:
#   sudo install -m 0755 deploy/jdlab-backup.sh /opt/jdlab/jdlab-backup.sh
#   # then cron (as a user in the `docker` group), daily at 03:15:
#   #   15 3 * * *  /opt/jdlab/jdlab-backup.sh >> /var/log/jdlab-backup.log 2>&1
# Manual run:
#   /opt/jdlab/jdlab-backup.sh
#
# Env (overridable; sensible defaults):
#   BACKUP_DIR      local dump dir           (default: /opt/jdlab/backups)
#   RETENTION_DAYS  prune local dumps > N     (default: 7)
#   DB_CONTAINER    postgres container name   (default: postgres-prostore)
#   S3_BUCKET_URL   s3://bucket/prefix        (from /run/jdlab/db.env; skip if unset)
set -eo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/jdlab/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_CONTAINER="${DB_CONTAINER:-postgres-prostore}"

# S3_BUCKET_URL is written by jdlab-env.sh into the tmpfs env file.
[ -f /run/jdlab/db.env ] && . /run/jdlab/db.env

mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE="${BACKUP_DIR}/full_backup-${DATE}.sql.gz"

echo "[$(date)] dumping all databases from ${DB_CONTAINER}..."
# pipefail (set above) makes a mid-stream pg_dumpall failure fail the whole
# pipeline, so we never keep or upload a truncated gzip.
docker exec -u postgres "$DB_CONTAINER" pg_dumpall --clean --if-exists | gzip > "$FILE"
echo "OK dump $(du -h "$FILE" | cut -f1)"

if [ -n "${S3_BUCKET_URL:-}" ]; then
  aws s3 cp "$FILE" "${S3_BUCKET_URL%/}/" && echo "OK uploaded to ${S3_BUCKET_URL%/}/"
else
  echo "WARN S3_BUCKET_URL unset — kept local dump only"
fi

# Prune local dumps older than the retention window.
find "$BACKUP_DIR" -name 'full_backup-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] done."
