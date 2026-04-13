#!/bin/zsh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/Users/cornelius/Documents/Crop Intel}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT_FILE="$BACKUP_DIR/cropintel_$STAMP.sql"

/usr/bin/env docker compose exec -T postgres pg_dump -U cropintel -d cropintel > "$OUT_FILE"
/usr/bin/gzip -f "$OUT_FILE"

find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup written: ${OUT_FILE}.gz"
