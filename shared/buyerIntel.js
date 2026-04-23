export const BUYER_INTEL_TYPE_RELEVANCE = {
    'Yellow Corn': {
        ethanol: 2,
        feedlot: 2,
        processor: 1,
        elevator: 1,
        shuttle: 1,
        river: 1,
        export: 1,
        crush: 0,
        transload: 1,
    },
    'White Corn': {
        processor: 2,
        elevator: 1,
        shuttle: 1,
        ethanol: 0,
        feedlot: 0,
        crush: 0,
        river: 1,
        export: 1,
        transload: 1,
    },
    'Soybeans': {
        crush: 2,
        export: 2,
        processor: 1,
        river: 1,
        elevator: 1,
        shuttle: 1,
        ethanol: 0,
        feedlot: 0,
        transload: 1,
    },
    'Wheat': {
        processor: 2,
        export: 2,
        elevator: 1,
        shuttle: 1,
        river: 1,
        ethanol: 0,
        feedlot: 0,
        crush: 0,
        transload: 1,
    },
    'Sunflowers': {
        crush: 2,
        processor: 2,
        elevator: 1,
        ethanol: 0,
        feedlot: 0,
        river: 0,
        shuttle: 1,
        export: 0,
        transload: 1,
    },
};

export const BUYER_INTEL_SIGNAL_MAX_POINTS = {
    cropMatch: 25,
    priceAdvantage: 25,
    railAccess: 15,
    verifiedContact: 10,
    freightEfficiency: 15,
    bidFreshness: 10,
    droughtImpact: 5,
};

export function getCropTypeRelevance(crop) {
    return BUYER_INTEL_TYPE_RELEVANCE[crop] || {};
}

export function calculateBuyerIntelScore(input) {
    const signals = [];

    const typeRelevance = BUYER_INTEL_TYPE_RELEVANCE[input.crop]?.[input.buyerType] ?? 0;
    const cropMatchPts = typeRelevance === 2 ? 25 : typeRelevance === 1 ? 12 : 0;
    signals.push({
        name: 'Crop Match',
        points: cropMatchPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.cropMatch,
        reason: typeRelevance === 2
            ? `${input.buyerType} is a primary buyer for ${input.crop}`
            : typeRelevance === 1
                ? `${input.buyerType} is a secondary market for ${input.crop}`
                : `${input.buyerType} rarely buys ${input.crop}`,
    });

    let priceAdvPts = 0;
    if (input.netPrice != null && input.benchmarkPrice != null && input.benchmarkPrice > 0) {
        const diff = input.netPrice - input.benchmarkPrice;
        if (diff > 0.50) priceAdvPts = 25;
        else if (diff > 0.25) priceAdvPts = 20;
        else if (diff > 0) priceAdvPts = 15;
        else if (diff > -0.25) priceAdvPts = 8;
    }
    signals.push({
        name: 'Price Advantage',
        points: priceAdvPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.priceAdvantage,
        reason: input.netPrice != null && input.benchmarkPrice != null
            ? `Net $${input.netPrice.toFixed(2)} vs benchmark $${input.benchmarkPrice.toFixed(2)}`
            : 'No price data available',
    });

    const railScore = input.railConfidence ?? 0;
    const railPts = railScore >= 70 ? 15 : railScore >= 40 ? 10 : railScore >= 15 ? 5 : 0;
    signals.push({
        name: 'Rail Access',
        points: railPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.railAccess,
        reason: railScore >= 70
            ? 'BNSF rail-served confirmed'
            : railScore >= 40
                ? 'Likely rail accessible'
                : railScore >= 15
                    ? 'Possible rail access'
                    : 'Unverified rail access',
    });

    const hasVerifiedContact = input.verifiedStatus === 'verified' && input.hasPhone;
    const hasAnyContact = !!input.hasPhone || input.verifiedStatus === 'needs_review';
    const contactPts = hasVerifiedContact ? 10 : hasAnyContact ? 5 : 0;
    signals.push({
        name: 'Verified Contact',
        points: contactPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.verifiedContact,
        reason: hasVerifiedContact
            ? 'Verified phone on file'
            : hasAnyContact
                ? 'Contact info pending verification'
                : 'No contact information',
    });

    const freight = Math.abs(input.freightCost ?? 0);
    const freightPts = freight === 0
        ? 0
        : freight < 0.60
            ? 15
            : freight < 0.90
                ? 12
                : freight < 1.20
                    ? 8
                    : freight < 1.60
                        ? 4
                        : 0;
    signals.push({
        name: 'Freight Efficiency',
        points: freightPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.freightEfficiency,
        reason: freight === 0 ? 'No freight estimate' : `$${freight.toFixed(2)}/bu freight cost`,
    });

    const bidFreshPts = input.hasRealBid ? 10 : 0;
    signals.push({
        name: 'Bid Freshness',
        points: bidFreshPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.bidFreshness,
        reason: input.hasRealBid ? 'Live scraped bid available' : 'Estimated bid only',
    });

    let droughtPts = 0;
    if (input.droughtSeverity) {
        switch (input.droughtSeverity) {
            case 'exceptional':
            case 'extreme':
                droughtPts = 5;
                break;
            case 'severe':
                droughtPts = 4;
                break;
            case 'moderate':
                droughtPts = 2;
                break;
            default:
                droughtPts = 0;
        }
    }
    signals.push({
        name: 'Drought Impact',
        points: droughtPts,
        maxPoints: BUYER_INTEL_SIGNAL_MAX_POINTS.droughtImpact,
        reason: droughtPts > 0
            ? `${input.droughtSeverity} drought - tighter supply boosts buyer urgency`
            : input.droughtSeverity === 'abnormal'
                ? 'Minor dryness - no significant supply pressure'
                : 'No drought conditions in region',
    });

    const score = signals.reduce((sum, signal) => sum + signal.points, 0);

    let label;
    let emoji;
    let color;
    if (score >= 85) {
        label = 'Top Target';
        emoji = '🔥';
        color = 'green';
    } else if (score >= 65) {
        label = 'Strong Lead';
        emoji = '✅';
        color = 'blue';
    } else if (score >= 45) {
        label = 'Worth Exploring';
        emoji = '⚠️';
        color = 'amber';
    } else {
        label = 'Low Priority';
        emoji = '⛔';
        color = 'gray';
    }

    return { score, label, emoji, color, signals };
}
