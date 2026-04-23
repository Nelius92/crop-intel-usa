export type CropType =
    | 'Yellow Corn'
    | 'White Corn'
    | 'Soybeans'
    | 'Wheat'
    | 'Sunflowers';

export interface HeatmapOpportunityThreshold {
    netPrice: number;
    cashPrice: number;
}

export declare const DEFAULT_CROP: CropType;
export declare const CROP_TYPES: readonly [
    'Yellow Corn',
    'White Corn',
    'Soybeans',
    'Wheat',
    'Sunflowers',
];
export declare const USDA_COMMODITY_BY_CROP: Readonly<Record<CropType, string>>;
export declare const HEATMAP_OPPORTUNITY_THRESHOLDS: Readonly<Record<CropType, HeatmapOpportunityThreshold>>;
export declare function isCropType(value: string): value is CropType;
export declare function normalizeCropForUsda(crop: CropType): string;
