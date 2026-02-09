# BNSF API Quick Reference

## 🔑 Authentication

Your BNSF API uses **mutual TLS (mTLS)** authentication with client certificates.

### Certificate Details

- **Organization:** RAGUSE FAMILY PARTNERSHIP
- **Valid From:** December 16, 2025
- **Expires:** December 16, 2026
- **Issuer:** Sectigo Limited
- **Key Type:** RSA 2048-bit

### Certificate Files

```
certs/
├── bnsf-client-cert.pem    # Client certificate (2,415 bytes)
├── bnsf-client-key.pem     # Private key (1,867 bytes)
├── bnsf-client.p12         # PKCS#12 bundle (3,221 bytes)
└── bnsf-ca.pem             # CA certificate (empty - not required)
```

**⚠️ Important:** These files are gitignored and should NEVER be committed to version control.

---

## 🌐 API Endpoints

### Base URLs
```
Production:  https://api.bnsf.com:6443
Trial:       https://api-trial.bnsf.com:6443
```

**IMPORTANT:** The BNSF API requires port 6443 for mTLS authentication.

### Available Endpoints

#### 1. Carload Rates
```http
POST /v1/carload-rates
Content-Type: application/json

{
  "priceAuthorityOwner": "BNSF",
  "priceAuthorityNumber": "4022",
  "priceAuthorityItemNumber": "31750"  // optional
}
```

**Response:**
```json
{
  "message": {
    "results": [
      {
        "effectiveDate": "2024-01-15",
        "expirationDate": "2024-12-31",
        "priceAmount": 125.50,
        "unitOfMeasure": "CWT",
        "calcCode": "BASE"
      }
    ]
  }
}
```

#### 2. Car Tracking
```http
GET /v1/cars?status=in-transit&destination=Houston,TX
```

**Response:** Car tracking data (see `bnsf-cars.json` for example)

---

## 🧪 Testing

### Run Full Production Tests
```bash
./scripts/run-tests.sh
```

This will test:
- Environment configuration
- Certificate validity
- Tariff rate calculations
- BNSF API connectivity (if enabled)
- Application build

### Test BNSF API Directly
```bash
# Basic test (without item number)
npm run test:bnsf -- --owner BNSF --number 4022

# With item number
npm run test:bnsf -- --owner BNSF --number 4022 --item 31750

# Short form
npm run test:bnsf -- -o BNSF -n 4022 -i 31750
```

### Manual Test with curl
```bash
# Set environment
export BNSF_BASE_URL="https://customer.bnsf.com"

# Test carload rates
curl -X POST "${BNSF_BASE_URL}/v1/carload-rates" \
  --cert certs/bnsf-client-cert.pem \
  --key certs/bnsf-client-key.pem \
  -H "Content-Type: application/json" \
  -d '{
    "priceAuthorityOwner": "BNSF",
    "priceAuthorityNumber": "4022"
  }'
```

---

## 🔧 Configuration

### Environment Variables

Create `.env.bnsf` (already created for you):

```bash
# BNSF API Configuration
BNSF_BASE_URL=https://customer.bnsf.com
BNSF_CLIENT_CERT_PEM="$(cat certs/bnsf-client-cert.pem)"
BNSF_CLIENT_KEY_PEM="$(cat certs/bnsf-client-key.pem)"
BNSF_FEATURE_ENABLED=true
```

### Using in Code

```typescript
import { BnsfClient } from './packages/connectors/src/bnsf/client';

const client = new BnsfClient({
  certPath: 'certs/bnsf-client-cert.pem',
  keyPath: 'certs/bnsf-client-key.pem',
  apiBaseUrl: 'https://customer.bnsf.com',
  featureEnabled: true,
});

// Get rates
const rate = await client.getRates('Hereford, TX', 'Modesto, CA');
console.log(`Rate: $${rate.ratePerBushel}/bushel`);

// Track cars
const cars = await client.getCars({ status: 'in-transit' });
```

---

## 🛡️ Fallback System

The application automatically falls back to tariff-based rates when:
- BNSF API is disabled (`featureEnabled: false`)
- Certificates are not configured
- API is unavailable or returns an error
- Network timeout occurs

### Tariff Rates (BNSF Tariff 4022 - 2025/2026)

**Base Rate:** $4,400/car (Hereford, TX base)  
**Fuel Surcharge:** $250/car average

| Destination | Differential | Rate/Car | Rate/Bushel |
|-------------|--------------|----------|-------------|
| California Central Valley | +$960 | $5,610 | $1.40 |
| PNW Export | +$600 | $5,250 | $1.31 |
| Texas Gulf | -$260 | $4,390 | $1.10 |
| Southwest Kansas | -$1,020 | $3,630 | $0.91 |
| Texas Panhandle (base) | $0 | $4,650 | $1.16 |

*Assumes 4,000 bushels per car*

---

## ⚠️ Current Status

### ✅ What's Working
- Certificate extraction and validation
- mTLS authentication configuration
- Tariff-based fallback calculations
- Graceful error handling

### ⚠️ Needs Verification
- **API Endpoint URL** - May need confirmation from BNSF
- **Response Format** - Currently receiving HTML instead of JSON
- **Authentication Flow** - May need additional headers

### 📞 Next Steps

1. **Contact BNSF Support** to verify:
   - Correct API base URL
   - Account activation status
   - Required headers beyond mTLS

2. **Test with Known Parameters**:
   - Use tariff number: 4022
   - Test with different item numbers
   - Verify origin/destination format

3. **Review API Documentation** from BNSF for:
   - Exact endpoint paths
   - Request/response schemas
   - Error codes and handling

---

## 🔄 Certificate Renewal

### When to Renew
**Renewal Date:** Set reminder for **November 2026**  
**Expiration:** December 16, 2026

### Renewal Process

1. **Get new certificates** from BNSF/Sectigo
2. **Extract private key**:
   ```bash
   openssl pkcs12 -in new-cert.p12 -nocerts -out certs/bnsf-client-key.pem -nodes -legacy
   ```
3. **Copy certificate**:
   ```bash
   cp new-cert.pem certs/bnsf-client-cert.pem
   ```
4. **Test configuration**:
   ```bash
   ./scripts/run-tests.sh
   ```
5. **Update production** environment

---

## 📚 Additional Resources

### Test Data
- `~/Downloads/bnsf-cars.json` - Sample car tracking data
- Real-time data from BNSF showing corn shipments from Campbell, MN

### Scripts
- `scripts/test-production.ts` - Full production test suite
- `scripts/bnsf_carload_rates_smoke.ts` - BNSF API smoke test
- `scripts/run-tests.sh` - Test runner with environment loading

### Documentation
- `README.md` - General project documentation
- This guide - BNSF-specific reference

---

## 🆘 Troubleshooting

### "Mac verify error: invalid password"
The P12 file is password-protected. Correct password: `Campbell2025`

### "unsupported algorithm RC2-40-CBC"
Use the `-legacy` flag with OpenSSL commands.

### "BNSF API returned HTML"
This indicates:
1. Wrong endpoint URL, or
2. Authentication not properly configured, or
3. API account not fully activated

**Solution:** Contact BNSF support to verify endpoint and activation status.

### "Connection timeout"
Check:
1. Network connectivity
2. Firewall settings
3. BNSF API service status

**Fallback:** Application will automatically use tariff rates.

---

**Last Updated:** February 2, 2026  
**Certificate Status:** ✅ Valid until December 16, 2026
