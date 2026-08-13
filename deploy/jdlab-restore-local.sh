#!/bin/bash
# jdlab-restore-local.sh — Restore pg_dumpall .sql.gz into local Postgres (Toolbox + Podman)
# Usage: ./jdlab-restore-local.sh ~/full_backup-2026-08-12_03-00-01.sql.gz

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-postgres-local}"
DB_USER="${DB_USER:-jdlab}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found → $BACKUP_FILE"
  exit 1
fi

if ! command -v podman &>/dev/null; then
  echo "Error: podman not found"
  exit 1
fi
RUNTIME="podman"

echo "→ Runtime     : $RUNTIME"
echo "→ Container   : $CONTAINER_NAME"
echo "→ DB user     : $DB_USER"
echo "→ Backup file : $BACKUP_FILE"
echo

# Check if container exists
if ! $RUNTIME ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Error: container '$CONTAINER_NAME' not found"
  echo "Available containers:"
  $RUNTIME ps -a --format '  {{.Names}}  ({{.Status}})'
  exit 1
fi

# Start container if stopped
if ! $RUNTIME ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Container is stopped. Starting it..."
  $RUNTIME start "$CONTAINER_NAME"
  sleep 3
fi

echo "Dropping existing app databases..."
$RUNTIME exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('jdlab', 'outline', 'neondb', 'prostore')
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS jdlab;
DROP DATABASE IF EXISTS outline;
DROP DATABASE IF EXISTS neondb;
DROP DATABASE IF EXISTS prostore;
SQL

echo "Restoring (this may take a while)..."
gunzip -c "$BACKUP_FILE" | $RUNTIME exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres

echo
echo "✓ Restore completed successfully"
echo
echo "Databases now available:"
$RUNTIME exec "$CONTAINER_NAME" psql -U "$DB_USER" -c '\l'
