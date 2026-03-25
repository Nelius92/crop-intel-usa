/**
 * Buyer Intel Score Engine
 *
 * Deterministic 0–100 relevance score for each buyer per crop.
 * No AI involved — pure data-driven signals.
 */

// ── Crop ↔ Buyer Type Relevance Map ─────────────────────────────────
type BuyerType = 'ethanol' | 'feedlot' | 'processor' | 'river' | 'shuttle' | 'export' | 'elevator' | 'crush' | 'transload';
type CropType = 'Yellow Corn' | 'White Corn' | 'Soybeans' | 'Wheat' | 'Sunflowers';

// 0 = irrelevant, 1 = secondary, 2 = top match
const CROP_TYPE_RELEVANCE: Record<CropType, Partial<Record<BuyerType, number>>> = {
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

export interface BuyerIntelInput {
    buyerType: string;
    crop: CropType;
    netPrice?: number | null;
    benchmarkPrice?: number;     // e.g. $3.81 for Yellow Corn
    railConfidence?: number | null; // 0-100
    verifiedStatus?: string | null; // 'verified' | 'needs_review' | 'unverified'
    hasPhone?: boolean;
    freightCost?: number | null;
    hasRealBid?: boolean;         // true if bid came from scraping, not estimated
    website?: string | null;
}

export interface BuyerIntelResult {
    score: number;           // 0-100
    label: string;           // 'Top Target' | 'Strong Lead' | 'Worth Exploring' | 'Low Priority'
    emoji: string;           // 🔥 | ✅ | ⚠️ | ⛔
    color: string;           // CSS class: green / blue / amber / gray
    signals: IntelSignal[];  // Breakdown of each scoring component
}

export interface IntelSignal {
    name: string;
    points: number;
    maxPoints: number;
    reason: string;
}

export function calculateBuyerIntelScore(input: BuyerIntelInput): BuyerIntelResult {
    const signals: IntelSignal[] = [];

    // ── 1. Crop Match (25 pts) ──────────────────────────────────────
    const typeRelevance = CROP_TYPE_RELEVANCE[input.crop]?.[input.buyerType as BuyerType] ?? 0;
    const cropMatchPts = typeRelevance === 2 ? 25 : typeRelevance === 1 ? 12 : 0;
    signals.push({
        name: 'Crop Match',
        points: cropMatchPts,
        maxPoints: 25,
        reason: typeRelevance === 2
            ? `${input.buyerType} is a primary buyer for ${input.crop}`
            : typeRelevance === 1
                ? `${input.buyerType} is a secondary market for ${input.crop}`
                : `${input.buyerType} rarely buys ${input.crop}`,
    });

    // ── 2. Price Advantage (25 pts) ─────────────────────────────────
    let priceAdvPts = 0;
    if (input.netPrice != null && input.benchmarkPrice != null && input.benchmarkPrice > 0) {
        const diff = input.netPrice - input.benchmarkPrice;
        if (diff > 0.50) priceAdvPts = 25;
        else if (diff > 0.25) priceAdvPts = 20;
        else if (diff > 0) priceAdvPts = 15;
        else if (diff > -0.25) priceAdvPts = 8;
        else priceAdvPts = 0;
    }
    signals.push({
        name: 'Price Advantage',
        points: priceAdvPts,
        maxPoints: 25,
        reason: input.netPrice != null && input.benchmarkPrice != null
            ? `Net $${input.netPrice.toFixed(2)} vs benchmark $${input.benchmarkPrice.toFixed(2)}`
            : 'No price data available',
    });

    // ── 3. Rail Access (15 pts) ─────────────────────────────────────
    const railScore = input.railConfidence ?? 0;
    const railPts = railScore >= 70 ? 15 : railScore >= 40 ? 10 : railScore >= 15 ? 5 : 0;
    signals.push({
        name: 'Rail Access',
        points: railPts,
        maxPoints: 15,
        reason: railScore >= 70 ? 'BNSF rail-served confirmed'
            : railScore >= 40 ? 'Likely rail accessible'
                : railScore >= 15 ? 'Possible rail access'
                    : 'Unverified rail access',
    });

    // ── 4. Verified Contact (10 pts) ────────────────────────────────
    const hasVerifiedContact = input.verifiedStatus === 'verified' && input.hasPhone;
    const hasAnyContact = input.hasPhone || input.verifiedStatus === 'needs_review';
    const contactPts = hasVerifiedContact ? 10 : hasAnyContact ? 5 : 0;
    signals.push({
        name: 'Verified Contact',
        points: contactPts,
        maxPoints: 10,
        reason: hasVerifiedContact ? 'Verified phone on file'
            : hasAnyContact ? 'Contact info pending verification'
                : 'No contact information',
    });

    // ── 5. Freight Efficiency (15 pts) ──────────────────────────────
    const freight = Math.abs(input.freightCost ?? 0);
    const freightPts = freight === 0 ? 0 // No data
        : freight < 0.60 ? 15
            : freight < 0.90 ? 12
                : freight < 1.20 ? 8
                    : freight < 1.60 ? 4 : 0;
    signals.push({
        name: 'Freight Efficiency',
        points: freightPts,
        maxPoints: 15,
        reason: freight === 0 ? 'No freight estimate'
            : `$${freight.toFixed(2)}/bu freight cost`,
    });

    // ── 6. Bid Freshness (10 pts) ───────────────────────────────────
    const bidFreshPts = input.hasRealBid ? 10 : 0;
    signals.push({
        name: 'Bid Freshness',
        points: bidFreshPts,
        maxPoints: 10,
        reason: input.hasRealBid ? 'Live scraped bid available' : 'Estimated bid only',
    });

    // ── Total ───────────────────────────────────────────────────────
    const score = signals.reduce((sum, s) => sum + s.points, 0);

    let label: string;
    let emoji: string;
    let color: string;
    if (score >= 80) { label = 'Top Target'; emoji = '🔥'; color = 'green'; }
    else if (score >= 60) { label = 'Strong Lead'; emoji = '✅'; color = 'blue'; }
    else if (score >= 40) { label = 'Worth Exploring'; emoji = '⚠️'; color = 'amber'; }
    else { label = 'Low Priority'; emoji = '⛔'; color = 'gray'; }

    return { score, label, emoji, color, signals };
}

/** Get the crop-type relevance map (useful for frontend display) */
export function getCropTypeRelevance(crop: CropType): Record<string, number> {
    return (CROP_TYPE_RELEVANCE[crop] ?? {}) as Record<string, number>;
}
