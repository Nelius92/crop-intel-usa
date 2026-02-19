import { describe, it, expect } from 'vitest';
import {
    scoreRailConfidence,
    enrichBuyersWithRailConfidence,
    getCorridorName,
    CORRIDOR_NAMES
} from '../railConfidenceService';
import { TRANSLOADERS } from '../transloaderService';
import { Buyer } from '../../types';
import { FALLBACK_BUYERS_DATA } from '../fallbackData';

// ── Test helpers ──
const makeBuyer = (overrides: Partial<Buyer>): Buyer => ({
    id: 'test-1',
    name: 'Test Buyer',
    city: 'Test City',
    state: 'TX',
    region: 'Southern Plains',
    lat: 34.73,
    lng: -102.39,
    type: 'feedlot',
    basis: -0.10,
    cashPrice: 4.40,
    netPrice: 3.90,
    freightCost: -0.50,
    contactName: 'Test',
    contactPhone: '555-0000',
    verified: false,
    organic: false,
    railAccessible: false,
    nearTransload: false,
    cropType: 'Yellow Corn',
    ...overrides
});

describe('Rail Confidence Scoring', () => {
    describe('scoreRailConfidence', () => {
        it('should return a score between 0 and 100', () => {
            const buyer = makeBuyer({});
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            expect(result.railEvidence.score).toBeGreaterThanOrEqual(0);
            expect(result.railEvidence.score).toBeLessThanOrEqual(100);
        });

        it('should give high score for shuttle facility near BNSF track', () => {
            // Hereford, TX is right on BNSF line
            const buyer = makeBuyer({ type: 'shuttle', lat: 34.82, lng: -102.39 });
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            expect(result.railEvidence.score).toBeGreaterThanOrEqual(40);
            expect(result.railServedConfidence).toMatch(/confirmed|likely/);
        });

        it('should give low score for buyer far from any BNSF track', () => {
            // Middle of Maine - far from BNSF
            const buyer = makeBuyer({ lat: 45.5, lng: -69.0 });
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            expect(result.railEvidence.score).toBeLessThan(40);
            expect(result.railServedConfidence).toMatch(/possible|unverified/);
        });

        it('should give facility type bonus for shuttle/export/river types', () => {
            const base = makeBuyer({ lat: 41.88, lng: -87.63 }); // Chicago area
            const shuttle = makeBuyer({ lat: 41.88, lng: -87.63, type: 'shuttle' });

            const baseResult = scoreRailConfidence(base, TRANSLOADERS);
            const shuttleResult = scoreRailConfidence(shuttle, TRANSLOADERS);

            expect(shuttleResult.railEvidence.score).toBeGreaterThan(baseResult.railEvidence.score);
            expect(shuttleResult.railEvidence.facilityTypeBonus).toBe(true);
            expect(baseResult.railEvidence.facilityTypeBonus).toBe(false);
        });

        it('should populate evidence fields correctly', () => {
            const buyer = makeBuyer({ lat: 41.88, lng: -87.63 }); // Chicago
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            const ev = result.railEvidence;

            expect(typeof ev.distanceToTrackMiles).toBe('number');
            expect(typeof ev.nearestCorridorId).toBe('string');
            expect(ev.nearestCorridorId).not.toBe('unknown');
            expect(typeof ev.manuallyVerified).toBe('boolean');
            expect(ev.manuallyVerified).toBe(false);
        });
    });

    describe('Confidence level mapping', () => {
        it('score >= 70 → confirmed', () => {
            // Close to BNSF track + shuttle type + near transloader
            const buyer = makeBuyer({ lat: 41.88, lng: -87.63, type: 'shuttle' });
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            if (result.railEvidence.score >= 70) {
                expect(result.railServedConfidence).toBe('confirmed');
            }
        });

        it('score 40-69 → likely', () => {
            const buyer = makeBuyer({ lat: 42.0, lng: -93.5 }); // Iowa, near BNSF
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            if (result.railEvidence.score >= 40 && result.railEvidence.score < 70) {
                expect(result.railServedConfidence).toBe('likely');
            }
        });

        it('score 15-39 → possible', () => {
            const buyer = makeBuyer({ lat: 38.0, lng: -80.0 }); // West Virginia, far from BNSF
            const result = scoreRailConfidence(buyer, TRANSLOADERS);
            if (result.railEvidence.score >= 15 && result.railEvidence.score < 40) {
                expect(result.railServedConfidence).toBe('possible');
            }
        });
    });

    describe('enrichBuyersWithRailConfidence', () => {
        it('should enrich all buyers with rail confidence data', () => {
            const testBuyers = FALLBACK_BUYERS_DATA.slice(0, 5);
            const enriched = enrichBuyersWithRailConfidence(testBuyers, TRANSLOADERS);

            expect(enriched).toHaveLength(5);
            enriched.forEach(buyer => {
                expect(buyer.railServedConfidence).toBeDefined();
                expect(buyer.railEvidence).toBeDefined();
                expect(typeof buyer.railAccessible).toBe('boolean');
                expect(typeof buyer.railEvidence!.score).toBe('number');
            });
        });

        it('should derive railAccessible from score >= 40', () => {
            const testBuyers = FALLBACK_BUYERS_DATA.slice(0, 10);
            const enriched = enrichBuyersWithRailConfidence(testBuyers, TRANSLOADERS);

            enriched.forEach(buyer => {
                const expected = buyer.railEvidence!.score >= 40;
                expect(buyer.railAccessible).toBe(expected);
            });
        });

        it('should derive nearTransload from transloader distance <= 25mi', () => {
            const testBuyers = FALLBACK_BUYERS_DATA.slice(0, 10);
            const enriched = enrichBuyersWithRailConfidence(testBuyers, TRANSLOADERS);

            enriched.forEach(buyer => {
                const ev = buyer.railEvidence!;
                if (ev.nearestTransloadMiles !== undefined && ev.nearestTransloadMiles <= 25) {
                    expect(buyer.nearTransload).toBe(true);
                }
            });
        });
    });

    describe('getCorridorName', () => {
        it('should return human-readable name for known corridor IDs', () => {
            expect(getCorridorName('bnsf-north-transcon')).toBe('BNSF Northern Transcon');
        });

        it('should return the ID itself for unknown corridors', () => {
            expect(getCorridorName('nonexistent-id')).toBe('nonexistent-id');
        });

        it('should have names for all major corridors', () => {
            const knownIds = Object.keys(CORRIDOR_NAMES);
            expect(knownIds.length).toBeGreaterThan(5);
            knownIds.forEach(id => {
                expect(getCorridorName(id)).not.toBe(id); // Should have a human name
            });
        });
    });
});
