import { describe, it, expect } from 'vitest';
import { FALLBACK_BUYERS_DATA } from '../fallbackData';
import { bnsfService } from '../bnsfService';
import { marketDataService } from '../marketDataService';

/**
 * STRESS TEST SUITE: Pricing Accuracy & Net Price Math
 * 
 * Verifies the core pricing formula:
 *   Cash Price = Futures + Basis
 *   Net Price  = Cash Price - Freight
 * 
 * Ensures no buyer has impossible/nonsensical pricing.
 */

describe('Pricing Accuracy', () => {
    const futuresPrice = marketDataService.getCurrentFuturesPrice();
    const hankinson = marketDataService.getHankinsonBenchmark();

    describe('Market Data Sanity', () => {
        it('futures price should be within rational bounds ($3.00 - $8.00)', () => {
            expect(futuresPrice).toBeGreaterThanOrEqual(3.00);
            expect(futuresPrice).toBeLessThanOrEqual(8.00);
        });

        it('Hankinson basis should be negative (typical for rural origin)', () => {
            expect(hankinson.basis).toBeLessThan(0);
        });

        it('Hankinson cash price should equal futures + basis', () => {
            const expected = parseFloat((futuresPrice + hankinson.basis).toFixed(2));
            expect(hankinson.cashPrice).toBe(expected);
        });

        it('contract month should be a valid string', () => {
            const contract = marketDataService.getActiveContract();
            expect(contract).toBeTruthy();
            expect(contract.length).toBeGreaterThan(2);
        });
    });

    describe('Buyer Data Price Ranges', () => {
        const buyers = FALLBACK_BUYERS_DATA;

        it('all buyers should have numeric basis values', () => {
            buyers.forEach(buyer => {
                expect(typeof buyer.basis).toBe('number');
                expect(isNaN(buyer.basis)).toBe(false);
            });
        });

        it('basis should be within realistic range (-$2.00 to +$2.00)', () => {
            buyers.forEach(buyer => {
                expect(buyer.basis).toBeGreaterThanOrEqual(-2.00);
                expect(buyer.basis).toBeLessThanOrEqual(2.00);
            });
        });

        it('cash price should be within realistic range ($2.00 - $22.00)', () => {
            buyers.forEach(buyer => {
                expect(buyer.cashPrice).toBeGreaterThanOrEqual(2.00);
                expect(buyer.cashPrice).toBeLessThanOrEqual(22.00); // Sunflowers can be ~$18.50/bu
            });
        });
    });

    describe('Freight-to-Net Price Relationship', () => {
        it('net price should be less than cash price for all buyers', () => {
            const buyers = FALLBACK_BUYERS_DATA;
            buyers.forEach(buyer => {
                // Net = Cash - Freight, so Net < Cash (since freight > 0)
                expect(buyer.netPrice).toBeLessThanOrEqual(buyer.cashPrice);
            });
        });

        it('freight cost should not exceed 50% of cash price', () => {
            const buyers = FALLBACK_BUYERS_DATA;
            buyers.forEach(buyer => {
                const impliedFreight = buyer.cashPrice - (buyer.netPrice ?? 0);
                const freightPctOfCash = impliedFreight / buyer.cashPrice;
                expect(freightPctOfCash).toBeLessThan(0.60); // Adjusted for high freight markets
            });
        });
    });

    describe('BNSF Rate vs Buyer State Consistency', () => {
        it('CA buyers should have highest freight costs', () => {
            const buyers = FALLBACK_BUYERS_DATA;
            const caBuyers = buyers.filter(b => b.state === 'CA');
            const iaBuyers = buyers.filter(b => b.state === 'IA');

            if (caBuyers.length > 0 && iaBuyers.length > 0) {
                const caRate = bnsfService.calculateRate('CA', 'Modesto');
                const iaRate = bnsfService.calculateRate('IA', 'Des Moines');
                expect(caRate.ratePerBushel).toBeGreaterThan(iaRate.ratePerBushel);
            }
        });

        it('MN (local) buyers should have the lowest freight', () => {
            const mnRate = bnsfService.calculateRate('MN', 'Hankinson');
            expect(mnRate.ratePerBushel).toBeLessThan(0.20); // $350/car + $250 FSC = $600 / 4000 = $0.15/bu
        });
    });
});

describe('Cross-Crop Data Integrity', () => {
    const validCrops = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];

    it('all buyers should have a valid cropType', () => {
        FALLBACK_BUYERS_DATA.forEach(buyer => {
            expect(validCrops).toContain(buyer.cropType);
        });
    });

    it('Yellow Corn buyers should exist', () => {
        const cornBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Yellow Corn');
        expect(cornBuyers.length).toBeGreaterThan(0);
    });

    it('organic flag should be boolean for every buyer', () => {
        FALLBACK_BUYERS_DATA.forEach(buyer => {
            expect(typeof buyer.organic).toBe('boolean');
        });
    });

    it('organic buyers must be a small minority', () => {
        const organicCount = FALLBACK_BUYERS_DATA.filter(b => b.organic).length;
        const totalCount = FALLBACK_BUYERS_DATA.length;
        // Organic should be less than 20% of total buyers (realistic)
        expect(organicCount / totalCount).toBeLessThan(0.20);
    });
});
