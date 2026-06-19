#!/usr/bin/env bash
# Decrypts and restores a backup produced by backup-db.sh.
#
# Required:
#   BACKUP_ENCRYPTION_KEY   passphrase used to encrypt the backup
#
# Usage:
#   BACKUP_ENCRYPTION_KEY=changeme ./scripts/restore-db.sh backups/baobaoheath_20260619T020000Z.sql.gz.enc
#
# WARNING: this overwrites the target database. Double-check DATABASE_URL
# (or POSTGRES_CONTAINER) before running against anything but a throwaway/dev DB.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
export BACKUP_ENCRYPTION_KEY

ENCRYPTED_FILE="${1:?Usage: restore-db.sh <path-to-.sql.gz.enc>}"
if [ ! -f "$ENCRYPTED_FILE" ]; then
  echo "[restore] ERROR: file not found: $ENCRYPTED_FILE" >&2
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-postgresql://baobao_user:baobao_password@127.0.0.1:5433/baobaoheath_db}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-baobao_db}"

TMP_SQL="$(mktemp).sql"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

echo "[restore] Decrypting $ENCRYPTED_FILE..."
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -in "$ENCRYPTED_FILE" | gunzip -c > "$TMP_SQL"

read -r -p "About to restore into ${DATABASE_URL}. This will overwrite existing data. Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] Aborted."
  exit 1
fi

echo "[restore] Restoring..."
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" < "$TMP_SQL"
elif command -v docker >/dev/null 2>&1; then
  echo "[restore] psql not found locally, falling back to 'docker exec $POSTGRES_CONTAINER'"
  PGUSER="$(echo "$DATABASE_URL" | sed -E 's#postgresql://([^:]+):.*#\1#')"
  PGDATABASE="$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
  docker exec -i -e PGPASSWORD="$(echo "$DATABASE_URL" | sed -E 's#postgresql://[^:]+:([^@]+)@.*#\1#')" \
    "$POSTGRES_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" < "$TMP_SQL"
else
  echo "[restore] ERROR: neither psql nor docker is available" >&2
  exit 1
fi

echo "[restore] Done."
