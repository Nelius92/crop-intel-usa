import { RailNetwork, RailNode, Buyer } from '../types';
import { bnsfService } from './bnsfService';
import { truckFreightService } from './truckFreightService';
import { cacheService, CACHE_TTL } from './cacheService';

// Comprehensive BNSF & Major Rail Network Simulation
export const RAIL_LINES: RailNetwork[] = [
    // --- BNSF Northern Transcon (Chicago -> Seattle/PNW) ---
    {
        id: 'bnsf-north-transcon',
        path: [
            { lat: 41.8781, lng: -87.6298 }, // Chicago
            { lat: 43.8013, lng: -91.2396 }, // La Crosse
            { lat: 44.9778, lng: -93.2650 }, // Minneapolis
            { lat: 45.5600, lng: -94.1600 }, // St Cloud
            { lat: 46.8772, lng: -96.7898 }, // Fargo
            { lat: 46.9200, lng: -98.0000 }, // Valley City
            { lat: 46.9000, lng: -99.5000 }, // Jamestown
            { lat: 46.8000, lng: -100.780 }, // Bismarck
            { lat: 46.9000, lng: -102.800 }, // Dickinson
            { lat: 47.1000, lng: -105.000 }, // Glendive
            { lat: 46.4000, lng: -105.800 }, // Miles City
            { lat: 46.6000, lng: -108.500 }, // Roundup
            { lat: 45.7800, lng: -108.500 }, // Billings (Key Hub)
            { lat: 45.6700, lng: -110.500 }, // Livingston
            { lat: 45.6800, lng: -111.040 }, // Bozeman
            { lat: 46.5900, lng: -112.020 }, // Helena
            { lat: 46.8700, lng: -113.990 }, // Missoula
            { lat: 47.6000, lng: -115.300 }, // Thompson Falls
            { lat: 48.2000, lng: -116.500 }, // Sandpoint
            { lat: 47.6588, lng: -117.426 }, // Spokane
            { lat: 47.4200, lng: -120.300 }, // Wenatchee
            { lat: 47.9700, lng: -122.200 }, // Everett
            { lat: 47.6062, lng: -122.332 }, // Seattle
        ]
    },
    {
        id: 'bnsf-pnw-connector',
        path: [
            { lat: 47.6588, lng: -117.426 }, // Spokane
            { lat: 46.2396, lng: -119.100 }, // Pasco (Key Grain Hub)
            { lat: 45.6387, lng: -122.675 }, // Portland
            { lat: 46.1300, lng: -122.900 }, // Longview
            { lat: 45.6318, lng: -122.671 }, // Vancouver WA (Export)
        ]
    },
    // --- Montana - High Line (Minot -> Havre -> Glacier -> Spokane) ---
    {
        id: 'bnsf-high-line',
        path: [
            { lat: 48.2325, lng: -101.296 }, // Minot
            { lat: 48.5500, lng: -109.670 }, // Havre
            { lat: 48.5000, lng: -111.800 }, // Shelby
            { lat: 48.5300, lng: -113.000 }, // Browning (Glacier)
            { lat: 48.4100, lng: -114.330 }, // Whitefish
            { lat: 48.3000, lng: -115.500 }, // Libby
            { lat: 48.2000, lng: -116.500 }, // Sandpoint (Joins)
        ]
    },

    // --- BNSF Southern Transcon (Chicago -> LA) ---
    {
        id: 'bnsf-south-transcon',
        path: [
            { lat: 41.8781, lng: -87.6298 }, // Chicago
            { lat: 40.9000, lng: -90.4000 }, // Galesburg
            { lat: 40.8000, lng: -91.1000 }, // Fort Madison
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
            { lat: 38.4000, lng: -96.2000 }, // Emporia
            { lat: 37.6872, lng: -97.3301 }, // Wichita
            { lat: 37.2000, lng: -97.0000 }, // Wellington
            { lat: 36.4000, lng: -98.7000 }, // Waynoka
            { lat: 35.2220, lng: -101.831 }, // Amarillo (Feedlot Alley)
            { lat: 34.4208, lng: -103.200 }, // Clovis
            { lat: 34.6000, lng: -106.600 }, // Belen (ABQ bypass)
            { lat: 35.2000, lng: -108.500 }, // Gallup
            { lat: 35.1983, lng: -111.651 }, // Flagstaff
            { lat: 35.2000, lng: -113.600 }, // Kingman
            { lat: 34.8500, lng: -114.600 }, // Needles
            { lat: 34.9000, lng: -117.000 }, // Barstow
            { lat: 34.1000, lng: -117.300 }, // San Bernardino
            { lat: 34.0522, lng: -118.243 }, // Los Angeles
        ]
    },
    // --- California Central Valley ---
    {
        id: 'bnsf-california-central',
        path: [
            { lat: 34.9000, lng: -117.000 }, // Barstow
            { lat: 35.1000, lng: -118.400 }, // Mojave
            { lat: 35.3733, lng: -119.018 }, // Bakersfield
            { lat: 36.3100, lng: -119.300 }, // Hanford
            { lat: 36.7378, lng: -119.787 }, // Fresno (Dairy)
            { lat: 36.9700, lng: -120.060 }, // Madera
            { lat: 37.3000, lng: -120.480 }, // Merced
            { lat: 37.6391, lng: -120.996 }, // Modesto
            { lat: 37.9577, lng: -121.290 }, // Stockton
            { lat: 38.0000, lng: -122.000 }, // Richmond (Bay Area)
        ]
    },

    // --- Central Corridor & Coal Loop (Denver/WY) ---
    {
        id: 'bnsf-central-corridor',
        path: [
            { lat: 40.8136, lng: -96.7026 }, // Lincoln
            { lat: 40.6000, lng: -99.1000 }, // Kearney
            { lat: 41.1300, lng: -100.700 }, // North Platte (UP parallel)
            { lat: 40.5853, lng: -103.200 }, // Sterling
            { lat: 39.7392, lng: -104.990 }, // Denver
            { lat: 40.5000, lng: -105.000 }, // Fort Collins
            { lat: 41.1400, lng: -104.800 }, // Cheyenne
            { lat: 42.8000, lng: -106.300 }, // Casper
            { lat: 43.6000, lng: -108.200 }, // Thermopolis
            { lat: 44.5000, lng: -109.000 }, // Greybull
            { lat: 45.7800, lng: -108.500 }, // Billings (Connects North)
        ]
    },
    {
        id: 'bnsf-powder-river',
        path: [
            { lat: 41.1400, lng: -104.000 }, // Alliance NE
            { lat: 43.0000, lng: -105.000 }, // Douglas WY
            { lat: 44.2000, lng: -105.500 }, // Gillette (Coal)
            { lat: 45.0000, lng: -106.000 }, // Sheridan
            { lat: 45.7800, lng: -108.500 }, // Billings
        ]
    },

    // --- Texas Access & Gulf Coast ---
    {
        id: 'bnsf-texas-access',
        path: [
            { lat: 39.0997, lng: -94.5786 }, // Kansas City
            { lat: 38.5000, lng: -94.8000 }, // Paola
            { lat: 37.8000, lng: -94.7000 }, // Fort Scott
            { lat: 37.0902, lng: -94.5100 }, // Joplin
            { lat: 36.1540, lng: -95.9928 }, // Tulsa
            { lat: 33.6000, lng: -96.6000 }, // Sherman
            { lat: 32.7767, lng: -96.7970 }, // Dallas
            { lat: 32.7555, lng: -97.3308 }, // Fort Worth
            { lat: 32.4000, lng: -97.4000 }, // Cleburne
            { lat: 31.1000, lng: -97.3000 }, // Temple
            { lat: 29.7604, lng: -95.3698 }, // Houston
            { lat: 29.3013, lng: -94.7977 }, // Galveston (Export)
        ]
    },
    {
        id: 'bnsf-texas-panhandle-feeder',
        path: [
            { lat: 37.2000, lng: -97.0000 }, // Wellington KS
            { lat: 36.4000, lng: -98.7000 }, // Waynoka OK
            { lat: 35.2220, lng: -101.831 }, // Amarillo
            { lat: 33.5800, lng: -101.850 }, // Lubbock
            { lat: 32.4000, lng: -99.7000 }, // Sweetwater
            { lat: 31.1000, lng: -97.3000 }, // Temple (Connects to Gulf)
        ]
    },

    // --- Corn Belt Feeders (Detailed) ---
    {
        id: 'feeder-sioux-city-lincoln',
        path: [
            { lat: 43.5500, lng: -96.7000 }, // Sioux Falls SD
            { lat: 42.4900, lng: -96.4000 }, // Sioux City IA
            { lat: 41.2565, lng: -95.9345 }, // Omaha NE
            { lat: 40.8136, lng: -96.7026 }, // Lincoln NE
        ]
    },
    {
        id: 'feeder-minneapolis-omaha',
        path: [
            { lat: 44.9778, lng: -93.2650 }, // Minneapolis
            { lat: 42.5000, lng: -94.1000 }, // Fort Dodge IA
            { lat: 41.2565, lng: -95.9345 }, // Omaha
        ]
    },
    {
        id: 'feeder-central-il',
        path: [
            { lat: 40.9000, lng: -90.4000 }, // Galesburg IL
            { lat: 40.7000, lng: -89.6000 }, // Peoria
            { lat: 39.8000, lng: -89.6000 }, // Springfield
            { lat: 38.6270, lng: -90.1994 }, // St Louis
        ]
    },

    // --- Southeast Access (CSX/NS Partnerships) ---
    {
        id: 'southeast-corridor',
        path: [
            { lat: 38.6270, lng: -90.1994 }, // St. Louis
            { lat: 37.0000, lng: -89.1000 }, // Cairo
            { lat: 35.1495, lng: -90.0490 }, // Memphis (BNSF Yard)
            { lat: 33.5186, lng: -86.8104 }, // Birmingham (BNSF reach)
            { lat: 33.7490, lng: -84.3880 }, // Atlanta (Connection)
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

// Calculate freight FROM Campbell, MN TO buyer location
// Uses buyer's state to determine proper BNSF rate, or falls back to truck
export const calculateFreight = async (
    buyerLocation: { lat: number, lng: number, state?: string, city?: string },
    destinationName: string,
    railAccessible: boolean = true
): Promise<{ ratePerBushel: number, distance: number, origin: string, mode: 'rail' | 'truck', formula: string }> => {
    const cacheKey = `${buyerLocation.state || 'unknown'}::${buyerLocation.city || destinationName}::${railAccessible}`;

    // Return cached freight rate immediately if fresh (12h TTL)
    const cached = cacheService.get<{ ratePerBushel: number, distance: number, origin: string, mode: 'rail' | 'truck', formula: string }>('freight', cacheKey);
    if (cached) return cached;

    return new Promise((resolve) => {
        setTimeout(() => {

            let state = buyerLocation.state || "";
            let city = buyerLocation.city || "";

            // If state not provided, parse from destination name
            if (!state) {
                if (destinationName.includes("Modesto") || destinationName.includes("Penny Newman") ||
                    destinationName.includes("Stanislaus") || destinationName.includes("Gilbert") ||
                    destinationName.includes("Tulare") || destinationName.includes("Fresno")) {
                    state = "CA";
                    city = city || "Modesto";
                } else if (destinationName.includes("Yakima") || destinationName.includes("Pasco") ||
                    destinationName.includes("Walla") || destinationName.includes("Northwest")) {
                    state = "WA";
                    city = city || "Yakima";
                } else if (destinationName.includes("Hereford") || destinationName.includes("Texas") ||
                    destinationName.includes("Amarillo")) {
                    state = "TX";
                    city = city || "Hereford";
                } else if (destinationName.includes("Kansas")) {
                    state = "KS";
                    city = city || "Garden City";
                } else if (destinationName.includes("Jerome") || destinationName.includes("Idaho")) {
                    state = "ID";
                    city = city || "Jerome";
                } else if (destinationName.includes("Iowa") || destinationName.includes("Des Moines") ||
                    destinationName.includes("Cedar Rapids")) {
                    state = "IA";
                    city = city || "Des Moines";
                } else if (destinationName.includes("Nebraska") || destinationName.includes("Albion") ||
                    destinationName.includes("Aurora")) {
                    state = "NE";
                    city = city || "Central City";
                }
            }

            // Decision: Rail or Truck?
            if (railAccessible && state) {
                // Use BNSF Rate Engine FROM Campbell, MN
                const bnsfRate = bnsfService.calculateRate(state, city, buyerLocation.lat, buyerLocation.lng);

                const result = {
                    ratePerBushel: bnsfRate.ratePerBushel,
                    distance: bnsfRate.distanceMiles,
                    origin: bnsfRate.origin,
                    mode: 'rail' as const,
                    formula: bnsfRate.formula
                };
                cacheService.set('freight', cacheKey, result, CACHE_TTL.FREIGHT_MS);
                resolve(result);
            } else {
                // Use truck model
                const truckRate = truckFreightService.calculateRate(
                    buyerLocation.lat, buyerLocation.lng,
                    city, state
                );
                const result = {
                    ratePerBushel: truckRate.ratePerBushel,
                    distance: truckRate.distanceMiles,
                    origin: 'Campbell, MN',
                    mode: 'truck' as const,
                    formula: truckRate.formula
                };
                cacheService.set('freight', cacheKey, result, CACHE_TTL.FREIGHT_MS);
                resolve(result);
            }
        }, 50);
    });
};
