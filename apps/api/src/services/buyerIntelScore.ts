import {
    calculateBuyerIntelScore as calculateSharedBuyerIntelScore,
    getCropTypeRelevance,
    type BuyerIntelInput,
    type BuyerIntelResult,
} from '../../../../shared/buyerIntel.js';

export type { BuyerIntelInput, BuyerIntelResult, IntelSignal } from '../../../../shared/buyerIntel.js';

export function calculateBuyerIntelScore(input: BuyerIntelInput): BuyerIntelResult {
    return calculateSharedBuyerIntelScore(input);
}

export { getCropTypeRelevance };
