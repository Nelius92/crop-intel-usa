import { Buyer, BuyerType, CropType } from '../types';

// This service fetches and enriches buyer data with live market prices
// Prices are calculated using: Cash = Futures + Basis, Net = Cash - Freight

import { FALLBACK_BUYERS_DATA } from './fallbackData';
import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';
import { calculateFreight } from './railService';
import { enrichBuyersWithRailConfidence } from './railConfidenceService';
import { TRANSLOADERS } from './transloaderService';
import { cacheService, CACHE_TTL } from './cacheService';

// ── Filter Interface ──
export interface BuyerFilters {
    crop?: CropType;
    buyerType?: BuyerType;
    state?: string;
    region?: string;
    minRailConfidence?: number;
    bnsfServedOnly?: boolean; // Shortcut for minRailConfidence >= 70
    searchQuery?: string;
}

export const fetchRealBuyersFromGoogle = async (
    selectedCrop: string = 'Yellow Corn',
    filters?: BuyerFilters,
    forceRefresh: boolean = false
): Promise<Buyer[]> => {
    // Cache key is the crop name (filters are applied post-cache for simplicity)
    const cacheKey = selectedCrop;

    if (!forceRefresh) {
        const cached = cacheService.get<Buyer[]>('buyers', cacheKey);
        if (cached) {
            // Apply filters on top of cached data and return instantly
            return applyFilters(cached, filters);
        }
    }

    // Start with all buyers
    let filteredBuyers = [...FALLBACK_BUYERS_DATA];

    // Apply crop filter
    filteredBuyers = filteredBuyers.filter(b =>
        (b.cropType || 'Yellow Corn') === selectedCrop
    );

    // Fetch live market data for the SPECIFIC CROP
    const marketData = marketDataService.getCropMarketData(selectedCrop);
    const currentFutures = marketData.futuresPrice;

    // USDA regional adjustments (currently only for Corn, defaults to 0 others)
    const regionalAdjustments = await usdaMarketService.getRegionalAdjustments();

    // Get Hankinson benchmark for comparison
    const hankinsonBenchmark = {
        cashPrice: marketData.hankinsonCashPrice
    };

    // Calculate dynamic prices for each buyer
    const now = new Date().toISOString();
    const dynamicBuyers = await Promise.all(filteredBuyers.map(async (buyer) => {
        // Get USDA basis for this buyer's region
        const regionKey = usdaMarketService.getRegionForState(buyer.state);
        let basis = buyer.basis;

        // Override basis with official USDA report if available AND it's corn
        if (selectedCrop === 'Yellow Corn' && regionKey && regionalAdjustments[regionKey]) {
            basis = regionalAdjustments[regionKey].basisAdjustment;
        }

        // Calculate Cash Price: Futures + Basis
        const newCashPrice = currentFutures + basis;

        // Calculate Freight FROM Campbell, MN TO this buyer (cached 12h)
        const freightInfo = await calculateFreight(
            { lat: buyer.lat, lng: buyer.lng, state: buyer.state, city: buyer.city },
            buyer.name,
            buyer.railAccessible
        );
        const newFreightCost = freightInfo.ratePerBushel;

        // Calculate Net Price: Cash - Freight (what you receive)
        const newNetPrice = newCashPrice - newFreightCost;

        // Hankinson benchmark: HankNet = HankCash - $0.30 truck freight
        const hankinsonNetPrice = hankinsonBenchmark.cashPrice - 0.30;
        const benchmarkDiff = parseFloat((newNetPrice - hankinsonNetPrice).toFixed(2));

        const futuresSource = marketDataService.getFuturesSource(selectedCrop);

        const basisSource = (selectedCrop === 'Yellow Corn' && regionKey && regionalAdjustments[regionKey])
            ? {
                value: basis,
                confidence: 'verified' as const,
                source: regionalAdjustments[regionKey].source,
                timestamp: now,
                staleAfterMinutes: 60
            }
            : {
                value: basis,
                confidence: 'estimated' as const,
                source: 'Regional Estimate',
                timestamp: now,
                staleAfterMinutes: 120
            };

        const provenance = {
            futures: futuresSource,
            basis: basisSource,
            freight: {
                value: newFreightCost,
                confidence: 'estimated' as const,
                source: `BNSF Tariff 4022 (${freightInfo.mode})`,
                timestamp: now,
                staleAfterMinutes: 720 // 12h, matches freight cache TTL
            },
            fees: {
                value: 0,
                confidence: 'verified' as const,
                source: 'No fees',
                timestamp: now,
                staleAfterMinutes: 10080
            }
        };

        // Overall verified only if all provenance sources are verified
        const verified = [provenance.futures.confidence, provenance.basis.confidence, provenance.freight.confidence]
            .every(c => c === 'verified');

        return {
            ...buyer,
            basis: parseFloat(basis.toFixed(2)),
            freightCost: parseFloat((-newFreightCost).toFixed(2)),
            freightMode: freightInfo.mode,
            freightFormula: freightInfo.formula,
            cashPrice: parseFloat(newCashPrice.toFixed(2)),
            netPrice: parseFloat(newNetPrice.toFixed(2)),
            futuresPrice: currentFutures,
            benchmarkDiff,
            lastUpdated: now,
            provenance,
            verified,
            dataSource: (selectedCrop === 'Yellow Corn' && regionalAdjustments[regionKey]) ? regionalAdjustments[regionKey].source : 'fallback'
        };
    }));


    // Score rail confidence for each buyer using BNSF network + transloaders
    const enrichedBuyers = enrichBuyersWithRailConfidence(dynamicBuyers, TRANSLOADERS);

    // Cache the fully-computed list (30m TTL)
    cacheService.set('buyers', cacheKey, enrichedBuyers, CACHE_TTL.BUYERS_MS);

    // Apply any active filters before returning
    return applyFilters(enrichedBuyers, filters);
};

