import { describe, it, expect, vi } from 'vitest';
import { fetchRealBuyersFromGoogle, getOrganicBuyers, getConventionalBuyers } from '../buyersService';
import { FALLBACK_BUYERS_DATA } from '../fallbackData';
import { isDataStale, getOverallConfidence, DataSource } from '../../types';

// Mock dependencies
vi.mock('../marketDataService', () => ({
    marketDataService: {
        getCurrentFuturesPrice: () => 4.50,
        getHankinsonBenchmark: () => ({ cashPrice: 4.40, basis: -0.10 }),
        getCropMarketData: () => ({
            futuresPrice: 4.50,
            contractMonth: "ZCH6 (Mar '26)",
            lastUpdated: new Date().toISOString(),
            source: 'fallback',
            hankinsonBasis: -0.47,
            hankinsonCashPrice: 4.03
        }),
        getFuturesSource: () => ({
            value: 4.50,
            confidence: 'estimated',
            source: "ZCH6 (Mar '26) Fallback",
            timestamp: new Date().toISOString(),
            staleAfterMinutes: 60
        })
    }
}));

vi.mock('../usdaMarketService', () => ({
    usdaMarketService: {
        getRegionalAdjustments: async () => ({}),
        getRegionForState: () => 'Midwest',
        getDataFreshness: () => ({ source: 'Mock', lastUpdated: 'Now' })
    }
}));

vi.mock('../railService', () => ({
    calculateFreight: async () => ({ ratePerBushel: 0.50, origin: 'Campbell, MN' })
}));

describe('buyersService', () => {
    describe('fetchRealBuyersFromGoogle', () => {
        it('should filter buyers by Yellow Corn (default)', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            expect(buyers.length).toBeGreaterThan(0);
            buyers.forEach(b => {
                expect(b.cropType).toBe('Yellow Corn');
            });
        });

        it('should return buyers for Soybeans', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Soybeans');
            buyers.forEach(b => {
                expect(b.cropType).toBe('Soybeans');
            });
        });

        it('should return buyers for Wheat', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Wheat');
            buyers.forEach(b => {
                expect(b.cropType).toBe('Wheat');
            });
        });
    });

    describe('Trust Layer: Provenance', () => {
        it('every buyer should have a provenance object', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            buyers.forEach(b => {
                expect(b.provenance).toBeDefined();
                expect(b.provenance!.futures).toBeDefined();
                expect(b.provenance!.basis).toBeDefined();
                expect(b.provenance!.freight).toBeDefined();
                expect(b.provenance!.fees).toBeDefined();
            });
        });

        it('futures should be labeled estimated when using fallback', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            buyers.forEach(b => {
                expect(b.provenance!.futures.confidence).toBe('estimated');
                expect(b.provenance!.futures.source).toContain('Fallback');
            });
        });

        it('basis should be estimated when USDA data unavailable', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            // Since mock returns empty regionalAdjustments, basis should be estimated
            buyers.forEach(b => {
                expect(b.provenance!.basis.confidence).toBe('estimated');
                expect(b.provenance!.basis.source).toBe('Regional Estimate');
            });
        });

        it('freight should reference BNSF Tariff 4022', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            buyers.forEach(b => {
                expect(b.provenance!.freight.source).toContain('BNSF Tariff 4022');
                expect(b.provenance!.freight.confidence).toBe('estimated');
            });
        });

        it('verified flag should be false when futures is estimated', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            buyers.forEach(b => {
                // Futures is fallback → estimated → overall not verified
                expect(b.verified).toBe(false);
            });
        });

        it('each provenance field should have a valid ISO timestamp', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Yellow Corn');
            const b = buyers[0];
            expect(new Date(b.provenance!.futures.timestamp).getTime()).not.toBeNaN();
            expect(new Date(b.provenance!.basis.timestamp).getTime()).not.toBeNaN();
            expect(new Date(b.provenance!.freight.timestamp).getTime()).not.toBeNaN();
        });
    });

    describe('getOrganicBuyers', () => {
        it('should return only organic buyers', () => {
            const organic = getOrganicBuyers(FALLBACK_BUYERS_DATA);
            expect(organic.length).toBeGreaterThan(0);
            organic.forEach(b => {
                expect(b.organic).toBe(true);
            });
            // Modesto Milling should be in there
            expect(organic.some(b => b.name === 'Modesto Milling')).toBe(true);
        });
    });

    describe('getConventionalBuyers', () => {
        it('should return only conventional buyers', () => {
            const conventional = getConventionalBuyers(FALLBACK_BUYERS_DATA);
            expect(conventional.length).toBeGreaterThan(0);
            conventional.forEach(b => {
                expect(b.organic).toBe(false);
            });
            // Modesto Milling should NOT be in there
            expect(conventional.some(b => b.name === 'Modesto Milling')).toBe(false);
        });
    });
});

describe('Trust Layer: Utility Functions', () => {
    it('isDataStale should detect stale data', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const ds: DataSource = {
            value: 4.30,
            confidence: 'estimated',
            source: 'Test',
            timestamp: twoHoursAgo,
            staleAfterMinutes: 60
        };
        expect(isDataStale(ds)).toBe(true);
    });

    it('isDataStale should detect fresh data', () => {
        const ds: DataSource = {
            value: 4.30,
            confidence: 'verified',
            source: 'Test',
            timestamp: new Date().toISOString(),
            staleAfterMinutes: 60
        };
        expect(isDataStale(ds)).toBe(false);
    });

    it('getOverallConfidence returns estimated when any source is estimated', () => {
        const provenance = {
            futures: { value: 4.3, confidence: 'estimated' as const, source: 'a', timestamp: '', staleAfterMinutes: 60 },
            basis: { value: 1.45, confidence: 'verified' as const, source: 'b', timestamp: '', staleAfterMinutes: 60 },
            freight: { value: 1.40, confidence: 'verified' as const, source: 'c', timestamp: '', staleAfterMinutes: 60 },
            fees: { value: 0, confidence: 'verified' as const, source: 'd', timestamp: '', staleAfterMinutes: 60 }
        };
        expect(getOverallConfidence(provenance)).toBe('estimated');
    });

    it('getOverallConfidence returns missing when any source is missing', () => {
        const provenance = {
            futures: { value: 4.3, confidence: 'verified' as const, source: 'a', timestamp: '', staleAfterMinutes: 60 },
            basis: { value: 0, confidence: 'missing' as const, source: 'b', timestamp: '', staleAfterMinutes: 60 },
            freight: { value: 1.40, confidence: 'verified' as const, source: 'c', timestamp: '', staleAfterMinutes: 60 },
            fees: { value: 0, confidence: 'verified' as const, source: 'd', timestamp: '', staleAfterMinutes: 60 }
        };
        expect(getOverallConfidence(provenance)).toBe('missing');
    });

    it('getOverallConfidence returns verified only when all sources verified', () => {
        const provenance = {
            futures: { value: 4.3, confidence: 'verified' as const, source: 'a', timestamp: '', staleAfterMinutes: 60 },
            basis: { value: 1.45, confidence: 'verified' as const, source: 'b', timestamp: '', staleAfterMinutes: 60 },
            freight: { value: 1.40, confidence: 'verified' as const, source: 'c', timestamp: '', staleAfterMinutes: 60 },
            fees: { value: 0, confidence: 'verified' as const, source: 'd', timestamp: '', staleAfterMinutes: 60 }
        };
        expect(getOverallConfidence(provenance)).toBe('verified');
    });
});

