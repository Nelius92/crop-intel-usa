import { Buyer, CropType } from '../types';
import { apiPostJson } from './apiClient';
import { DroughtSeverity } from './droughtService';
import {
    calculateBuyerIntelScore as calculateSharedBuyerIntelScore,
    type BuyerIntelResult,
} from '../../shared/buyerIntel.js';

export type { BuyerIntelResult, IntelSignal } from '../../shared/buyerIntel.js';

export function calculateBuyerIntelScore(
    buyer: Buyer,
    crop: CropType,
    benchmarkPrice?: number,
    droughtSeverity?: DroughtSeverity
): BuyerIntelResult {
    return calculateSharedBuyerIntelScore({
        buyerType: buyer.type,
        crop,
        netPrice: buyer.netPrice ?? null,
        benchmarkPrice,
        railConfidence: buyer.railConfidence ?? null,
        verifiedStatus: buyer.verified ? 'verified' : 'unverified',
        hasPhone: !!buyer.contactPhone,
        freightCost: buyer.freightCost ?? null,
        hasRealBid: !!buyer.bidSource,
        website: buyer.website ?? null,
        droughtSeverity,
    });
}

// ── On-demand Gemini Explanation (API call) ──────────────────────────
export async function fetchBuyerExplanation(
    buyer: Buyer,
    crop: CropType,
    benchmarkPrice?: number
): Promise<string> {
    try {
        const result = await apiPostJson<{ data: { explanation: string } }>('/api/ai/buyer-intel', {
            crop,
            buyerData: {
                name: buyer.name,
                type: buyer.type,
                city: buyer.city,
                state: buyer.state,
                netPrice: buyer.netPrice ?? null,
                benchmarkPrice,
                railConfidence: buyer.railConfidence ?? null,
                verifiedStatus: buyer.verified ? 'verified' : 'unverified',
                hasPhone: !!buyer.contactPhone,
                freightCost: buyer.freightCost ?? null,
                hasRealBid: !!buyer.bidSource,
                website: buyer.website ?? null,
                contactPhone: buyer.contactPhone ?? null,
            },
            withExplanation: true,
        });
        return result.data?.explanation || 'Unable to generate explanation.';
    } catch (err) {
        console.error('Buyer intel explanation error:', err);
        return `${buyer.name} is a ${buyer.type} facility in ${buyer.city}, ${buyer.state}. Contact the grain desk to discuss ${crop} delivery options.`;
    }
}
