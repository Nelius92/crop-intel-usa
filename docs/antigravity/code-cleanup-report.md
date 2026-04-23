# Code Cleanup Report

## Scope

Balanced cleanup and structure pass focused on repo health first, then organization, while keeping the current app and API surface stable.

## Completed

- Restored a green baseline:
  - Fixed the extracted `corn-map` syntax/type issues.
  - Aligned buyer-intel scoring to the current 7-signal frontend model, including drought.
  - Corrected heatmap crop threshold drift by sourcing thresholds only from shared `CropType` definitions.
- Centralized shared domain rules:
  - Added `shared/crops` for crop metadata, USDA mappings, and heatmap thresholds.
  - Added `shared/buyerIntel` for canonical buyer-intel scoring logic.
  - Updated frontend and API consumers to use the shared modules.
  - Added `@shared` path support to root Vite/Vitest/TS config and API TS config.
- Split oversized modules by responsibility:
  - `CornMap` now delegates constants, layer helpers, and selection logic to `src/components/corn-map/`.
  - `OpportunityDrawer` now delegates actions, trust/freshness UI, market cards, and type guards to `src/components/opportunity-drawer/`.
  - `buyersService` now re-exports a focused `src/services/buyers/` module set for API adaptation, filtering, live-bid merge, and orchestration.
  - USDA route logic now lives in `apps/api/src/services/usda/` with a thin router in `apps/api/src/routes/usda.ts`.
- Reorganized repo structure:
  - Moved `src/scripts/morningBidScan.ts` and `src/scripts/scrapeBnsfAssets.ts` to top-level `scripts/`.
  - Moved `CloudHealthCheck` and its Gemini/Google Maps helpers into `src/devtools/` and lazy-loaded the feature from `src/App.tsx`.
  - Removed unused frontend-only services:
    - `src/services/bidScraperService.ts`
    - `src/services/mapDataService.ts`
    - `src/services/usdaService.ts`
  - Moved loose Python utilities into `python/legacy/`.
  - Moved documentation/reference assets into `docs/assets/`.
- Tightened runtime hygiene:
  - Replaced remaining frontend `console.log` calls with no-op behavior or dev-only informational logging.
  - Added explicit regression coverage for shared crop-domain thresholds and USDA parser behavior.

## Compatibility Notes

- Preserved existing API routes for `/api/buyers`, `/api/usda`, and `/api/ai`.
- Kept compatibility aliases where they are still part of the app surface or fallback logic:
  - `MarketOracle.hankinsonBasis`
  - `marketDataService.getHankinsonBenchmark()`
  - `marketDataService.updateHankinsonBasis()`

## Residual Follow-Up

- Frontend production build still emits a chunk-size warning for the main bundle at roughly `2.19 MB` minified.
- `baseline-browser-mapping` is stale and produces a warning during test/build runs.
- The benchmark compatibility aliases above can be retired in a later pass once downstream callers are updated.
