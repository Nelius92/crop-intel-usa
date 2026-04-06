import { describe, it, expect } from 'vitest';
import {
    calculateCashBid,
    calculateBasis,
    calculateNetPrice,
    calculateArbitrage,
    validateBid,
    getContractForDelivery,
    getNearbyContract,
    validateSunflowerPrice,
    sunflowerCwtToBushel,
    sunflowerBushelToCwt,
    CROP_CONTRACT_MAP
} from '../bidFormulaEngine';

/**
 * BID FORMULA ENGINE TEST SUITE
 * 
 * Validates the core mathematical engine of Corn Intel:
 *   Cash Bid = Futures + Basis
 *   Net Price = Cash Bid - Freight
 *   Arbitrage = Net via Rail - Local Benchmark Net
 */

describe('Core Price Math', () => {
    describe('calculateCashBid', () => {
        it('positive basis: $4.50 + $0.10 = $4.60', () => {
            expect(calculateCashBid(4.50, 0.10)).toBe(4.60);
        });

        it('negative basis: $4.50 + (-$0.47) = $4.03', () => {
            expect(calculateCashBid(4.50, -0.47)).toBe(4.03);
        });

        it('zero basis: $4.50 + $0.00 = $4.50', () => {
            expect(calculateCashBid(4.50, 0.00)).toBe(4.50);
        });

        it('should handle floating point precision', () => {
            // 4.354 + (-0.65) should not produce 3.7040000000000006
            const result = calculateCashBid(4.354, -0.65);
            expect(result).toBe(3.70);
        });
    });

    describe('calculateBasis', () => {
        it('should derive basis from cash and futures', () => {
            expect(calculateBasis(4.03, 4.50)).toBe(-0.47);
        });

        it('positive basis: $4.70 - $4.50 = +$0.20', () => {
            expect(calculateBasis(4.70, 4.50)).toBe(0.20);
        });
    });

    describe('calculateNetPrice', () => {
        it('Net = Cash - Freight: $4.03 - $0.30 = $3.73', () => {
            expect(calculateNetPrice(4.03, 0.30)).toBe(3.73);
        });

        it('zero freight: $4.03 - $0.00 = $4.03', () => {
            expect(calculateNetPrice(4.03, 0.00)).toBe(4.03);
        });

        it('high freight: $4.03 - $1.58 = $2.45', () => {
            expect(calculateNetPrice(4.03, 1.58)).toBe(2.45);
        });
    });

    describe('calculateArbitrage', () => {
        it('profitable: net $4.00 vs benchmark $3.73 = +$0.27', () => {
            const result = calculateArbitrage(4.00, 3.73);
            expect(result).toBe(0.27);
        });

        it('unprofitable: net $3.50 vs benchmark $3.73 = -$0.23', () => {
            const result = calculateArbitrage(3.50, 3.73);
            expect(result).toBe(-0.23);
        });

        it('breakeven: net $3.73 vs benchmark $3.73 = $0.00', () => {
            const result = calculateArbitrage(3.73, 3.73);
            expect(result).toBe(0.00);
        });
    });
});

describe('Bid Validation', () => {
    it('valid bid within tolerance should pass', () => {
        // validateBid(bid, futures, basis, toleranceCents)
        const result = validateBid(4.03, 4.50, -0.47, 5);
        expect(result.valid).toBe(true);
    });

    it('bid outside tolerance should fail', () => {
        // Expected: 4.50 + (-0.47) = 4.03, actual bid = 5.00
        const result = validateBid(5.00, 4.50, -0.47, 5);
        expect(result.valid).toBe(false);
    });

    it('should include diff in result', () => {
        // Expected: 4.50 + (-0.47) = 4.03, actual bid = 4.10
        const result = validateBid(4.10, 4.50, -0.47, 5);
        // diff = |4.10 - 4.03| = 0.07
        expect(result.diff).toBeCloseTo(0.07, 2);
    });
});

describe('Contract Month Resolution', () => {
    describe('getContractForDelivery', () => {
        it('March delivery → March contract (March is a corn contract month)', () => {
            const result = getContractForDelivery('Yellow Corn', 3, 2026);
            expect(result).toBeTruthy();
            if (result) {
                // ZCH26 — March contract (March IS a contract month for corn)
                expect(result).toContain('ZCH');
            }
        });

        it('July delivery → July contract (delivery month IS a contract month)', () => {
            const result = getContractForDelivery('Yellow Corn', 7, 2026);
            expect(result).toBeTruthy();
            if (result) {
                // ZCN26 — July contract
                expect(result).toContain('ZCN');
            }
        });

        it('October delivery → December contract for corn', () => {
            const result = getContractForDelivery('Yellow Corn', 10, 2026);
            expect(result).toBeTruthy();
            if (result) {
                // ZCZ26 — December contract
                expect(result).toContain('ZCZ');
            }
        });

        it('sunflowers should return null (no futures contract)', () => {
            const result = getContractForDelivery('Sunflowers', 3, 2026);
            expect(result).toBeNull();
        });
    });

    describe('getNearbyContract', () => {
        it('should return a valid contract string for corn', () => {
            const result = getNearbyContract('Yellow Corn');
            expect(result).toBeTruthy();
            // Should start with ZC (corn symbol)
            expect(result).toContain('ZC');
        });

        it('should return a valid contract string for soybeans', () => {
            const result = getNearbyContract('Soybeans');
            expect(result).toBeTruthy();
            expect(result).toContain('ZS');
        });

        it('should return null for sunflowers', () => {
            expect(getNearbyContract('Sunflowers')).toBeNull();
        });
    });
});

describe('Crop Contract Map', () => {
    it('all 5 crops should be defined', () => {
        const crops = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];
        crops.forEach(crop => {
            expect(CROP_CONTRACT_MAP[crop]).toBeDefined();
        });
    });

    it('sunflowers should NOT have futures', () => {
        expect(CROP_CONTRACT_MAP['Sunflowers'].hasFutures).toBe(false);
    });

    it('corn should have 5 contract months', () => {
        expect(CROP_CONTRACT_MAP['Yellow Corn'].contractMonths).toHaveLength(5);
    });

    it('soybeans should have 7 contract months', () => {
        expect(CROP_CONTRACT_MAP['Soybeans'].contractMonths).toHaveLength(7);
    });
});

describe('Sunflower Unit Conversions', () => {
    it('valid sunflower price ($18-$28/cwt) should pass', () => {
        expect(validateSunflowerPrice(23.50)).toBe(true);
    });

    it('invalid sunflower price ($5/cwt) should fail', () => {
        expect(validateSunflowerPrice(5.00)).toBe(false);
    });

    it('$/cwt to $/bu: $23/cwt → $5.75/bu (4 bu/cwt)', () => {
        expect(sunflowerCwtToBushel(23.00)).toBe(5.75);
    });

    it('$/bu to $/cwt: $5.75/bu → $23.00/cwt', () => {
        expect(sunflowerBushelToCwt(5.75)).toBe(23.00);
    });

    it('round-trip conversion should be close (rounding loss at 2dp)', () => {
        const original = 23.50;
        const roundTrip = sunflowerBushelToCwt(sunflowerCwtToBushel(original));
        // 23.50 / 4 = 5.875 → rounds to 5.88 → 5.88 * 4 = 23.52
        // This is expected rounding loss at 2 decimal places
        expect(roundTrip).toBeCloseTo(original, 1);
    });
});
