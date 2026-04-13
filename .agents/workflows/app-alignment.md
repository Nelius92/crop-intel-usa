---
description: Crop Intel app alignment - how every feature should work, data flow, and quality standards
---

# Crop Intel — App Alignment Skill

> **This is the single source of truth** for how the Crop Intel app should work.
> Every AI agent working on this project MUST read this before making changes.

## Mission
Campbell MN farm with BNSF rail access → find the best corn selling opportunities in the US → calculate net price (Cash Bid - Rail Freight) → surface top opportunities daily.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Vercel Frontend │────▶│  Railway API      │────▶│  PostgreSQL DB  │
│  (Vite + React)  │     │  (Express.js)     │     │  (182+ buyers)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                                 ▲
        │                                                 │
        ▼                                          ┌──────┴──────┐
  ┌───────────┐                                    │  Firecrawl   │
  │  Mapbox GL │                                    │  Scraper     │
  │  (Heatmap) │                                    │  (Bushel)    │
  └───────────┘                                    └─────────────┘
```

### Stack
| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | Vite + React + TypeScript | `src/` |
| Backend API | Express.js on Railway | `apps/api/` |
| Database | PostgreSQL (Railway) | 182+ buyers |
| Maps | Mapbox GL JS | Dark theme |
| Scraper | Firecrawl SDK | `scripts/scrape-live-bids.ts` |
| Deployment | Vercel (frontend), Railway (API) | `vercel.json` |

### Key URLs
- **Local**: http://localhost:5173
- **Production**: https://crop-intel-usa.vercel.app
- **API**: https://crop-intel-api-production.up.railway.app
- **Repo**: https://github.com/Nelius92/crop-intel-usa

---

## Data Pipeline

### Price Calculation (the core formula)
```
Net Price = Cash Price - Freight Cost
Cash Price = Futures Price + Basis
```

### Data Sources (in priority order)
1. **Live Scraped Bids** (highest priority) — from Bushel portals via Firecrawl
2. **USDA Regional Basis** (fallback) — estimated pricing using regional averages
3. **Futures Price** — CME corn futures (ZCH6 = Mar 2026 front-month)

### Pricing Logic (`buyersService.ts`)
```
IF buyer has scraped cash bid → use it directly (VERIFIED badge)
ELSE → Cash = Futures + USDA Regional Basis (EST badge)
```

### Freight Logic (`railService.ts` + `bnsfService.ts`)
```
IF railConfidence >= 40 → BNSF Tariff 4022 rail rate (RAIL FRT)
ELSE → Truck freight rate per mile (TRUCK)
```

### Benchmark
- **Hankinson, ND** — local elevator benchmark
- Formula: `HankNet = HankCash - $0.30 truck freight`
- "VS BENCHMARK" column = `buyer.netPrice - hankinsonNetPrice`
- Green (+) = better than selling locally at Hankinson

---

## Farm Origin
- **City**: Campbell
- **State**: MN
- **Zip**: 56522
- **BNSF Access**: YES (BNSF mainline)
- All freight calculations originate from Campbell, MN

---

## UI Tabs

### 1. Heat Map
- Mapbox dark theme with corn price heatmap overlay
- Buyer markers with color coding by opportunity quality
- **Top 3 Opportunities** panel shows best net-price buyers
- Each card shows: Basis, Cash Price, Net Price, "TRADE NOW" button
- Header shows: ZCH6 futures price, benchmark Hankinson price, buyer count, cache freshness

### 2. Buyers
- Table of all 182+ facilities sorted by Net Price (highest first)
- Columns: Facility Name, Type, Location, Basis, Cash Price, Freight, Net Price, VS Benchmark, Rail Access
- **Type badges**: PROCESSOR, FEEDLOT, ELEVATOR, TRANSLOAD, ETHANOL
- **Freight display**: Red text showing `-$X.XX RAIL FRT` or `-$X.XX TRUCK`
- **Rail Access badges**: BNSF ✓ (100), Likely (40-99), Unverified (<40)
- Click any row → opens **Detail Drawer**

### 3. Detail Drawer
- Net Price, Cash Bid, Basis, Freight (with mode icon)
- Rail Access status + VS HANK comparison
- Data freshness indicator (green dot = fresh)
- **"EXPLAIN THIS CALCULATION"** accordion — shows full provenance
- **"RAIL SERVED EVIDENCE"** — distance to track, nearest BNSF corridor, confidence score

### 4. Settings
- **Mapbox API Key**: Configured (hidden)
- **Farm Origin**: Campbell, MN, 56522 (editable)
- **Enable Animations**: Toggle

---

## Buyer Database

### Coverage: 28 states, 182+ buyers
Top states: ND (20), KS (18), IA (14), MN (14), CA (12), NE (12), TX (12)

### Buyer Types
- **processor** — corn processors (ethanol, feed mills, food)
- **feedlot** — cattle feedlots
- **elevator** — grain elevators
- **transload** — rail transload facilities
- **ethanol** — ethanol plants

### Rail Confidence Scale
| Score | Badge | Freight Method |
|-------|-------|---------------|
| 100 | BNSF ✓ | BNSF Tariff 4022 |
| 40-99 | Likely | BNSF Tariff 4022 |
| 0-39 | Unverified | Truck rate |
| null | — | Truck rate |

---

## Live Bid Scraper

### Bushel-Powered Portals (working)
| Portal | Typical Yield | States |
|--------|--------------|--------|
| Scoular | ~111 corn bids | KS, NE |
| AGP | ~7 corn bids | NE |
| CHS Farmers Alliance | varies | MN, ND, SD |
| Gavilon | varies | NE, IA, KS |
| Premier Companies | varies | TX, KS, OK |

### Run Command
```bash
npx tsx scripts/scrape-live-bids.ts
```
Output: `/tmp/live-bids.json`

### Barchart (deferred)
Blocked by anti-bot. Future work: Firecrawl Browser Sandbox with upgraded plan.

---

## Caching Strategy (`cacheService.ts`)
| Namespace | TTL | Purpose |
|-----------|-----|---------|
| FREIGHT | 12h | Rail/truck rates (change slowly) |
| MARKET | 30min | Futures prices |
| USDA | 60min | Regional basis data |
| ORACLE | 60min | Gemini AI recommendations |
| BUYERS | 30min | Enriched buyer data |

---

## API Endpoints (Railway)

### Working
- `GET /api/buyers?scope=all&crop=Yellow%20Corn` — all buyers with metadata

### Proxy Config
- **Dev**: Vite proxy in `vite.config.ts` → Railway
- **Prod**: `vercel.json` rewrites → Railway

---

## Design System

### Colors
- Background: `#120202` (corn-base)
- Accent: Yellow-Gold (corn-accent)
- Borders: `white/10` with `backdrop-blur-md`
- Positive values: Green
- Negative values: Red
- Freight: Red text

