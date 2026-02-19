export interface Coordinates {
    lat: number;
    lng: number;
}

export type CropType = 'Yellow Corn' | 'White Corn' | 'Soybeans' | 'Wheat' | 'Sunflowers';

export interface HeatmapPoint extends Coordinates {
    id: string;
    cornPrice: number; // Cash price
    basis: number;
    change24h: number; // Percentage
    isOpportunity: boolean;
    regionName?: string; // For display
    marketLabel?: string; // e.g., "Strong export demand"
}

export type BuyerType = 'ethanol' | 'feedlot' | 'processor' | 'river' | 'shuttle' | 'export' | 'elevator' | 'crush' | 'transload';

// ─── Trust Layer: Price Provenance ───────────────────────────────
export type DataConfidence = 'verified' | 'estimated' | 'missing';

export interface DataSource {
    value: number;
    confidence: DataConfidence;
    source: string;              // e.g. "USDA AMS", "BNSF Tariff 4022"
    timestamp: string;           // ISO string of when this data was obtained
    staleAfterMinutes: number;   // Mark stale if older than this
}

export interface PriceProvenance {
    futures: DataSource;
    basis: DataSource;
    freight: DataSource;
    fees: DataSource;
}

/** Check if a DataSource is stale based on its timestamp and threshold */
export function isDataStale(ds: DataSource): boolean {
    const ageMs = Date.now() - new Date(ds.timestamp).getTime();
    return ageMs > ds.staleAfterMinutes * 60 * 1000;
}

/** Get the overall confidence for a buyer (lowest of all sources) */
export function getOverallConfidence(p: PriceProvenance): DataConfidence {
    const levels: DataConfidence[] = [p.futures.confidence, p.basis.confidence, p.freight.confidence];
    if (levels.includes('missing')) return 'missing';
    if (levels.includes('estimated')) return 'estimated';
    return 'verified';
}
// ─────────────────────────────────────────────────────────────────

// ─── Rail-Served Confidence ──────────────────────────────────────
export type RailConfidenceLevel = 'confirmed' | 'likely' | 'possible' | 'unverified';

export interface RailEvidence {
    distanceToTrackMiles: number;         // Haversine to nearest BNSF segment
    nearestCorridorId: string;            // e.g. "bnsf-california-central"
    nearestTransloadId?: string;          // If within 50mi of a transloader
    nearestTransloadMiles?: number;
    facilityTypeBonus: boolean;           // shuttle/export/river → +20 pts
    manuallyVerified: boolean;            // Future: human audit flag
    lastVerifiedAt?: string;              // ISO timestamp
    score: number;                        // 0-100 composite score
}

export function railConfidenceFromScore(score: number): RailConfidenceLevel {
    if (score >= 70) return 'confirmed';
    if (score >= 40) return 'likely';
    if (score >= 15) return 'possible';
    return 'unverified';
}
// ─────────────────────────────────────────────────────────────────

export interface Buyer extends Coordinates {
    id: string;
    name: string;
    type: BuyerType;
    cropType?: CropType;
    organic?: boolean;
    basis: number;
    cashPrice: number;
    city: string;
    state: string;
    region: string;
    railAccessible: boolean;             // Derived: score >= 40
    nearTransload: boolean;
    railServedConfidence?: RailConfidenceLevel;
    railEvidence?: RailEvidence;
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
    freightMode?: 'rail' | 'truck';
    freightFormula?: string;
    futuresPrice?: number;
    contractMonth?: string;
    benchmarkDiff?: number;
    verified?: boolean;          // Now derived from provenance
    isManual?: boolean;
    lastUpdated?: string;
    confidenceScore?: number;
    railConfidence?: number;     // 0-100 BNSF rail-served confidence (legacy)
    dataSource?: string;         // Legacy compat
    provenance?: PriceProvenance; // Trust Layer
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
