import type { Buyer, HeatmapPoint, Transloader } from '../../types';
import type { BNSFOpportunity } from '../../services/bnsfScraperService';

export type DrawerItem = HeatmapPoint | Buyer | Transloader | BNSFOpportunity | null;

export function isBuyer(item: DrawerItem): item is Buyer {
    return !!item
        && 'type' in item
        && ['elevator', 'processor', 'feedlot', 'shuttle', 'export', 'river', 'ethanol', 'crush'].includes(item.type);
}

export function isTransloader(item: DrawerItem): item is Transloader {
    return !!item && 'type' in item && item.type === 'transload';
}

export function isBnsfOpportunity(item: DrawerItem): item is BNSFOpportunity {
    return !!item && 'livePriceBase' in item;
}
