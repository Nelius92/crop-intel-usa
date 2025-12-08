export interface Coordinates {
    lat: number;
    lng: number;
}

export interface HeatmapPoint extends Coordinates {
    id: string;
    cornPrice: number; // Cash price
    basis: number;
    change24h: number; // Percentage
    isOpportunity: boolean;
    regionName?: string; // For display
    marketLabel?: string; // e.g., "Strong export demand"
}

export type BuyerType = 'ethanol' | 'feedlot' | 'processor' | 'river' | 'shuttle' | 'export';

export interface Buyer extends Coordinates {
    id: string;
    name: string;
    type: BuyerType;
    basis: number; // Single value for chart
    cashPrice: number;
    city: string;
    state: string;
    region: string; // e.g., "South Texas"
    railAccessible: boolean;
    nearTransload: boolean;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    website?: string;
    googlePlaceId?: string;
    rating?: number;
    userRatingsTotal?: number;
    fullAddress?: string;
    netPrice?: number;
    freightCost?: number;
    futuresPrice?: number;
    contractMonth?: string; // e.g. "Dec 2025"
    benchmarkDiff?: number; // Difference from Hankinson Renewable Energy
    verified?: boolean; // True if data passed the AI Auditor check
    isManual?: boolean; // True if manually entered by user
    lastUpdated?: string; // ISO timestamp
    confidenceScore?: number; // 0-100 score of data reliability
}

export interface MarketOracle {
    futuresPrice: number;
    contractMonth: string;
    hankinsonBasis: number;
    centralRegionBasis: number;
    lastUpdated: string;
}

export interface RailNode {
    lat: number;
    lng: number;
}

export interface RailNetwork {
    id: string;
    path: RailNode[];
}

export interface Transloader {
    id: string;
    name: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    railroad: string[]; // e.g., ['BNSF', 'UP']
    commodities: string[]; // e.g., ['Grain', 'Liquids']
    type: 'transload';
}
