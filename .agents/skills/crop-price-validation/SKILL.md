---
name: crop-price-validation
description: Trace crop price data end-to-end from raw provider to UI display, validating math, units, staleness, and error handling
---

# Crop Price Validation Skill

## Goal
Verify the entire cash bid pipeline produces correct, fresh prices in the UI.

## When to Use
- After changing any pricing service
- After adding a new crop or data source
- During audit of price accuracy

## Procedure
1. Inventory all price providers (scrapers, APIs, hardcoded defaults)
2. Map the transformation: raw → normalized → domain → API → UI
3. For each crop, verify:
   - Symbol/ID mapping
   - Currency and unit conversions ($/bu vs $/cwt)
   - Benchmark comparison math
   - Freight calculation from Campbell, MN
   - Staleness labeling and cache TTL
   - Error and empty states
4. Check for NaN guards on all math operations
5. Verify bid scraper parsing with test data
6. Create `docs/antigravity/crop-price-audit.md`

## Key Files
- `src/services/buyersService.ts` — core pipeline
- `src/services/marketDataService.ts` — benchmark defaults
- `src/services/usdaMarketService.ts` — regional basis
- `src/services/railService.ts` — freight
- `src/services/bnsfService.ts` — BNSF tariff rates
- `apps/api/src/services/bid-scraper.ts` — scraping

## Artifacts
- `docs/antigravity/crop-price-audit.md`

## Definition of Done
- End-to-end transformation map documented
- Per-crop math verified
- Risks ranked with evidence
