/**
 * Sunflower Lane Visualization Data — Crop Intel
 * ================================================
 * Provides map-ready "Best Lanes" data from Campbell, MN for the
 * sunflower oilseed and confection markets. Includes:
 * - GeoJSON lane polylines with NDV-based coloring
 * - Buyer markers with interline (I=0/I=1) indicators
 * - Tracking bridge status for interline moves
 * - Automated offer payload for one-click contract locking
 */

import { Coordinates } from '../types';

// ============================================================================
// 1. ORIGIN & DESTINATION COORDINATES
// ============================================================================

export const CAMPBELL_ORIGIN: Coordinates & { name: string; stationCode: string } = {
    lat: 46.0953,
    lng: -96.3975,
    name: 'Campbell Grain Terminal',
    stationCode: 'CAMPB',
};

export const BRECKENRIDGE_JUNCTION: Coordinates & { name: string } = {
    lat: 46.2633,
    lng: -96.5881,
    name: 'Breckenridge, MN (BNSF/RRVW Interchange)',
};

// ============================================================================
// 2. SUNFLOWER LANE DEFINITIONS
// ============================================================================

export type InterlineIndicator = 0 | 1;
export type LaneSignal = 'strong-sell' | 'sell' | 'hold' | 'weak';
export type SunflowerCategory = 'oilseed' | 'confection';
export type TrackingStatus = 'full-visibility' | 'partial-visibility' | 'dark-zone';

export interface SunflowerLane {
    id: string;
    buyer: string;
    buyerType: 'crush' | 'processor' | 'confection';
    category: SunflowerCategory;
    destination: Coordinates & { city: string; state: string };
    interline: InterlineIndicator;        // I=0 single-line, I=1 interline
    interlineCarrier?: string;            // e.g., 'RRVW', 'CPKC'
    interchangePoint?: Coordinates & { name: string };
    bidCwt: number;
    freightCwt: number;
    ndvCwt: number;
    ndvPerCar: number;
    freightPctOfBid: number;
    signal: LaneSignal;
    rank: number;
    trackingStatus: TrackingStatus;
    routeCoordinates: Coordinates[];      // Polyline for map rendering
    color: string;                        // HSL color for lane rendering
    futuresAnchor: { symbol: string; price: number; unit: string };
    oilPremiumCwt?: number;               // Only for oilseed
    contactPhone: string;
    contactName?: string;
}

export interface AutomatedOffer {
    laneId: string;
    buyerName: string;
    action: 'lock-in-premium';
    contractType: 'cash' | 'aog';
    priceCwt: number;
    quantityCwt: number;           // Default 1 car = 1,244.40 CWT
    deliveryWindow: string;        // e.g., "Apr 14 – Apr 28, 2026"
    expiresAt: string;             // ISO timestamp (60 seconds from generation)
    ndvCwt: number;
    freightCwt: number;
    totalContractValue: number;
    status: 'pending' | 'locked' | 'expired';
    bushel_compatible: boolean;    // Mimics Bushel 1-click model
}

// ============================================================================
// 3. LANE DATA (computed from prior analysis)
// ============================================================================

const CWT_PER_CAR = 1244.40;

const SOY_OIL_FUTURES = { symbol: 'ZL', price: 67.75, unit: '¢/lb' };

