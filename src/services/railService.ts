import { RailNetwork, RailNode, Buyer } from '../types';

// Simple mock rail lines
export const RAIL_LINES: RailNetwork[] = [
    {
        id: 'ns-corridor', // North-South through Midwest (approx I-35 corridor)
        path: [
            { lat: 45.0, lng: -93.5 }, // Minneapolis
            { lat: 41.6, lng: -93.6 }, // Des Moines
            { lat: 39.1, lng: -94.6 }, // Kansas City
        ]
    },
    {
        id: 'ew-corridor', // East-West (approx I-80 corridor)
        path: [
            { lat: 41.2, lng: -100.0 }, // Central NE
            { lat: 41.2, lng: -96.0 },  // Omaha
            { lat: 41.6, lng: -93.6 },  // Des Moines
            { lat: 41.5, lng: -90.5 },  // Quad Cities
            { lat: 41.8, lng: -87.6 },  // Chicago
        ]
    }
];

// Helper to calculate distance between two points (Haversine formula approx)
export function getDistanceFromLatLonInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 3959; // Radius of the earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in miles
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Distance from point to line segment
export function distToSegment(p: RailNode, v: RailNode, w: RailNode) {
    const l2 = Math.pow(v.lat - w.lat, 2) + Math.pow(v.lng - w.lng, 2);
    if (l2 === 0) return getDistanceFromLatLonInMiles(p.lat, p.lng, v.lat, v.lng);

    let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
    t = Math.max(0, Math.min(1, t));

    const projLat = v.lat + t * (w.lat - v.lat);
    const projLng = v.lng + t * (w.lng - v.lng);

    return getDistanceFromLatLonInMiles(p.lat, p.lng, projLat, projLng);
}

export const checkRailProximity = (buyers: Buyer[]): Buyer[] => {
    return buyers.map(buyer => {
        let isAccessible = false;

        for (const line of RAIL_LINES) {
            for (let i = 0; i < line.path.length - 1; i++) {
                const start = line.path[i];
                const end = line.path[i + 1];
                const dist = distToSegment({ lat: buyer.lat, lng: buyer.lng }, start, end);

                if (dist <= 30) { // 30 miles threshold
                    isAccessible = true;
                    break;
                }
            }
            if (isAccessible) break;
        }

        return { ...buyer, railAccessible: isAccessible };
    });
};

import { usdaService } from './usdaService';

export interface FreightQuote {
    origin: string;
    destination: string;
    distanceMiles: number;
    ratePerBushel: number;
    totalCostPerCar: number; // Approx 3500 bu/car
    estimatedDays: number;
    isRealTime?: boolean;
}

export const CAMPBELL_MN_COORDS = { lat: 46.095, lng: -96.370 };

// Cache for real-time rate adjustment
let realTimeRateAdjustment = 1.0;
let hasFetchedRealTime = false;

export const calculateFreight = async (destination: { lat: number, lng: number }, destName: string): Promise<FreightQuote> => {
    const distance = getDistanceFromLatLonInMiles(CAMPBELL_MN_COORDS.lat, CAMPBELL_MN_COORDS.lng, destination.lat, destination.lng);

    // Try to fetch real-time data once
    if (!hasFetchedRealTime) {
        const latestRate = await usdaService.getLatestRailRates();
        if (latestRate) {
            // If USDA reports a high rate (e.g. > $5000/car for a standard route), adjust our base.
            // Standard mock base was ~$4200 for long haul.
            // Let's say baseline is $4000.
            realTimeRateAdjustment = latestRate / 4000;
            hasFetchedRealTime = true;
        }
    }

    // Mock Rate Logic with Real-Time Adjustment:
    // Base rate $0.40/bu + $0.001/mile (approx)
    // If > 500 miles, slightly cheaper per mile rate.
    // If > 1000 miles (e.g. to Texas), even cheaper per mile (unit train efficiency).
    let perMileRate = 0.001;
    if (distance > 1000) {
        perMileRate = 0.0006;
    } else if (distance > 500) {
        perMileRate = 0.0008;
    }

    const baseRate = 0.40 * realTimeRateAdjustment; // Apply USDA factor
    const ratePerBushel = baseRate + (distance * perMileRate);

    const bushelsPerCar = 3500; // Small hopper
    const totalCostPerCar = ratePerBushel * bushelsPerCar;

    // 1 day per 300 miles + 2 days loading/unloading
    const estimatedDays = Math.ceil(distance / 300) + 2;

    return {
        origin: "Campbell, MN",
        destination: destName,
        distanceMiles: Math.round(distance),
        ratePerBushel: parseFloat(ratePerBushel.toFixed(2)),
        totalCostPerCar: parseFloat(totalCostPerCar.toFixed(2)),
        estimatedDays,
        isRealTime: hasFetchedRealTime
    };
};
