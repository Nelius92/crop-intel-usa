import { Buyer } from '../types';
// import { googleMapsService } from './googleMapsService';

// This service fetches and enriches buyer data with live market prices
// Prices are calculated using: Cash = Futures + Basis, Net = Cash - Freight

import { FALLBACK_BUYERS_DATA } from './fallbackData';
import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';
import { calculateFreight } from './railService';

export const fetchRealBuyersFromGoogle = async (): Promise<Buyer[]> => {
    // Fetch live market data
    const currentFutures = marketDataService.getCurrentFuturesPrice();
    const regionalAdjustments = await usdaMarketService.getRegionalAdjustments();

    // Get Hankinson benchmark for comparison
    const hankinsonBenchmark = marketDataService.getHankinsonBenchmark();

    // Calculate dynamic prices for each buyer
    const dynamicBuyers = await Promise.all(FALLBACK_BUYERS_DATA.map(async (buyer) => {
        // Get USDA basis for this buyer's region
        const regionKey = usdaMarketService.getRegionForState(buyer.state);
        let basis = buyer.basis;

        // Override basis with official USDA report if available
        if (regionKey && regionalAdjustments[regionKey]) {
            basis = regionalAdjustments[regionKey].basisAdjustment;
        }

        // Calculate Cash Price: Futures + Basis
        const newCashPrice = currentFutures + basis;

        // Calculate Freight FROM Campbell, MN TO this buyer
        const freightInfo = await calculateFreight(
            { lat: buyer.lat, lng: buyer.lng, state: buyer.state, city: buyer.city },
            buyer.name
        );
        const newFreightCost = freightInfo.ratePerBushel;

        // Calculate Net Price: Cash - Freight (what you receive)
        const newNetPrice = newCashPrice - newFreightCost;

        // Calculate difference vs Hankinson benchmark
        // Positive = better than selling at Hankinson, Negative = worse
        const benchmarkDiff = parseFloat((newNetPrice - hankinsonBenchmark.cashPrice).toFixed(2));

        return {
            ...buyer,
            basis: parseFloat(basis.toFixed(2)),
            freightCost: parseFloat((-newFreightCost).toFixed(2)), // Negative for display
            cashPrice: parseFloat(newCashPrice.toFixed(2)),
            netPrice: parseFloat(newNetPrice.toFixed(2)),
            futuresPrice: currentFutures,
            benchmarkDiff, // + means better than Hankinson, - means worse
            dataSource: regionalAdjustments[regionKey]?.source || 'fallback'
        };
    }));

    return dynamicBuyers;
};

// Get top buyers by NET PRICE (highest net price = best deal for seller)
export const getTopNetPriceBuyers = (buyers: Buyer[], count: number = 5): Buyer[] => {
    return [...buyers]
        .sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0))
        .slice(0, count);
};

// Get top buyers by BASIS (useful for seeing market strength)
export const getTop3BasisBuyers = (buyers: Buyer[]): Buyer[] => {
    return [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3);
};

// Get buyers near BNSF rail (prioritize rail-accessible buyers)
export const getRailAccessibleBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => b.railAccessible);
};

// Get buyers sorted by net price, filtered by region
export const getBuyersByRegion = (buyers: Buyer[], region: string): Buyer[] => {
    return [...buyers]
        .filter(b => b.region?.toLowerCase().includes(region.toLowerCase()))
        .sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0));
};

// Deprecated mock generator
export const generateBuyers = (_count: number): Buyer[] => {
    return [];
};

// Enrich buyer with Google Maps data (disabled to save API costs)
export const enrichBuyerWithGoogleData = async (buyer: Buyer): Promise<Buyer> => {
    return buyer;
};

// Get market data freshness info
export const getMarketDataInfo = async (): Promise<{ futuresPrice: number; dataSource: string; lastUpdated: string }> => {
    const marketData = marketDataService.getMarketData();
    const usadData = usdaMarketService.getDataFreshness();

    return {
        futuresPrice: marketData.futuresPrice,
        dataSource: `${marketData.source} / ${usadData.source}`,
        lastUpdated: usadData.lastUpdated
    };
};