export const SUNFLOWER_LANES: SunflowerLane[] = [
    {
        id: 'lane-cargill-westfargo',
        buyer: 'Cargill',
        buyerType: 'crush',
        category: 'oilseed',
        destination: { lat: 46.8740, lng: -96.8989, city: 'West Fargo', state: 'ND' },
        interline: 0,
        bidCwt: 23.95,
        freightCwt: 0.96,
        ndvCwt: 22.99,
        ndvPerCar: 28620,
        freightPctOfBid: 4.0,
        signal: 'strong-sell',
        rank: 1,
        trackingStatus: 'full-visibility',
        routeCoordinates: [
            { lat: 46.0953, lng: -96.3975 }, // Campbell
            { lat: 46.4500, lng: -96.6000 }, // midpoint
            { lat: 46.8772, lng: -96.7898 }, // Fargo/Dilworth
            { lat: 46.8740, lng: -96.8989 }, // West Fargo
        ],
        color: 'hsl(142, 76%, 36%)',   // Strong green = best NDV
        futuresAnchor: SOY_OIL_FUTURES,
        oilPremiumCwt: 0,  // Base (40% oil)
        contactPhone: '800-742-0051',
        contactName: 'Dan Oberholtzer',
    },
    {
        id: 'lane-adm-enderlin',
        buyer: 'ADM',
        buyerType: 'crush',
        category: 'oilseed',
        destination: { lat: 46.6253, lng: -97.5958, city: 'Enderlin', state: 'ND' },
        interline: 1,
        interlineCarrier: 'RRVW → CPKC',
        interchangePoint: BRECKENRIDGE_JUNCTION,
        bidCwt: 23.75,
        freightCwt: 1.45,
        ndvCwt: 22.30,
        ndvPerCar: 27742,
        freightPctOfBid: 6.1,
        signal: 'hold',
        rank: 2,
        trackingStatus: 'partial-visibility',
        routeCoordinates: [
            { lat: 46.0953, lng: -96.3975 }, // Campbell
            { lat: 46.2633, lng: -96.5881 }, // Breckenridge (INTERCHANGE)
            { lat: 46.4400, lng: -97.1000 }, // RRVW segment
            { lat: 46.6253, lng: -97.5958 }, // Enderlin
        ],
        color: 'hsl(38, 92%, 50%)',    // Amber = interline, lower NDV
        futuresAnchor: SOY_OIL_FUTURES,
        oilPremiumCwt: 0,
        contactPhone: '701-551-2874',
        contactName: 'Lacey Zahradka',
    },
    {
        id: 'lane-rrc-fargo',
        buyer: 'Red River Commodities',
        buyerType: 'confection',
        category: 'confection',
        destination: { lat: 46.8772, lng: -96.7898, city: 'Fargo', state: 'ND' },
        interline: 0,
        bidCwt: 30.00,  // Mid-range confection
        freightCwt: 0.96,
        ndvCwt: 29.04,
        ndvPerCar: 36122,
        freightPctOfBid: 3.2,
        signal: 'strong-sell',
        rank: 1,
        trackingStatus: 'full-visibility',
        routeCoordinates: [
            { lat: 46.0953, lng: -96.3975 }, // Campbell
            { lat: 46.4500, lng: -96.6000 },
            { lat: 46.8772, lng: -96.7898 }, // Fargo
        ],
        color: 'hsl(262, 83%, 58%)',   // Purple = confection premium
        futuresAnchor: SOY_OIL_FUTURES,
        contactPhone: '701-282-2600',
        contactName: 'Nick Boll',
    },
    {
        id: 'lane-chs-fargo',
        buyer: 'CHS',
        buyerType: 'confection',
        category: 'confection',
        destination: { lat: 46.8900, lng: -96.8100, city: 'Fargo', state: 'ND' },
        interline: 0,
        bidCwt: 29.25,
        freightCwt: 0.96,
        ndvCwt: 28.29,
        ndvPerCar: 35189,
        freightPctOfBid: 3.3,
        signal: 'sell',
        rank: 2,
        trackingStatus: 'full-visibility',
        routeCoordinates: [
            { lat: 46.0953, lng: -96.3975 },
            { lat: 46.4500, lng: -96.6000 },
            { lat: 46.8900, lng: -96.8100 },
        ],
        color: 'hsl(280, 70%, 50%)',   // Violet = confection #2
        futuresAnchor: SOY_OIL_FUTURES,
        contactPhone: '701-282-1700',
    },
];

// ============================================================================
// 4. TRACKING BRIDGE (BNSF → RRVW/CPKC handoff)
// ============================================================================

export interface TrackingSegment {
    carrier: string;
    from: Coordinates & { name: string };
    to: Coordinates & { name: string };
    status: TrackingStatus;
    trackingTool: string;
    trackingUrl?: string;
    estimatedHours: number;
}

export interface InterlineTrackingBridge {
    laneId: string;
    segments: TrackingSegment[];
    visibilityGap: {
        exists: boolean;
        description?: string;
        mitigation?: string;
    };
}

