#!/usr/bin/env bash
# Resolve AWS SSM parameters into per-service env files for docker compose.
# Runs on the HOST (which has the AWS CLI + the EC2 instance role via IMDS).
# Writes to /run/jdlab (tmpfs = RAM, wiped on reboot), files mode 0600 (root only).
# No secrets are printed; values are written literally (no eval -> no injection).
#
# Usage:  sudo ./jdlab-env.sh  &&  docker compose -f docker-compose.prod.yml up -d
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
DIR="${JDLAB_ENV_DIR:-/run/jdlab}"
install -d -m 700 "$DIR"

render() {  # $1 = SSM path prefix (trailing slash), $2 = output file
  local path="$1" out="$2" tmp
  tmp="$(mktemp "${out}.XXXXXX")"
  chmod 600 "$tmp"
  # KEY=VALUE, one per line; strip the path prefix from the parameter name.
  aws ssm get-parameters-by-path \
      --path "$path" --recursive --with-decryption --region "$REGION" \
      --query "Parameters[].[Name,Value]" --output text \
  | while IFS=$'\t' read -r name value; do
      [ -n "$name" ] && printf '%s=%s\n' "${name##*/}" "$value"
    done > "$tmp"
  mv -f "$tmp" "$out"
  echo "wrote $out ($(wc -l < "$out") keys)"
}

render "/jdlab/"          "$DIR/nextjs.env"
render "/jdlab/db/"       "$DIR/db.env"
render "/jdlab/prostore/" "$DIR/prostore.env"
render "/jdlab/outline/"  "$DIR/outline.env"

echo "SSM parameters loaded into $DIR"
