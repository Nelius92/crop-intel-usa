import type { BuyerType } from '../../types';
import { FALLBACK_BUYERS_DATA } from '../fallbackData';
import { apiGetJson } from '../apiClient';
import type { ApiBuyerDirectoryRecord } from './types';

function fallbackBuyerId(record: { id?: string; name: string; state: string; city: string }): string {
    if (record.id) {
        return record.id;
    }
    const slug = `${record.name}-${record.city}-${record.state}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `fallback-${slug}`;
}

export async function fetchBuyerDirectoryRecords(crop: string): Promise<ApiBuyerDirectoryRecord[]> {
    try {
        const result = await apiGetJson<{ data: ApiBuyerDirectoryRecord[] }>(
            `/api/buyers?scope=all&crop=${encodeURIComponent(crop)}`
        );
        return result.data || [];
    } catch (error) {
        console.warn('API unavailable, falling back to local buyer data.', (error as Error).message);
        return FALLBACK_BUYERS_DATA
            .filter((buyer) => (buyer.cropType || 'Yellow Corn') === crop)
            .map((buyer) => ({
                id: fallbackBuyerId(buyer),
                name: buyer.name,
                type: buyer.type as BuyerType,
                city: buyer.city,
                state: buyer.state,
                region: buyer.region || 'Unknown',
                lat: buyer.lat,
                lng: buyer.lng,
                cropType: buyer.cropType,
                organic: buyer.organic ?? false,
                railConfidence: buyer.railConfidence ?? undefined,
                contactRole: buyer.contactName ?? 'Grain Desk',
                facilityPhone: buyer.contactPhone ?? undefined,
                website: buyer.website ?? undefined,
                verifiedStatus: buyer.verified ? 'verified' : 'unverified',
                contactConfidenceScore: buyer.confidenceScore ?? undefined,
                nearTransload: buyer.nearTransload ?? false,
                railAccessible: buyer.railAccessible ?? false,
                cashBid: buyer.cashPrice ?? null,
                postedBasis: buyer.basis ?? null,
                bidDate: buyer.lastUpdated ?? null,
                bidSource: buyer.dataSource ?? null,
            }));
    }
}