export function getTrackingBridge(lane: SunflowerLane): InterlineTrackingBridge | null {
    if (lane.interline === 0) {
        // Single-line: full BNSF visibility
        return {
            laneId: lane.id,
            segments: [{
                carrier: 'BNSF',
                from: { ...CAMPBELL_ORIGIN, name: CAMPBELL_ORIGIN.name },
                to: { ...lane.destination, name: `${lane.buyer} ${lane.destination.city}` },
                status: 'full-visibility',
                trackingTool: 'BNSF ShipperConnect API',
                trackingUrl: 'https://api.bnsf.com:6443/v1/cars',
                estimatedHours: 4,
            }],
            visibilityGap: { exists: false },
        };
    }

    // Interline: BNSF segment + dark zone + RRVW/CPKC segment
    return {
        laneId: lane.id,
        segments: [
            {
                carrier: 'BNSF',
                from: { ...CAMPBELL_ORIGIN, name: CAMPBELL_ORIGIN.name },
                to: { ...BRECKENRIDGE_JUNCTION, name: BRECKENRIDGE_JUNCTION.name },
                status: 'full-visibility',
                trackingTool: 'BNSF ShipperConnect API (/v1/cars)',
                trackingUrl: 'https://api.bnsf.com:6443/v1/cars',
                estimatedHours: 2,
            },
            {
                carrier: lane.interlineCarrier || 'RRVW',
                from: { ...BRECKENRIDGE_JUNCTION, name: 'Breckenridge Interchange' },
                to: { ...lane.destination, name: `${lane.buyer} ${lane.destination.city}` },
                status: 'partial-visibility',
                trackingTool: 'Commtrex Interline Tracker / CPKC ShipOnline',
                trackingUrl: 'https://www.commtrex.com/rail-logistics',
                estimatedHours: 8,
            },
        ],
        visibilityGap: {
            exists: true,
            description: 'BNSF tracking terminates at Breckenridge interchange. ' +
                'RRVW/CPKC segment requires separate tracking via Commtrex or CPKC ShipOnline.',
            mitigation: 'Subscribe to Commtrex Rail IQ for automated interline ETAs. ' +
                'Fallback: call RRVW dispatch at (701) 642-2662 for car status.',
        },
    };
}

// ============================================================================
// 5. AUTOMATED OFFER GENERATOR (Bushel-style 1-click)
// ============================================================================

export function generateAutomatedOffer(
    lane: SunflowerLane,
    contractType: 'cash' | 'aog' = 'cash',
    numCars: number = 1,
): AutomatedOffer {
    const quantityCwt = CWT_PER_CAR * numCars;
    const totalContractValue = lane.bidCwt * quantityCwt;

    // Expires in 60 seconds — mimics Bushel's rapid-fire offer model
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    // Delivery window: 2 weeks from today
    const start = new Date();
    const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
        laneId: lane.id,
        buyerName: lane.buyer,
        action: 'lock-in-premium',
        contractType,
        priceCwt: lane.bidCwt,
        quantityCwt: Math.round(quantityCwt * 100) / 100,
        deliveryWindow: `${fmt(start)} – ${fmt(end)}`,
        expiresAt,
        ndvCwt: lane.ndvCwt,
        freightCwt: lane.freightCwt,
        totalContractValue: Math.round(totalContractValue * 100) / 100,
        status: 'pending',
        bushel_compatible: true,
    };
}

// ============================================================================
// 6. MAP VISUALIZATION HELPERS
// ============================================================================

/**
 * Returns GeoJSON FeatureCollection for rendering lanes on Mapbox
 */
export function getLaneGeoJSON() {
    return {
        type: 'FeatureCollection' as const,
        features: SUNFLOWER_LANES.map(lane => ({
            type: 'Feature' as const,
            properties: {
                id: lane.id,
                buyer: lane.buyer,
                category: lane.category,
                interline: lane.interline,
                ndvCwt: lane.ndvCwt,
                signal: lane.signal,
                color: lane.color,
                rank: lane.rank,
                label: `${lane.buyer} — $${lane.ndvCwt}/cwt NDV`,
            },
            geometry: {
                type: 'LineString' as const,
                coordinates: lane.routeCoordinates.map(c => [c.lng, c.lat]),
            },
        })),
    };
}

/**
 * Returns marker data for buyer destinations
 */
export function getDestinationMarkers() {
    return SUNFLOWER_LANES.map(lane => ({
        id: lane.id,
        position: lane.destination,
        label: lane.buyer,
        category: lane.category,
        interline: lane.interline === 1 ? 'INTERLINE' : 'SINGLE-LINE',
        ndvCwt: lane.ndvCwt,
        signal: lane.signal,
        color: lane.color,
        icon: lane.category === 'confection' ? '🌻' : '🛢️',
    }));
}

/**
 * Returns the interchange marker (Breckenridge) for interline routes
 */
export function getInterchangeMarker() {
    return {
        position: BRECKENRIDGE_JUNCTION,
        label: '⚡ BNSF/RRVW Interchange',
        description: 'Tracking hand-off point. BNSF visibility ends here.',
        icon: '🔀',
    };
}

/**
 * Get best lane by category
 */
export function getBestLane(category: SunflowerCategory): SunflowerLane {
    return SUNFLOWER_LANES
        .filter(l => l.category === category)
        .sort((a, b) => b.ndvCwt - a.ndvCwt)[0];
}
