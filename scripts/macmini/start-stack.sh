#!/bin/zsh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/Users/cornelius/Documents/Crop Intel}"
cd "$REPO_DIR"

/usr/bin/env docker compose up -d postgres api frontend

# Seed buyers on first run (safe to rerun; script is idempotent)
/usr/bin/env docker compose exec -T api node dist/cli/buyers-seed.js || true
