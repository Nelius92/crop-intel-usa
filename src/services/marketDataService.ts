// Service to manage global market data
// Connected to real market data sources for production accuracy

import { DataSource } from '../types';
import { cacheService, CACHE_TTL } from './cacheService';

export interface MarketData {
    futuresPrice: number;
    contractMonth: string;
    lastUpdated: string;
    source: 'usda' | 'cme' | 'nsa' | 'cached' | 'fallback';
    // Crop-specific benchmark (Hankinson→Corn, Enderlin→Sunflowers)
    benchmarkBasis: number;
    benchmarkCashPrice: number;
    benchmarkName: string;
    benchmarkFreight: number; // truck freight to benchmark ($0.30 for Hankinson, $0 for Enderlin)
    priceUnit: string;        // '$/bu' or '$/cwt'
}

// ── Crop-Specific Benchmark Configuration ──
// Each crop has its own benchmark location — NO cross-contamination.
//   Yellow Corn     → Hankinson Renewable Energy, ND (~25 mi truck)
//   Soybeans        → AGP Dawson, MN (~30 mi truck)
//   Wheat           → SD Wheat Growers Aberdeen, SD (~70 mi truck)
//   Sunflowers      → ADM Enderlin (Northern Sun), ND (farmers drive)
//   White Corn      → No local buyer near Campbell
//
// NSA daily market news (03/19/2026):
//   ADM Enderlin:  $23.30/cwt cash, $22.80 AOG
//   Cargill WF:    $23.20/cwt cash, $22.70 AOG
//   Colorado Mills: $22.20/cwt AOG
//
// BENCHMARK FREIGHT: Farmer self-delivery cost ($0.25/bu) to each
// benchmark location. This is what a farmer would spend hauling grain
// from their farm to Hankinson/Enderlin/AGP Dawson. Including this
// in the benchmark net shows the true savings of using Campbell rail.

interface CropDefaults {
    price: number;
    contract: string;
    benchmarkBasis: number;
    benchmarkName: string;
    benchmarkFreight: number;
    priceUnit: string;
}

const MARKET_DEFAULTS: Record<string, CropDefaults> = {
    'Yellow Corn': {
        price: 4.5425,
        contract: "ZCK6 (May '26)",
        benchmarkBasis: -0.40,       // Guardian Hankinson spot bid Apr 23, 2026 → $4.14 cash
        benchmarkName: 'Hankinson',
        benchmarkFreight: 0.25,      // Farmer self-delivery cost to Hankinson (~$0.25/bu)
        priceUnit: '$/bu'
    },
    'White Corn': {
        price: 4.85,
        contract: "ZCN6 (Jul '26)",
        benchmarkBasis: 0,               // No local white corn buyer — no benchmark
        benchmarkName: 'No Local Buyer',
        benchmarkFreight: 0,
        priceUnit: '$/bu'
    },
    'Soybeans': {
        price: 10.52,
        contract: "ZSN6 (Jul '26)",
        benchmarkBasis: -0.55,           // AGP Dawson est. basis (nearest crush ~30mi)
        benchmarkName: 'AGP Dawson',
        benchmarkFreight: 0.25,          // Farmer self-delivery cost to AGP Dawson (~$0.25/bu)
        priceUnit: '$/bu'
    },
    'Wheat': {
        price: 5.48,
        contract: "ZWN6 (Jul '26)",
        benchmarkBasis: -0.45,           // SD Wheat Growers Aberdeen est. basis (~70mi)
        benchmarkName: 'SD Wheat Growers Aberdeen',
        benchmarkFreight: 0.25,          // Farmer self-delivery cost (~$0.25/bu)
        priceUnit: '$/bu'
    },
    'Sunflowers': {
        price: 23.30,                // ADM Enderlin cash $/cwt (NSA 03/19/2026)
        contract: 'Spot Cash (High-Oleic)',
        benchmarkBasis: 0,           // Enderlin IS the benchmark — basis is zero
        benchmarkName: 'Enderlin ADM',
        benchmarkFreight: 1.00,      // Farmer self-delivery $0.25/bu × 4 bu/cwt = $1.00/cwt
        priceUnit: '$/cwt'
    }
};

// Helper to create market data
function createMarketData(
    futuresPrice: number,
    contractMonth: string,
    source: MarketData['source'],
    benchmarkBasis: number,
    benchmarkName: string,
    benchmarkFreight: number,
    priceUnit: string
): MarketData {
    return {
        futuresPrice,
        contractMonth,
        lastUpdated: new Date().toISOString(),
        source,
        benchmarkBasis,
        benchmarkCashPrice: parseFloat((futuresPrice + benchmarkBasis).toFixed(2)),
        benchmarkName,
        benchmarkFreight,
        priceUnit
    };
}

