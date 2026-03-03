---
description: Verify buyer data accuracy - check websites, phones, and locations
---

# Verify Buyer Data

## Purpose
Audit the 182+ buyers in the Railway database—check websites are reachable, phone numbers are valid, and lat/lng coordinates match the city/state.

## Quick Audit (API check)
// turbo
```bash
curl -s 'https://corn-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn' | python3 -c "
import sys,json
d=json.load(sys.stdin)
buyers = d.get('data',[])
no_phone = [b for b in buyers if not b.get('facilityPhone')]
no_web = [b for b in buyers if not b.get('website')]
no_rail = [b for b in buyers if b.get('railConfidence') is None]
unverified = [b for b in buyers if b.get('verifiedStatus') != 'verified']
print(f'Total: {len(buyers)}')
print(f'No phone: {len(no_phone)}')
print(f'No website: {len(no_web)}')
print(f'No railConf: {len(no_rail)}')
print(f'Unverified: {len(unverified)}')
"
```

## Verification Steps

### 1. Website Reachability
For buyers with websites, check the URL responds:
```bash
# Extract websites and check HTTP status
curl -s 'https://corn-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn' | python3 -c "
import sys,json
d=json.load(sys.stdin)
for b in d['data']:
    url = b.get('website','')
    if url:
        print(f'{b[\"name\"]}|{url}')
" | while IFS='|' read name url; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)
    echo "$name: $code ($url)"
done
```

### 2. Phone Number Format
Check phone numbers are valid US format (10 digits):
```bash
curl -s 'https://corn-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn' | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
for b in d['data']:
    phone = b.get('facilityPhone','')
    if phone:
        digits = re.sub(r'\D','',phone)
        valid = len(digits) == 10 or len(digits) == 11
        print(f'{'✓' if valid else '✗'} {b[\"name\"]}: {phone}')
"
```

### 3. Location Spot Check
Verify lat/lng places the buyer in the correct state:
```bash
curl -s 'https://corn-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn' | python3 -c "
import sys,json
d=json.load(sys.stdin)
for b in d['data'][:10]:
    print(f'{b[\"name\"]} | {b[\"city\"]}, {b[\"state\"]} | ({b[\"lat\"]}, {b[\"lng\"]})')
"
```

### 4. Priority: Enrich Top Net-Price Buyers First
Focus verification on the highest-value buyers — use web search to find phone, website, email for the top 20.
