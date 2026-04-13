---
description: Full app testing workflow - verify all features work correctly
---

# Crop Intel — Full Pressure Test

## Prerequisites
- Dev server running: `npm run dev` → http://localhost:5173
- Railway backend accessible: https://crop-intel-api-production.up.railway.app
- Production app: https://crop-intel-usa.vercel.app

## Quick Smoke Test
// turbo-all

1. Verify Railway API responds:
```bash
curl -s 'https://crop-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d[\"data\"])} buyers')"
```

2. Verify USDA data is LIVE (not fallback):
```bash
curl -s --max-time 20 'https://crop-intel-api-production.up.railway.app/api/usda/grain-report?commodity=Corn&state=ND' | python3 -c "import json,sys; d=json.load(sys.stdin); s=d.get('data',{}).get('summary',{}); print(f'USDA: Source={d.get(\"source\")} Price=\${s.get(\"avgPrice\",0):.2f}/bu Bids={s.get(\"bidCount\",0)}')"
```

3. Run test suite:
```bash
cd /Users/cornelius/Documents/Corn\ Intel && npm test 2>&1 | tail -5
```

## API Endpoint Tests

### Core Endpoints
- [ ] `GET /api/buyers?scope=all&crop=Yellow%20Corn` → 182 buyers, 28 states
- [ ] `GET /api/buyers?scope=all&crop=Soybeans` → 8+ buyers
- [ ] `GET /api/buyers?scope=all&crop=Sunflowers` → 12+ buyers
- [ ] `GET /api/usda/grain-report?commodity=Corn&state=ND` → source: `usda-ams`, degraded: `false`
- [ ] `GET /api/usda/grain-report?commodity=Soybeans&state=ND` → source: `usda-ams`
- [ ] `GET /api/usda/grain-report?commodity=Wheat&state=ND` → source: `usda-ams`
- [ ] `GET /api/usda/sunflower-report` → source: `usda-ams`, degraded: `false`
- [ ] `GET /health` → status: `ok`

### AI Buyer Intel (POST)
```bash
curl -s --max-time 30 -X POST "https://crop-intel-api-production.up.railway.app/api/ai/buyer-intel" \
  -H "Content-Type: application/json" \
  -d '{"crop":"Yellow Corn","buyerData":{"name":"Dakota Spirit AgEnergy","type":"ethanol","city":"Spiritwood","state":"ND","netPrice":3.55,"benchmarkPrice":3.51,"railConfidence":50,"hasPhone":true,"freightCost":-0.15},"withExplanation":true}'
```
- [ ] Returns `score` (number 0-100)
- [ ] Returns `label` (e.g., "Strong Lead", "Worth Exploring")
- [ ] Returns `explanation` (Gemini-generated text, 200+ chars)

## UI Feature Verification

### Map Tab (Heat Map)
- [ ] Mapbox dark theme loads correctly
- [ ] Buyer markers visible on map with color coding
- [ ] Map layers toggle (Price Heatmap, BNSF Opportunities, BNSF Network Lines, Transloaders)
- [ ] Crop selector works (top right dropdown)

### Buyers Tab
- [ ] Header shows: Benchmark price, futures reference (ZCH6), facility count, cache freshness
- [ ] "LIVE MARKET QUOTES" shows 3 top buyer cards with basis and cash price
- [ ] "BUYER NETWORK" table shows all columns:
  - Facility Name, Intel, Type, Location, Basis, Cash Price, Freight, Net Price, VS Benchmark, Rail Access
- [ ] Sorted by Net Price (highest first)
- [ ] Phone numbers shown for buyers with contacts
- [ ] "Worth Exploring" / "Strong Lead" / "Top Target" badges on Intel column
- [ ] Click a row → Detail drawer opens with:
  - Net Price, Cash Bid, Basis, Freight (with mode icon)
  - Rail Access badge + VS Benchmark
  - Data freshness indicator (green dot)
  - "EXPLAIN THIS CALCULATION" accordion
  - "RAIL SERVED EVIDENCE" section (distance, corridor, score)
  - "WHY CONTACT THIS BUYER?" with Intel score and signal breakdown
  - AI explanation loads (Gemini) when expanded

### Crop Switching
- [ ] Yellow Corn → 182 buyers, ZCH6 @ $4.35, benchmark $3.81
- [ ] Soybeans → 8 buyers, ZSH6 @ $11.42, benchmark $10.87
- [ ] Wheat → buyers load, ZWH6 @ $5.42
- [ ] Sunflowers → 12 buyers, Spot Cash @ $23.30, benchmark $23.30

### Settings Tab
- [ ] Farm Origin: Campbell, MN, 56522
- [ ] Mapbox API Key: "Configured (hidden)"
- [ ] Enable Animations toggle

## Data Accuracy Checks

### Price Math Verification
For any buyer: `Cash Price = Futures + Basis` and `Net Price = Cash - Freight`

Example (Yellow Corn):
- Futures: $4.35
- Basis: -0.65
- Cash: $4.35 + (-0.65) = $3.70 ✓
- Freight: -$0.15 (BNSF)
- Net: $3.70 - $0.15 = $3.55 ✓
- Benchmark: $3.81 - $0.30 (truck) = $3.51
- VS Benchmark: $3.55 - $3.51 = +$0.04 ✓

### USDA Data Quality
- [ ] `source` is `usda-ams` (NOT `fallback`)
- [ ] `degraded` is `false`
- [ ] Report date matches current date (or most recent trading day)
- [ ] Bid count > 0 for all crops
- [ ] Prices are in reasonable ranges (Corn: $3-5, Soy: $9-13, Wheat: $4-7, Sunflowers: $20-30)

### Freight Sanity
- [ ] ND/MN local buyers → low freight ($0.07-$0.30)
- [ ] CA/WA/TX buyers → higher rail freight ($0.80-$1.60)
- [ ] Rail-served buyers (railConfidence >= 40) → show "RAIL FRT"
- [ ] Truck-only buyers (railConfidence < 40) → show "TRUCK"

## Integration Tests
```bash
cd /Users/cornelius/Documents/Corn\ Intel && npm test 2>&1
```
Expected: 130+ tests passing across 6 suites

## Live Production Check
Open https://crop-intel-usa.vercel.app/ in browser and:
1. Verify Yellow Corn loads with 182 buyers
2. Click a buyer → check drawer data matches table
3. Switch to Soybeans → verify different buyers load
4. Switch to Sunflowers → verify 12 buyers at ~$23/cwt
5. Go to Heat Map → verify Mapbox renders with BNSF lines
6. Go back to Buyers → verify data persists

## Farmer Readiness Check
Can you answer these questions from the app RIGHT NOW?
1. "What's the best price I can get for my Yellow Corn today?"
2. "Who should I call to sell my Soybeans?"
3. "Are sunflower prices good right now?"
4. "Is it cheaper to rail or truck my grain?"
5. "How does this price compare to just selling at Hankinson?"

If YES to all 5 → the app is production ready.
