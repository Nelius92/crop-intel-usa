# Crop Intel — Assumption Challenge Matrix

## Executive Summary
- Product purpose confirmed by owner: operational tool for Campbell MN area farmers
- Core problem: farmers truck to local buyers at a loss; app shows rail alternatives
- Missing: order submission flow, automated cash bid data, price alerts
- Data trust is the #1 risk — stale prices without clear warning

---

## A) Purpose & Target Users

### 1. Primary Purpose
**Answer**: Operational pricing dashboard + order submission tool

Farmers see net prices after BNSF rail freight compared to local benchmarks, then submit orders through the Campbell facility office.

**Evidence**: Owner stated: *"The farmer has 10 rail cars of sunflowers to sell → go to app → see pricing → submit it → office gets it → reaches out to buyers."*

**Why it matters**: UI must prioritize clarity of benchmark comparison and make the submission flow dead simple.

### 2. Target Users
**Answer**: Farmers/producers in the Campbell, MN area

**Evidence**: Owner: *"Local farmers in and around the Campbell MN area to have access to sell their [crops on the] open market."*

**Why it matters**: These are farmers, not traders. Simplicity > sophistication. Spotty rural connectivity is likely. Offline-first patterns would help.

---

## B) Core Problem Solved

### 3. Daily Decision
**Answer**: "Should I truck to Enderlin/Hankinson, or ship via rail through Campbell for a better price?"

**Evidence**: Owner: *"Enderlin is our closest sunflower buyer that puts farmers in the position to just truck and sell it to them and lock in their price even at a loss — we need to fix that problem."*

**Why it matters**: The benchmark comparison must be correct and current. If Enderlin's price is wrong, the whole value prop collapses.

---

## C) Success Metrics

### 4. Quantitative
**Answer (likely)**:
- Number of orders submitted through app
- Revenue per rail car vs what farmer would have gotten locally
- Number of farmers actively using the app

**Evidence**: Inferred from product purpose — the order flow is the conversion event.

### 5. Qualitative
**Answer**: User trust — "The prices make sense and I can see I'm getting a better deal"

**Evidence**: Owner emphasis on comparing to local benchmarks farmers already know (Enderlin, Hankinson). Trust comes from showing familiar reference points.

---

## D) Primary Journeys

### 6. Top 3 User Journeys

**Journey 1**: Find best sunflower buyer
1. Open app → crop selector: Sunflowers
2. See buyer table sorted by net price
3. See "VS BENCHMARK" column showing $ better than Enderlin
4. Click top buyer → see freight breakdown + cash bid source
5. **[FUTURE]** Tap "Submit Order" → office notified

**Journey 2**: Compare corn opportunities
1. Open app → default: Yellow Corn
2. Scan buyers beating Hankinson benchmark
3. Filter by rail-accessible (BNSF ✓)
4. Review top opportunities on map

**Journey 3**: Morning price check
1. Open app → see current pricing summary
2. Check if any new opportunities worth pursuing
3. **[FUTURE]** See alerts for price threshold crossings

---

## E) Edge Cases

### 7. Failure Modes
| Scenario | Current Handling | Risk |
|----------|-----------------|------|
| No scraped bids | Falls back to USDA regional estimates with EST badge | **Medium** — estimates may mislead |
| Stale cache | Shows cached data with "X min ago" label | **Medium** — could be hours old |
| API backend down | Falls back to `buyers.json` static file | **Low** — degrades gracefully |
| Weekend/no trading | Shows last known prices | **Low** — cash bids don't change on weekends |
| Missing state mapping | Defaults to "Central Plains" basis | **Low** — reasonable default |
| NaN in calculations | Guards added in `buyersService.ts` line 197 | **Fixed** |

---

## F) Regulatory, Licensing & Privacy

### 8. User Data Collected
**Answer**: No authentication — no personal data collected currently.

**Evidence**: No auth routes, no login UI, no user table in database. `App.tsx` has no auth guard.

**Future concern**: When order submission is built, farmer contact info will be collected.

### 9. Market Data Licensing
**Answer**: Primarily public/free sources (USDA AMS), plus scraped Bushel portals.

**Evidence**: `usdaMarketService.ts` uses USDA AMS (public). `bid-scraper.ts` scrapes Bushel-powered portals via Firecrawl. No CME or licensed vendor feeds.

**Risk**: Bushel portal scraping may violate terms of service. Should document this risk.

---

## G) Monetization

### 10. Business Model
**Answer**: Internal tool / transload facility value-add — Campbell facility earns revenue from rail car handling.

**Evidence**: Owner operates the Campbell transload facility. More farmers shipping via rail = more business.

---

## H) Latency & Accuracy

### 11. Acceptable Staleness
| Price Type | Acceptable | Current |
|-----------|-----------|---------|
| Cash bids | Daily updates | Manual script — unknown frequency |
| Benchmark (local) | Daily updates | Hardcoded — stale |
| Rail freight | Weekly is fine | 12h cache — adequate |

### 12. Accuracy Tolerance
**Answer**: "Exact provider value" — farmers will compare to prices they can verify by calling the elevator. Any rounding error destroys trust.

**Evidence**: Owner emphasis on cash bid accuracy. Farmers know what Enderlin pays today — if the app disagrees, trust is broken.

---

## Not Yet Verified
- Exact current Enderlin/Hankinson prices (need live verification)
- Bushel scraper terms of service compliance
- Whether USDA AMS API proxy works in production
- API backend health and Postgres connectivity
- Whether all 182+ buyers render without errors
