import { RailNetwork, RailNode, Buyer } from '../types';
import { bnsfService } from './bnsfService';

// Comprehensive BNSF & Major Rail Network Simulation
export const RAIL_LINES: RailNetwork[] = [
    // --- BNSF Northern Transcon (Chicago -> Seattle/PNW) ---
    {
        id: 'bnsf-north-transcon',
        path: [
            { lat: 41.8781, lng: -87.6298 }, // Chicago
            { lat: 43.8013, lng: -91.2396 }, // La Crosse
            { lat: 44.9778, lng: -93.2650 }, // Minneapolis
            { lat: 46.8772, lng: -96.7898 }, // Fargo
            { lat: 48.2325, lng: -101.296 }, // Minot
            { lat: 48.5500, lng: -109.670 }, // Havre
            { lat: 48.4100, lng: -114.330 }, // Whitefish
            { lat: 47.6588, lng: -117.426 }, // Spokane
            { lat: 47.6062, lng: -122.332 }, // Seattle
        ]
    },
    {
        id: 'bnsf-pnw-connector',
        path: [
            { lat: 47.6588, lng: -117.426 }, // Spokane
            { lat: 46.2396, lng: -119.100 }, // Pasco (Key Grain Hub)
            { lat: 45.6387, lng: -122.675 }, // Portland
            { lat: 45.6318, lng: -122.671 }, // Vancouver WA (Export)
        ]
    },

    // --- BNSF Southern Transcon (Chicago -> LA) ---
    {
        id: 'bnsf-south-transcon',
        path: [
            { lat: 41.8781, lng: -87.6298 }, // Chicago
            { lat: 40.8000, lng: -91.1000 }, // Fort Madison
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
            { lat: 37.6872, lng: -97.3301 }, // Wichita
            { lat: 36.3932, lng: -99.3000 }, // Woodward
            { lat: 35.2220, lng: -101.831 }, // Amarillo (Feedlot Alley)
            { lat: 34.4208, lng: -103.200 }, // Clovis
            { lat: 34.6000, lng: -106.600 }, // Belen
            { lat: 35.1983, lng: -111.651 }, // Flagstaff
            { lat: 34.8500, lng: -114.600 }, // Needles
            { lat: 34.9000, lng: -117.000 }, // Barstow
            { lat: 34.0522, lng: -118.243 }, // Los Angeles
        ]
    },
    {
        id: 'bnsf-california-central',
        path: [
            { lat: 34.9000, lng: -117.000 }, // Barstow
            { lat: 35.3733, lng: -119.018 }, // Bakersfield
            { lat: 36.7378, lng: -119.787 }, // Fresno (Dairy)
            { lat: 37.6391, lng: -120.996 }, // Modesto
            { lat: 37.9577, lng: -121.290 }, // Stockton
        ]
    },

    // --- Central Corridor (Denver -> West) ---
    {
        id: 'bnsf-central-corridor',
        path: [
            { lat: 40.8136, lng: -96.7026 }, // Lincoln
            { lat: 40.5853, lng: -103.200 }, // Sterling
            { lat: 39.7392, lng: -104.990 }, // Denver
            { lat: 41.1400, lng: -104.800 }, // Cheyenne
            { lat: 41.7600, lng: -107.200 }, // Rawlins
            { lat: 41.2500, lng: -111.000 }, // Evanston
            { lat: 41.2230, lng: -111.973 }, // Ogden
        ]
    },

    // --- Texas Access (KC -> Gulf) ---
    {
        id: 'bnsf-texas-access',
        path: [
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
            { lat: 37.0902, lng: -94.5100 }, // Joplin
            { lat: 36.1540, lng: -95.9928 }, // Tulsa
            { lat: 32.7767, lng: -96.7970 }, // Dallas
            { lat: 32.7555, lng: -97.3308 }, // Fort Worth
            { lat: 31.5493, lng: -97.1467 }, // Waco
            { lat: 29.7604, lng: -95.3698 }, // Houston
            { lat: 29.3013, lng: -94.7977 }, // Galveston (Export)
        ]
    },

    // --- Corn Belt Feeders ---
    {
        id: 'corn-belt-feeder-1',
        path: [
            { lat: 42.4900, lng: -96.4000 }, // Sioux City
            { lat: 41.2565, lng: -95.9345 }, // Omaha
            { lat: 40.8136, lng: -96.7026 }, // Lincoln
            { lat: 39.7600, lng: -95.8000 }, // Topeka
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
        ]
    },
    {
        id: 'corn-belt-feeder-2',
        path: [
            { lat: 41.5868, lng: -93.6250 }, // Des Moines
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
        ]
    },

    // --- Southeast Access (Simulated CSX/NS for Poultry Markets) ---
    {
        id: 'southeast-corridor',
        path: [
            { lat: 38.6270, lng: -90.1994 }, // St. Louis
            { lat: 37.0000, lng: -89.1000 }, // Cairo
            { lat: 35.1495, lng: -90.0490 }, // Memphis
            { lat: 33.5186, lng: -86.8104 }, // Birmingham
            { lat: 33.7490, lng: -84.3880 }, // Atlanta
            { lat: 34.2979, lng: -83.8241 }, // Gainesville (Poultry Capital)
        ]
    },
    {
        id: 'east-coast-feeder',
        path: [
            { lat: 41.8781, lng: -87.6298 }, // Chicago
            { lat: 41.0000, lng: -85.0000 }, // Fort Wayne
            { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
            { lat: 39.2904, lng: -76.6122 }, // Baltimore
            { lat: 38.6000, lng: -75.3000 }, // Delmarva (Poultry)
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

export interface FreightQuote {
    origin: string;
    destination: string;
    distanceMiles: number;
    ratePerBushel: number;
    totalCostPerCar: number;
    estimatedDays: number;
    isRealTime?: boolean;
}

export const calculateFreight = async (origin: { lat: number, lng: number }, destinationName: string): Promise<{ ratePerBushel: number, distance: number }> => {
    // Simulate async calculation
    return new Promise((resolve) => {
        setTimeout(() => {
            // Parse destination from name/context (Simplified for now)
            // In a real app, we'd have structured destination data
            let state = "";
            let city = "";

            if (destinationName.includes("Modesto") || destinationName.includes("Penny Newman") || destinationName.includes("Stanislaus")) {
                state = "CA";
                city = "Modesto";
            } else if (destinationName.includes("Yakima") || destinationName.includes("Pomeroy") || destinationName.includes("Northwest")) {
                state = "WA";
                city = "Yakima";
            } else if (destinationName.includes("Hereford") || destinationName.includes("Texas")) {
                state = "TX";
                city = "Hereford";
            } else if (destinationName.includes("Kansas")) {
                state = "KS";
                city = "Garden City";
            } else {
                // Default fallback for local/unknown
                resolve({ ratePerBushel: 0.15, distance: 50 });
                return;
            }

            // Use BNSF Rate Engine
            const bnsfRate = bnsfService.calculateRate(state, city);

            // Estimate distance (just for display)
            // This is secondary to the Tariff Rate which is the "Truth"
            const distance = state === "CA" ? 1800 : (state === "WA" ? 1600 : (state === "TX" ? 900 : 400));

            resolve({
                ratePerBushel: bnsfRate.ratePerBushel,
                distance: distance
            });
        }, 100);
    });
};
