// USDA AgTransport API Service
// Documentation: https://api.transportation.usda.gov/
import { apiGetJson } from './apiClient';

export interface RailRateData {
    week_ending_date: string;
    origin_region: string;
    destination_region: string;
    rate_per_car: number;
    fuel_surcharge_per_car: number;
    total_cost_per_car: number;
}

export const usdaService = {
    // Fetch latest rail cost data
    // Note: Since we don't have a specific endpoint for "Campbell MN to X", 
    // we'll fetch the "Grain Transportation Report" dataset for context
    // and use the latest "St. Louis" or "PNW" index as a baseline for our dynamic calculations.

    async getLatestRailRates(): Promise<number | null> {
        try {
            const response = await apiGetJson<{
                success: boolean;
                futuresPrice?: number;
                source?: string;
            }>('/api/usda/futures-price');

            // This service historically returned rail-rate context; we now proxy through backend and
            // use the futures endpoint only as a connectivity/freshness signal.
            if (!response.success) {
                return null;
            }

            return response.futuresPrice ?? null;
        } catch (error) {
            console.error('Error fetching USDA proxy data:', error);
            return null;
        }
    }
};
