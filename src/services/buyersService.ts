import { Buyer, PriceProvenance, getOverallConfidence } from '../types';
// import { googleMapsService } from './googleMapsService';

// This service fetches and enriches buyer data with live market prices
// Prices are calculated using: Cash = Futures + Basis, Net = Cash - Freight

import { FALLBACK_BUYERS_DATA } from './fallbackData';
import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';
import { calculateFreight } from './railService';

export const fetchRealBuyersFromGoogle = async (selectedCrop: string = 'Yellow Corn'): Promise<Buyer[]> => {
    // Filter by crop type first
    const filteredBuyers = FALLBACK_BUYERS_DATA.filter(b =>
        (b.cropType || 'Yellow Corn') === selectedCrop
    );

    // Fetch live market data for the SPECIFIC CROP
    const marketData = marketDataService.getCropMarketData(selectedCrop);
    const currentFutures = marketData.futuresPrice;

    // Trust Layer: get provenance for futures price
    const futuresSource = marketDataService.getFuturesSource(selectedCrop);

    // USDA regional adjustments (currently only for Corn, defaults to 0 others)
    const regionalAdjustments = await usdaMarketService.getRegionalAdjustments();

    // Get Hankinson benchmark for comparison
    const hankinsonBenchmark = {
        cashPrice: marketData.hankinsonCashPrice
    };

    const now = new Date().toISOString();

    // Calculate dynamic prices for each buyer
    const dynamicBuyers = await Promise.all(filteredBuyers.map(async (buyer) => {
        // Get USDA basis for this buyer's region
        const regionKey = usdaMarketService.getRegionForState(buyer.state);
        let basis = buyer.basis;
        let basisFromUSDA = false;

        // Override basis with official USDA report if available AND it's corn
        if (selectedCrop === 'Yellow Corn' && regionKey && regionalAdjustments[regionKey]) {
            basis = regionalAdjustments[regionKey].basisAdjustment;
            basisFromUSDA = true;
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

        // Calculate difference vs Hankinson benchmark for this crop
        const benchmarkDiff = parseFloat((newNetPrice - hankinsonBenchmark.cashPrice).toFixed(2));

        // Build Trust Layer provenance
        const provenance: PriceProvenance = {
            futures: futuresSource,
            basis: {
                value: basis,
                confidence: basisFromUSDA ? 'verified' : 'estimated',
                source: basisFromUSDA ? `USDA AMS (${regionalAdjustments[regionKey]?.source || 'Regional'})` : 'Regional Estimate',
                timestamp: now,
                staleAfterMinutes: 60
            },
            freight: {
                value: newFreightCost,
                confidence: 'estimated',
                source: `BNSF Tariff 4022 · ${freightInfo.origin || 'Campbell, MN'}`,
                timestamp: now,
                staleAfterMinutes: 1440 // Daily
            },
            fees: {
                value: 0,
                confidence: 'verified',
                source: 'None',
                timestamp: now,
                staleAfterMinutes: 99999
            }
        };

        return {
            ...buyer,
            basis: parseFloat(basis.toFixed(2)),
            freightCost: parseFloat((-newFreightCost).toFixed(2)),
            cashPrice: parseFloat(newCashPrice.toFixed(2)),
            netPrice: parseFloat(newNetPrice.toFixed(2)),
            futuresPrice: currentFutures,
            contractMonth: marketData.contractMonth,
            benchmarkDiff,
            lastUpdated: now,
            verified: getOverallConfidence(provenance) === 'verified',
            provenance
        };
    }));

    return dynamicBuyers;
};

// Helper: Get organic buyers
export const getOrganicBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => b.organic);
};

// Helper: Get conventional buyers
export const getConventionalBuyers = (buyers: Buyer[]): Buyer[] => {
    return buyers.filter(b => !b.organic);
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

