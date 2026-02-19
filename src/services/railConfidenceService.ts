// Rail-Served Confidence Scoring Engine
// Scores each buyer 0-100 based on evidence of BNSF rail access
//
// Inputs:
//   1. Distance to nearest BNSF track segment (from railService.ts RAIL_LINES)
//   2. Proximity to nearest transloader (from transloaderService.ts)
//   3. Facility type (shuttle/export/river inherently require rail)
//   4. Manual verification flag (future human audit)
//
// Output: RailEvidence + RailConfidenceLevel per buyer

import { Buyer, RailEvidence, RailConfidenceLevel, railConfidenceFromScore } from '../types';
import { RAIL_LINES, distToSegment, getDistanceFromLatLonInMiles } from './railService';
import { Transloader } from '../types';

// ─── Score Components ────────────────────────────────────────────

/** Distance to nearest BNSF track: 0-50 points */
function scoreTrackDistance(miles: number): number {
    if (miles <= 5) return 50;
    if (miles <= 10) return 40;
    if (miles <= 15) return 35;
    if (miles <= 20) return 28;
    if (miles <= 30) return 20;
    if (miles <= 50) return 10;
    return 0;
}

/** Proximity to transloader: 0-20 points */
function scoreTransloaderProximity(miles: number | undefined): number {
    if (miles === undefined) return 0;
    if (miles <= 10) return 20;
    if (miles <= 25) return 15;
    if (miles <= 50) return 10;
    return 0;
}

/** Facility type bonus: 0-20 points */
const RAIL_INHERENT_TYPES = new Set(['shuttle', 'export', 'river']);

function scoreFacilityType(type: string): number {
    return RAIL_INHERENT_TYPES.has(type) ? 20 : 0;
}

/** Manual verification: 0-10 points */
function scoreManualVerification(verified: boolean): number {
    return verified ? 10 : 0;
}

// ─── Core Scoring ────────────────────────────────────────────────

interface NearestTrackResult {
    distanceMiles: number;
    corridorId: string;
}

function findNearestTrack(lat: number, lng: number): NearestTrackResult {
    let minDist = Infinity;
    let nearestCorridor = 'unknown';

    for (const line of RAIL_LINES) {
        for (let i = 0; i < line.path.length - 1; i++) {
            const dist = distToSegment(
                { lat, lng },
                line.path[i],
                line.path[i + 1]
            );
            if (dist < minDist) {
                minDist = dist;
                nearestCorridor = line.id;
            }
        }
    }

    return {
        distanceMiles: parseFloat(minDist.toFixed(1)),
        corridorId: nearestCorridor
    };
}

interface NearestTransloadResult {
    id: string;
    distanceMiles: number;
}

function findNearestTransloader(
    lat: number,
    lng: number,
    transloaders: Transloader[]
): NearestTransloadResult | null {
    let minDist = Infinity;
    let nearest: NearestTransloadResult | null = null;

    for (const tl of transloaders) {
        const dist = getDistanceFromLatLonInMiles(lat, lng, tl.lat, tl.lng);
        if (dist < minDist && dist <= 50) {
            minDist = dist;
            nearest = {
                id: tl.id,
                distanceMiles: parseFloat(dist.toFixed(1))
            };
        }
    }

    return nearest;
}

// ─── Public API ──────────────────────────────────────────────────

export function scoreRailConfidence(
    buyer: Buyer,
    transloaders: Transloader[]
): { railServedConfidence: RailConfidenceLevel; railEvidence: RailEvidence } {
    // 1. Distance to nearest BNSF track
    const nearest = findNearestTrack(buyer.lat, buyer.lng);
    const trackScore = scoreTrackDistance(nearest.distanceMiles);

    // 2. Nearest transloader
    const nearestTL = findNearestTransloader(buyer.lat, buyer.lng, transloaders);
    const transloadScore = scoreTransloaderProximity(nearestTL?.distanceMiles);

    // 3. Facility type
    const facilityBonus = scoreFacilityType(buyer.type);

    // 4. Manual verification (not yet implemented, default false)
    const manualScore = scoreManualVerification(false);

    // Composite
    const totalScore = Math.min(100, trackScore + transloadScore + facilityBonus + manualScore);

    const evidence: RailEvidence = {
        distanceToTrackMiles: nearest.distanceMiles,
        nearestCorridorId: nearest.corridorId,
        nearestTransloadId: nearestTL?.id,
        nearestTransloadMiles: nearestTL?.distanceMiles,
        facilityTypeBonus: facilityBonus > 0,
        manuallyVerified: false,
        score: totalScore
    };

    return {
        railServedConfidence: railConfidenceFromScore(totalScore),
        railEvidence: evidence
    };
}

/** Score all buyers in a list */
export function enrichBuyersWithRailConfidence(
    buyers: Buyer[],
    transloaders: Transloader[]
): Buyer[] {
    return buyers.map(buyer => {
        const { railServedConfidence, railEvidence } = scoreRailConfidence(buyer, transloaders);
        return {
            ...buyer,
            railServedConfidence,
            railEvidence,
            railAccessible: railEvidence.score >= 40, // Derive from score
            nearTransload: railEvidence.nearestTransloadMiles !== undefined && railEvidence.nearestTransloadMiles <= 25,
            railConfidence: railEvidence.score // Legacy compat
        };
    });
}

// ─── Corridor Display Names ──────────────────────────────────────
export const CORRIDOR_NAMES: Record<string, string> = {
    'bnsf-north-transcon': 'BNSF Northern Transcon',
    'bnsf-pnw-connector': 'BNSF PNW Connector',
    'bnsf-high-line': 'BNSF Hi-Line',
    'bnsf-south-transcon': 'BNSF Southern Transcon',
    'bnsf-california-central': 'BNSF CA Central Valley',
    'bnsf-central-corridor': 'BNSF Central Corridor',
    'bnsf-powder-river': 'BNSF Powder River',
    'bnsf-texas-access': 'BNSF Texas Access',
    'bnsf-texas-panhandle-feeder': 'BNSF TX Panhandle Feeder',
    'feeder-sioux-city-lincoln': 'Sioux City–Lincoln Feeder',
    'feeder-minneapolis-omaha': 'Minneapolis–Omaha Feeder',
    'feeder-central-il': 'Central IL Feeder',
    'southeast-corridor': 'Southeast Corridor'
};

export function getCorridorName(id: string): string {
    return CORRIDOR_NAMES[id] || id;
}
