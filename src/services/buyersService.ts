import { Buyer, BuyerType, CropType } from '../types';
import { FALLBACK_BUYERS_DATA } from './fallbackData';

// This service fetches and enriches buyer data with live market prices
// Prices are calculated using: Cash = Futures + Basis, Net = Cash - Freight

import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';
import { calculateFreight } from './railService';
import { convertFreightToCropUnit, getCropPriceUnit } from './bnsfService';
import { enrichBuyersWithRailConfidence } from './railConfidenceService';
import { TRANSLOADERS } from './transloaderService';
import { cacheService, CACHE_TTL } from './cacheService';
import { apiGetJson } from './apiClient';
import { normalizeFreightData } from '../utils/freightNormalizer';

// ── Live Bid Ingestion ──────────────────────────────────────────
// Loads scraped bids from morning scan (live_bids.json)
// and merges them into the buyer pipeline

interface ScrapedBidRecord {
    buyerName: string;
    city: string;
    state: string;
    crop: string;
    deliveryPeriod: string;
    contractMonth: string;
    futuresPrice: number;
    basis: number;
    cashBid: number;
    change?: number;
    scrapedAt: string;
    source: string;
    sourceUrl?: string;
    priceUnit: string;
    validated: boolean;
}

interface LiveBidsData {
    scanTime: string;
    totalBids: number;
    bids: ScrapedBidRecord[];
}

// Cache the live bids in memory (refreshed when stale)
let _liveBidsCache: LiveBidsData | null = null;
let _liveBidsCacheTime = 0;
const LIVE_BIDS_CACHE_TTL = 30 * 60 * 1000; // 30 min (scan runs once/day)

async function loadLiveBids(): Promise<LiveBidsData | null> {
    const now = Date.now();
    if (_liveBidsCache && (now - _liveBidsCacheTime) < LIVE_BIDS_CACHE_TTL) {
        return _liveBidsCache;
    }

    try {
        // In Vite, we use dynamic import for JSON
        const module = await import('../data/live_bids.json');
        const data = module.default as LiveBidsData;

        // Check staleness — bids older than 36 hours are stale
        const scanAge = now - new Date(data.scanTime).getTime();
        if (scanAge > 36 * 60 * 60 * 1000) {
            if (import.meta.env.DEV) console.warn('[LiveBids] Data is stale (>36h old), will use as fallback only');
        }

        _liveBidsCache = data;
        _liveBidsCacheTime = now;
        if (import.meta.env.DEV) console.log(`[LiveBids] Loaded ${data.totalBids} scraped bids from ${data.scanTime}`);
        return data;
    } catch {
        // live_bids.json doesn't exist yet or failed to load — not an error
        return null;
    }
}

/**
 * Get the best scraped bid for a specific buyer+crop combo.
 * Returns the nearest-delivery "Spot" bid (most relevant for current prices).
 */
function getBestScrapedBid(
    liveBids: LiveBidsData,
    buyerName: string,
    crop: string
): ScrapedBidRecord | null {
    // Normalize names for fuzzy matching
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedBuyer = normalize(buyerName);

    const matches = liveBids.bids.filter(bid => {
        if (bid.crop !== crop) return false;
        if (!bid.validated) return false;
        // Exact or fuzzy match on buyer name
        const normalizedBid = normalize(bid.buyerName);
        return normalizedBid === normalizedBuyer
            || normalizedBuyer.includes(normalizedBid)
            || normalizedBid.includes(normalizedBuyer);
    });

    if (matches.length === 0) return null;

    // Return nearest delivery period (first chronologically)
    return matches.sort((a, b) => {
        // Prefer "Spot" or nearest month
        if (a.deliveryPeriod.toLowerCase().includes('spot')) return -1;
        if (b.deliveryPeriod.toLowerCase().includes('spot')) return 1;
        return a.deliveryPeriod.localeCompare(b.deliveryPeriod);
    })[0];
}

/**
 * Get scraped buyers that DON'T exist in the directory yet.
 * These are new buyer discoveries from the morning scan.
 */
