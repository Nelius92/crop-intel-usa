import { Buyer } from '../types';
// import { googleMapsService } from './googleMapsService';

// This service is now mostly a fallback or utility since we fetch live data.
// Updating to match new types just in case.

// Key Corn Belt Hubs to search around
/*
const SEARCH_HUBS = [
    // Key Corn Belt & High-Demand Hubs (Ethanol, Feedlots, Export)
    { city: "Des Moines", state: "IA" }, // Ethanol
    { city: "Cedar Rapids", state: "IA" }, // Processing
    { city: "Fort Dodge", state: "IA" }, // Ethanol
    { city: "Sioux City", state: "IA" }, // Processing
    { city: "Blair", state: "NE" }, // Processing
    { city: "Omaha", state: "NE" },
    { city: "Columbus", state: "NE" }, // Ethanol
    { city: "Grand Island", state: "NE" }, // Processing
    { city: "Decatur", state: "IL" }, // Processing
    { city: "Peoria", state: "IL" }, // River
    { city: "Champaign", state: "IL" },
    { city: "Mankato", state: "MN" },
    { city: "Marshall", state: "MN" },
    { city: "Sioux Falls", state: "SD" },
    { city: "Aberdeen", state: "SD" },
    { city: "Kansas City", state: "MO" },
    { city: "St. Joseph", state: "MO" },
    { city: "Amarillo", state: "TX" }, // Feedlot Alley
    { city: "Hereford", state: "TX" }, // Feedlot Alley
    { city: "Lubbock", state: "TX" }, // South Plains
    { city: "Corpus Christi", state: "TX" }, // Export
    { city: "Dalhart", state: "TX" },
    { city: "Garden City", state: "KS" }, // Feedlots
    { city: "Dodge City", state: "KS" }, // Feedlots
    { city: "Guymon", state: "OK" }, // Feedlots
    { city: "Memphis", state: "TN" }, // River
    { city: "St. Louis", state: "MO" }, // River
    { city: "Cairo", state: "IL" }, // River Confluence

    // West Coast (Rail Destination Markets)
    { city: "Modesto", state: "CA" }, // Dairy/Poultry
    { city: "Fresno", state: "CA" }, // Dairy
    { city: "Tulare", state: "CA" }, // Dairy Capital
    { city: "Pasco", state: "WA" }, // PNW Export/Feed
    { city: "Yakima", state: "WA" }, // Dairy
    { city: "Jerome", state: "ID" }, // Dairy
    { city: "Casa Grande", state: "AZ" }, // Dairy

    // East Coast & Southeast (Poultry/Hog Markets)
    { city: "Gainesville", state: "GA" }, // Poultry Capital
    { city: "Dalton", state: "GA" },
    { city: "Clinton", state: "NC" }, // Hogs/Poultry
    { city: "Fayetteville", state: "NC" },
    { city: "Harrisonburg", state: "VA" }, // Poultry
    { city: "Millsboro", state: "DE" }, // Poultry
    { city: "Albany", state: "NY" }, // Ethanol/Feed

    // Southern Plains & Delta
    { city: "Little Rock", state: "AR" }, // Poultry
    { city: "Springdale", state: "AR" }, // Poultry HQ
    { city: "Guntersville", state: "AL" } // Poultry/River
];
*/

import { FALLBACK_BUYERS_DATA } from './fallbackData';
import { marketDataService } from './marketDataService';
import { usdaMarketService } from './usdaMarketService';

import { calculateFreight } from './railService';

export const fetchRealBuyersFromGoogle = async (): Promise<Buyer[]> => {
    // Return static data to save costs, but RECALCULATE prices based on live market & USDA Reports
    return new Promise((resolve) => {
        setTimeout(async () => {
            const currentFutures = marketDataService.getCurrentFuturesPrice();
            const regionalAdjustments = await usdaMarketService.getRegionalAdjustments();

            // We need to map over the buyers and await the async freight calc
            const dynamicBuyers = await Promise.all(FALLBACK_BUYERS_DATA.map(async (buyer) => {
                // Determine if we have a USDA "Truth" for this buyer's state
                let basis = buyer.basis;
                let state = buyer.state;

                // Map state to region key in our service
                let regionKey = "";
                if (state === "CA") regionKey = "California";
                else if (state === "WA") regionKey = "Washington";
                else if (state === "TX") regionKey = "Texas";
                else if (["IA", "NE", "IL", "MN", "ND", "SD", "OH"].includes(state)) regionKey = "Midwest";

                if (regionKey && regionalAdjustments[regionKey]) {
                    // OVERRIDE the basis with the official USDA report value
                    // This ensures "Hot Spots" are driven by the daily report
                    basis = regionalAdjustments[regionKey].basisAdjustment;
                }

                // Recalculate Cash Price: Futures + Basis
                const newCashPrice = currentFutures + basis;

                // Recalculate Freight using BNSF Rate Engine
                // We pass the buyer's location and name to the rail service
                const freightInfo = await calculateFreight({ lat: buyer.lat, lng: buyer.lng }, buyer.name);
                const newFreightCost = freightInfo.ratePerBushel;

                // Recalculate Net Price: Cash - Freight (Freight is a cost, so subtract it)
                // Note: In the JSON, freight might be stored as negative, but our service returns positive cost.
                // Net = Cash - Cost.
                const newNetPrice = newCashPrice - newFreightCost;

                return {
                    ...buyer,
                    basis: basis, // Update basis to reflect USDA report
                    freightCost: -newFreightCost, // Store as negative for display consistency if app expects it
                    cashPrice: parseFloat(newCashPrice.toFixed(2)),
                    netPrice: parseFloat(newNetPrice.toFixed(2))
                };
            }));

            resolve(dynamicBuyers);
        }, 500); // Simulate network delay
    });
};

// Deprecated: Mock generator (kept for fallback if needed, but unused in main flow)
export const generateBuyers = (_count: number): Buyer[] => {
    return [];
};

// New function to enrich buyer data with real-time Google Maps info
export const enrichBuyerWithGoogleData = async (buyer: Buyer): Promise<Buyer> => {
    // DISABLED to save costs. Return buyer as is.
    return buyer;
    /*
    // Search query: "Name City State"
    const query = `${buyer.name} ${buyer.city} ${buyer.state}`;
    const details = await googleMapsService.searchPlace(query);

    if (details) {
        return {
            ...buyer,
            fullAddress: details.formattedAddress || buyer.fullAddress,
            contactPhone: details.phoneNumber || buyer.contactPhone,
            website: details.websiteUri || buyer.website,
            rating: details.rating,
            userRatingsTotal: details.userRatingCount,
            googlePlaceId: details.placeId
        };
    }

    return buyer;
    */
};

export const getTop3BasisBuyers = (buyers: Buyer[]): Buyer[] => {
    // Sort by basis descending (highest basis is best for seller)
    return [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3);
};
