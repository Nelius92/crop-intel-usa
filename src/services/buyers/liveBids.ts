import type { BuyerType, CropType } from '../../types';
import type { ApiBuyerDirectoryRecord, LiveBidsData, ScrapedBidRecord } from './types';

let liveBidsCache: LiveBidsData | null = null;
let liveBidsCacheTime = 0;
const LIVE_BIDS_CACHE_TTL_MS = 30 * 60 * 1000;

function normalizeBuyerName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function loadLiveBids(): Promise<LiveBidsData | null> {
    const now = Date.now();
    if (liveBidsCache && (now - liveBidsCacheTime) < LIVE_BIDS_CACHE_TTL_MS) {
        return liveBidsCache;
    }

    try {
        const module = await import('../../data/live_bids.json');
        const data = module.default as LiveBidsData;
        const scanAge = now - new Date(data.scanTime).getTime();
        if (scanAge > 36 * 60 * 60 * 1000 && import.meta.env.DEV) {
            console.warn('[LiveBids] Data is stale (>36h old), will use as fallback only');
        }

        liveBidsCache = data;
        liveBidsCacheTime = now;
        if (import.meta.env.DEV) {
            console.info(`[LiveBids] Loaded ${data.totalBids} scraped bids from ${data.scanTime}`);
        }
        return data;
    } catch {
        return null;
    }
}

export function getBestScrapedBid(
    liveBids: LiveBidsData,
    buyerName: string,
    crop: string
): ScrapedBidRecord | null {
    const normalizedBuyer = normalizeBuyerName(buyerName);

    const matches = liveBids.bids.filter((bid) => {
        if (bid.crop !== crop || !bid.validated) {
            return false;
        }

        const normalizedBid = normalizeBuyerName(bid.buyerName);
        return normalizedBid === normalizedBuyer
            || normalizedBuyer.includes(normalizedBid)
            || normalizedBid.includes(normalizedBuyer);
    });

    if (matches.length === 0) {
        return null;
    }

    return matches.sort((left, right) => {
        if (left.deliveryPeriod.toLowerCase().includes('spot')) return -1;
        if (right.deliveryPeriod.toLowerCase().includes('spot')) return 1;
        return left.deliveryPeriod.localeCompare(right.deliveryPeriod);
    })[0];
}

export function getNewScrapedBuyers(
    liveBids: LiveBidsData,
    existingNames: Set<string>,
    crop: string
): ApiBuyerDirectoryRecord[] {
    const normalizedExisting = new Set([...existingNames].map(normalizeBuyerName));
    const buyerMap = new Map<string, ScrapedBidRecord>();

    for (const bid of liveBids.bids) {
        if (bid.crop !== crop || !bid.validated) {
            continue;
        }

        const key = normalizeBuyerName(bid.buyerName);
        if (normalizedExisting.has(key)) {
            continue;
        }

        if (!buyerMap.has(key) || bid.deliveryPeriod < buyerMap.get(key)!.deliveryPeriod) {
            buyerMap.set(key, bid);
        }
    }

    return [...buyerMap.values()].map((bid) => ({
        id: `scraped-${normalizeBuyerName(bid.buyerName)}`,
        name: bid.buyerName,
        type: 'ethanol' as BuyerType,
        city: bid.city,
        state: bid.state,
        region: `${bid.state} Region`,
        lat: 0,
        lng: 0,
        cropType: bid.crop as CropType,
        cashBid: bid.cashBid,
        postedBasis: bid.basis,
        bidDate: bid.scrapedAt,
        bidSource: `${bid.source} (${bid.sourceUrl || 'scraped'})`,
        verifiedStatus: 'verified',
    }));
}
