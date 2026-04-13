# Crop Intel — Project Context

## Executive Summary
- Crop Intel helps Campbell MN farmers find better crop selling opportunities via BNSF rail vs trucking to local buyers
- Core value: net price comparison (Cash Bid - Rail Freight) against local benchmarks per crop
- Stack: Vite + React 18 + TS + Tailwind frontend, Express + Postgres API backend
- Deployed: Vercel (frontend) + Railway (API + DB)
- **Critical gap**: No automated live cash bid data source — currently hardcoded or manual scraper

## Verified Facts
- `.env` files NOT tracked in git (verified `git ls-files`)
- Node v24.11.1, npm 11.6.2
- 6 test suites exist under vitest
- 182+ buyers across 28 US states in database
- 5 crops supported: Yellow Corn, White Corn, Soybeans, Wheat, Sunflowers

## Project Header

| Field | Value |
|-------|-------|
| App name | Crop Intel (crop-intel-usa) |
| Primary stack | Vite + React 18 + TypeScript + Tailwind CSS (frontend), Express.js + PostgreSQL (API) |
| Package manager | npm 11.6.2 |
| Runtime | Node.js v24.11.1 |
| Deployment target | Vercel (frontend), Railway (API + Postgres) |
| Production URLs | Frontend: https://crop-intel-usa.vercel.app, API: https://crop-intel-api-production.up.railway.app |
| Repository | https://github.com/Nelius92/crop-intel-usa |

## Core User Flows
1. Open app → see buyer table sorted by best net price → compare to local benchmark
2. Switch crop (sunflowers/corn/soybeans/wheat) → see crop-specific pricing + benchmark
3. View map → see geographic spread of buyers + opportunities
4. Click buyer row → see detailed breakdown (cash bid, basis, freight, rail evidence)
5. **[FUTURE]** Submit order → Campbell office receives → contacts buyers → farmer notified

## Farm Origin
- **City**: Campbell, MN (ZIP 56522)
- **Rail access**: BNSF mainline
- All freight calculations originate from Campbell

## Per-Crop Benchmarks
| Crop | Benchmark Buyer | Location | Freight from Campbell |
|------|----------------|----------|----------------------|
| Sunflowers | ADM Enderlin (Northern Sun) | Enderlin, ND | $0 (farmers truck directly) |
| Yellow Corn | Hankinson Renewable Energy | Hankinson, ND | $0.30/bu truck |
| White Corn | Hankinson | Hankinson, ND | $0.30/bu truck |
| Soybeans | Hankinson | Hankinson, ND | $0.30/bu truck |
| Wheat | Hankinson | Hankinson, ND | $0.30/bu truck |

## Crop Price Providers
| Source | Type | Status |
|--------|------|--------|
| Hardcoded defaults | Fallback prices in `marketDataService.ts` | Active (frozen ~Feb 2026) |
| USDA AMS API | Regional basis adjustments via `/api/usda/grain-report` | Active with fallback |
| Bushel portal scraper | Live cash bids via Firecrawl | Manual script run |
| NSA (National Sunflower Assoc.) | Sunflower cash prices | Referenced in code, manual |

## Expected Price Update Frequency
- **Current**: Manual — someone must run scraper scripts
- **Needed**: Daily automated cash bids at minimum
- Cash bids updated periodically (benchmark comparison doesn't need real-time)

## Highest-Risk Areas
1. **Cash bid staleness** — farmers seeing stale prices without clear warning
2. **No order submission flow** — the core business workflow isn't built yet
3. **Benchmark accuracy** — if Enderlin/Hankinson prices are wrong, the comparison is misleading
4. **No automated data feed** — everything depends on manual script runs
