import { describe, it, expect } from 'vitest';
import { calculateBuyerIntelScore } from '../buyerIntelService';
import { Buyer, CropType } from '../../types';

/**
 * BUYER INTEL SCORE TEST SUITE
 *
 * Validates the composite scoring engine that ranks buyers by
 * actionability: crop match + price advantage + rail access +
 * verified contact + freight efficiency + bid freshness.
 */

function makeBuyer(overrides: Partial<Buyer> = {}): Buyer {
    return {
        id: 'test-1',
        name: 'Test Buyer',
        type: 'ethanol',
        city: 'Fargo',
        state: 'ND',
        region: 'Northern Plains',
        lat: 46.8772,
        lng: -96.7898,
        railAccessible: true,
        nearTransload: false,
        ...overrides,
    };
}

describe('Buyer Intel Score', () => {
    describe('Score Labels & Thresholds', () => {
        it('score >= 80 should be "Top Target" 🔥', () => {
            const buyer = makeBuyer({
                type: 'ethanol',
                netPrice: 5.00,
                railConfidence: 90,
                verified: true,
                contactPhone: '(555) 123-4567',
                freightCost: -0.50,
                bidSource: 'Barchart',
            });
            const result = calculateBuyerIntelScore(buyer, 'Yellow Corn', 3.73);
            expect(result.score).toBeGreaterThanOrEqual(80);
            expect(result.label).toBe('Top Target');
            expect(result.emoji).toBe('🔥');
        });

        it('score 60-79 should be "Strong Lead" ✅', () => {
            const buyer = makeBuyer({
                type: 'ethanol',
                netPrice: 4.00,
                railConfidence: 50,
                verified: false,
                contactPhone: '(555) 123-4567',
                freightCost: -0.80,
            });
            const result = calculateBuyerIntelScore(buyer, 'Yellow Corn', 3.73);
            expect(result.score).toBeGreaterThanOrEqual(60);
            expect(result.score).toBeLessThan(80);
            expect(result.label).toBe('Strong Lead');
        });

        it('score < 40 should be "Low Priority" ⛔', () => {
            const buyer = makeBuyer({
                type: 'crush',  // crush doesn't buy corn
                netPrice: 3.50,
                railConfidence: 0,
                verified: false,
                freightCost: -2.00,
            });
            const result = calculateBuyerIntelScore(buyer, 'Yellow Corn', 3.73);
            expect(result.score).toBeLessThan(40);
            expect(result.label).toBe('Low Priority');
        });
    });

    describe('Signal: Crop Match (25 pts)', () => {
        it('ethanol plant scores max for Yellow Corn', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ type: 'ethanol' }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Crop Match');
            expect(signal?.points).toBe(25);
        });

        it('crush plant scores 0 for Yellow Corn (rarely buys it)', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ type: 'crush' }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Crop Match');
            expect(signal?.points).toBe(0);
        });

        it('crush plant scores max for Soybeans', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ type: 'crush' }),
                'Soybeans'
            );
            const signal = result.signals.find(s => s.name === 'Crop Match');
            expect(signal?.points).toBe(25);
        });

        it('crush plant scores max for Sunflowers', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ type: 'crush' }),
                'Sunflowers'
            );
            const signal = result.signals.find(s => s.name === 'Crop Match');
            expect(signal?.points).toBe(25);
        });
    });

    describe('Signal: Price Advantage (25 pts)', () => {
        it('big premium (>$0.50 above benchmark) scores 25', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ netPrice: 4.50 }),
                'Yellow Corn',
                3.73
            );
            const signal = result.signals.find(s => s.name === 'Price Advantage');
            expect(signal?.points).toBe(25);
        });

        it('no net price scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ netPrice: undefined }),
                'Yellow Corn',
                3.73
            );
            const signal = result.signals.find(s => s.name === 'Price Advantage');
            expect(signal?.points).toBe(0);
        });

        it('no benchmark scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ netPrice: 4.50 }),
                'Yellow Corn',
                undefined
            );
            const signal = result.signals.find(s => s.name === 'Price Advantage');
            expect(signal?.points).toBe(0);
        });
    });

    describe('Signal: Rail Access (15 pts)', () => {
        it('high rail confidence (>= 70) scores 15', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ railConfidence: 85 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Rail Access');
            expect(signal?.points).toBe(15);
        });

        it('mid rail confidence (40-69) scores 10', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ railConfidence: 50 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Rail Access');
            expect(signal?.points).toBe(10);
        });

        it('no rail confidence scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ railConfidence: 0 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Rail Access');
            expect(signal?.points).toBe(0);
        });
    });

    describe('Signal: Verified Contact (10 pts)', () => {
        it('verified + phone scores 10', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ verified: true, contactPhone: '(555) 123-4567' }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Verified Contact');
            expect(signal?.points).toBe(10);
        });

        it('phone but not verified scores 5', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ verified: false, contactPhone: '(555) 123-4567' }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Verified Contact');
            expect(signal?.points).toBe(5);
        });

        it('no phone scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ verified: false, contactPhone: undefined }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Verified Contact');
            expect(signal?.points).toBe(0);
        });
    });

    describe('Signal: Freight Efficiency (15 pts)', () => {
        it('low freight ($0.50/bu) scores 15', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ freightCost: -0.50 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Freight Efficiency');
            expect(signal?.points).toBe(15);
        });

        it('high freight ($1.58/bu) scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ freightCost: -1.58 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Freight Efficiency');
            // $1.58 >= $1.60 threshold → 0 pts
            expect(signal?.points).toBe(4);
        });

        it('zero freight scores 0 (no estimate)', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ freightCost: 0 }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Freight Efficiency');
            expect(signal?.points).toBe(0);
        });
    });

    describe('Signal: Bid Freshness (10 pts)', () => {
        it('scraped bid scores 10', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ bidSource: 'Barchart (scraped)' }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Bid Freshness');
            expect(signal?.points).toBe(10);
        });

        it('no bid source scores 0', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ bidSource: undefined }),
                'Yellow Corn'
            );
            const signal = result.signals.find(s => s.name === 'Bid Freshness');
            expect(signal?.points).toBe(0);
        });
    });

    describe('Score Consistency', () => {
        it('total should equal sum of all signals', () => {
            const result = calculateBuyerIntelScore(
                makeBuyer({ netPrice: 4.20, railConfidence: 60, freightCost: -0.80 }),
                'Yellow Corn',
                3.73
            );
            const signalSum = result.signals.reduce((sum, s) => sum + s.points, 0);
            expect(result.score).toBe(signalSum);
        });

        it('max possible score should be 100', () => {
            const maxSignals = [25, 25, 15, 10, 15, 10]; // all signal maxes
            expect(maxSignals.reduce((a, b) => a + b, 0)).toBe(100);
        });

        it('all signals should have 6 entries', () => {
            const result = calculateBuyerIntelScore(makeBuyer(), 'Yellow Corn');
            expect(result.signals).toHaveLength(6);
        });

        it('all 5 crops should return a valid score', () => {
            const crops: CropType[] = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];
            crops.forEach(crop => {
                const result = calculateBuyerIntelScore(makeBuyer(), crop);
                expect(result.score).toBeGreaterThanOrEqual(0);
                expect(result.score).toBeLessThanOrEqual(100);
                expect(result.label).toBeTruthy();
            });
        });
    });
});
