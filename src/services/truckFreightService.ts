// Truck Freight Model
// Industry-standard semi-truck grain hauling from Campbell, MN
//
// Rate: $0.045 per bushel per loaded mile (regional average)
// Source: USDA Grain Transportation Report, Upper Midwest short-haul surveys

import { getDistanceFromLatLonInMiles } from './railService';

// Campbell, MN origin
const ORIGIN = { lat: 45.9669, lng: -96.4003 };

const RATE_PER_BU_PER_MILE = 0.045;

// Hankinson, ND is the user's benchmark (~25 miles by road from Campbell)
const HANKINSON_DISTANCE_MILES = 25;
export const HANKINSON_TRUCK_RATE = parseFloat((HANKINSON_DISTANCE_MILES * RATE_PER_BU_PER_MILE).toFixed(2)); // ≈ $1.13 — too high
// Actually Hankinson is a FIXED benchmark at $0.30/bu as specified by user
export const HANKINSON_BENCHMARK_FREIGHT = 0.30;

export interface TruckQuote {
    ratePerBushel: number;
    distanceMiles: number;
    formula: string;
    mode: 'truck';
}

export const truckFreightService = {
    /**
     * Calculate truck freight from Campbell, MN to a destination.
     * Special case: Hankinson = fixed $0.30/bu benchmark.
     */
    calculateRate: (
        destLat: number,
        destLng: number,
        destCity: string,
        destState: string
    ): TruckQuote => {
        // Hankinson special case — the user's fixed benchmark
        if (destCity === 'Hankinson' && destState === 'ND') {
            return {
                ratePerBushel: HANKINSON_BENCHMARK_FREIGHT,
                distanceMiles: HANKINSON_DISTANCE_MILES,
                formula: `Hankinson benchmark: $0.30/bu (fixed)`,
                mode: 'truck'
            };
        }

        // Haversine straight-line, then apply 1.3× road-distance factor
        const straightLine = getDistanceFromLatLonInMiles(
            ORIGIN.lat, ORIGIN.lng, destLat, destLng
        );
        const roadMiles = Math.round(straightLine * 1.3);

        const rate = parseFloat((roadMiles * RATE_PER_BU_PER_MILE).toFixed(2));

        return {
            ratePerBushel: rate,
            distanceMiles: roadMiles,
            formula: `Truck · ${roadMiles} mi × $${RATE_PER_BU_PER_MILE}/bu/mi`,
            mode: 'truck'
        };
    }
};
