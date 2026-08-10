#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore-database.sh /path/to/backup.dump"
  exit 1
fi

APP_DIR="${APP_DIR:-/var/www/bembex-portal}"
ENV_FILE="${ENV_FILE:-$APP_DIR/server/.env}"
BACKUP_FILE="$1"

set -a
source "$ENV_FILE"
set +a

CONNECTION_URL="${DIRECT_URL:-$DATABASE_URL}"

pg_restore "$BACKUP_FILE" \
  --dbname="$CONNECTION_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl

echo "Database restored from $BACKUP_FILE"