function getNewScrapedBuyers(
    liveBids: LiveBidsData,
    existingNames: Set<string>,
    crop: string
): ApiBuyerDirectoryRecord[] {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedExisting = new Set([...existingNames].map(normalize));

    // Group bids by buyer, take the best (nearest delivery) per buyer
    const buyerMap = new Map<string, ScrapedBidRecord>();
    for (const bid of liveBids.bids) {
        if (bid.crop !== crop || !bid.validated) continue;
        const key = normalize(bid.buyerName);
        if (normalizedExisting.has(key)) continue; // already in directory
        if (!buyerMap.has(key) || bid.deliveryPeriod < (buyerMap.get(key)!.deliveryPeriod)) {
            buyerMap.set(key, bid);
        }
    }

    return [...buyerMap.values()].map(bid => ({
        id: `scraped-${normalize(bid.buyerName)}-${Date.now()}`,
        name: bid.buyerName,
        type: 'ethanol' as BuyerType,
        city: bid.city,
        state: bid.state,
        region: `${bid.state} Region`,
        lat: 0, lng: 0, // Will be geocoded later
        cropType: bid.crop as CropType,
        cashBid: bid.cashBid,
        postedBasis: bid.basis,
        bidDate: bid.scrapedAt,
        bidSource: `${bid.source} (${bid.sourceUrl || 'scraped'})`,
        verifiedStatus: 'verified' as const,
    }));
}

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
    // Scraped bid fields (from bid-pipeline → Postgres)
    cashBid?: number | string | null;
    postedBasis?: number | string | null;
    bidDate?: string | null;
    bidSource?: string | null;
    nearTransload?: boolean;
    railAccessible?: boolean;
}


