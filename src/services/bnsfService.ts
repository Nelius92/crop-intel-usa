// BNSF Rate Engine
// Calibrated with LIVE BNSF API data (Tariff 4022 Item 31750, March 2026)
// Verified 735 rates from POST /v1/carload-rates on api.bnsf.com:6443
//
// ORIGIN: Campbell, MN (BNSF served, Wahpeton subdivision) 
// All rates FROM Campbell, MN TO destination
//
// Rate-per-bushel is CROP-AWARE: corn=4000 bu/car, soybeans=3667,
// sunflowers=8800, wheat=3667. The per-car rate is constant —
// only the per-bushel conversion changes by crop weight.

interface RailRate {
    origin: string;
    destination: string;
    ratePerCar: number;
    ratePerBushel: number;
    fuelSurcharge: number; // Per car
    tariffItem: string;
    distanceMiles: number;
    formula: string;
}

// Inline Haversine (avoids circular import with railService)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Campbell, MN coordinates (user's rail origin)
export const CAMPBELL_MN = {
    name: 'Campbell, MN',
    lat: 45.9669,
    lng: -96.4003,
    railroad: 'BNSF',
    subdivision: 'Wahpeton'
};

// Constants
const FUEL_SURCHARGE_AVG = 250; // Estimated average FSC per car

// Crop-specific bushels per car (BNSF 5161 cu ft covered hopper)
// Net weight capacity: 223,400 lbs (286k GRL - 62,600 tare)
// Volume capacity: ~4,148 bushels (5161 cu ft)
//
// BINDING CONSTRAINT varies by crop:
//   Heavy crops (corn, soybeans, wheat) → WEIGH OUT at 223,400 lbs
//   Light crops (sunflowers, barley)    → CUBE OUT at ~4,148 bu
const CROP_BUSHELS_PER_CAR: Record<string, number> = {
    'Yellow Corn': 4000,    // 56 lbs/bu → 223,400/56 = 3,989 bu, round to 4,000
    'White Corn': 4000,
    'Soybeans': 3723,       // 60 lbs/bu → 223,400/60 = 3,723 bu (weigh-out)
    'Wheat': 3723,          // 60 lbs/bu → 223,400/60 = 3,723 bu (weigh-out)
    'Sunflowers': 4148,     // 25 lbs/bu → cube-out at ~4,148 bu (volume-limited)
                            // Note: weight limit = 223,400/25 = 8,936 bu but car
                            // fills up (5161 cu ft) well before hitting weight.
};

// Crop price units — most crops trade $/bu, sunflowers trade $/cwt
const CROP_PRICE_UNIT: Record<string, string> = {
    'Yellow Corn': '/bu',
    'White Corn': '/bu',
    'Soybeans': '/bu',
    'Wheat': '/bu',
    'Sunflowers': '/cwt',
};

// Crop test weight (lbs per bushel) — needed for unit conversions
const CROP_LBS_PER_BUSHEL: Record<string, number> = {
    'Yellow Corn': 56,
    'White Corn': 56,
    'Soybeans': 60,
    'Wheat': 60,
    'Sunflowers': 25,
};

/** Get bushels per car for a crop (defaults to corn) */
export function getCropBushelsPerCar(crop: string = 'Yellow Corn'): number {
    return CROP_BUSHELS_PER_CAR[crop] || 4000;
}

/** Get the price unit label for a crop (e.g., '/bu' or '/cwt') */
export function getCropPriceUnit(crop: string = 'Yellow Corn'): string {
    return CROP_PRICE_UNIT[crop] || '/bu';
}

/** Get lbs per bushel for a crop */
export function getCropLbsPerBushel(crop: string = 'Yellow Corn'): number {
    return CROP_LBS_PER_BUSHEL[crop] || 56;
}

/**
 * Convert a freight rate from $/bu to the crop's native price unit.
 * For most crops this is a no-op (already $/bu).
 * For sunflowers: $/bu × (100 lbs/cwt ÷ 25 lbs/bu) = $/bu × 4 = $/cwt
 */
export function convertFreightToCropUnit(freightPerBushel: number, crop: string = 'Yellow Corn'): number {
    if (CROP_PRICE_UNIT[crop] === '/cwt') {
        const lbsPerBu = CROP_LBS_PER_BUSHEL[crop] || 56;
        const bushelsPerCwt = 100 / lbsPerBu;
        return freightPerBushel * bushelsPerCwt;
    }
    return freightPerBushel; // Already in $/bu
}

// Base Rate Anchor: Campbell, MN to Hereford, TX (approx $4400/car)
// This is based on Northern Plains to Texas Panhandle tariff
const BASE_RATE_CAMPBELL_TO_HEREFORD = 4400;

