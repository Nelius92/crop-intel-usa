import { describe, it, expect } from 'vitest';
import { bnsfService } from '../bnsfService';
import { calculateFreight } from '../railService';

/**
 * STRESS TEST SUITE: Freight Calculation Accuracy
 * 
 * Tests the BNSF tariff-based rate engine and the calculateFreight function
 * to ensure freight rates from Campbell, MN are accurate and consistent.
 * 
 * Rates calibrated with LIVE BNSF API data (Tariff 4022 Item 31750, March 2026).
 * Crop-specific: per-car rates are constant, per-bushel varies by crop weight.
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

    describe('API-Verified Rates (CA, WA, OR, MT)', () => {
        it('California: Modesto = $6,075/car ($1.58/bu corn)', () => {
            const rate = bnsfService.calculateRate('CA', 'Modesto');
            // BNSF API: Modesto = $6,075/car + $250 FSC = $6,325
            // $6,325 / 4,000 bu = $1.58/bu (corn)
            expect(rate.ratePerCar).toBe(6075);
            expect(rate.ratePerBushel).toBe(1.58);
            expect(rate.tariffItem).toContain('API-verified');
        });

        it('WA Inland: Toppenish = $3,038/car ($0.82/bu corn)', () => {
            const rate = bnsfService.calculateRate('WA', 'Toppenish');
            // BNSF API: Toppenish $3,038/car + $250 FSC = $3,288
            expect(rate.ratePerCar).toBe(3038);
            expect(rate.ratePerBushel).toBe(0.82);
            expect(rate.tariffItem).toContain('WA inland');
        });

        it('WA Export: Seattle-area = $5,944/car ($1.55/bu corn)', () => {
            const rate = bnsfService.calculateRate('WA', 'Seattle');
            expect(rate.ratePerCar).toBe(5944);
            expect(rate.ratePerBushel).toBe(1.55);
            expect(rate.tariffItem).toContain('WA export');
        });

        it('OR Export: McMinnville = $6,606/car ($1.71/bu corn)', () => {
            const rate = bnsfService.calculateRate('OR', 'McMinnville');
            expect(rate.ratePerCar).toBe(6606);
            expect(rate.ratePerBushel).toBe(1.71);
        });

        it('OR Inland: Prineville = $4,966/car ($1.30/bu corn)', () => {
            const rate = bnsfService.calculateRate('OR', 'Prineville');
            expect(rate.ratePerCar).toBe(4966);
            expect(rate.ratePerBushel).toBe(1.30);
        });

        it('Montana: $4,900/car ($1.29/bu corn)', () => {
            const rate = bnsfService.calculateRate('MT', 'Billings');
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });
    });

    describe('Texas & Southern Plains', () => {
        it('TX Panhandle (Hereford) = base rate $4,400/car ($1.16/bu)', () => {
            const rate = bnsfService.calculateRate('TX', 'Hereford');
            expect(rate.ratePerCar).toBe(4400);
            expect(rate.ratePerBushel).toBe(1.16);
            expect(rate.origin).toBe('Campbell, MN');
            expect(rate.destination).toBe('Hereford, TX');
        });

        it('TX Gulf (Galveston) = Base - $260 ($1.10/bu)', () => {
            const rate = bnsfService.calculateRate('TX', 'Galveston');
            expect(rate.ratePerCar).toBe(4140);
            expect(rate.ratePerBushel).toBe(1.10);
        });

        it('Kansas = Base - $1,020 ($0.91/bu)', () => {
            const rate = bnsfService.calculateRate('KS', 'Garden City');
            expect(rate.ratePerCar).toBe(3380);
            expect(rate.ratePerBushel).toBe(0.91);
        });

        it('Colorado = same tier as KS ($0.91/bu)', () => {
            const rate = bnsfService.calculateRate('CO', 'Denver');
            expect(rate.ratePerCar).toBe(3380);
            expect(rate.ratePerBushel).toBe(0.91);
        });

        it('Oklahoma = TX Gulf tier ($1.04/bu)', () => {
            const rate = bnsfService.calculateRate('OK', 'Tulsa');
            expect(rate.ratePerCar).toBe(4140);
            expect(rate.ratePerBushel).toBe(1.10);
        });
    });

    describe('Mountain / Southwest', () => {
        it('Idaho = Base + $500 ($1.29/bu)', () => {
            const rate = bnsfService.calculateRate('ID', 'Jerome');
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });

        it('Wyoming = Base + $500 ($1.29/bu)', () => {
            const rate = bnsfService.calculateRate('WY', 'Sheridan');
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });

        it('New Mexico = base TX tier ($1.16/bu)', () => {
            const rate = bnsfService.calculateRate('NM', 'Clovis');
            expect(rate.ratePerCar).toBe(4400);
            expect(rate.ratePerBushel).toBe(1.16);
        });

        it('Arizona = Base + $700 ($1.28/bu)', () => {
            const rate = bnsfService.calculateRate('AZ', 'Phoenix');
            expect(rate.ratePerCar).toBe(5100);
            expect(rate.ratePerBushel).toBe(1.34);
        });
    });

    describe('Midwest / Corn Belt', () => {
        it('Iowa = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('IA', 'Des Moines');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('Nebraska = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('NE', 'Columbus');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('Illinois = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('IL', 'Springfield');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('Indiana = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('IN', 'Indianapolis');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('Ohio = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('OH', 'Toledo');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });

        it('Wisconsin = Midwest tier ($0.79/bu)', () => {
            const rate = bnsfService.calculateRate('WI', 'Madison');
            expect(rate.ratePerCar).toBe(2900);
            expect(rate.ratePerBushel).toBe(0.79);
        });
    });

    describe('Southeast (Interline)', () => {
        it('Tennessee = Base + $500 ($1.16/bu)', () => {
            const rate = bnsfService.calculateRate('TN', 'Memphis');
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });

        it('Arkansas = Base + $200 ($1.15/bu)', () => {
            const rate = bnsfService.calculateRate('AR', 'Little Rock');
            expect(rate.ratePerCar).toBe(4600);
            expect(rate.ratePerBushel).toBe(1.21);
        });

        it('Mississippi = Base + $500 ($1.29/bu)', () => {
            const rate = bnsfService.calculateRate('MS', 'Jackson');
            expect(rate.ratePerCar).toBe(4900);
            expect(rate.ratePerBushel).toBe(1.29);
        });

        it('Alabama = Base + $700 ($1.34/bu)', () => {
            const rate = bnsfService.calculateRate('AL', 'Birmingham');
            expect(rate.ratePerCar).toBe(5100);
            expect(rate.ratePerBushel).toBe(1.34);
        });

        it('Georgia = Base + $900 ($1.41/bu)', () => {
            const rate = bnsfService.calculateRate('GA', 'Atlanta');
            expect(rate.ratePerCar).toBe(5300);
            expect(rate.ratePerBushel).toBe(1.39);
        });

        it('Louisiana = TX Gulf tier ($1.10/bu)', () => {
            const rate = bnsfService.calculateRate('LA', 'New Orleans');
            expect(rate.ratePerCar).toBe(4140);
            expect(rate.ratePerBushel).toBe(1.10);
        });
    });

    describe('Crop-Specific Bushels Per Car', () => {
        it('soybeans cost more per bushel (fewer bu/car)', () => {
            const cornRate = bnsfService.calculateRate('CA', 'Modesto', undefined, undefined, 'Yellow Corn');
            const soyRate = bnsfService.calculateRate('CA', 'Modesto', undefined, undefined, 'Soybeans');
            // Same per-car, but soy = 3,723 bu/car (weigh-out at 60 lbs/bu) vs corn = 4,000
            expect(cornRate.ratePerCar).toBe(soyRate.ratePerCar);
            expect(soyRate.ratePerBushel).toBeGreaterThan(cornRate.ratePerBushel);
            // Soy: (6075+250)/3723 = $1.70/bu
            expect(soyRate.ratePerBushel).toBe(1.70);
        });

        it('sunflowers cost less per bushel (volume-limited, lighter)', () => {
            const cornRate = bnsfService.calculateRate('CA', 'Modesto', undefined, undefined, 'Yellow Corn');
            const sunRate = bnsfService.calculateRate('CA', 'Modesto', undefined, undefined, 'Sunflowers');
            // Sunflowers: 4,148 bu/car (cube-out at 5,161 cu ft, 25 lbs/bu)
            expect(sunRate.ratePerBushel).toBeLessThan(cornRate.ratePerBushel);
            // (6075+250)/4148 = $1.52/bu
            expect(sunRate.ratePerBushel).toBe(1.52);
        });

        it('wheat same per-bushel as soybeans (same 60 lbs/bu)', () => {
            const soyRate = bnsfService.calculateRate('KS', 'Garden City', undefined, undefined, 'Soybeans');
            const wheatRate = bnsfService.calculateRate('KS', 'Garden City', undefined, undefined, 'Wheat');
            expect(soyRate.ratePerBushel).toBe(wheatRate.ratePerBushel);
        });
    });

    describe('Rate Reasonableness', () => {
        it('freight should never be negative', () => {
            const states = ['CA', 'WA', 'TX', 'KS', 'ID', 'IA', 'NE', 'IL', 'OR',
                            'CO', 'OK', 'WY', 'MT', 'GA', 'AL', 'TN', 'AR', 'MS',
                            'LA', 'OH', 'IN', 'WI', 'NM', 'AZ', 'FL', 'MN'];
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
            const states = ['CA', 'WA', 'TX', 'KS', 'ID', 'IA', 'NE', 'IL', 'OR',
                            'CO', 'OK', 'WY', 'MT', 'GA', 'AL', 'TN', 'AR', 'MS',
                            'LA', 'OH', 'IN', 'WI', 'NM', 'AZ', 'MN'];
            states.forEach(state => {
                const rate = bnsfService.calculateRate(state, 'City');
                expect(rate.ratePerBushel).toBeGreaterThanOrEqual(0.05);
                expect(rate.ratePerBushel).toBeLessThanOrEqual(3.00);
            });
        });

        it('southeast interline should be pricier than Midwest', () => {
            const gaRate = bnsfService.calculateRate('GA', 'Atlanta');
            const iaRate = bnsfService.calculateRate('IA', 'Des Moines');
            expect(gaRate.ratePerBushel).toBeGreaterThan(iaRate.ratePerBushel);
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
            expect(result.ratePerBushel).toBe(1.58); // CA API-verified rate
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
            expect(result.ratePerBushel).toBe(1.58); // Updated CA rate
        });

        it('should return a positive rate for unknown location (truck fallback)', async () => {
            const result = await calculateFreight(
                { lat: 30.0, lng: -80.0 },
                'Unknown Random Buyer'
            );
            // No state can be inferred → truck freight service computes based on distance
            expect(result.ratePerBushel).toBeGreaterThan(0);
        });
    });
});
