import { describe, expect, it } from 'vitest';
import {
    CROP_TYPES,
    DEFAULT_CROP,
    HEATMAP_OPPORTUNITY_THRESHOLDS,
    USDA_COMMODITY_BY_CROP,
} from '@shared/crops.js';

describe('shared crop domain', () => {
    it('defines heatmap opportunity thresholds for every supported crop and nothing extra', () => {
        expect(DEFAULT_CROP).toBe('Yellow Corn');
        expect(Object.keys(HEATMAP_OPPORTUNITY_THRESHOLDS).sort()).toEqual([...CROP_TYPES].sort());

        for (const crop of CROP_TYPES) {
            expect(HEATMAP_OPPORTUNITY_THRESHOLDS[crop]).toMatchObject({
                netPrice: expect.any(Number),
                cashPrice: expect.any(Number),
            });
        }
    });

    it('maps every supported crop to a USDA commodity label', () => {
        expect(Object.keys(USDA_COMMODITY_BY_CROP).sort()).toEqual([...CROP_TYPES].sort());

        for (const crop of CROP_TYPES) {
            expect(USDA_COMMODITY_BY_CROP[crop]).toBeTruthy();
        }
    });
});
