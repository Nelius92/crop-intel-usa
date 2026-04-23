import type { BuyerType, CropType } from '../../types';

export interface ScrapedBidRecord {
    buyerName: string;
    city: string;
    state: string;
    crop: string;
    deliveryPeriod: string;
    contractMonth: string;
    futuresPrice: number;
    basis: number;
    cashBid: number;
    change?: number;
    scrapedAt: string;
    source: string;
    sourceUrl?: string;
    priceUnit: string;
    validated: boolean;
}

export interface LiveBidsData {
    scanTime: string;
    totalBids: number;
    bids: ScrapedBidRecord[];
}

export interface BuyerFilters {
    crop?: CropType;
    buyerType?: BuyerType;
    state?: string;
    region?: string;
    minRailConfidence?: number;
    bnsfServedOnly?: boolean;
    searchQuery?: string;
}

export interface ApiBuyerDirectoryRecord {
    id: string;
    name: string;
    type: BuyerType;
    city: string;
    state: string;
    region: string;
    lat: number;
    lng: number;
    cropType?: CropType;
    organic?: boolean;
    railConfidence?: number | null;
    contactRole?: string | null;
    facilityPhone?: string | null;
    website?: string | null;
    verifiedStatus?: 'verified' | 'needs_review' | 'unverified' | null;
    contactConfidenceScore?: number | null;
    cashBid?: number | string | null;
    postedBasis?: number | string | null;
    bidDate?: string | null;
    bidSource?: string | null;
    nearTransload?: boolean;
    railAccessible?: boolean;
}