### Typography
- Headers: Bold, white
- Data: Tabular numbers, right-aligned for prices
- Badges: ALL CAPS, small, with colored backgrounds

### Theme
- Mapbox: Dark theme (nighttime)
- Glassmorphism panels with blur effects
- Professional, premium look — NOT a simple MVP

---

## Quality Rules

1. **Never show a price without provenance** — every number must trace back to a source
2. **EST badge required** on estimated (non-scraped) prices
3. **Rail-first sorting** — BNSF freight advantages should surface in net price ranking
4. **Benchmark transparency** — VS HANK column shows value vs local Hankinson elevator
5. **Farm Origin is sacred** — ALL freight calculations must originate from Campbell, MN
6. **Cache freshness** — show "Cached · X min ago" in header
7. **No console.log in production** — clean console output
8. **Responsive design** — works on desktop and mobile (bottom nav for mobile)

---

## Testing

### Run Tests
```bash
npm test
```
Expected: 88+ passing (some may be infrastructure-dependent)

### Manual Verification
Use the `/test-app` workflow for a full feature checklist.

### Key Assertions
- CA buyers → RAIL FRT ~$1.40, Net ~$4.40
- ND/MN buyers → TRUCK freight
- All 182+ buyers have prices (no blank/NaN)
- Sorting is by Net Price descending
- Benchmark diff is positive for good opportunities
