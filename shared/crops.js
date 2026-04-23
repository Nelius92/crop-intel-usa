export const DEFAULT_CROP = 'Yellow Corn';

export const CROP_TYPES = [
    'Yellow Corn',
    'White Corn',
    'Soybeans',
    'Wheat',
    'Sunflowers',
];

export const USDA_COMMODITY_BY_CROP = {
    'Yellow Corn': 'Corn',
    'White Corn': 'Corn',
    'Soybeans': 'Soybeans',
    'Wheat': 'Wheat',
    'Sunflowers': 'Sunflowers',
};

export const HEATMAP_OPPORTUNITY_THRESHOLDS = {
    'Yellow Corn': { netPrice: 4.75, cashPrice: 5.0 },
    'White Corn': { netPrice: 4.9, cashPrice: 5.15 },
    'Soybeans': { netPrice: 10.5, cashPrice: 11.0 },
    'Wheat': { netPrice: 5.5, cashPrice: 6.0 },
    'Sunflowers': { netPrice: 20.0, cashPrice: 22.0 },
};

export function isCropType(value) {
    return CROP_TYPES.includes(value);
}

export function normalizeCropForUsda(crop) {
    return USDA_COMMODITY_BY_CROP[crop] || crop;
}
