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
 * Tests crop separation: Hankinson=Corn, Enderlin=Sunflowers
 */

describe('Pricing Accuracy', () => {
    const futuresPrice = marketDataService.getCurrentFuturesPrice();
    const cornBenchmark = marketDataService.getBenchmark('Yellow Corn');
    const sunflowerBenchmark = marketDataService.getBenchmark('Sunflowers');

    describe('Market Data Sanity', () => {
        it('corn futures price should be within rational bounds ($3.00 - $8.00)', () => {
            expect(futuresPrice).toBeGreaterThanOrEqual(3.00);
            expect(futuresPrice).toBeLessThanOrEqual(8.00);
        });

        it('corn benchmark (Hankinson) basis should be negative', () => {
            expect(cornBenchmark.basis).toBeLessThan(0);
        });

        it('corn benchmark cash price should equal futures + basis', () => {
            const expected = parseFloat((futuresPrice + cornBenchmark.basis).toFixed(2));
            expect(cornBenchmark.cashPrice).toBe(expected);
        });

        it('sunflower benchmark (Enderlin) should be in $/cwt range ($18-$28)', () => {
            expect(sunflowerBenchmark.cashPrice).toBeGreaterThanOrEqual(18.00);
            expect(sunflowerBenchmark.cashPrice).toBeLessThanOrEqual(28.00);
        });

        it('contract month should be a valid string', () => {
            const contract = marketDataService.getActiveContract();
            expect(contract).toBeTruthy();
            expect(contract.length).toBeGreaterThan(2);
        });
    });

    // ── Crop Separation Tests ──
    // These ensure Hankinson is NEVER used for sunflowers and Enderlin is NEVER used for corn

    describe('Crop Benchmark Separation', () => {
        it('corn benchmark should be Hankinson', () => {
            expect(cornBenchmark.name).toBe('Hankinson');
        });

        it('sunflower benchmark should be Enderlin ADM', () => {
            expect(sunflowerBenchmark.name).toBe('Enderlin ADM');
        });

        it('corn benchmark freight should be $0.25 (self-delivery from Campbell)', () => {
            expect(cornBenchmark.freight).toBe(0.25);
        });

        it('sunflower benchmark freight should be $1.00/cwt (self-delivery to Enderlin)', () => {
            expect(sunflowerBenchmark.freight).toBe(1.00);
        });

        it('corn price unit should be $/bu', () => {
            const data = marketDataService.getCropMarketData('Yellow Corn');
            expect(data.priceUnit).toBe('$/bu');
        });

        it('sunflower price unit should be $/cwt', () => {
            const data = marketDataService.getCropMarketData('Sunflowers');
            expect(data.priceUnit).toBe('$/cwt');
        });

        it('sunflower and corn benchmarks should be completely different', () => {
            expect(sunflowerBenchmark.name).not.toBe(cornBenchmark.name);
            // Sunflower price (~$23/cwt) should be way higher than corn (~$4/bu)
            expect(sunflowerBenchmark.cashPrice).toBeGreaterThan(cornBenchmark.cashPrice * 3);
        });

        it('all 5 crops should return valid benchmark data', () => {
            const crops = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];
            for (const crop of crops) {
                const bm = marketDataService.getBenchmark(crop);
                expect(bm.cashPrice).toBeGreaterThan(0);
                expect(bm.name).toBeTruthy();
                expect(bm.freight).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Buyer Data Price Ranges', () => {
        const buyers = FALLBACK_BUYERS_DATA;

        it('all buyers should have numeric basis values', () => {
            buyers.forEach(buyer => {
                if (buyer.basis !== undefined) {
                    expect(typeof buyer.basis).toBe('number');
                    expect(isNaN(buyer.basis)).toBe(false);
                }
            });
        });

        it('basis should be within realistic range (-$2.00 to +$2.00)', () => {
            buyers.forEach(buyer => {
                expect(buyer.basis).toBeGreaterThanOrEqual(-2.00);
                expect(buyer.basis).toBeLessThanOrEqual(2.00);
            });
        });

        it('cash price should be within realistic range ($2.00 - $28.00)', () => {
            buyers.forEach(buyer => {
                expect(buyer.cashPrice).toBeGreaterThanOrEqual(2.00);
                expect(buyer.cashPrice).toBeLessThanOrEqual(28.00); // Sunflowers ~$23/cwt
            });
        });
    });

    describe('Freight-to-Net Price Relationship', () => {
        const buyers = FALLBACK_BUYERS_DATA;

        it('Net price should equal cash price minus freight cost', () => {
            buyers.forEach(buyer => {
                if (buyer.cashPrice && buyer.netPrice && buyer.freightCost != null && buyer.netPrice > 0) {
                    expect(buyer.netPrice).toBeLessThanOrEqual(buyer.cashPrice);
                    expect(buyer.netPrice).toBeCloseTo(buyer.cashPrice - Math.abs(buyer.freightCost), 2);
                }
            });
        });

        it('Freight cost should be a reasonable percentage of cash price (optional)', () => {
            buyers.forEach(buyer => {
                if (buyer.cashPrice && buyer.cashPrice > 0 && buyer.netPrice && buyer.netPrice > 0) {
                    const impliedFreight = buyer.cashPrice - buyer.netPrice;
                    const freightPctOfCash = impliedFreight / buyer.cashPrice;
                    expect(freightPctOfCash).toBeLessThan(0.70);
                }
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
            expect(mnRate.ratePerBushel).toBeLessThan(0.20);
        });

        it('sunflower freight per bu should be lower than corn (more bu/car)', () => {
            const cornRate = bnsfService.calculateRate('ND', 'Enderlin', undefined, undefined, 'Yellow Corn');
            const sunflowerRate = bnsfService.calculateRate('ND', 'Enderlin', undefined, undefined, 'Sunflowers');
            // Sunflowers: 8800 bu/car vs Corn: 4000 bu/car → lower per-bu freight
            expect(sunflowerRate.ratePerBushel).toBeLessThan(cornRate.ratePerBushel);
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

    it('Sunflower buyers should exist', () => {
        const sfBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Sunflowers');
        expect(sfBuyers.length).toBeGreaterThan(0);
    });

    it('corn buyers and sunflower buyers should have NO overlap', () => {
        const cornBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Yellow Corn');
        const sfBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Sunflowers');
        const cornNames = new Set(cornBuyers.map(b => b.name));
        sfBuyers.forEach(b => {
            expect(cornNames.has(b.name)).toBe(false);
        });
    });

    it('Hankinson should NOT appear as a sunflower buyer', () => {
        const sfBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Sunflowers');
        sfBuyers.forEach(b => {
            expect(b.name.toLowerCase()).not.toContain('hankinson');
        });
    });

    it('Enderlin should NOT appear as a corn buyer', () => {
        const cornBuyers = FALLBACK_BUYERS_DATA.filter(b => b.cropType === 'Yellow Corn');
        cornBuyers.forEach(b => {
            expect(b.name.toLowerCase()).not.toContain('enderlin');
        });
    });

    it('organic flag should be boolean for every buyer', () => {
        FALLBACK_BUYERS_DATA.forEach(buyer => {
            expect(typeof buyer.organic).toBe('boolean');
        });
    });

    it('organic buyers must be a small minority', () => {
        const organicCount = FALLBACK_BUYERS_DATA.filter(b => b.organic).length;
        const totalCount = FALLBACK_BUYERS_DATA.length;
        expect(organicCount / totalCount).toBeLessThan(0.20);
    });
});
