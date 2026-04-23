import type { Buyer, BuyerType } from '../../types';
import type { BuyerFilters } from './types';

export function applyFilters(buyers: Buyer[], filters?: BuyerFilters): Buyer[] {
    if (!filters) {
        return buyers;
    }

    let result = buyers;
    if (filters.buyerType) result = result.filter((buyer) => buyer.type === filters.buyerType);
    if (filters.state) result = result.filter((buyer) => buyer.state === filters.state);
    if (filters.region) {
        result = result.filter((buyer) => buyer.region?.toLowerCase().includes(filters.region!.toLowerCase()));
    }
    if (filters.bnsfServedOnly) {
        result = result.filter((buyer) => (buyer.railConfidence ?? 0) >= 70);
    } else if (filters.minRailConfidence !== undefined) {
        result = result.filter((buyer) => (buyer.railConfidence ?? 0) >= filters.minRailConfidence!);
    }
    if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        result = result.filter((buyer) =>
            buyer.name.toLowerCase().includes(query)
            || buyer.city.toLowerCase().includes(query)
            || buyer.region?.toLowerCase().includes(query)
        );
    }
    return result;
}

export function getOrganicBuyers(buyers: Buyer[]): Buyer[] {
    return buyers.filter((buyer) => buyer.organic);
}

export function getConventionalBuyers(buyers: Buyer[]): Buyer[] {
    return buyers.filter((buyer) => !buyer.organic);
}

export function getTopNetPriceBuyers(buyers: Buyer[], count = 5): Buyer[] {
    return [...buyers]
        .sort((left, right) => (right.netPrice ?? 0) - (left.netPrice ?? 0))
        .slice(0, count);
}

export function getTop3BasisBuyers(buyers: Buyer[]): Buyer[] {
    return [...buyers]
        .filter((buyer) => buyer.basis !== undefined)
        .sort((left, right) => (right.basis ?? 0) - (left.basis ?? 0))
        .slice(0, 3);
}

export function getRailAccessibleBuyers(buyers: Buyer[]): Buyer[] {
    return buyers.filter((buyer) => buyer.railAccessible);
}

export function getBNSFServedBuyers(buyers: Buyer[], minConfidence = 70): Buyer[] {
    return buyers.filter((buyer) => (buyer.railConfidence ?? 0) >= minConfidence);
}

export function getBuyersByState(buyers: Buyer[], state: string): Buyer[] {
    return buyers.filter((buyer) => buyer.state === state);
}

export function getUniqueStates(buyers: Buyer[]): string[] {
    return [...new Set(buyers.map((buyer) => buyer.state))].sort();
}

export function getUniqueBuyerTypes(buyers: Buyer[]): BuyerType[] {
    return [...new Set(buyers.map((buyer) => buyer.type))].sort() as BuyerType[];
}

export function getBuyersByRegion(buyers: Buyer[], region: string): Buyer[] {
    return [...buyers]
        .filter((buyer) => buyer.region?.toLowerCase().includes(region.toLowerCase()))
        .sort((left, right) => (right.netPrice ?? 0) - (left.netPrice ?? 0));
}
