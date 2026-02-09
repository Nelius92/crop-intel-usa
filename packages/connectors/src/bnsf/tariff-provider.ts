import { RailRate, RateProvider } from './types.js';

// Constants based on BNSF Tariff 4022 (2025/2026)
const BUSHELS_PER_CAR = 4000;
const FUEL_SURCHARGE_AVG = 250;
const BASE_RATE_HEREFORD = 4400;

/**
 * Tariff-based rate provider (fallback when BNSF API unavailable)
 * Based on BNSF Tariff 4022 for 2025/2026 Marketing Year
 */
export class TariffRateProvider implements RateProvider {
    async getRates(origin: string, destinationFull: string): Promise<RailRate> {
        // Parse destination (e.g. "Hereford, TX" -> city: "Hereford", state: "TX")
        const [city, state] = destinationFull.split(',').map(s => s.trim());

        let ratePerCar = BASE_RATE_HEREFORD;
        let tariffItem = '4022-39011'; // General Corn Tariff

        // Apply Official 2025 Tariff Differentials
        if (state === 'CA') {
            // California Central Valley: Base + $960
            ratePerCar = BASE_RATE_HEREFORD + 960;
            tariffItem = '4022-39013 (CA)';
        } else if (state === 'WA' || state === 'OR') {
            // PNW Export: Base + $600
            ratePerCar = BASE_RATE_HEREFORD + 600;
            tariffItem = '4022-39011 (PNW)';
        } else if (state === 'TX') {
            if (city === 'Hereford' || city === 'Amarillo') {
                // The Base
                ratePerCar = BASE_RATE_HEREFORD;
            } else if (['Galveston', 'Houston', 'Corpus Christi'].includes(city)) {
                // Texas Gulf: Base - $260
                ratePerCar = BASE_RATE_HEREFORD - 260;
                tariffItem = '4022-39011 (Gulf)';
            }
        } else if (state === 'KS') {
            // SW Kansas: Base - $1,020
            ratePerCar = BASE_RATE_HEREFORD - 1020;
            tariffItem = '4022-39011 (KS)';
        }

        const totalCost = ratePerCar + FUEL_SURCHARGE_AVG;
        const ratePerBushel = parseFloat((totalCost / BUSHELS_PER_CAR).toFixed(2));

        return {
            origin,
            destination: destinationFull,
            destination_city: city,
            destination_state: state,
            ratePerCar,
            ratePerBushel,
            fuelSurcharge: FUEL_SURCHARGE_AVG,
            tariffItem,
        };
    }
}
