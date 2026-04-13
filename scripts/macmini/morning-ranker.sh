#!/bin/zsh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/Users/cornelius/Documents/Crop Intel}"
cd "$REPO_DIR"

LOG_DIR="${LOG_DIR:-$REPO_DIR/logs}"
mkdir -p "$LOG_DIR"

# Optional env file for DB URL / API URL / config paths
ENV_FILE="${ENV_FILE:-$REPO_DIR/ops/morning-ranker.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (set in environment or $ENV_FILE)" >&2
  exit 1
fi

VENV_DIR="${VENV_DIR:-$REPO_DIR/.venv-cropintel}"
PYTHON_BIN="${PYTHON_BIN:-$VENV_DIR/bin/python3}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON_BIN_FALLBACK:-/usr/bin/python3}"
fi

API_BASE_URL="${CROP_INTEL_API_BASE_URL:-http://127.0.0.1}"
BID_SOURCE_CONFIG="${CROP_INTEL_BID_SOURCE_CONFIG:-$REPO_DIR/python/bid_sources.json}"
MODEL_COEFFICIENTS_FILE="${CROP_INTEL_MODEL_COEFFICIENTS_FILE:-}"

ARGS=(
  "$REPO_DIR/python/morning_ranker.py"
  --database-url "$DATABASE_URL"
  --api-base-url "$API_BASE_URL"
  --crop "${CROP_INTEL_MORNING_CROP:-Yellow Corn}"
  --limit "${CROP_INTEL_MORNING_LIMIT:-250}"
  --top-n "${CROP_INTEL_MORNING_TOP_N:-30}"
  --top-states "${CROP_INTEL_MORNING_TOP_STATES:-3}"
  --max-bid-age-hours "${CROP_INTEL_MAX_BID_AGE_HOURS:-36}"
)

if [[ -f "$BID_SOURCE_CONFIG" ]]; then
  ARGS+=(--bid-source-config "$BID_SOURCE_CONFIG")
else
  ARGS+=(--skip-scrape)
fi

if [[ -n "$MODEL_COEFFICIENTS_FILE" && -f "$MODEL_COEFFICIENTS_FILE" ]]; then
  ARGS+=(--model-coefficients-file "$MODEL_COEFFICIENTS_FILE")
fi

if [[ "${CROP_INTEL_VERIFIED_ONLY:-1}" == "1" ]]; then
  ARGS+=(--verified-only)
fi

exec "$PYTHON_BIN" "${ARGS[@]}"
