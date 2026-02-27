import { env } from '../env.js';

export interface GooglePlaceCandidate {
    placeId: string;
    name: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
}

export interface GooglePlaceDetails {
    placeId: string;
    name?: string;
    formattedAddress?: string;
    phone?: string;
    website?: string;
    mapsUrl?: string;
    lat?: number;
    lng?: number;
}

function getApiKey(): string {
    if (!env.GOOGLE_MAPS_API_KEY) {
        throw new Error('GOOGLE_MAPS_API_KEY is required for buyer contact sync');
    }
    return env.GOOGLE_MAPS_API_KEY;
}

export async function searchGooglePlaces(query: string): Promise<GooglePlaceCandidate[]> {
    const apiKey = getApiKey();

    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id,name,formatted_address,geometry');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
        throw new Error(`Google Places findplace failed with ${response.status}`);
    }

    const data = await response.json() as {
        status?: string;
        error_message?: string;
        candidates?: Array<{
            place_id?: string;
            name?: string;
            formatted_address?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
        }>;
    };

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places findplace status=${data.status}${data.error_message ? ` (${data.error_message})` : ''}`);
    }

    return (data.candidates ?? [])
        .filter((c) => c.place_id)
        .map((c) => ({
            placeId: c.place_id as string,
            name: c.name ?? '',
            formattedAddress: c.formatted_address,
            lat: c.geometry?.location?.lat,
            lng: c.geometry?.location?.lng,
        }));
}

export async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
    const apiKey = getApiKey();
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,website,url,geometry');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
        throw new Error(`Google Places details failed with ${response.status}`);
    }

    const data = await response.json() as {
        status?: string;
        error_message?: string;
        result?: {
            place_id?: string;
            name?: string;
            formatted_address?: string;
            formatted_phone_number?: string;
            website?: string;
            url?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
        };
    };

    if (data.status && data.status !== 'OK') {
        throw new Error(`Google Places details status=${data.status}${data.error_message ? ` (${data.error_message})` : ''}`);
    }

    return {
        placeId: data.result?.place_id ?? placeId,
        name: data.result?.name,
        formattedAddress: data.result?.formatted_address,
        phone: data.result?.formatted_phone_number,
        website: data.result?.website,
        mapsUrl: data.result?.url,
        lat: data.result?.geometry?.location?.lat,
        lng: data.result?.geometry?.location?.lng,
    };
}
