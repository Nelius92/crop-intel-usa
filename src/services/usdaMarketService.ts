// USDA Market News Service
// Fetches daily grain reports from USDA AMS to drive regional pricing
// API Documentation: https://marsapi.ams.usda.gov/

import { cacheService, CACHE_TTL } from './cacheService';

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


// Fallback data based on latest known USDA reports (Feb 2026)
const FALLBACK_ADJUSTMENTS: Record<string, RegionalAdjustment> = {
    "Texas": {
        region: "Texas",
        basisAdjustment: 0.85,
        trend: 'FLAT',
        reportDate: "2026-02-01",
        source: 'fallback'
    },
    "Washington": {
        region: "Washington",
        basisAdjustment: 1.10,
        trend: 'UP',
        reportDate: "2026-02-01",
        source: 'fallback'
    },
    "California": {
        region: "California",
        basisAdjustment: 1.45,
        trend: 'FLAT',
        reportDate: "2026-02-01",
        source: 'fallback'
    },
    "Midwest": {
        region: "Midwest",
        basisAdjustment: -0.25,
        trend: 'DOWN',
        reportDate: "2026-02-01",
        source: 'fallback'
    },
    "Idaho": {
        region: "Idaho",
        basisAdjustment: 0.95,
        trend: 'FLAT',
        reportDate: "2026-02-01",
        source: 'fallback'
    },
    "PNW": {
        region: "PNW",
        basisAdjustment: 1.15,
        trend: 'UP',
        reportDate: "2026-02-01",
        source: 'fallback'
    }
};

// Map states to regions for basis lookup
const STATE_TO_REGION: Record<string, string> = {
    'TX': 'Texas',
    'CA': 'California',
    'WA': 'Washington',
    'OR': 'PNW',
    'ID': 'Idaho',
    'IA': 'Midwest',
    'IL': 'Midwest',
    'NE': 'Midwest',
    'MN': 'Midwest',
    'SD': 'Midwest',
    'ND': 'Midwest',
    'KS': 'Midwest',
    'MO': 'Midwest',
    'OH': 'Midwest',
    'IN': 'Midwest'
};

export const usdaMarketService = {
    // Get regional adjustment for a specific state
    getRegionForState: (state: string): string => {
        return STATE_TO_REGION[state] || 'Midwest';
    },

    // Fetch latest regional adjustments from USDA AMS
    getRegionalAdjustments: async (): Promise<Record<string, RegionalAdjustment>> => {
        // Return cached if valid (60m TTL)
        const cached = cacheService.get<Record<string, RegionalAdjustment>>('usda', USDA_CACHE_KEY);
        if (cached) return cached;

        try {
            // Try USDA AMS Market News API
            const response = await fetch(
                'https://marsapi.ams.usda.gov/services/v1.2/reports/LM_GR110?q=commodity=Corn',
                {
                    signal: AbortSignal.timeout(8000),
                    headers: { 'Accept': 'application/json' }
                }
            );

            if (response.ok) {
                const data = await response.json();
                const parsedAdjustments = parseUSDAReport(data);
                if (Object.keys(parsedAdjustments).length > 0) {
                    cacheService.set('usda', USDA_CACHE_KEY, parsedAdjustments, CACHE_TTL.USDA_MS);
                    console.log('Loaded fresh USDA market data');
                    return parsedAdjustments;
                }
            }
        } catch (error) {
            console.warn('USDA AMS API unavailable, using fallback:', error);
        }

        // Use fallback data
        const fallback = { ...FALLBACK_ADJUSTMENTS };
        cacheService.set('usda', USDA_CACHE_KEY, fallback, CACHE_TTL.USDA_MS);
        return fallback;
    },

    // Get basis for a specific state
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
        console.log(`Updated ${region} basis to ${basis >= 0 ? '+' : ''}${basis.toFixed(2)}`);
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

// Parse USDA report data into regional adjustments
function parseUSDAReport(data: any): Record<string, RegionalAdjustment> {
    const adjustments: Record<string, RegionalAdjustment> = {};

    try {
        const results = data?.results || data?.data || [];
        for (const item of results) {
            const state = item.state || item.location_state;
            const region = STATE_TO_REGION[state];
            if (region && item.basis !== undefined) {
                // Parse basis (usually in cents, convert to dollars)
                const basisValue = typeof item.basis === 'string'
                    ? parseFloat(item.basis) / 100
                    : item.basis;

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
