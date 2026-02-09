---
description: Verify buyer data accuracy - check websites, phones, and locations
---

# Verify Buyer Data Workflow

This workflow validates buyer information in `buyers.json` to ensure accuracy before production use.

## Prerequisites
- App running locally (`npm run dev`)
- Browser available for testing

## Steps

### 1. Load Buyer Data
```bash
// turbo
cat src/data/buyers.json | head -100
```

### 2. Test Website URLs
For each buyer, verify the website loads:
```bash
# Test first 10 buyer websites
curl -I -s -o /dev/null -w "%{http_code}" https://modestomilling.com
curl -I -s -o /dev/null -w "%{http_code}" https://algilbert.com
curl -I -s -o /dev/null -w "%{http_code}" https://valleywidecoop.com
```

### 3. Validate Phone Format
All phone numbers should match pattern: `(xxx) xxx-xxxx`

```bash
grep -E '"contactPhone":\s*"[^"]*"' src/data/buyers.json | head -20
```

### 4. Check GPS Coordinates
Verify lat/lng are within continental US bounds:
- Latitude: 24.0 to 49.5
- Longitude: -125.0 to -66.5

### 5. Browser Testing
1. Open http://localhost:5173/buyers
2. Click on first 5 buyers
3. For each buyer, test:
   - [ ] Drawer opens correctly
   - [ ] Website button opens correct URL
   - [ ] Call button shows valid phone
   - [ ] Basis and cash price display

### 6. Mark as Verified
After testing, update the buyer entry:
```json
{
  "verified": true,
  "lastVerified": "2026-02-02",
  "verifiedBy": "manual"
}
```

## Reporting Issues
If data is incorrect, update `buyers.json` with corrected information and set `verified: true`.
