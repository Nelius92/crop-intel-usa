#!/bin/zsh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/Users/cornelius/Documents/Crop Intel}"
cd "$REPO_DIR"

/usr/bin/env docker compose exec -T api node dist/cli/buyers-sync.js --limit 500 --stale-days 30 --delay-ms 150
/usr/bin/env docker compose exec -T api node dist/cli/buyers-verify-report.js
