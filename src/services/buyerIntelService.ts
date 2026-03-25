/**
 * Buyer Intel Score — Frontend (client-side)
 *
 * Mirrors the backend scoring logic so scores display instantly
 * without an API call. The backend is used only for Gemini explanations.
 */

import { Buyer, CropType } from '../types';
import { apiPostJson } from './apiClient';

// ── Crop ↔ Buyer Type Relevance Map ─────────────────────────────────
const CROP_TYPE_RELEVANCE: Record<CropType, Record<string, number>> = {
    'Yellow Corn': {
        ethanol: 2, feedlot: 2, processor: 1, elevator: 1,
        shuttle: 1, river: 1, export: 1, crush: 0, transload: 1,
    },
    'White Corn': {
        processor: 2, elevator: 1, shuttle: 1,
        ethanol: 0, feedlot: 0, crush: 0, river: 1, export: 1, transload: 1,
    },
    'Soybeans': {
        crush: 2, export: 2, processor: 1, river: 1,
        elevator: 1, shuttle: 1, ethanol: 0, feedlot: 0, transload: 1,
    },
    'Wheat': {
        processor: 2, export: 2, elevator: 1, shuttle: 1,
        river: 1, ethanol: 0, feedlot: 0, crush: 0, transload: 1,
    },
    'Sunflowers': {
        crush: 2, processor: 2, elevator: 1,
        ethanol: 0, feedlot: 0, river: 0, shuttle: 1, export: 0, transload: 1,
    },
};

export interface IntelSignal {
    name: string;
    points: number;
    maxPoints: number;
    reason: string;
}

export interface BuyerIntelResult {
    score: number;
    label: string;
    emoji: string;
    color: string;
    signals: IntelSignal[];
}

export function calculateBuyerIntelScore(buyer: Buyer, crop: CropType, benchmarkPrice?: number): BuyerIntelResult {
    const signals: IntelSignal[] = [];

    // 1. Crop Match (25 pts)
    const typeRelevance = CROP_TYPE_RELEVANCE[crop]?.[buyer.type] ?? 0;
    const cropMatchPts = typeRelevance === 2 ? 25 : typeRelevance === 1 ? 12 : 0;
    signals.push({
        name: 'Crop Match',
        points: cropMatchPts,
        maxPoints: 25,
        reason: typeRelevance === 2 ? `${buyer.type} is a primary buyer for ${crop}`
            : typeRelevance === 1 ? `${buyer.type} is a secondary market for ${crop}`
                : `${buyer.type} rarely buys ${crop}`,
    });

    // 2. Price Advantage (25 pts)
    let priceAdvPts = 0;
    if (buyer.netPrice != null && benchmarkPrice != null && benchmarkPrice > 0) {
        const diff = buyer.netPrice - benchmarkPrice;
        if (diff > 0.50) priceAdvPts = 25;
        else if (diff > 0.25) priceAdvPts = 20;
        else if (diff > 0) priceAdvPts = 15;
        else if (diff > -0.25) priceAdvPts = 8;
    }
    signals.push({
        name: 'Price Advantage',
        points: priceAdvPts,
        maxPoints: 25,
        reason: buyer.netPrice != null && benchmarkPrice != null
            ? `Net $${buyer.netPrice.toFixed(2)} vs benchmark $${benchmarkPrice.toFixed(2)}`
            : 'No price data available',
    });

    // 3. Rail Access (15 pts)
    const rc = buyer.railConfidence ?? 0;
    const railPts = rc >= 70 ? 15 : rc >= 40 ? 10 : rc >= 15 ? 5 : 0;
    signals.push({
        name: 'Rail Access',
        points: railPts,
        maxPoints: 15,
        reason: rc >= 70 ? 'BNSF rail-served confirmed'
            : rc >= 40 ? 'Likely rail accessible'
                : rc >= 15 ? 'Possible rail access' : 'Unverified rail access',
    });

    // 4. Verified Contact (10 pts)
    const hasVerified = buyer.verified && !!buyer.contactPhone;
    const hasAny = !!buyer.contactPhone;
    const contactPts = hasVerified ? 10 : hasAny ? 5 : 0;
    signals.push({
        name: 'Verified Contact',
        points: contactPts,
        maxPoints: 10,
        reason: hasVerified ? 'Verified phone on file'
            : hasAny ? 'Contact info pending verification' : 'No contact information',
    });

    // 5. Freight Efficiency (15 pts)
    const freight = Math.abs(buyer.freightCost ?? 0);
    const freightPts = freight === 0 ? 0
        : freight < 0.60 ? 15
            : freight < 0.90 ? 12
                : freight < 1.20 ? 8
                    : freight < 1.60 ? 4 : 0;
    signals.push({
        name: 'Freight Efficiency',
        points: freightPts,
        maxPoints: 15,
        reason: freight === 0 ? 'No freight estimate' : `$${freight.toFixed(2)}/bu freight cost`,
    });

    // 6. Bid Freshness (10 pts)
    const hasRealBid = !!(buyer as any).bidSource;
    const bidPts = hasRealBid ? 10 : 0;
    signals.push({
        name: 'Bid Freshness',
        points: bidPts,
        maxPoints: 10,
        reason: hasRealBid ? 'Live scraped bid available' : 'Estimated bid only',
    });

    // Total
    const score = signals.reduce((sum, s) => sum + s.points, 0);

    let label: string, emoji: string, color: string;
    if (score >= 80) { label = 'Top Target'; emoji = '🔥'; color = 'green'; }
    else if (score >= 60) { label = 'Strong Lead'; emoji = '✅'; color = 'blue'; }
    else if (score >= 40) { label = 'Worth Exploring'; emoji = '⚠️'; color = 'amber'; }
    else { label = 'Low Priority'; emoji = '⛔'; color = 'gray'; }

    return { score, label, emoji, color, signals };
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
                hasRealBid: !!(buyer as any).bidSource,
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