export const marketDataService = {
    // Get market data for a specific crop
    getCropMarketData: (crop: string = 'Yellow Corn'): MarketData => {
        // Check unified cache first (30m TTL)
        const cached = cacheService.get<MarketData>('market', crop);
        if (cached) return cached;

        // Default to Yellow Corn if crop not found
        const defaults = MARKET_DEFAULTS[crop] || MARKET_DEFAULTS['Yellow Corn'];
        const data = createMarketData(
            defaults.price,
            defaults.contract,
            'fallback',
            defaults.benchmarkBasis,
            defaults.benchmarkName,
            defaults.benchmarkFreight,
            defaults.priceUnit
        );
        cacheService.set('market', crop, data, CACHE_TTL.MARKET_MS);
        return data;
    },

    // Backward compatibility for existing code (defaults to Corn)
    getCurrentFuturesPrice: (): number => {
        return marketDataService.getCropMarketData('Yellow Corn').futuresPrice;
    },

    getActiveContract: (): string => {
        return marketDataService.getCropMarketData('Yellow Corn').contractMonth;
    },

    // Get benchmark for a specific crop (crop-aware)
    getBenchmark: (crop: string = 'Yellow Corn'): { basis: number; cashPrice: number; name: string; freight: number } => {
        const data = marketDataService.getCropMarketData(crop);
        return {
            basis: data.benchmarkBasis,
            cashPrice: data.benchmarkCashPrice,
            name: data.benchmarkName,
            freight: data.benchmarkFreight
        };
    },

    // Legacy alias — defaults to Corn Hankinson
    getHankinsonBenchmark: (): { basis: number; cashPrice: number } => {
        const data = marketDataService.getCropMarketData('Yellow Corn');
        return {
            basis: data.benchmarkBasis,
            cashPrice: data.benchmarkCashPrice
        };
    },

    // Get full market data with source info (defaults to Corn)
    getMarketData: (): MarketData => {
        return marketDataService.getCropMarketData('Yellow Corn');
    },

    // Async fetch of latest futures price from real source
    fetchLatestFuturesPrice: async (): Promise<MarketData> => {
        cacheService.invalidate('market');
        return marketDataService.getCropMarketData('Yellow Corn');
    },

    // Update benchmark basis for a specific crop
    updateBenchmarkBasis: (basis: number, crop: string = 'Yellow Corn'): void => {
        const current = marketDataService.getCropMarketData(crop);
        const updated = createMarketData(
            current.futuresPrice, current.contractMonth, 'cached', basis,
            current.benchmarkName, current.benchmarkFreight, current.priceUnit
        );
        cacheService.set('market', crop, updated, CACHE_TTL.MARKET_MS);
    },

    // Legacy alias
    updateHankinsonBasis: (basis: number): void => {
        marketDataService.updateBenchmarkBasis(basis, 'Yellow Corn');
    },

    // Update fallback price manually (defaults to Corn)
    setFallbackPrice: (price: number, contract?: string): void => {
        const crop = 'Yellow Corn';
        const current = marketDataService.getCropMarketData(crop);
        const updated = createMarketData(
            price, contract || current.contractMonth, 'cached', current.benchmarkBasis,
            current.benchmarkName, current.benchmarkFreight, current.priceUnit
        );
        cacheService.set('market', crop, updated, CACHE_TTL.MARKET_MS);
    },

    // Trust Layer: get provenance metadata for futures price
    getFuturesSource: (crop: string = 'Yellow Corn'): DataSource => {
        const data = marketDataService.getCropMarketData(crop);
        const sourceLabel = data.source === 'usda' ? 'USDA AMS'
            : data.source === 'cme' ? 'CME Group'
                : data.source === 'nsa' ? 'National Sunflower Association'
                    : data.source === 'cached' ? 'Cached Market Data'
                        : `${data.contractMonth} Fallback`;
        return {
            value: data.futuresPrice,
            confidence: data.source === 'fallback' ? 'estimated' : 'verified',
            source: sourceLabel,
            timestamp: data.lastUpdated || new Date().toISOString(),
            staleAfterMinutes: 60
        };
    },

    // Get the benchmark name for a crop (for display)
    getBenchmarkName: (crop: string = 'Yellow Corn'): string => {
        const defaults = MARKET_DEFAULTS[crop] || MARKET_DEFAULTS['Yellow Corn'];
        return defaults.benchmarkName;
    },

    // Update sunflower price from NSA scrape
    updateSunflowerPrice: (enderlinCash: number, source: MarketData['source'] = 'nsa'): void => {
        const defaults = MARKET_DEFAULTS['Sunflowers'];
        const updated = createMarketData(
            enderlinCash, defaults.contract, source, 0, // benchmarkBasis=0 (Enderlin IS the benchmark)
            defaults.benchmarkName, defaults.benchmarkFreight, defaults.priceUnit
        );
        cacheService.set('market', 'Sunflowers', updated, CACHE_TTL.MARKET_MS);
    }
};
