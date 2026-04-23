import opportunitiesData from '../data/bnsf_opportunities.json';
import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';

export interface Location {
    lat: number;
    lng: number;
    city: string;
    state: string;
}

export interface BNSFOpportunity {
    id: string;
    name: string;
    category: 'grain_elevator' | 'ethanol_plant' | 'feedlot' | 'pet_food' | string;
    location: Location;
    capacity?: string;
    railAccessible: boolean;
    contactInfo: string;
    livePriceBase: number;
    currentPrice?: number;
    freightRateOverride: number;
    managerName?: string;
    operatingHours?: string;
    website?: string;
}

export const bnsfOpportunitiesService = {
    getOpportunities: (): BNSFOpportunity[] => {
        return opportunitiesData as BNSFOpportunity[];
    },

    // Fetch real-time futures price and USDA regional basis
    getLiveOpportunities: async (crop: string = 'Yellow Corn'): Promise<BNSFOpportunity[]> => {
        const marketData = marketDataService.getCropMarketData(crop);
        const futures = marketData.futuresPrice;
        const usdaAdjustments = await usdaMarketService.getRegionalAdjustments();

        return (opportunitiesData as BNSFOpportunity[]).map(opp => {
            const region = usdaMarketService.getRegionForState(opp.location.state);
            const regionalAdj = usdaAdjustments[region];
            const basis = regionalAdj?.basisAdjustment ?? -0.30;
            const livePrice = futures + basis;

            return {
                ...opp,
                currentPrice: Number(livePrice.toFixed(2))
            };
        });
    }
};
