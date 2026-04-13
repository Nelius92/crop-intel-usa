# Crop Intel — App Architecture Audit

## Executive Summary
- Monorepo with frontend (`src/`) and API backend (`apps/api/`)
- Tab-based routing (Map, Buyers, Settings) with `useState` — no router library
- In-memory + localStorage cache with TTL (no Redis)
- No authentication — fully open
- 17 frontend services, 7 API routes, 3 DB repositories, 7 CLI tools
- Price pipeline: hardcoded defaults → USDA regional basis → scraped bids → cache → UI

## Environment (verified)
- OS: macOS
- Node: v24.11.1, npm: 11.6.2
- Build: Vite 5.1, TypeScript 5.3
- Test: Vitest 4.0 with jsdom

---

## Project Structure

```
crop-intel-usa/
├── src/                          # Frontend (Vite + React)
│   ├── App.tsx                   # Root: tab routing (map/buyers/settings)
│   ├── main.tsx                  # Entry point
│   ├── types.ts                  # Core types (Buyer, CropType, PriceProvenance)
│   ├── pages/
│   │   ├── HeatMapPage.tsx       # Mapbox heatmap + top opportunities
│   │   ├── BuyersPage.tsx        # Buyer table with sorting/filtering
│   │   ├── SettingsPage.tsx      # Config (farm origin, API keys)
│   │   └── UnderConstructionPage.tsx
│   ├── components/               # 16 UI components
│   │   ├── BuyerTable.tsx        # Main buyer data table (24KB — largest component)
│   │   ├── CornMap.tsx           # Mapbox integration (41KB — most complex)
│   │   ├── OpportunityDrawer.tsx  # Buyer detail drawer (29KB)
│   │   └── ... (13 more)
│   ├── services/                 # 17 frontend services
│   │   ├── buyersService.ts      # Core price pipeline
│   │   ├── marketDataService.ts  # Benchmark defaults + cache
│   │   ├── usdaMarketService.ts  # USDA AMS regional basis
│   │   ├── railService.ts        # Freight from Campbell
│   │   ├── bnsfService.ts        # BNSF Tariff 4022 rates
│   │   ├── cacheService.ts       # L1 memory + L2 localStorage with TTL
│   │   ├── gemini.ts             # AI recommendations (Gemini)
│   │   └── ... (10 more)
│   ├── data/
│   │   ├── buyers.json           # 121KB fallback buyer data
│   │   └── bnsf_opportunities.json
│   └── test/                     # Test setup
├── apps/api/                     # Backend API (Express)
│   ├── src/
│   │   ├── server.ts             # Express app + middleware
│   │   ├── routes/               # 7 routes (health, buyers, usda, meta, ai, recommendations, places)
│   │   ├── services/             # 5 services (bid-scraper, buyer-contact-sync, gemini, google-places, website-verification)
│   │   ├── repositories/         # 3 repos (buyers, recommendations, sync-runs)
│   │   ├── cli/                  # 7 CLI tools (seed, sync, migrate, bid-pipeline, review)
│   │   ├── db/                   # Postgres pool + migrations
│   │   └── middleware/           # CORS, rate-limit, error-handler
│   └── package.json
├── scripts/                      # 16 utility scripts
│   ├── scrape-live-bids.ts       # Bushel portal scraper
│   ├── update-morning-prices.ts  # Manual price update
│   ├── test-production.ts        # Production smoke test
│   └── ...
├── docs/                         # Project docs
├── .agents/workflows/            # 4 existing workflows
└── package.json                  # Root package
```

---

## Entry Points
| Entry | File | Purpose |
|-------|------|---------|
| Frontend | `src/main.tsx` → `App.tsx` | React app root |
| API server | `apps/api/src/server.ts` | Express listener |
| CLI tools | `apps/api/src/cli/*.ts` | Seeding, syncing, migrations |
| Scripts | `scripts/*.ts` | Scrapers, price updates, tests |

## Routing
- **Frontend**: Tab-based via `useState<'map' | 'buyers' | 'settings'>` in `App.tsx` — no React Router
- **API**: Express Router per resource (`/api/buyers`, `/api/usda`, `/api/ai`, `/api/meta`, `/api/recommendations`, `/api/places`, `/health`)

## State Management
- React `useState` only — no global store (Redux, Zustand, etc.)
- Crop selection lifted to `App.tsx`, passed down as props
- Cache state in `cacheService.ts` singleton (memory Map + localStorage)

## API Layer
- **Dev**: Vite proxy (`/api` → Railway production API)
- **Prod**: Vercel rewrites (`vercel.json` → Railway)
- **API middleware**: Helmet, CORS, rate-limiter, express.json, request logging

## Database
- PostgreSQL on Railway
- 3 repositories: buyers, recommendations, sync-runs
- Migrations in `apps/api/src/db/migrations.ts`
- Auto-migrate on startup if `AUTO_RUN_MIGRATIONS=true`

## Cache Layer
| Namespace | TTL | Purpose |
|-----------|-----|---------|
| `freight` | 12h | BNSF/truck rates (keyed by state::city) |
| `market` | 30m | Benchmark prices per crop |
| `usda` | 60m | USDA regional basis data |
| `oracle` | 60m | Gemini AI recommendations |
| `buyers` | 30m | Fully-computed buyer list per crop |

## Background/Scheduled Jobs
- None automated — all manual script runs
- `scripts/run-daily-scraper.sh` exists but not cron'd
- `ops/launchd/` has templates for Mac mini cron jobs

## Authentication
- **None** — fully open, no login/sessions

## Logging
- Frontend: `console.log`/`console.warn`
- API: Winston logger (`apps/api/src/logger.ts`)
