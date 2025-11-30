// USDA AgTransport API Service
// Documentation: https://api.transportation.usda.gov/

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
            // Using a public dataset endpoint from USDA (Example: Rail Tariff Rates)
            // In a real scenario, we'd query a specific dataset ID.
            // For now, we'll simulate a fetch to a known open data endpoint or return a realistic "live" value
            // if the API requires a key we don't have yet.

            // Attempting to fetch from a known open endpoint for GTR data
            const response = await fetch('https://api.transportation.usda.gov/wips/services/GTR/RailRates?format=json');

            if (!response.ok) {
                console.warn('USDA API fetch failed, using fallback.');
                return null;
            }

            const data = await response.json();
            // Parse data to find relevant rate...
            // For this implementation, we will assume the API returns a list and we take the latest.
            return data[0]?.rate_per_car || null;
        } catch (error) {
            console.error('Error fetching USDA data:', error);
            return null;
        }
    }
};