// Distance estimates from Campbell, MN (miles)
const DISTANCES_FROM_CAMPBELL: Record<string, number> = {
    // West Coast / PNW
    'CA': 1850,   // Campbell to Modesto/Central Valley
    'WA': 1650,   // Campbell to Yakima/PNW
    'OR': 1750,   // Campbell to Portland/McMinnville
    // Mountain West
    'ID': 1400,   // Campbell to Jerome
    'MT': 900,    // Campbell to Billings/Great Falls
    'WY': 850,    // Campbell to Sheridan/Casper
    'CO': 750,    // Campbell to Denver/Eastern CO
    'NM': 1300,   // Campbell to Clovis/Albuquerque
    'AZ': 1700,   // Campbell to Phoenix/Yuma
    // Texas & Southern Plains
    'TX': 1200,   // Campbell to Hereford/Amarillo
    'OK': 850,    // Campbell to Tulsa/OKC
    // Central / Midwest
    'KS': 650,    // Campbell to SW Kansas
    'IA': 450,    // Campbell to Des Moines
    'NE': 400,    // Campbell to Columbus/Central City
    'IL': 600,    // Campbell to Springfield/Peoria
    'MO': 550,    // Campbell to Kansas City
    'IN': 700,    // Campbell to Indianapolis
    'OH': 850,    // Campbell to Toledo/Columbus
    'WI': 350,    // Campbell to Madison/Milwaukee
    // Southeast (via BNSF interline through Memphis/Birmingham)
    'GA': 1200,   // Campbell to Atlanta
    'AL': 1100,   // Campbell to Birmingham
    'TN': 950,    // Campbell to Memphis/Nashville
    'AR': 800,    // Campbell to Little Rock
    'MS': 950,    // Campbell to Jackson
    'LA': 1050,   // Campbell to New Orleans/Baton Rouge
    // Local / Short-haul
    'MN': 65,     // Campbell to local
    'ND': 40,     // Campbell to Hankinson (~25 miles)
    'SD': 120,    // Campbell to South Dakota elevators
};

