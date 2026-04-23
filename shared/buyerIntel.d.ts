import type { CropType } from './crops.js';

export type BuyerType =
    | 'ethanol'
    | 'feedlot'
    | 'processor'
    | 'river'
    | 'shuttle'
    | 'export'
    | 'elevator'
    | 'crush'
    | 'transload';

export type DroughtSeverity =
    | 'none'
    | 'abnormal'
    | 'moderate'
    | 'severe'
    | 'extreme'
    | 'exceptional';

export interface IntelSignal {
    name: string;
    points: number;
    maxPoints: number;
    reason: string;
}

export interface BuyerIntelInput {
    buyerType: string;
    crop: CropType;
    netPrice?: number | null;
    benchmarkPrice?: number;
    railConfidence?: number | null;
    verifiedStatus?: string | null;
    hasPhone?: boolean;
    freightCost?: number | null;
    hasRealBid?: boolean;
    website?: string | null;
    droughtSeverity?: DroughtSeverity;
}

export interface BuyerIntelResult {
    score: number;
    label: string;
    emoji: string;
    color: string;
    signals: IntelSignal[];
}

export declare const BUYER_INTEL_TYPE_RELEVANCE: Readonly<Record<CropType, Partial<Record<BuyerType, number>>>>;
export declare const BUYER_INTEL_SIGNAL_MAX_POINTS: Readonly<{
    cropMatch: 25;
    priceAdvantage: 25;
    railAccess: 15;
    verifiedContact: 10;
    freightEfficiency: 15;
    bidFreshness: 10;
    droughtImpact: 5;
}>;
export declare function getCropTypeRelevance(crop: CropType): Partial<Record<BuyerType, number>>;
export declare function calculateBuyerIntelScore(input: BuyerIntelInput): BuyerIntelResult;
