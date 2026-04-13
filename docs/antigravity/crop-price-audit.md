# Crop Intel — Crop Price Audit

## Executive Summary
- Cash bids come from 3 sources: scraped Bushel/Barchart → USDA regional basis fallback → hardcoded defaults
- **Freight is a model, not live BNSF API** — rates are hardcoded per-state differentials from a base anchor
- **Benchmark math is correct** but benchmarks themselves are stale (hardcoded Feb 2026 values)
- **Sunflower pricing works differently**: uses cwt not bushels, Enderlin ADM as benchmark
- **Biggest risk**: price freshness — all "live" data requires manual script runs

## Verified Facts
- `benchmarkDiff` NaN guard exists in `buyersService.ts:197` ✅
- Crop-specific bushels/car conversion is correct (corn 4000, beans 3667, sunflowers 8800) ✅
- Haversine distance calculation is mathematically correct ✅
- Cache TTLs are reasonable (freight 12h, market 30m, USDA 60m, buyers 30m) ✅
- USDA basis cents→dollars conversion handles edge cases (threshold at ±5) ✅
- Tests cover pricing accuracy, freight stress, rail confidence, data integrity ✅

## Not Yet Verified
- Whether hardcoded BNSF Tariff 4022 rates match actual tariff
- Whether bid scraper regex correctly parses all Bushel portal formats
- Whether Barchart scraping works (only 'ND' state configured, Barchart has anti-bot)
- Current Enderlin ADM or Hankinson cash bid accuracy

---

## End-to-End Transformation Map

### 1. Raw Provider → Ingestion

| Source | Method | Files | Frequency |
|--------|--------|-------|-----------|
| Bushel/Scoular portal | Firecrawl scrape → markdown → regex parse | `bid-scraper.ts`, `scripts/scrape-live-bids.ts` | Manual |
| Barchart cash grain | Firecrawl scrape → table parse | `bid-scraper.ts` | Manual (blocked by anti-bot) |
| USDA AMS API | HTTP GET via API proxy | `usdaMarketService.ts` | On-demand with 60m cache |
| Hardcoded defaults | Static objects in code | `marketDataService.ts` | Never (stale) |

### 2. Ingestion → Storage

| Step | Where |
|------|-------|
| Scraped bids → fuzzy match buyer name → UPDATE `buyers` table (`cash_bid`, `posted_basis`, `bid_date`, `bid_source`) | `bid-scraper.ts:upsertScrapedBids()` |
| USDA data → in-memory cache | `usdaMarketService.ts` |
| Market defaults → in-memory + localStorage cache | `marketDataService.ts` |

### 3. Storage → API → Frontend

| Step | Where |
|------|-------|
| `GET /api/buyers?scope=all&crop=X` → Postgres query → JSON response | `apps/api/src/routes/buyers.ts` |
| Frontend `fetchBuyerContactsFromApi()` → maps API records to `Buyer` objects | `buyersService.ts:46-80` |

### 4. Frontend → Price Calculation

```
For each buyer:
  IF buyer.cashBid exists (scraped):
    cashPrice = cashBid
    basis = cashPrice - futuresPrice (back-calculated)
    confidence = 'verified'
  ELSE:
    basis = USDA regional adjustment for buyer.state
    cashPrice = futuresPrice + basis
    confidence = 'estimated'
  
  freight = bnsfService.calculateRate() or truckFreightService.calculateRate()
  netPrice = cashPrice - freight
  benchmarkDiff = netPrice - (benchmarkCashPrice - benchmarkFreight)
```

### 5. Price → UI Display

| Column | Source | File |
|--------|--------|------|
| Cash Price | `buyer.cashPrice` | `BuyerTable.tsx` |
| Basis | `buyer.basis` | `BuyerTable.tsx` |
| Freight | `buyer.freightCost` (negative display) | `BuyerTable.tsx` |
| Net Price | `buyer.netPrice` | `BuyerTable.tsx` |
| VS Benchmark | `buyer.benchmarkDiff` | `BuyerTable.tsx` |
| EST/VERIFIED badge | `buyer.provenance.basis.confidence` | `BuyerTable.tsx` |

---

## Findings by Category

### A. Symbol/ID Mapping
- ✅ Crop types properly mapped: `CropType = 'Yellow Corn' | 'White Corn' | 'Soybeans' | 'Wheat' | 'Sunflowers'`
- ✅ Buyer types properly mapped: 9 types including `ethanol`, `feedlot`, `processor`, `transload`
- ⚠️ Bid scraper commodity mapping is fragile: `if (lowerLine.includes('soybean'))` — could match false positives

### B. Currency/Unit Conversions
- ✅ Corn/beans/wheat use $/bu, sunflowers use $/cwt — handled via `marketDataService.MARKET_DEFAULTS`
- ✅ Bushels per car varies by crop (corn 4000, sunflowers 8800)
- ⚠️ `usdaMarketService.ts:278` basis cents→dollars threshold at ±5 — could misclassify edge cases like basis of exactly -5.00

### C. Benchmark Logic
- ✅ Per-crop benchmarks: Hankinson for corn/beans/wheat, Enderlin for sunflowers
- ✅ Benchmark freight: $0.30/bu for Hankinson (truck from Campbell), $0 for Enderlin
- ⚠️ Benchmark prices are hardcoded: corn futures $4.35, sunflower cash $23.30
- ❌ No automated update mechanism for benchmark prices

### D. Freight Calculation
- ✅ Campbell, MN origin hardcoded: lat 45.9669, lng -96.4003
- ✅ State-based rate differentials (CA +$960, PNW +$600, KS -$1020, TX base $4400)
- ✅ Short-haul (MN/ND/SD) uses Haversine for actual distance
- ⚠️ Base rate ($4400/car) + fuel surcharge ($250/car) are estimates, not live BNSF API
- ⚠️ Many states have no specific rate → default $500/car used

### E. Staleness & Cache
- ✅ Cache TTLs defined: freight 12h, market 30m, USDA 60m, buyers 30m
- ✅ Cache has L1 (memory) and L2 (localStorage) for persistence
- ⚠️ "Cached · X min ago" header exists but doesn't distinguish between "real data cached 5m ago" vs "hardcoded defaults cached 5m ago"

### F. Error/Empty States
- ✅ API fallback to `buyers.json` when backend is down
- ✅ NaN guard on `benchmarkDiff` (line 197)
- ⚠️ No explicit "data is stale" UI warning — only cache age shown
- ⚠️ If scraper returns 0 bids, old bids remain in DB without expiry

---

## Critical Risks (Ranked)

1. **No automated live data** — all prices require manual intervention
2. **Hardcoded benchmark prices** — if Hankinson/Enderlin prices change, comparisons are wrong
3. **Fragile bid scraper** — regex parsing of markdown is brittle, no validation tests
4. **Barchart blocked** — only 'ND' configured, anti-bot likely blocks scraping
5. **No bid expiration** — old scraped bids stay in DB indefinitely
6. **Missing states in freight model** — some states default to generic $500/car rate

## Recommended Data Source Strategy

For launch viability, the minimum automated data pipeline should be:
1. **Daily benchmark update**: Script that fetches today's Hankinson cash bid and Enderlin ADM price (could call the elevators' posted prices or scrape their websites)
2. **Scoular Bushel scraper on cron**: Already works — just needs to be automated (Railway cron or Mac mini launchd)
3. **USDA AMS proxy**: Already implemented — just needs to be verified in production
4. **Bid expiration**: Mark bids older than 3 business days as stale
