import { describe, it, expect } from 'vitest';
import { bnsfService } from '../bnsfService';
import { calculateFreight } from '../railService';

/**
 * STRESS TEST SUITE: Freight Calculation Accuracy
 * 
 * Tests the BNSF tariff-based rate engine and the calculateFreight function
 * to ensure freight rates from Campbell, MN are accurate and consistent.
 * 
 * All rates are based on BNSF Tariff 4022 (2025/2026 Marketing Year).
 */

describe('BNSF Rate Engine - bnsfService', () => {
    describe('Origin Verification', () => {
        it('should use Campbell, MN as the origin', () => {
            const origin = bnsfService.getOrigin();
            expect(origin.name).toBe('Campbell, MN');
            expect(origin.lat).toBeCloseTo(45.9669, 2);
            expect(origin.lng).toBeCloseTo(-96.4003, 2);
            expect(origin.railroad).toBe('BNSF');
        });
    });

    describe('Tariff Rate Calculations', () => {
        it('should calculate correct rate for Hereford, TX (base rate)', () => {
            const rate = bnsfService.calculateRate('TX', 'Hereford');
            // Base rate: $4400/car + $250 FSC = $4650 total
            // $4650 / 4000 bushels = $1.16/bushel
            expect(rate.ratePerCar).toBe(4400);
            expect(rate.ratePerBushel).toBe(1.16);
            expect(rate.fuelSurcharge).toBe(250);
            expect(rate.origin).toBe('Campbell, MN');
            expect(rate.destination).toBe('Hereford, TX');
            expect(rate.tariffItem).toContain('4022');
        });

        it('should calculate correct rate for California (Base + $960)', () => {
            const rate = bnsfService.calculateRate('CA', 'Modesto');
            // CA: $4400 + $960 = $5360/car + $250 FSC = $5610
            // $5610 / 4000 = $1.40/bushel
            expect(rate.ratePerCar).toBe(5360);
            expect(rate.ratePerBushel).toBe(1.40);
            expect(rate.tariffItem).toContain('CA');
        });

        it('should calculate correct rate for PNW / Washington (Base + $600)', () => {
            const rate = bnsfService.calculateRate('WA', 'Yakima');
            // WA: $4400 + $600 = $5000/car + $250 FSC = $5250
            // $5250 / 4000 = $1.31/bushel
            expect(rate.ratePerCar).toBe(5000);
            expect(rate.ratePerBushel).toBe(1.31);
            expect(rate.tariffItem).toContain('PNW');
        });

        it('should calculate correct rate for Oregon (same as WA)', () => {
            const rate = bnsfService.calculateRate('OR', 'Portland');
            expect(rate.ratePerCar).toBe(5000);
            expect(rate.ratePerBushel).toBe(1.31);
        });

        it('should calculate correct rate for SW Kansas (Base - $1020)', () => {
            const rate = bnsfService.calculateRate('KS', 'Garden City');
            // KS: $4400 - $1020 = $3380/car + $250 FSC = $3630
            // $3630 / 4000 = $0.91/bushel
            expect(rate.ratePerCar).toBe(3380);
            expect(rate.ratePerBushel).toBe(0.91);
        });

        it('should calculate correct rate for Idaho (Base + $500)', () => {
            const rate = bnsfService.calculateRate('ID', 'Jerome');
            // ID: $4400 + $500 = $4900/car + $250 FSC = $5150
            // $5150 / 4000 = $1.29/bushel
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });

        it('should calculate correct rate for Texas Gulf (Base - $260)', () => {
            const rate = bnsfService.calculateRate('TX', 'Galveston');
            // Gulf: $4400 - $260 = $4140/car + $250 FSC = $4390
            // $4390 / 4000 = $1.10/bushel
            expect(rate.ratePerCar).toBe(4140);
            expect(rate.ratePerBushel).toBe(1.10);
        });

        it('should calculate correct rate for Midwest (Base - $1500)', () => {
            const rate = bnsfService.calculateRate('IA', 'Des Moines');
            // Midwest: $4400 - $1500 = $2900/car + $250 FSC = $3150
            // $3150 / 4000 = $0.79/bushel
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('should calculate correct rate for Nebraska (Midwest tier)', () => {
            const rate = bnsfService.calculateRate('NE', 'Columbus');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('should calculate correct rate for Illinois (Midwest tier)', () => {
            const rate = bnsfService.calculateRate('IL', 'Springfield');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('should use default rate for unknown state', () => {
            const rate = bnsfService.calculateRate('FL', 'Miami');
            // Default: $4400/car + $250 FSC = $4650
            expect(rate.ratePerCar).toBe(4400);
            expect(rate.ratePerBushel).toBe(1.16);
        });
    });

    describe('Rate Reasonableness', () => {
        it('freight should never be negative', () => {
            const states = ['CA', 'WA', 'TX', 'KS', 'ID', 'IA', 'NE', 'IL', 'OR', 'FL', 'MN'];
            states.forEach(state => {
                const rate = bnsfService.calculateRate(state, 'City');
                expect(rate.ratePerBushel).toBeGreaterThan(0);
                expect(rate.ratePerCar).toBeGreaterThan(0);
            });
        });

        it('longer hauls should cost more than shorter hauls', () => {
            const caRate = bnsfService.calculateRate('CA', 'Modesto');
            const ksRate = bnsfService.calculateRate('KS', 'Garden City');
            const iaRate = bnsfService.calculateRate('IA', 'Des Moines');

            // CA > KS > IA in terms of cost
            expect(caRate.ratePerBushel).toBeGreaterThan(ksRate.ratePerBushel);
            expect(ksRate.ratePerBushel).toBeGreaterThan(iaRate.ratePerBushel);
        });

        it('rate per bushel should always be between $0.05 and $3.00', () => {
            const states = ['CA', 'WA', 'TX', 'KS', 'ID', 'IA', 'NE', 'IL', 'OR', 'MN'];
            states.forEach(state => {
                const rate = bnsfService.calculateRate(state, 'City');
                expect(rate.ratePerBushel).toBeGreaterThanOrEqual(0.05);
                expect(rate.ratePerBushel).toBeLessThanOrEqual(3.00);
            });
        });
    });
});

describe('calculateFreight Integration', () => {
    describe('Known Destinations', () => {
        it('should calculate freight for CA buyer (Modesto area)', async () => {
            const result = await calculateFreight(
                { lat: 37.6391, lng: -120.9969, state: 'CA', city: 'Modesto' },
                'Penny Newman Grain'
            );
            expect(result.origin).toBe('Campbell, MN');
            expect(result.ratePerBushel).toBe(1.40); // CA rate
            expect(result.distance).toBe(1850);
        });

        it('should calculate freight for TX buyer (Hereford)', async () => {
            const result = await calculateFreight(
                { lat: 34.8158, lng: -102.3979, state: 'TX', city: 'Hereford' },
                'Hereford Grain Corp'
            );
            expect(result.ratePerBushel).toBe(1.16); // TX base rate
            expect(result.distance).toBe(1200);
        });

        it('should calculate freight for KS buyer', async () => {
            const result = await calculateFreight(
                { lat: 37.9717, lng: -100.8727, state: 'KS', city: 'Garden City' },
                'SW Kansas Elevator'
            );
            expect(result.ratePerBushel).toBe(0.91);
            expect(result.distance).toBe(650);
        });

        it('should calculate freight for IA buyer (Midwest tier)', async () => {
            const result = await calculateFreight(
                { lat: 41.5868, lng: -93.6250, state: 'IA', city: 'Des Moines' },
                'Iowa Corn Processor'
            );
            expect(result.ratePerBushel).toBe(0.79); // Midwest rate
        });
    });

    describe('State-Name Fallback (no state provided)', () => {
        it('should infer CA from "Modesto" in name', async () => {
            const result = await calculateFreight(
                { lat: 37.6391, lng: -120.9969 },
                'Stanislaus Feed Modesto'
            );
            expect(result.ratePerBushel).toBe(1.40);
        });

        it('should infer WA from "Yakima" in name', async () => {
            const result = await calculateFreight(
                { lat: 46.6021, lng: -120.5059 },
                'Yakima Valley Feed'
            );
            expect(result.ratePerBushel).toBe(1.31);
        });

        it('should fallback to $0.15 for unknown location', async () => {
            const result = await calculateFreight(
                { lat: 30.0, lng: -80.0 },
                'Unknown Random Buyer'
            );
            expect(result.ratePerBushel).toBe(0.15);
            expect(result.distance).toBe(50);
        });
    });
});