async function fetchBuyerContactsFromApi(crop: string): Promise<ApiBuyerDirectoryRecord[]> {
    try {
        const result = await apiGetJson<{ data: ApiBuyerDirectoryRecord[] }>(
            `/api/buyers?scope=all&crop=${encodeURIComponent(crop)}`
        );
        return result.data || [];
    } catch (error) {
        console.warn("API unavailable, falling back to local buyer data.", (error as Error).message);
        // Fall back to FALLBACK_BUYERS_DATA (buyers.json) when backend is down
        return FALLBACK_BUYERS_DATA
            .filter(b => (b.cropType || 'Yellow Corn') === crop)
            .map(b => ({
                id: b.id || `fallback-${Math.random().toString(36).slice(2)}`,
                name: b.name,
                type: b.type as BuyerType,
                city: b.city,
                state: b.state,
                region: b.region || 'Unknown',
                lat: b.lat,
                lng: b.lng,
                cropType: b.cropType as CropType,
                organic: b.organic ?? false,
                railConfidence: b.railConfidence ?? undefined,
                contactName: b.contactName ?? 'Grain Desk',
                contactPhone: b.contactPhone ?? undefined,
                website: b.website ?? undefined,
                verified: b.verified ?? false,
                confidenceScore: b.confidenceScore ?? undefined,
                nearTransload: b.nearTransload ?? false,
                railAccessible: b.railAccessible ?? false,
                cashBid: b.cashPrice ?? null,
                postedBasis: b.basis ?? null,
            } as Buyer));
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
            cashBid: match.cashBid ?? null,
            postedBasis: match.postedBasis ?? null,
            bidDate: match.bidDate ?? null,
            bidSource: match.bidSource ?? null,
            basis: 0,
            cashPrice: 0,
            // Derive rail accessibility from railConfidence score (types.ts: "Derived: score >= 40")
            railAccessible: (match.railConfidence ?? 0) >= 40,
            nearTransload: match.nearTransload ?? false
        } as Buyer;
    });

    // Apply crop filter
    filteredBuyers = filteredBuyers.filter(b =>
        (b.cropType || 'Yellow Corn') === selectedCrop
    );

    // ── Enrich with Live Scraped Bids ────────────────────────────
    // Merge morning scan results into the buyer pipeline
    const liveBids = await loadLiveBids();
    if (liveBids && liveBids.bids.length > 0) {
        let enrichedCount = 0;

        // Step 1: Enrich existing buyers with scraped prices
        for (const buyer of filteredBuyers) {
            // Skip buyers that already have a real bid from the backend
            if (buyer.cashBid != null) continue;

            const scrapedBid = getBestScrapedBid(liveBids, buyer.name, selectedCrop);
            if (scrapedBid) {
                buyer.cashBid = scrapedBid.cashBid;
                buyer.postedBasis = scrapedBid.basis;
                buyer.bidDate = scrapedBid.scrapedAt;
                buyer.bidSource = `${scrapedBid.source} (${scrapedBid.sourceUrl || 'scraped'})`;
                enrichedCount++;
            }
        }

        // Step 2: Add new buyers discovered by the scraper
        const existingNames = new Set(filteredBuyers.map(b => b.name));
        const newScrapedBuyers = getNewScrapedBuyers(liveBids, existingNames, selectedCrop);

        for (const rec of newScrapedBuyers) {
            filteredBuyers.push({
                id: rec.id,
                name: rec.name,
                type: rec.type,
                city: rec.city,
                state: rec.state,
                lat: rec.lat ?? 0,
                lng: rec.lng ?? 0,
                region: rec.region,
                cropType: (rec.cropType as CropType) ?? (selectedCrop as CropType),
                organic: false,
                contactName: 'Grain Desk',
                verified: true,
                railConfidence: undefined,
                dataSource: 'morning-scan',
                cashBid: rec.cashBid,
                postedBasis: rec.postedBasis,
                bidDate: rec.bidDate,
                bidSource: rec.bidSource,
                basis: 0,
                cashPrice: 0,
                railAccessible: false,
                nearTransload: false,
            } as Buyer);
        }

        if (enrichedCount > 0 || newScrapedBuyers.length > 0) {
            if (import.meta.env.DEV) console.log(`[LiveBids] Enriched ${enrichedCount} existing buyers, added ${newScrapedBuyers.length} new scraped buyers for ${selectedCrop}`);
        }
    }

    // Fetch live market data for the SPECIFIC CROP
    const marketData = marketDataService.getCropMarketData(selectedCrop);
    const currentFutures = marketData.futuresPrice;

    // Get crop-specific benchmark (Hankinson for corn, Enderlin for sunflowers)
    const benchmark = marketDataService.getBenchmark(selectedCrop);

    // Pre-load USDA per-state basis data (fetches from all 22 state reports)
    // Map the crop name to the USDA commodity name
    const usdaCommodity = selectedCrop === 'Yellow Corn' ? 'Corn'
        : selectedCrop === 'White Corn' ? 'Corn'
        : selectedCrop;
    const stateBasisMap = await usdaMarketService.getStateBasisMap(usdaCommodity);
    // Also keep regional fallback for states not covered by USDA reports
    const usdaAdjustments = await usdaMarketService.getRegionalAdjustments();

    // Calculate dynamic prices for each buyer
    const now = new Date().toISOString();
    const dynamicBuyers = await Promise.all(filteredBuyers.map(async (buyer) => {
        // ── Price Calculation ──
        // Priority 1: Real scraped bid (from bid-pipeline → DB → API)
        // Priority 2: USDA per-state basis (Futures + State-Level Basis)
        // Priority 3: Regional fallback basis
        const hasRealBid = buyer.cashBid != null;
        let newCashPrice: number;
        let basis: number;
        let basisConfidence: 'verified' | 'estimated';
        let basisSourceLabel: string;

        if (hasRealBid) {
            // Use the real scraped cash bid directly (parse it because Postgres numeric returns as string)
            newCashPrice = typeof buyer.cashBid === 'number'
                ? buyer.cashBid
                : parseFloat(String(buyer.cashBid));

            if (selectedCrop === 'Sunflowers') {
                // Sunflowers have NO futures contract — price IS the cash bid
                // Basis is meaningless, set to 0
                basis = 0;
            } else {
                // Back-calculate basis from the real cash bid
                basis = parseFloat((newCashPrice - currentFutures).toFixed(2));
            }
            basisConfidence = 'verified';
            basisSourceLabel = buyer.bidSource || 'Scraped Bid';
        } else if (selectedCrop === 'Sunflowers') {
            // Sunflowers fallback: use the benchmark price (Enderlin ADM)
            // No USDA per-state basis available for sunflowers
            newCashPrice = currentFutures; // For sunflowers, "futures" = benchmark cash
            basis = 0;
            basisConfidence = 'estimated';
            basisSourceLabel = `${benchmark.name} Benchmark`;
        } else {
            // Use USDA per-state basis — this is the key improvement
            // Each state now gets its own accurate basis from the USDA MARS API
            const basisInfo = usdaMarketService.getStateBasis(
                buyer.state,
                stateBasisMap,
                usdaAdjustments
            );
            basis = basisInfo.basis;
            newCashPrice = parseFloat((currentFutures + basis).toFixed(2));
            basisConfidence = basisInfo.confidence;
            basisSourceLabel = basisInfo.source;
        }

        // Calculate Freight FROM Campbell, MN TO this buyer (cached 12h)
        // Pass crop type for correct bushels-per-car conversion
        const freightInfo = await calculateFreight(
            { lat: buyer.lat, lng: buyer.lng, state: buyer.state, city: buyer.city },
            buyer.name,
            buyer.railAccessible,
            selectedCrop
        );
        // BNSF rate engine returns freight in $/bu for all crops.
        // For sunflowers (priced in $/cwt), convert freight to $/cwt
        // so that Net = Cash($/cwt) - Freight($/cwt) is unit-consistent.
        const rawFreightPerBushel = freightInfo.ratePerBushel;
        let newFreightCost = convertFreightToCropUnit(rawFreightPerBushel, selectedCrop);

        // ── Freight Normalizer Middleware (DTO contract) ──────────────────────
        // Intercept and normalize any raw per-car or per-ton rates that leaked through
        newFreightCost = normalizeFreightData(newFreightCost, freightInfo.mode === 'rail' ? undefined : undefined);

        const MAX_FREIGHT: Record<string, number> = {
            'Yellow Corn': 5.00,      // Max ~$5/bu (CA shuttle = ~$1.60)
            'White Corn': 5.00,
            'Soybeans': 5.00,
            'Wheat': 5.00,
            'Sunflowers': 20.00,      // $/cwt — higher nominal due to unit
        };

        // Optional specific clamp per crop if we really need it, but normalizeFreightData handles the huge anomalies:
        const maxFreight = MAX_FREIGHT[selectedCrop] || 5.00;
        if (newFreightCost > maxFreight) {
            if (import.meta.env.DEV) {
                console.warn(`[FreightGuard] ${buyer.name}: freight $${newFreightCost.toFixed(2)} still exceeds max $${maxFreight} for ${selectedCrop} after normalization.`);
            }
            newFreightCost = maxFreight;
        }

        // Net Price = Cash Price - Freight (both in same unit now)
        // NaN guards: if any upstream value is bad, clamp to 0
        if (isNaN(newCashPrice)) newCashPrice = 0;
        if (isNaN(newFreightCost)) newFreightCost = 0;
        const newNetPrice = newCashPrice - newFreightCost;

        // Benchmark comparison (crop-specific):
        //   Corn:       Hankinson cash - $0.30 truck freight
        //   Sunflowers: Enderlin ADM cash - $0 (farmers drive there)
        const benchmarkNetPrice = benchmark.cashPrice - benchmark.freight;
        const rawBenchmarkDiff = newNetPrice - benchmarkNetPrice;
        const benchmarkDiff = isNaN(rawBenchmarkDiff) ? 0 : parseFloat(rawBenchmarkDiff.toFixed(2));

        const futuresSource = marketDataService.getFuturesSource(selectedCrop);

        const basisSource = {
            value: basis,
            confidence: basisConfidence,
            source: basisSourceLabel,
            timestamp: now,
            staleAfterMinutes: hasRealBid ? 60 : 120
        };

        const priceUnit = getCropPriceUnit(selectedCrop);

        const provenance = {
            futures: futuresSource,
            basis: basisSource,
            freight: {
                value: newFreightCost,
                confidence: 'estimated' as const,
                source: `BNSF Tariff 4022 (${freightInfo.mode}) ${priceUnit}`,
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
            dataSource: hasRealBid ? (buyer.bidSource || 'scraped-bid') : basisSourceLabel,
            priceSource: hasRealBid
                ? (buyer.bidDate && (Date.now() - new Date(buyer.bidDate).getTime()) > 36 * 60 * 60 * 1000
                    ? 'stale' as const : 'live_bid' as const)
                : 'usda_estimate' as const
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
    const usdaData = usdaMarketService.getDataFreshness();

    return {
        futuresPrice: marketData.futuresPrice,
        dataSource: `${marketData.source} / ${usdaData.source}`,
        lastUpdated: usdaData.lastUpdated
    };
};
