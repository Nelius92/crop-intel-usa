// Google Maps Places API Service

// Google Maps Places API Service
// Using the JavaScript API to avoid CORS issues with the REST endpoint in browser

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let googleMapsLoadedPromise: Promise<void> | null = null;

// Declare google on window to avoid TS errors
declare global {
    interface Window {
        google: any;
    }
}

const loadGoogleMapsScript = () => {
    if (googleMapsLoadedPromise) return googleMapsLoadedPromise;

    googleMapsLoadedPromise = new Promise((resolve, reject) => {
        if (window.google && window.google.maps && window.google.maps.places) {
            resolve();
            return;
        }

        // Check if script is already in DOM
        const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
            // Wait for it to load
            let attempts = 0;
            const check = setInterval(() => {
                attempts++;
                if (window.google && window.google.maps && window.google.maps.places) {
                    clearInterval(check);
                    resolve();
                } else if (attempts > 50) { // 5 seconds timeout
                    clearInterval(check);
                    reject(new Error("Google Maps script found but failed to initialize 'places' library within timeout."));
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            // Double check that the object is actually available
            if (window.google && window.google.maps && window.google.maps.places) {
                resolve();
            } else {
                // Sometimes onload fires before the global object is fully ready? Unlikely but safe to check.
                let attempts = 0;
                const check = setInterval(() => {
                    attempts++;
                    if (window.google && window.google.maps && window.google.maps.places) {
                        clearInterval(check);
                        resolve();
                    } else if (attempts > 20) {
                        clearInterval(check);
                        reject(new Error("Google Maps script loaded but 'places' library missing."));
                    }
                }, 100);
            }
        };
        script.onerror = (err) => {
            googleMapsLoadedPromise = null; // Reset so we can try again
            reject(new Error(`Failed to load Google Maps script: ${err}`));
        };
        document.head.appendChild(script);
    });
    return googleMapsLoadedPromise;
};

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
        if (!API_KEY) {
            console.warn("Google Maps API Key missing.");
            return null;
        }
        await loadGoogleMapsScript();

        return new Promise((resolve) => {
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            const request = {
                query: query,
                fields: ['name', 'formatted_address', 'place_id', 'geometry', 'rating', 'user_ratings_total']
            };

            service.findPlaceFromQuery(request, (results: any[], status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
                    const place = results[0];
                    // Need to fetch details to get phone/website as they might not be in findPlaceFromQuery basic fields depending on billing
                    // But findPlaceFromQuery supports fields. Let's try to get details if needed.
                    // Actually, findPlaceFromQuery has limited fields. textSearch is better or getDetails.

                    // Let's use getDetails for the specific place if we found one, or just return what we have.
                    // To get website/phone, we need getDetails.
                    service.getDetails({
                        placeId: place.place_id!,
                        fields: ['formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'url', 'place_id']
                    }, (placeDetails: any, detailStatus: any) => {
                        if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK && placeDetails) {
                            resolve({
                                formattedAddress: placeDetails.formatted_address,
                                phoneNumber: placeDetails.formatted_phone_number,
                                websiteUri: placeDetails.website,
                                rating: placeDetails.rating,
                                userRatingCount: placeDetails.user_ratings_total,
                                googleMapsUri: placeDetails.url,
                                placeId: placeDetails.place_id
                            });
                        } else {
                            resolve(null);
                        }
                    });
                } else {
                    console.error("Google Places Search Error:", status);
                    resolve(null);
                }
            });
        });
    },

    async searchNearbyPlaces(query: string): Promise<any[]> {
        if (!API_KEY) return [];
        await loadGoogleMapsScript();

        return new Promise((resolve) => {
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            service.textSearch({ query }, (results: any[], status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                    // Map JS API results to a format similar to our previous REST API expectation or just raw
                    // We need to adapt the consumer (buyersService) if the structure is different.
                    // REST API: { formattedAddress, nationalPhoneNumber, ... }
                    // JS API: { formatted_address, name, place_id, ... }

                    // Let's map it here to match the REST API structure we used in buyersService
                    const mappedResults = results.map((place: any) => ({
                        id: place.place_id,
                        displayName: { text: place.name },
                        formattedAddress: place.formatted_address,
                        location: {
                            latitude: place.geometry?.location?.lat(),
                            longitude: place.geometry?.location?.lng()
                        },
                        rating: place.rating,
                        userRatingCount: place.user_ratings_total,
                        // Note: textSearch results don't include phone/website usually. 
                        // We might need to fetch details on demand or accept that the list view has less info.
                        // For now, we return what we have. The 'enrich' step in buyersService calls searchPlace (which calls getDetails) so that will fill in the gaps.
                    }));
                    resolve(mappedResults);
                } else {
                    console.error(`Google Places TextSearch Error for query "${query}":`, status);
                    // If ZERO_RESULTS, it's not an API error, just no results.
                    if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                        console.warn("No results found for query:", query);
                    }
                    resolve([]);
                }
            });
        });
    }
};
