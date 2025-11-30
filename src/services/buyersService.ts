import { Buyer } from '../types';
import { googleMapsService } from './googleMapsService';

// This service is now mostly a fallback or utility since we fetch live data.
// Updating to match new types just in case.

// Key Corn Belt Hubs to search around
const SEARCH_HUBS = [
    { city: "Des Moines", state: "IA" },
    { city: "Omaha", state: "NE" },
    { city: "Decatur", state: "IL" },
    { city: "Mankato", state: "MN" },
    { city: "Sioux Falls", state: "SD" },
    { city: "Kansas City", state: "MO" },
    { city: "Amarillo", state: "TX" }, // Feedlot Alley
    { city: "Hereford", state: "TX" }, // Feedlot Alley
    { city: "Oklahoma City", state: "OK" },
    { city: "Grand Island", state: "NE" }
];

export const fetchRealBuyersFromGoogle = async (): Promise<Buyer[]> => {
    const allBuyers: Buyer[] = [];
    const seenIds = new Set<string>();

    // Parallel fetch for all hubs
    const promises = SEARCH_HUBS.map(async (hub) => {
        // Search for both elevators and feedlots/ethanol plants
        // We can do a broader search or multiple. "grain buyer" might be too generic.
        // Let's try "grain elevator" and "feedlot" for TX hubs.
        let term = "grain elevator";
        if (hub.state === "TX" || hub.state === "OK" || hub.state === "KS") {
            term = "feedlot";
        }
        const query = `${term} near ${hub.city}, ${hub.state}`;
        const places = await googleMapsService.searchNearbyPlaces(query);

        return places.map((place: any) => {
            if (seenIds.has(place.id)) return null;
            seenIds.add(place.id);

            // Map Google Place to Buyer
            // Note: Pricing data is simulated based on USDA regional averages since Google doesn't provide it.
            return {
                id: place.id,
                name: place.displayName?.text || "Unknown Buyer",
                type: 'elevator' as any, // Default type, cast to any to avoid strict literal check issues
                basis: 0.30 + (Math.random() * 0.4 - 0.2), // Simulated variation around market avg
                cashPrice: 4.50 + (Math.random() * 0.2 - 0.1), // Simulated variation
                city: hub.city,
                state: hub.state,
                region: `${hub.city} Region`,
                lat: place.location?.latitude || 0,
                lng: place.location?.longitude || 0,
                railAccessible: Math.random() > 0.4, // Simulated
                nearTransload: Math.random() > 0.6, // Simulated
                fullAddress: place.formattedAddress,
                contactPhone: place.nationalPhoneNumber,
                website: place.websiteUri,
                rating: place.rating,
                userRatingsTotal: place.userRatingCount,
                googlePlaceId: place.id
            } as Buyer;
        }).filter((b): b is Buyer => b !== null);
    });

    const results = await Promise.all(promises);
    results.forEach(hubBuyers => allBuyers.push(...hubBuyers));

    return allBuyers;
};

// Deprecated: Mock generator (kept for fallback if needed, but unused in main flow)
export const generateBuyers = (_count: number): Buyer[] => {
    return [];
};

// New function to enrich buyer data with real-time Google Maps info
export const enrichBuyerWithGoogleData = async (buyer: Buyer): Promise<Buyer> => {
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
};

export const getTop3BasisBuyers = (buyers: Buyer[]): Buyer[] => {
    // Sort by basis descending (highest basis is best for seller)
    return [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3);
};
