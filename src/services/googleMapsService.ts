import { apiGetJson } from './apiClient';

export interface PlaceDetails {
    formattedAddress?: string;
    phoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    placeId?: string;
}

export const googleMapsService = {
    async searchPlace(query: string): Promise<PlaceDetails | null> {
        try {
            const result = await apiGetJson<{ data: any[] }>(`/api/places/search?q=${encodeURIComponent(query)}`);
            const candidates = result.data || [];
            if (candidates.length > 0 && candidates[0].placeId) {
                const placeId = candidates[0].placeId;
                const detailsResult = await apiGetJson<{ data: any }>(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
                const details = detailsResult.data;
                if (!details) return null;

                return {
                    formattedAddress: details.formattedAddress,
                    phoneNumber: details.phone,
                    websiteUri: details.website,
                    rating: details.rating,
                    userRatingCount: details.userRatingCount,
                    googleMapsUri: details.mapsUrl,
                    placeId: details.placeId
                };
            }
            return null;
        } catch (error) {
            console.error("Google Places API Proxy Error:", error);
            return null;
        }
    },

    async searchNearbyPlaces(query: string): Promise<any[]> {
        try {
            const result = await apiGetJson<{ data: any[] }>(`/api/places/search?q=${encodeURIComponent(query)}`);
            const candidates = result.data || [];

            return candidates.map(place => ({
                id: place.placeId,
                displayName: { text: place.name },
                formattedAddress: place.formattedAddress,
                location: {
                    latitude: place.lat,
                    longitude: place.lng
                }
            }));
        } catch (error) {
            console.error(`Google Places Proxy Error for query "${query}":`, error);
            return [];
        }
    }
};

