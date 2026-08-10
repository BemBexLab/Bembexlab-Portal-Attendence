#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bembex-portal}"
ENV_FILE="${ENV_FILE:-$APP_DIR/server/.env}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups/database}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

set -a
source "$ENV_FILE"
set +a

CONNECTION_URL="${DIRECT_URL:-$DATABASE_URL}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="$BACKUP_DIR/bembex-$TIMESTAMP.dump"

pg_dump "$CONNECTION_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$OUTPUT_FILE"

find "$BACKUP_DIR" -type f -name 'bembex-*.dump' -mtime +"$RETENTION_DAYS" -delete

echo "Database backup written to $OUTPUT_FILE"
