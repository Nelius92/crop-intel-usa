import { Buyer, BuyerType, CropType } from '../types';

// This service fetches and enriches buyer data with live market prices
// Prices are calculated using: Cash = Futures + Basis, Net = Cash - Freight

import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';
import { calculateFreight } from './railService';
import { enrichBuyersWithRailConfidence } from './railConfidenceService';
import { TRANSLOADERS } from './transloaderService';
import { cacheService, CACHE_TTL } from './cacheService';
import { apiGetJson } from './apiClient';

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

interface ApiBuyerDirectoryRecord {
    id: string;
    name: string;
    type: BuyerType;
    city: string;
    state: string;
    region: string;
    lat: number;
    lng: number;
    cropType?: CropType;
    organic?: boolean;
    railConfidence?: number | null;
    contactRole?: string | null;
    facilityPhone?: string | null;
    website?: string | null;
    verifiedStatus?: 'verified' | 'needs_review' | 'unverified' | null;
    contactConfidenceScore?: number | null;
}


async function fetchBuyerContactsFromApi(crop: string): Promise<ApiBuyerDirectoryRecord[]> {
    try {
        const result = await apiGetJson<{ data: ApiBuyerDirectoryRecord[] }>(
            `/api/buyers?scope=all&crop=${encodeURIComponent(crop)}`
        );
        return result.data || [];
    } catch (error) {
        console.error("Failed to fetch buyers from API:", error);
        throw new Error("Production API completely failed and fallbacks are explicitly disabled.");
    }
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

    const apiRecords = await fetchBuyerContactsFromApi(selectedCrop);

    // Production mode: The backend API is the strict and only source of truth.
    let filteredBuyers: Buyer[] = apiRecords.map((match) => {
        return {
            id: match.id,
            name: match.name,
            type: match.type,
            city: match.city,
            state: match.state,
            lat: match.lat,
            lng: match.lng,
            region: match.region,
            cropType: (match.cropType as CropType | undefined) ?? (selectedCrop as CropType),
            organic: match.organic ?? false,
            contactName: match.contactRole ?? 'Grain Desk',
            contactPhone: match.facilityPhone ?? undefined,
            website: match.website ?? undefined,
            confidenceScore: match.contactConfidenceScore ?? undefined,
            verified: match.verifiedStatus === 'verified',
            railConfidence: match.railConfidence ?? undefined,
            dataSource: 'api-directory',
            // Pass through real scraped bid data (null if not yet scraped)
            cashBid: (match as any).cashBid ?? null,
            postedBasis: (match as any).postedBasis ?? null,
            bidDate: (match as any).bidDate ?? null,
            bidSource: (match as any).bidSource ?? null,
            basis: 0,
            cashPrice: 0,
            // Derive rail accessibility from railConfidence score (types.ts: "Derived: score >= 40")
            railAccessible: (match.railConfidence ?? 0) >= 40,
            nearTransload: (match as any).nearTransload ?? false
        } as Buyer;
    });

    // Apply crop filter
    filteredBuyers = filteredBuyers.filter(b =>
        (b.cropType || 'Yellow Corn') === selectedCrop
    );

    // Fetch live market data for the SPECIFIC CROP
    const marketData = marketDataService.getCropMarketData(selectedCrop);
    const currentFutures = marketData.futuresPrice;

    // Get Hankinson benchmark for comparison
    const hankinsonBenchmark = {
        cashPrice: marketData.hankinsonCashPrice
    };

    // Pre-load USDA regional basis adjustments for fallback pricing
    const usdaAdjustments = await usdaMarketService.getRegionalAdjustments();

    // Calculate dynamic prices for each buyer
    const now = new Date().toISOString();
    const dynamicBuyers = await Promise.all(filteredBuyers.map(async (buyer) => {
        // ── Price Calculation ──
        // Priority 1: Real scraped bid (from bid-pipeline → DB → API)
        // Priority 2: USDA regional basis estimate (Futures + Regional Basis)
        const hasRealBid = (buyer as any).cashBid != null;
        let newCashPrice: number;
        let basis: number;
        let basisConfidence: 'verified' | 'estimated';
        let basisSourceLabel: string;

        if (hasRealBid) {
            // Use the real scraped cash bid directly (parse it because Postgres numeric returns as string)
            newCashPrice = parseFloat((buyer as any).cashBid);
            // Back-calculate basis from the real cash bid
            basis = parseFloat((newCashPrice - currentFutures).toFixed(2));
            basisConfidence = 'verified';
            basisSourceLabel = (buyer as any).bidSource || 'Scraped Bid';
        } else {
            // Use USDA regional basis as an estimated price
            const region = usdaMarketService.getRegionForState(buyer.state);
            const regionalAdj = usdaAdjustments[region];
            basis = regionalAdj?.basisAdjustment ?? -0.30;
            newCashPrice = parseFloat((currentFutures + basis).toFixed(2));
            basisConfidence = 'estimated';
            basisSourceLabel = `USDA ${region} est.`;
        }

        // Calculate Freight FROM Campbell, MN TO this buyer (cached 12h)
        const freightInfo = await calculateFreight(
            { lat: buyer.lat, lng: buyer.lng, state: buyer.state, city: buyer.city },
            buyer.name,
            buyer.railAccessible
        );
        const newFreightCost = freightInfo.ratePerBushel;

        // Net Price = Cash Price - Freight
        const newNetPrice = newCashPrice - newFreightCost;

        // Hankinson benchmark: HankNet = HankCash - $0.30 truck freight
        const hankinsonNetPrice = hankinsonBenchmark.cashPrice - 0.30;
        const benchmarkDiff = parseFloat((newNetPrice - hankinsonNetPrice).toFixed(2));

        const futuresSource = marketDataService.getFuturesSource(selectedCrop);

        const basisSource = {
            value: basis,
            confidence: basisConfidence,
            source: basisSourceLabel,
            timestamp: now,
            staleAfterMinutes: hasRealBid ? 60 : 120
        };

        const provenance = {
            futures: futuresSource,
            basis: basisSource,
            freight: {
                value: newFreightCost,
                confidence: 'estimated' as const,
                source: `BNSF Tariff 4022 (${freightInfo.mode})`,
                timestamp: now,
                staleAfterMinutes: 720
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
            dataSource: hasRealBid ? ((buyer as any).bidSource || 'scraped-bid') : basisSourceLabel
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
        .filter(b => b.basis !== undefined)
        .sort((a, b) => (b.basis ?? 0) - (a.basis ?? 0))
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
