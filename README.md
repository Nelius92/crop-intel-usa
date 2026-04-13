# crop-intel-usa

Crop intel application that helps farmers find the best basis on corn and other grains, enabling them to ship from their closest transloading rail to the best possible buyers.

## Local Web App (Mac Mini / Office LAN)

This repo now supports running Crop Intel as a local web app with:
- `frontend` (nginx + Vite build)
- `api` (Express + Postgres-backed buyers/contact directory)
- `postgres` (local DB)

### First-time local setup (Mac mini)

1. Install Docker Desktop (or Colima) and ensure `docker compose` works.
2. Add your server-side keys to the API container environment (recommended via compose override or `.env` injection):
   - `GOOGLE_MAPS_API_KEY` (required for nightly buyer contact sync)
   - `GEMINI_API_KEY` (optional for AI features; backend fallbacks exist)
3. Start the stack and seed buyers:
   ```bash
   ./scripts/macmini/first-run.sh
   ```
4. Open the app from another office computer on the LAN:
   - `http://<mac-mini-ip>/`

### Ongoing jobs (Mac mini)

- Nightly buyer contact sync: `./scripts/macmini/buyer-sync.sh`
- Nightly Postgres backup: `./scripts/macmini/pg-backup.sh`
- `launchd` templates are in `ops/launchd/`

### Docker Compose services

```bash
docker compose up -d --build
docker compose logs -f api
docker compose exec -T api node dist/cli/buyers-seed.js
docker compose exec -T api node dist/cli/buyers-sync.js --limit 200
```

## BNSF Carload Rates API Smoke Test

The `scripts/bnsf_carload_rates_smoke.ts` script provides a standalone utility for testing the BNSF Carload Rates API with mTLS authentication.

### Prerequisites

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

2. Install `ts-node` globally or use `npx`:
   ```bash
   npm install -g ts-node
   # or use npx ts-node (shown in examples below)
   ```

### Environment Variables

Set the following environment variables before running the script:

```bash
export BNSF_BASE_URL="https://api.bnsf.com"
export BNSF_CLIENT_CERT_PEM="$(cat /path/to/client-cert.pem)"
export BNSF_CLIENT_KEY_PEM="$(cat /path/to/client-key.pem)"
export BNSF_CA_PEM="$(cat /path/to/ca-cert.pem)"  # Optional
```

Or create a `.env` file (ensure it's in `.gitignore`):

```env
BNSF_BASE_URL=https://api.bnsf.com
BNSF_CLIENT_CERT_PEM=-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
BNSF_CLIENT_KEY_PEM=-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
# BNSF_CA_PEM is optional
```

### Usage

#### Basic Usage (without item number)

```bash
npx ts-node scripts/bnsf_carload_rates_smoke.ts --owner BNSF --number 4022
```

#### With Item Number

```bash
npx ts-node scripts/bnsf_carload_rates_smoke.ts --owner BNSF --number 4022 --item 31750
```

#### Short Form Arguments

```bash
npx ts-node scripts/bnsf_carload_rates_smoke.ts -o BNSF -n 4022 -i 31750
```

### Example Output

**Successful Response:**
```
🚂 BNSF Carload Rates Smoke Test

✅ Environment variables loaded
✅ CLI arguments parsed
   Owner: BNSF
   Number: 4022
   Item: 31750

📦 Request Body:
{
  "priceAuthorityOwner": "BNSF",
  "priceAuthorityNumber": "4022",
  "priceAuthorityItemNumber": "31750"
}

🔄 Calling BNSF Carload Rates API...

======================================================================
HTTP Status: 200
======================================================================

✅ Found 2 rate(s):

Rate #1:
  Effective Date:   2024-01-15
  Expiration Date:  2024-12-31
  Price Amount:     125.50
  Unit of Measure:  CWT
  Calc Code:        BASE

Rate #2:
  Effective Date:   2024-06-01
  Expiration Date:  2024-12-31
  Price Amount:     130.00
  Unit of Measure:  CWT
  Calc Code:        PEAK

======================================================================

✅ Request completed successfully
```

**No Rates Found:**
```
======================================================================
HTTP Status: 200
======================================================================

📋 Message: No rates found

======================================================================
```

**Error Response:**
```
======================================================================
HTTP Status: 400
======================================================================

📋 Message: Invalid price authority number

======================================================================

❌ Request failed with HTTP status 400
```

### Exit Codes

- `0`: Success (HTTP status < 400)
- `1`: Error (HTTP status >= 400, missing environment variables, or network error)
