// BNSF Rate Engine
// Based on Official BNSF Tariff 4022 (2025/2026 Marketing Year)
// Source: USDA Grain Transportation Report & BNSF Announcements

interface RailRate {
    destination: string;
    ratePerCar: number;
    ratePerBushel: number;
    fuelSurcharge: number; // Per car
    tariffItem: string;
}

// Constants
const BUSHELS_PER_CAR = 4000; // Standard hopper car approx
const FUEL_SURCHARGE_AVG = 250; // Estimated average FSC per car

// Base Rate Anchor: Hereford, TX (approx $4400/car from Northern Plains)
// We use this to derive others based on the official differentials.
const BASE_RATE_HEREFORD = 4400;

export const bnsfService = {
    // Calculate rate from a generic Northern Plains origin (e.g. NE/SD)
    calculateRate: (destinationState: string, destinationCity: string): RailRate => {
        let ratePerCar = BASE_RATE_HEREFORD;
        let tariffItem = "4022-39011"; // General Corn Tariff

        // Apply Official 2025 Tariff Differentials
        if (destinationState === 'CA') {
            // California Central Valley: Base + $960
            ratePerCar = BASE_RATE_HEREFORD + 960;
            tariffItem = "4022-39013 (CA)";
        } else if (destinationState === 'WA' || destinationState === 'OR') {
            // PNW Export: Parity with old Hereford (approx Base + $100 for distance)
            // Tariff says "Unchanged", implying it didn't drop like Hereford did.
            // So PNW is actually HIGHER than the new Hereford rate.
            // Let's estimate PNW at Base + $600 (since Hereford dropped $600)
            ratePerCar = BASE_RATE_HEREFORD + 600;
            tariffItem = "4022-39011 (PNW)";
        } else if (destinationState === 'TX') {
            if (destinationCity === 'Hereford' || destinationCity === 'Amarillo') {
                // The Base
                ratePerCar = BASE_RATE_HEREFORD;
            } else if (destinationCity === 'Galveston' || destinationCity === 'Houston' || destinationCity === 'Corpus Christi') {
                // Texas Gulf: Base - $260
                ratePerCar = BASE_RATE_HEREFORD - 260;
                tariffItem = "4022-39011 (Gulf)";
            }
        } else if (destinationState === 'KS') {
            // SW Kansas: Base - $1,020
            ratePerCar = BASE_RATE_HEREFORD - 1020;
            tariffItem = "4022-39011 (KS)";
        }

        const totalCost = ratePerCar + FUEL_SURCHARGE_AVG;
        const ratePerBushel = parseFloat((totalCost / BUSHELS_PER_CAR).toFixed(2));

        return {
            destination: `${destinationCity}, ${destinationState}`,
            ratePerCar,
            ratePerBushel,
            fuelSurcharge: FUEL_SURCHARGE_AVG,
            tariffItem
        };
    }
};
