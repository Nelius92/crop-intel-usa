import { describe, it, expect, vi } from 'vitest';
import { fetchRealBuyersFromGoogle, getOrganicBuyers, getConventionalBuyers } from '../buyersService';
import { FALLBACK_BUYERS_DATA } from '../fallbackData';

// Mock dependencies
vi.mock('../marketDataService', () => ({
    marketDataService: {
        getCurrentFuturesPrice: () => 4.50,
        getHankinsonBenchmark: () => ({ cashPrice: 4.40, basis: -0.10 })
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
    calculateFreight: async () => ({ ratePerBushel: 0.50 })
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

        it('should return empty list for Soybeans (until data is added)', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Soybeans');
            expect(buyers.length).toBe(0);
        });

        it('should return empty list for Wheat', async () => {
            const buyers = await fetchRealBuyersFromGoogle('Wheat');
            expect(buyers.length).toBe(0);
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
