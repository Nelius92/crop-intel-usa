// USDA Market News Service
// Fetches daily grain reports from USDA AMS to drive regional pricing
// API Documentation: https://marsapi.ams.usda.gov/

import { cacheService, CACHE_TTL } from './cacheService';
import { apiGetJson } from './apiClient';

const USDA_CACHE_KEY = 'adjustments';

export interface RegionalAdjustment {
    region: string;
    basisAdjustment: number; // The basis from report
    trend: 'UP' | 'DOWN' | 'FLAT';
    reportDate: string;
    source: 'usda-ams' | 'cached' | 'fallback';
    reportId?: string;
}

export interface USDAGrainBid {
    location: string;
    state: string;
    commodity: string;
    basis: number;
    cashPrice: number;
    reportDate: string;
}


// Fallback basis data — used ONLY when no real scraped bid exists.
// Based on actual market data as of Feb 27, 2026 (CME ZCH6 = $4.354).
// Real scraped bids always take priority over these estimates.
//
// Sources: Scoular portal (114 bids), web search (CHS/Plains ND), USDA AMS.
const FALLBACK_ADJUSTMENTS: Record<string, RegionalAdjustment> = {
    // ── Northern Plains (ND/MN/SD) ──────────────────────────────────────────
    "Northern Plains": {
        region: "Northern Plains",
        basisAdjustment: -0.65,  // Verified: ND -0.60 to -0.85, CHS/Plains Feb 2026
        trend: 'DOWN',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Corn Belt core (IA/IL/IN/OH) ─────────────────────────────────────────
    "Corn Belt": {
        region: "Corn Belt",
        basisAdjustment: -0.25,  // Strong ethanol/feed demand lifts basis vs ND
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Central Plains (NE/KS/MO) ────────────────────────────────────────────
    "Central Plains": {
        region: "Central Plains",
        basisAdjustment: -0.30,  // Verified via Scoular KS avg spot ~-0.30
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Southern Plains / feedlots (OK/CO) ───────────────────────────────────
    "Southern Plains": {
        region: "Southern Plains",
        basisAdjustment: -0.20,  // Feedlot demand: firmer than ND
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Texas / Gulf ────────────────────────────────────────────────────────
    "Texas": {
        region: "Texas",
        basisAdjustment: -0.15,  // West TX feedlots pay modest premium vs CBOT
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Southeast (TN/AR/AL/GA/MS/LA/NC/SC/FL) ───────────────────────────────
    "Southeast": {
        region: "Southeast",
        basisAdjustment: 0.05,   // Poultry/livestock demand, transport premium
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Great Lakes / Wisconsin ───────────────────────────────────────────────
    "Great Lakes": {
        region: "Great Lakes",
        basisAdjustment: -0.35,  // WI/MI dairy demand, slight discount vs IL
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Pacific Northwest (OR/WA export terminals) ────────────────────────────
    "PNW": {
        region: "PNW",
        basisAdjustment: 0.25,   // Export premium at Columbia River terminals
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── California (feedmills/dairies) ────────────────────────────────────────
    "California": {
        region: "California",
        basisAdjustment: 0.50,   // Transport cost premium; feedmill/dairy demand
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Mountain West (ID/MT/WY/UT/NV/AZ/NM) ────────────────────────────────
    "Mountain West": {
        region: "Mountain West",
        basisAdjustment: -0.55,  // Remote; high freight, weaker basis than Corn Belt
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    },
    // ── Mid-Atlantic / Northeast (VA/PA/NY/MD/DE/NJ/CT/MA/RI/VT/NH/ME) ───────
    "Mid-Atlantic": {
        region: "Mid-Atlantic",
        basisAdjustment: 0.10,   // Poultry corridor premium along I-81
        trend: 'FLAT',
        reportDate: "2026-02-27",
        source: 'fallback'
    }
};

// Map every US state to its regional pricing group
const STATE_TO_REGION: Record<string, string> = {
    // Northern Plains
    'ND': 'Northern Plains',
    'MN': 'Northern Plains',
    'SD': 'Northern Plains',
    // Corn Belt
    'IA': 'Corn Belt',
    'IL': 'Corn Belt',
    'IN': 'Corn Belt',
    'OH': 'Corn Belt',
    // Central Plains
    'NE': 'Central Plains',
    'KS': 'Central Plains',
    'MO': 'Central Plains',
    // Southern Plains
    'CO': 'Southern Plains',
    'OK': 'Southern Plains',
    // Texas
    'TX': 'Texas',
    // Southeast
    'TN': 'Southeast',
    'AR': 'Southeast',
    'AL': 'Southeast',
    'GA': 'Southeast',
    'MS': 'Southeast',
    'LA': 'Southeast',
    'NC': 'Southeast',
    'SC': 'Southeast',
    'FL': 'Southeast',
    'KY': 'Southeast',
    // Great Lakes
    'WI': 'Great Lakes',
    'MI': 'Great Lakes',
    // PNW
    'WA': 'PNW',
    'OR': 'PNW',
    // California
    'CA': 'California',
    // Mountain West
    'ID': 'Mountain West',
    'MT': 'Mountain West',
    'WY': 'Mountain West',
    'UT': 'Mountain West',
    'NV': 'Mountain West',
    'AZ': 'Mountain West',
    'NM': 'Mountain West',
    // Mid-Atlantic / Northeast
    'VA': 'Mid-Atlantic',
    'PA': 'Mid-Atlantic',
    'MD': 'Mid-Atlantic',
    'DE': 'Mid-Atlantic',
    'WV': 'Mid-Atlantic',
    'NY': 'Mid-Atlantic',
    'NJ': 'Mid-Atlantic',
    'CT': 'Mid-Atlantic',
    'MA': 'Mid-Atlantic',
    'RI': 'Mid-Atlantic',
    'VT': 'Mid-Atlantic',
    'NH': 'Mid-Atlantic',
    'ME': 'Mid-Atlantic',
};

export const usdaMarketService = {
    // Get regional adjustment for a specific state
    getRegionForState: (state: string): string => {
        return STATE_TO_REGION[state] || 'Central Plains'; // sensible default
    },

    // ── NEW: Per-state USDA basis map ──────────────────────────────────
    // Fetches from backend /api/usda/regional-basis which aggregates
    // ALL 22 state grain reports from USDA MARS API
    getStateBasisMap: async (commodity: string = 'Corn'): Promise<Record<string, StateBasisData>> => {
        const cacheKey = `state-basis-${commodity}`;
        const cached = cacheService.get<Record<string, StateBasisData>>('usda', cacheKey);
        if (cached) return cached;

        try {
            const response = await apiGetJson<{
                success: boolean;
                states?: Record<string, StateBasisData>;
                source?: string;
            }>(`/api/usda/regional-basis?commodity=${encodeURIComponent(commodity)}`);

            if (response.states && Object.keys(response.states).length > 0) {
                cacheService.set('usda', cacheKey, response.states, CACHE_TTL.USDA_MS);
                if (import.meta.env.DEV) {
                    console.info(`[USDA] State basis loaded: ${Object.keys(response.states).length} states for ${commodity}`);
                }
                return response.states;
            }
        } catch (error) {
            console.warn('State basis API unavailable:', error);
        }

        // Return empty — caller should fall back to regional
        return {};
    },

    // Get basis for a specific state, with cascading fallback:
    //   1. Per-state USDA data (most accurate)
    //   2. Regional fallback adjustments (month-old estimates)
    //   3. Default -0.30
    getStateBasis: (
        state: string,
        stateBasisMap: Record<string, StateBasisData>,
        fallbackAdjustments: Record<string, RegionalAdjustment>
    ): { basis: number; source: string; confidence: 'verified' | 'estimated' } => {
        // Priority 1: Exact state USDA data
        const stateData = stateBasisMap[state];
        if (stateData && stateData.avgBasisDollars !== undefined) {
            return {
                basis: stateData.avgBasisDollars,
                source: `USDA ${state}`,
                confidence: 'estimated',
            };
        }

        // Priority 2: Regional fallback
        const region = STATE_TO_REGION[state] || 'Central Plains';
        const regional = fallbackAdjustments[region];
        if (regional) {
            return {
                basis: regional.basisAdjustment,
                source: `${region} fallback`,
                confidence: 'estimated',
            };
        }

        // Priority 3: Default
        return { basis: -0.30, source: 'default', confidence: 'estimated' };
    },

    // Legacy: Fetch regional adjustments (kept for backward compatibility)
    // Now enhanced to use per-state data when available
    getRegionalAdjustments: async (): Promise<Record<string, RegionalAdjustment>> => {
        // Return cached if valid (60m TTL)
        const cached = cacheService.get<Record<string, RegionalAdjustment>>('usda', USDA_CACHE_KEY);
        if (cached) return cached;

        try {
            const response = await apiGetJson<{
                success: boolean;
                data?: any;
                fallback?: boolean;
            }>('/api/usda/grain-report?commodity=Corn');

            if (response.data) {
                const parsedAdjustments = parseUSDAReport(response.data);
                if (Object.keys(parsedAdjustments).length > 0) {
                    cacheService.set('usda', USDA_CACHE_KEY, parsedAdjustments, CACHE_TTL.USDA_MS);
                    return parsedAdjustments;
                }
            }
        } catch (error) {
            console.warn('USDA API proxy unavailable, using fallback:', error);
        }

        // Use fallback data
        const fallback = { ...FALLBACK_ADJUSTMENTS };
        cacheService.set('usda', USDA_CACHE_KEY, fallback, CACHE_TTL.USDA_MS);
        return fallback;
    },

    // Get basis for a specific state (legacy — kept for compatibility)
    getBasisForState: async (state: string): Promise<number> => {
        const adjustments = await usdaMarketService.getRegionalAdjustments();
        const region = STATE_TO_REGION[state] || 'Midwest';
        return adjustments[region]?.basisAdjustment || -0.20;
    },

    // Update fallback data manually (for morning price updates)
    updateRegionalBasis: (region: string, basis: number, trend: 'UP' | 'DOWN' | 'FLAT'): void => {
        // Get current cache or start from fallback
        const current = cacheService.get<Record<string, RegionalAdjustment>>('usda', USDA_CACHE_KEY) || { ...FALLBACK_ADJUSTMENTS };
        current[region] = {
            region,
            basisAdjustment: basis,
            trend,
            reportDate: new Date().toISOString().split('T')[0],
            source: 'cached'
        };
        cacheService.set('usda', USDA_CACHE_KEY, current, CACHE_TTL.USDA_MS);
    },

    // Get data freshness info
    getDataFreshness: (): { lastUpdated: string; source: string } => {
        const cached = cacheService.get<Record<string, RegionalAdjustment>>('usda', USDA_CACHE_KEY);
        if (cached) {
            const firstRegion = Object.values(cached)[0];
            return {
                lastUpdated: firstRegion?.reportDate || 'Unknown',
                source: firstRegion?.source || 'fallback'
            };
        }
        return { lastUpdated: 'Never', source: 'none' };
    }
};

// ── Per-state USDA basis data type ────────────────────────────────────
export interface StateBasisData {
    avgBasis: number;         // in cents (e.g., -75 for ND, +163 for CA)
    avgBasisDollars: number;  // in dollars (e.g., -0.75, +1.63)
    minBasis?: number;
    maxBasis?: number;
    avgPrice: number;
    bidCount: number;
    reportDate?: string;
    source: 'usda-ams' | 'usda-ams-cached' | 'fallback';
}

// Parse USDA report data into regional adjustments
function parseUSDAReport(data: any): Record<string, RegionalAdjustment> {
    const adjustments: Record<string, RegionalAdjustment> = {};

    try {
        const results = data?.results || data?.data || [];
        for (const item of results) {
            const state = item.state || item.location_state;
            const region = STATE_TO_REGION[state];
            if (region && item.basis !== undefined) {
                // Parse basis (convert cents to dollars if needed)
                let basisValue = typeof item.basis === 'string'
                    ? parseFloat(item.basis)
                    : item.basis;

                // If basis is large (e.g. > 5 or < -5), it is definitely in cents and needs conversion to dollars.
                // Realistic basis is between -$3.00 and +$3.00. 
                if (Math.abs(basisValue) >= 5) {
                    basisValue = basisValue / 100;
                }

                adjustments[region] = {
                    region,
                    basisAdjustment: basisValue,
                    trend: determineTrend(item),
                    reportDate: item.report_date || new Date().toISOString().split('T')[0],
                    source: 'usda-ams',
                    reportId: item.report_id
                };
            }
        }
    } catch (error) {
        console.error('Error parsing USDA report:', error);
    }

    return adjustments;
}

function determineTrend(item: any): 'UP' | 'DOWN' | 'FLAT' {
    if (item.trend) return item.trend.toUpperCase();
    if (item.change && item.change > 0) return 'UP';
    if (item.change && item.change < 0) return 'DOWN';
    return 'FLAT';
}
