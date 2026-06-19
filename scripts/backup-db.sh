#!/usr/bin/env bash
# Dumps the BaoBaoHealth Postgres database, compresses and encrypts the
# dump with AES-256, and prunes backups older than the retention window.
#
# Required:
#   BACKUP_ENCRYPTION_KEY   passphrase used for AES-256 encryption (openssl)
#
# Optional (defaults shown):
#   DATABASE_URL            postgresql://baobao_user:baobao_password@127.0.0.1:5433/baobaoheath_db
#   BACKUP_DIR              ./backups
#   BACKUP_RETENTION_DAYS   14
#   POSTGRES_CONTAINER      baobao_db   (used only if pg_dump isn't on PATH)
#
# Usage:
#   BACKUP_ENCRYPTION_KEY=changeme ./scripts/backup-db.sh
#
# Schedule with cron, e.g. nightly at 02:00:
#   0 2 * * * BACKUP_ENCRYPTION_KEY=changeme /path/to/scripts/backup-db.sh >> /var/log/baobaohealth-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required — refuse to write an unencrypted backup}"
export BACKUP_ENCRYPTION_KEY

DATABASE_URL="${DATABASE_URL:-postgresql://baobao_user:baobao_password@127.0.0.1:5433/baobaoheath_db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-baobao_db}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW_DUMP="$BACKUP_DIR/baobaoheath_${TIMESTAMP}.sql"
ENCRYPTED_FILE="$BACKUP_DIR/baobaoheath_${TIMESTAMP}.sql.gz.enc"

cleanup() { rm -f "$RAW_DUMP"; }
trap cleanup EXIT

echo "[backup] Dumping database..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$RAW_DUMP"
elif command -v docker >/dev/null 2>&1; then
  echo "[backup] pg_dump not found locally, falling back to 'docker exec $POSTGRES_CONTAINER'"
  PGUSER="$(echo "$DATABASE_URL" | sed -E 's#postgresql://([^:]+):.*#\1#')"
  PGDATABASE="$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
  docker exec -e PGPASSWORD="$(echo "$DATABASE_URL" | sed -E 's#postgresql://[^:]+:([^@]+)@.*#\1#')" \
    "$POSTGRES_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-privileges > "$RAW_DUMP"
else
  echo "[backup] ERROR: neither pg_dump nor docker is available" >&2
  exit 1
fi

if [ ! -s "$RAW_DUMP" ]; then
  echo "[backup] ERROR: dump is empty, aborting" >&2
  exit 1
fi

echo "[backup] Compressing and encrypting..."
gzip -c "$RAW_DUMP" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -out "$ENCRYPTED_FILE"

echo "[backup] Wrote $ENCRYPTED_FILE ($(du -h "$ENCRYPTED_FILE" | cut -f1))"

if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  echo "[backup] Pruning backups older than ${BACKUP_RETENTION_DAYS} days..."
  find "$BACKUP_DIR" -name 'baobaoheath_*.sql.gz.enc' -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete
fi

echo "[backup] Done."
