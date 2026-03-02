import { Buyer, CropType } from '../types';
import { apiGetJson } from './apiClient';

interface MorningRecommendationApiResponse {
    run: {
        id: string;
        cropType: string;
        startedAt: string;
        endedAt: string | null;
        topStates: string[];
    };
    topStates: string[];
    data: Array<{
        rank: number;
        compositeScore: number;
        cashBid: number | null;
        basis: number | null;
        futuresPrice: number | null;
        estimatedFreight: number | null;
        estimatedNetBid: number | null;
        bidSourceKind: string | null;
        buyer: {
            id: string;
            externalSeedKey?: string | null;
            name: string;
            type: Buyer['type'];
            city: string;
            state: string;
            region: string;
            lat: number;
            lng: number;
            cropType: string;
            organic: boolean;
            railConfidence: number | null;
            contactRole: string | null;
            facilityPhone: string | null;
            website: string | null;
            verifiedStatus: 'verified' | 'needs_review' | 'unverified' | null;
            contactConfidenceScore: number | null;
        };
    }>;
}

export interface MorningRecommendationResult {
    buyers: Buyer[];
    topStates: string[];
    runEndedAt: string | null;
    runStartedAt: string;
}

export async function fetchMorningRecommendationBuyers(
    crop: CropType
): Promise<MorningRecommendationResult | null> {
    try {
        const response = await apiGetJson<MorningRecommendationApiResponse>(
            `/api/recommendations/morning?crop=${encodeURIComponent(crop)}&scope=corridor&verifiedOnly=true&limit=30`
        );

        const buyers: Buyer[] = (response.data || []).map((item) => {
            const railConfidence = item.buyer.railConfidence ?? 0;
            const estimatedFreight = item.estimatedFreight ?? 0;
            const cashPrice = item.cashBid ?? ((item.futuresPrice ?? 0) + (item.basis ?? 0));
            const netPrice = item.estimatedNetBid ?? (cashPrice - estimatedFreight);

            return {
                id: item.buyer.id,
                name: item.buyer.name,
                type: item.buyer.type,
                city: item.buyer.city,
                state: item.buyer.state,
                region: item.buyer.region,
                lat: item.buyer.lat,
                lng: item.buyer.lng,
                cropType: item.buyer.cropType as CropType,
                organic: item.buyer.organic,
                basis: Number((item.basis ?? 0).toFixed(2)),
                cashPrice: Number(cashPrice.toFixed(2)),
                railAccessible: railConfidence >= 40,
                nearTransload: false,
                contactName: item.buyer.contactRole ?? 'Grain Desk',
                contactPhone: item.buyer.facilityPhone ?? undefined,
                website: item.buyer.website ?? undefined,
                netPrice: Number(netPrice.toFixed(2)),
                freightCost: Number((-Math.abs(estimatedFreight)).toFixed(2)),
                freightMode: railConfidence >= 70 ? 'rail' : 'truck',
                futuresPrice: item.futuresPrice ?? undefined,
                verified: item.buyer.verifiedStatus === 'verified',
                confidenceScore: item.buyer.contactConfidenceScore ?? undefined,
                railConfidence,
                dataSource: item.bidSourceKind ?? 'morning-recommendations',
                lastUpdated: response.run.endedAt ?? response.run.startedAt,
            };
        });

        return {
            buyers,
            topStates: response.topStates || response.run.topStates || [],
            runEndedAt: response.run.endedAt,
            runStartedAt: response.run.startedAt,
        };
    } catch {
        return null;
    }
}

