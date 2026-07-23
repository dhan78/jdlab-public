#!/usr/bin/env bash
# Apply changed SSM parameters to running containers during an incident.
# Overwrite the value in SSM first, then run this to pull + recreate a service.
#   aws ssm put-parameter --name /jdlab/PORTAL_JWT_SECRET --value '...' \
#     --type SecureString --overwrite
#   sudo ./jdlab-reload.sh nextjs
#
# `docker restart` does NOT re-read env — recreate is required.
set -euo pipefail

SVC="${1:?usage: jdlab-reload.sh <service>   (e.g. nextjs | app | outline | db)}"
DIR="$(cd "$(dirname "$0")" && pwd)"

"$DIR/jdlab-env.sh"
docker compose -f "$DIR/docker-compose.prod.yml" up -d --force-recreate --no-deps "$SVC"
echo "recreated: $SVC"
