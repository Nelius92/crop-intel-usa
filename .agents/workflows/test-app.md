---
description: Full app testing workflow - verify all features work correctly
---

# Corn Intel — Test App Workflow

## Prerequisites
- Dev server running: `npm run dev` → http://localhost:5173
- Railway backend accessible: https://corn-intel-api-production.up.railway.app

## Quick Smoke Test
// turbo-all

1. Verify Railway API responds:
```bash
curl -s 'https://corn-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn&limit=3' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d[\"data\"])} buyers')"
```

2. Verify local dev server is running:
```bash
curl -s http://localhost:5173/ | head -c 100
```

3. Run test suite:
```bash
cd /Users/cornelius/Documents/Corn\ Intel && npm test 2>&1 | tail -5
```

## Full Feature Verification

### Map Tab
- [ ] Heatmap renders with Mapbox (dark theme)
- [ ] Top 3 Opportunities panel shows best basis buyers
- [ ] Markers are clickable
- [ ] Crop selector (Yellow Corn) works in top-right

### Buyers Tab
- [ ] "182 ONLINE" badge shows (or current buyer count)
- [ ] Table columns: Facility Name, Type, Location, Basis, Cash Price, Freight, Net Price, Vs Benchmark, Rail Access
- [ ] Sorted by Net Price (highest first)
- [ ] CA buyers show RAIL FRT ~$1.40 (BNSF Tariff 4022)
- [ ] EST badge on estimated prices (non-scraped)
- [ ] Click a row → Detail drawer opens
- [ ] Detail drawer shows: Net Price, Cash Bid, Basis, Freight, Rail Access, VS HANK, data freshness
- [ ] "EXPLAIN THIS CALCULATION" accordion works
- [ ] "RAIL SERVED EVIDENCE" section shows distance to track + corridor

### Settings Tab
- [ ] Farm Origin: Campbell, MN, 56522
- [ ] Mapbox API Key: "Configured (hidden)"
- [ ] Enable Animations toggle works

### Data Accuracy Checks
- [ ] Futures price matches ZCH6 (or current front month)
- [ ] Benchmark shows Hankinson basis (-0.54) and cash ($3.81 or current)
- [ ] CA Net prices ~$4.40 (Cash $5.80 - Rail $1.40)
- [ ] ND/MN buyers show TRUCK freight (not RAIL)
- [ ] Rail-accessible buyers (railConfidence >= 40) show RAIL FRT

### Scraper Test
```bash
cd /Users/cornelius/Documents/Corn\ Intel && npx tsx scripts/scrape-live-bids.ts
```
- [ ] Should return 100+ corn bids from Bushel portals
- [ ] Results saved to /tmp/live-bids.json
