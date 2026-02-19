import { describe, it, expect } from 'vitest';
import buyersData from '../../data/buyers.json';
import { Buyer, BuyerType, CropType } from '../../types';

describe('Data Integrity - buyers.json', () => {
    const buyers = buyersData as unknown as Buyer[];

    it('should have at least 100 buyers (nationwide directory)', () => {
        expect(buyers.length).toBeGreaterThanOrEqual(100);
    });

    it('should have unique IDs', () => {
        const ids = buyers.map(b => b.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid cropType for all buyers', () => {
        const validCrops: CropType[] = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];
        buyers.forEach(buyer => {
            expect(buyer.cropType).toBeDefined();
            expect(validCrops).toContain(buyer.cropType);
        });
    });

    it('should have boolean organic flag for all buyers', () => {
        buyers.forEach(buyer => {
            expect(typeof buyer.organic).toBe('boolean');
        });
    });

    it('should have valid buyer type', () => {
        const validTypes: BuyerType[] = ['ethanol', 'feedlot', 'processor', 'river', 'shuttle', 'export', 'elevator', 'crush', 'transload'];
        buyers.forEach(buyer => {
            expect(validTypes).toContain(buyer.type);
        });
    });

    it('should have valid coordinates', () => {
        buyers.forEach(buyer => {
            expect(buyer.lat).toBeGreaterThanOrEqual(-90);
            expect(buyer.lat).toBeLessThanOrEqual(90);
            expect(buyer.lng).toBeGreaterThanOrEqual(-180);
            expect(buyer.lng).toBeLessThanOrEqual(180);
        });
    });

    it('should have railConfidence between 0-100', () => {
        buyers.forEach(buyer => {
            expect(buyer.railConfidence).toBeDefined();
            expect(buyer.railConfidence).toBeGreaterThanOrEqual(0);
            expect(buyer.railConfidence).toBeLessThanOrEqual(100);
        });
    });

    it('should have at least 50 BNSF-served buyers (railConfidence >= 70)', () => {
        const bnsfServed = buyers.filter(b => (b.railConfidence ?? 0) >= 70);
        expect(bnsfServed.length).toBeGreaterThanOrEqual(50);
    });

    it('should have buyers in at least 15 states', () => {
        const states = new Set(buyers.map(b => b.state));
        expect(states.size).toBeGreaterThanOrEqual(15);
    });

    it('should have at least 4 different buyer types', () => {
        const types = new Set(buyers.map(b => b.type));
        expect(types.size).toBeGreaterThanOrEqual(4);
    });

    it('should have at least one buyer for Yellow Corn', () => {
        const cornBuyers = buyers.filter(b => b.cropType === 'Yellow Corn');
        expect(cornBuyers.length).toBeGreaterThan(0);
    });
});
