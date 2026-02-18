import { describe, it, expect } from 'vitest';
import buyersData from '../../data/buyers.json';
import { Buyer, BuyerType, CropType } from '../../types';

describe('Data Integrity - buyers.json', () => {
    const buyers = buyersData as unknown as Buyer[];

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
        const validTypes: BuyerType[] = ['ethanol', 'feedlot', 'processor', 'river', 'shuttle', 'export', 'elevator'];
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
    it('should have at least one buyer for each crop type', () => {
        const validCrops: CropType[] = ['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers'];

        validCrops.forEach(crop => {
            const buyersForCrop = buyers.filter(b => b.cropType === crop);
            expect(buyersForCrop.length).toBeGreaterThan(0);
        });
    });
});
