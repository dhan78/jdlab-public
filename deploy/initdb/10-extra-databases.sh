#!/bin/bash
# First-boot only (runs when the postgres data volume is empty): create a
# dedicated role + database for each app that shares this Postgres instance.
# Passwords come from the db.env env_file (sourced from SSM /jdlab/db/):
#   JDLAB_DB_PASSWORD, OUTLINE_DB_PASSWORD
# If a password isn't provided, that app's DB is skipped.
#
# For an ALREADY-initialised volume this file does NOT run — create the DB once
# manually:
#   docker exec -it postgres-prostore psql -U "$POSTGRES_USER" \
#     -c "CREATE ROLE jdlab LOGIN PASSWORD '...'; CREATE DATABASE jdlab OWNER jdlab;"
set -euo pipefail

create_db_role() {
  local name="$1" pw="$2"
  [ -n "$pw" ] || { echo "skip $name (no password)"; return 0; }
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    DO \$do\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${name}') THEN
        CREATE ROLE "${name}" LOGIN PASSWORD '${pw}';
      END IF;
    END \$do\$;
EOSQL
  if ! psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='${name}'" | grep -q 1; then
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -c "CREATE DATABASE \"${name}\" OWNER \"${name}\""
  fi
  echo "ensured role+db: ${name}"
}

create_db_role "jdlab"   "${JDLAB_DB_PASSWORD:-}"
create_db_role "outline" "${OUTLINE_DB_PASSWORD:-}"
