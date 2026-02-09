#!/bin/bash

# Production Test Runner
# Loads environment variables and runs the production test suite

set -a  # automatically export all variables
source .env 2>/dev/null || true
source .env.bnsf 2>/dev/null || true

# Export certificate contents as environment variables
if [ -f "certs/bnsf-client-cert.pem" ]; then
    export BNSF_CLIENT_CERT_PEM="$(cat certs/bnsf-client-cert.pem)"
fi

if [ -f "certs/bnsf-client-key.pem" ]; then
    export BNSF_CLIENT_KEY_PEM="$(cat certs/bnsf-client-key.pem)"
fi

# Set BNSF base URL - correct endpoint with port 6443
export BNSF_BASE_URL="${BNSF_BASE_URL:-https://api.bnsf.com:6443}"

# Enable BNSF feature for testing
export BNSF_FEATURE_ENABLED="${BNSF_FEATURE_ENABLED:-true}"

set +a

# Run the test
echo "🚂 Running Corn Intel Production Tests..."
echo "Environment loaded from .env and .env.bnsf"
echo ""

npx tsx scripts/test-production.ts
