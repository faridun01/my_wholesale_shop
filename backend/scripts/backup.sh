#!/usr/bin/env bash
# Database backup script for My Wholesale Shop
set -eo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"
# Same default database name as docker-compose.yml.
DB_NAME="${POSTGRES_DB:-my_wholesale_shop}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Creating PostgreSQL backup to $BACKUP_FILE..."

# pipefail: a failed pg_dump must not leave an empty archive reported as a success.
if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  rm -f "$BACKUP_FILE"
  echo "Backup FAILED, nothing was saved" >&2
  exit 1
fi

echo "Backup created successfully: $BACKUP_FILE"

# Keep last 14 backups, delete older
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +14 -exec rm {} \;
