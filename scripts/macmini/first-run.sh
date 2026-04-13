#!/bin/zsh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/Users/cornelius/Documents/Crop Intel}"
cd "$REPO_DIR"

echo "Starting Crop Intel stack..."
/usr/bin/env docker compose up -d --build postgres api frontend

echo "Running seed import..."
/usr/bin/env docker compose exec -T api node dist/cli/buyers-seed.js

echo "Running initial contact sync (requires GOOGLE_MAPS_API_KEY on API container)..."
/usr/bin/env docker compose exec -T api node dist/cli/buyers-sync.js --limit 200 --stale-days 365 --delay-ms 200 || true

echo "Done. Open http://<mac-mini-ip>/ from another office computer."