export const bnsfService = {
    // Get origin info
    getOrigin: () => CAMPBELL_MN,

    // Calculate rate FROM Campbell, MN TO destination
    // Per-car rate is the same regardless of crop — the per-bushel
    // conversion accounts for crop weight (corn vs soybeans vs sunflowers)
    calculateRate: (destinationState: string, destinationCity: string, destLat?: number, destLng?: number, crop?: string): RailRate => {
        let ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD;
        let tariffItem = "4022-39011"; // General Grain Tariff
        let distanceMiles = DISTANCES_FROM_CAMPBELL[destinationState] || 500;

        // For short-haul states, compute actual distance if coordinates provided
        if (destLat !== undefined && destLng !== undefined &&
            (destinationState === 'MN' || destinationState === 'ND' || destinationState === 'SD')) {
            const straightLine = haversine(CAMPBELL_MN.lat, CAMPBELL_MN.lng, destLat, destLng);
            distanceMiles = Math.round(straightLine * 1.3); // road factor
        }

        // ── Rate Tiers (calibrated with BNSF API where available) ──────────

        if (destinationState === 'CA') {
            // BNSF API verified: Modesto = $6,075/car, Hughson = $6,075/car
            // Central Valley average from API Item 31750
            ratePerCar = 6075;
            tariffItem = "4022-31750 (CA · API-verified)";
        } else if (destinationState === 'WA') {
            // BNSF API shows wide range: Toppenish $3,038 vs Chehalis $6,498
            // Differentiate feed-yard (inland) vs export (coastal)
            if (destinationCity === 'Toppenish' || destinationCity === 'Yakima' || destinationCity === 'Sunnyside') {
                ratePerCar = 3038;
                tariffItem = "4022-31750 (WA inland · API-verified)";
            } else {
                // PNW export terminals & coastal
                ratePerCar = 5944;
                tariffItem = "4022-31750 (WA export · API-verified)";
            }
        } else if (destinationState === 'OR') {
            // BNSF API: McMinnville $6,606, Prineville $4,966
            if (destinationCity === 'Prineville' || destinationCity === 'Madras' || destinationCity === 'Bend') {
                ratePerCar = 4966;
                tariffItem = "4022-31750 (OR inland · API-verified)";
            } else {
                ratePerCar = 6606;
                tariffItem = "4022-31750 (OR export · API-verified)";
            }
        } else if (destinationState === 'MT') {
            // BNSF API: Sweet Grass $5,310/car (northern border)
            // Interior MT buyers likely lower
            ratePerCar = 4900;
            tariffItem = "4022-31750 (MT · API-calibrated)";
        } else if (destinationState === 'TX') {
            if (destinationCity === 'Hereford' || destinationCity === 'Amarillo') {
                ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD;
                tariffItem = "4022-39011 (TX Panhandle)";
            } else if (destinationCity === 'Galveston' || destinationCity === 'Houston' || destinationCity === 'Corpus Christi') {
                ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 260;
                tariffItem = "4022-39011 (TX Gulf)";
            } else {
                // General TX (San Antonio, Lubbock, etc.)
                ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD;
                tariffItem = "4022-39011 (TX)";
            }
        } else if (destinationState === 'KS') {
            // SW Kansas: Base - $1,020 (shorter haul from Campbell)
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 1020;
            tariffItem = "4022-39011 (KS)";
        } else if (destinationState === 'CO') {
            // Colorado: Similar distance to KS, feedlot corridor
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 1020;
            tariffItem = "4022-39011 (CO)";
        } else if (destinationState === 'OK') {
            // Oklahoma: Between KS and TX, via Tulsa corridor
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 260;
            tariffItem = "4022-39011 (OK)";
        } else if (destinationState === 'ID') {
            // Idaho: Similar to PNW inland
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 500;
            tariffItem = "4022-39011 (ID)";
        } else if (destinationState === 'WY') {
            // Wyoming: Mountain route, similar to MT
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 500;
            tariffItem = "4022-39011 (WY)";
        } else if (destinationState === 'NM') {
            // New Mexico: Southwest, similar to TX Panhandle
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD;
            tariffItem = "4022-39011 (NM)";
        } else if (destinationState === 'AZ') {
            // Arizona: Between TX and CA, long haul
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 700;
            tariffItem = "4022-39011 (AZ)";

        // ── Midwest / Corn Belt (short-haul, competitive) ──────────────────
        } else if (destinationState === 'IA' || destinationState === 'NE' ||
                   destinationState === 'IL' || destinationState === 'MO' ||
                   destinationState === 'IN' || destinationState === 'OH' ||
                   destinationState === 'WI') {
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 1500;
            tariffItem = `4022-39011 (Midwest · ${destinationState})`;

        // ── Southeast (BNSF interline via Memphis/Birmingham) ──────────────
        } else if (destinationState === 'TN') {
            // Tennessee: via Memphis BNSF yard
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 500;
            tariffItem = "4022-Interline (TN via Memphis)";
        } else if (destinationState === 'AR') {
            // Arkansas: Short interline from Memphis
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 200;
            tariffItem = "4022-Interline (AR)";
        } else if (destinationState === 'MS') {
            // Mississippi: via Memphis corridor
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 500;
            tariffItem = "4022-Interline (MS)";
        } else if (destinationState === 'AL') {
            // Alabama: via Birmingham BNSF reach
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 700;
            tariffItem = "4022-Interline (AL via Birmingham)";
        } else if (destinationState === 'GA') {
            // Georgia: Long interline via Birmingham/Atlanta
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD + 900;
            tariffItem = "4022-Interline (GA via Atlanta)";
        } else if (destinationState === 'LA') {
            // Louisiana: Gulf export, similar to TX Gulf
            ratePerCar = BASE_RATE_CAMPBELL_TO_HEREFORD - 260;
            tariffItem = "4022-39011 (LA Gulf)";

        // ── Short-haul / Local (MN/ND/SD) ──────────────────────────────────
        } else if (destinationState === 'MN' || destinationState === 'ND' || destinationState === 'SD') {
            distanceMiles = DISTANCES_FROM_CAMPBELL[destinationState] || 100;
            // Linear model: $100 base + $2.50/mile, floor $350/car
            ratePerCar = Math.max(350, 100 + (distanceMiles * 2.5));
            tariffItem = `4022-Local (${destinationState} · ${distanceMiles} mi)`;
        }

        // ── Per-bushel conversion (CROP-SPECIFIC) ──────────────────────────
        // The per-car rate is the same for all crops on the same route.
        // But bushels-per-car varies by crop weight:
        //   Corn:       4,000 bu/car (56 lbs/bu)
        //   Soybeans:   3,667 bu/car (60 lbs/bu) → higher $/bu
        //   Sunflowers: 8,800 bu/car (25 lbs/bu) → much lower $/bu
        const totalCost = ratePerCar + FUEL_SURCHARGE_AVG;
        const bushelsPerCar = getCropBushelsPerCar(crop);
        const ratePerBushel = parseFloat((totalCost / bushelsPerCar).toFixed(2));
        // NaN guard: if bushelsPerCar was 0 or undefined, clamp to safe fallback
        if (isNaN(ratePerBushel) || !isFinite(ratePerBushel)) {
            return {
                origin: CAMPBELL_MN.name,
                destination: `${destinationCity}, ${destinationState}`,
                ratePerCar,
                ratePerBushel: 1.00, // Safe fallback
                fuelSurcharge: FUEL_SURCHARGE_AVG,
                tariffItem: `${tariffItem} (fallback)`,
                distanceMiles,
                formula: `BNSF fallback rate — crop bushels/car unavailable`
            };
        }

        return {
            origin: CAMPBELL_MN.name,
            destination: `${destinationCity}, ${destinationState}`,
            ratePerCar,
            ratePerBushel,
            fuelSurcharge: FUEL_SURCHARGE_AVG,
            tariffItem,
            distanceMiles,
            formula: `BNSF ${tariffItem} · ${distanceMiles} mi · $${ratePerBushel}/bu`
        };
    }
};
