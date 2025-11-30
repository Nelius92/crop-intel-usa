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
}

export interface RailNode {
    lat: number;
    lng: number;
}

export interface RailNetwork {
    id: string;
    path: RailNode[];
}