/** Apply BuyerFilters to a buyer array (used for both cached and live data) */
function applyFilters(buyers: Buyer[], filters?: BuyerFilters): Buyer[] {
    if (!filters) return buyers;
    let result = buyers;
    if (filters.buyerType) result = result.filter(b => b.type === filters.buyerType);
    if (filters.state) result = result.filter(b => b.state === filters.state);
    if (filters.region) result = result.filter(b => b.region?.toLowerCase().includes(filters.region!.toLowerCase()));
    if (filters.bnsfServedOnly) {
        result = result.filter(b => (b.railConfidence ?? 0) >= 70);
    } else if (filters.minRailConfidence !== undefined) {
        result = result.filter(b => (b.railConfidence ?? 0) >= filters.minRailConfidence!);
    }
    if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        result = result.filter(b =>
            b.name.toLowerCase().includes(q) ||
            b.city.toLowerCase().includes(q) ||
            b.region?.toLowerCase().includes(q)
        );
    }
    return result;
}

/** Force-invalidate the buyers cache for a given crop (used by Refresh button) */
export const invalidateBuyerCache = (crop: string = 'Yellow Corn'): void => {
    cacheService.invalidate('buyers', crop);
};

/** Return the age (in ms) of the buyers cache for a given crop */
export const getBuyerCacheAge = (crop: string = 'Yellow Corn'): number | null => {
    return cacheService.getAge('buyers', crop);
};

// ── Filter Helpers ──

// Helper: Get organic buyers
export const getOrganicBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => b.organic);
};

// Helper: Get conventional buyers
export const getConventionalBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => !b.organic);
};

// Get top buyers by NET PRICE (highest net price = best deal for seller)
export const getTopNetPriceBuyers = (buyers: Buyer[], count: number = 5): Buyer[] => {
    return [...buyers]
        .sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0))
        .slice(0, count);
};

// Get top buyers by BASIS (useful for seeing market strength)
export const getTop3BasisBuyers = (buyers: Buyer[]): Buyer[] => {
    return [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3);
};

// Get buyers near BNSF rail (prioritize rail-accessible buyers)
export const getRailAccessibleBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => b.railAccessible);
};

// Get BNSF-served buyers (confidence >= threshold)
export const getBNSFServedBuyers = (buyers: Buyer[], minConfidence: number = 70): Buyer[] => {
    return buyers.filter(b => (b.railConfidence ?? 0) >= minConfidence);
};

// Get buyers by state
export const getBuyersByState = (buyers: Buyer[], state: string): Buyer[] => {
    return buyers.filter(b => b.state === state);
};

// Get unique states from buyer list
export const getUniqueStates = (buyers: Buyer[]): string[] => {
    return [...new Set(buyers.map(b => b.state))].sort();
};

// Get unique buyer types from buyer list
export const getUniqueBuyerTypes = (buyers: Buyer[]): BuyerType[] => {
    return [...new Set(buyers.map(b => b.type))].sort() as BuyerType[];
};

// Get buyers sorted by net price, filtered by region
export const getBuyersByRegion = (buyers: Buyer[], region: string): Buyer[] => {
    return [...buyers]
        .filter(b => b.region?.toLowerCase().includes(region.toLowerCase()))
        .sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0));
};

// Deprecated mock generator
export const generateBuyers = (_count: number): Buyer[] => {
    return [];
};

// Enrich buyer with Google Maps data (disabled to save API costs)
export const enrichBuyerWithGoogleData = async (buyer: Buyer): Promise<Buyer> => {
    return buyer;
};

// Get market data freshness info
export const getMarketDataInfo = async (): Promise<{ futuresPrice: number; dataSource: string; lastUpdated: string }> => {
    const marketData = marketDataService.getMarketData();
    const usadData = usdaMarketService.getDataFreshness();

    return {
        futuresPrice: marketData.futuresPrice,
        dataSource: `${marketData.source} / ${usadData.source}`,
        lastUpdated: usadData.lastUpdated
    };
};
