import type { Buyer, CropType } from '../../types';
import { DEFAULT_CROP, normalizeCropForUsda } from '../../../shared/crops.js';
import { convertFreightToCropUnit, getCropPriceUnit } from '../bnsfService';
import { cacheService, CACHE_TTL } from '../cacheService';
import { marketDataService } from '../marketDataService';
import { enrichBuyersWithRailConfidence } from '../railConfidenceService';
import { calculateFreight } from '../railService';
import { TRANSLOADERS } from '../transloaderService';
import { usdaMarketService } from '../usdaMarketService';
import { normalizeFreightData } from '../../utils/freightNormalizer';
import { fetchBuyerDirectoryRecords } from './api';
import { applyFilters } from './filters';
import { getBestScrapedBid, getNewScrapedBuyers, loadLiveBids } from './liveBids';
import type { BuyerFilters } from './types';

const MAX_FREIGHT_BY_CROP: Record<string, number> = {
    'Yellow Corn': 5.0,
    'White Corn': 5.0,
    'Soybeans': 5.0,
    'Wheat': 5.0,
    'Sunflowers': 20.0,
};

export async function fetchRealBuyersFromGoogle(
    selectedCrop: string = DEFAULT_CROP,
    filters?: BuyerFilters,
    forceRefresh = false
): Promise<Buyer[]> {
    const cacheKey = selectedCrop;
    if (!forceRefresh) {
        const cached = cacheService.get<Buyer[]>('buyers', cacheKey);
        if (cached) {
            return applyFilters(cached, filters);
        }
    }

    const apiRecords = await fetchBuyerDirectoryRecords(selectedCrop);
    let filteredBuyers: Buyer[] = apiRecords.map((record) => ({
        id: record.id,
        name: record.name,
        type: record.type,
        city: record.city,
        state: record.state,
        lat: record.lat,
        lng: record.lng,
        region: record.region,
        cropType: (record.cropType as CropType | undefined) ?? (selectedCrop as CropType),
        organic: record.organic ?? false,
        contactName: record.contactRole ?? 'Grain Desk',
        contactPhone: record.facilityPhone ?? undefined,
        website: record.website ?? undefined,
        confidenceScore: record.contactConfidenceScore ?? undefined,
        verified: record.verifiedStatus === 'verified',
        railConfidence: record.railConfidence ?? undefined,
        dataSource: 'api-directory',
        cashBid: record.cashBid ?? null,
        postedBasis: record.postedBasis ?? null,
        bidDate: record.bidDate ?? undefined,
        bidSource: record.bidSource ?? undefined,
        basis: 0,
        cashPrice: 0,
        railAccessible: (record.railConfidence ?? 0) >= 40,
        nearTransload: record.nearTransload ?? false,
    }));

    filteredBuyers = filteredBuyers.filter((buyer) => (buyer.cropType || DEFAULT_CROP) === selectedCrop);

    const liveBids = await loadLiveBids();
    if (liveBids && liveBids.bids.length > 0) {
        let enrichedCount = 0;

        for (const buyer of filteredBuyers) {
            if (buyer.cashBid != null) {
                continue;
            }

            const scrapedBid = getBestScrapedBid(liveBids, buyer.name, selectedCrop);
            if (!scrapedBid) {
                continue;
            }

            buyer.cashBid = scrapedBid.cashBid;
            buyer.postedBasis = scrapedBid.basis;
            buyer.bidDate = scrapedBid.scrapedAt;
            buyer.bidSource = `${scrapedBid.source} (${scrapedBid.sourceUrl || 'scraped'})`;
            enrichedCount++;
        }

        const existingNames = new Set(filteredBuyers.map((buyer) => buyer.name));
        const newScrapedBuyers = getNewScrapedBuyers(liveBids, existingNames, selectedCrop);
        for (const record of newScrapedBuyers) {
            filteredBuyers.push({
                id: record.id,
                name: record.name,
                type: record.type,
                city: record.city,
                state: record.state,
                lat: record.lat ?? 0,
                lng: record.lng ?? 0,
                region: record.region,
                cropType: (record.cropType as CropType) ?? (selectedCrop as CropType),
                organic: false,
                contactName: 'Grain Desk',
                verified: true,
                railConfidence: undefined,
                dataSource: 'morning-scan',
                cashBid: record.cashBid,
                postedBasis: record.postedBasis,
                bidDate: record.bidDate ?? undefined,
                bidSource: record.bidSource ?? undefined,
                basis: 0,
                cashPrice: 0,
                railAccessible: false,
                nearTransload: false,
            });
        }

        if ((enrichedCount > 0 || newScrapedBuyers.length > 0) && import.meta.env.DEV) {
            console.info(
                `[LiveBids] Enriched ${enrichedCount} existing buyers, added ${newScrapedBuyers.length} new scraped buyers for ${selectedCrop}`
            );
        }
    }

    const marketData = marketDataService.getCropMarketData(selectedCrop);
    const currentFutures = marketData.futuresPrice;
    const benchmark = marketDataService.getBenchmark(selectedCrop);
    const stateBasisMap = await usdaMarketService.getStateBasisMap(normalizeCropForUsda(selectedCrop as CropType));
    const usdaAdjustments = await usdaMarketService.getRegionalAdjustments();
    const now = new Date().toISOString();

    const dynamicBuyers = await Promise.all(filteredBuyers.map(async (buyer) => {
        const hasRealBid = buyer.cashBid != null;
        let cashPrice: number;
        let basis: number;
        let basisConfidence: 'verified' | 'estimated';
        let basisSourceLabel: string;

        if (hasRealBid) {
            cashPrice = typeof buyer.cashBid === 'number' ? buyer.cashBid : parseFloat(String(buyer.cashBid));
            basis = selectedCrop === 'Sunflowers'
                ? 0
                : parseFloat((cashPrice - currentFutures).toFixed(2));
            basisConfidence = 'verified';
            basisSourceLabel = buyer.bidSource || 'Scraped Bid';
        } else if (selectedCrop === 'Sunflowers') {
            cashPrice = currentFutures;
            basis = 0;
            basisConfidence = 'estimated';
            basisSourceLabel = `${benchmark.name} Benchmark`;
        } else {
            const basisInfo = usdaMarketService.getStateBasis(
                buyer.state,
                stateBasisMap,
                usdaAdjustments
            );
            basis = basisInfo.basis;
            cashPrice = parseFloat((currentFutures + basis).toFixed(2));
            basisConfidence = basisInfo.confidence;
            basisSourceLabel = basisInfo.source;
        }

        const freightInfo = await calculateFreight(
            { lat: buyer.lat, lng: buyer.lng, state: buyer.state, city: buyer.city },
            buyer.name,
            buyer.railAccessible,
            selectedCrop
        );
        const rawFreightPerBushel = freightInfo.ratePerBushel;
        let freightCost = convertFreightToCropUnit(rawFreightPerBushel, selectedCrop);
        freightCost = normalizeFreightData(freightCost, undefined);

        const maxFreight = MAX_FREIGHT_BY_CROP[selectedCrop] || 5.0;
        if (freightCost > maxFreight) {
            if (import.meta.env.DEV) {
                console.warn(
                    `[FreightGuard] ${buyer.name}: freight $${freightCost.toFixed(2)} still exceeds max $${maxFreight} for ${selectedCrop} after normalization.`
                );
            }
            freightCost = maxFreight;
        }

        if (isNaN(cashPrice)) cashPrice = 0;
        if (isNaN(freightCost)) freightCost = 0;

        const netPrice = cashPrice - freightCost;
        const benchmarkNetPrice = benchmark.cashPrice - benchmark.freight;
        const benchmarkDiff = parseFloat((netPrice - benchmarkNetPrice).toFixed(2));
        const futuresSource = marketDataService.getFuturesSource(selectedCrop);
        const priceUnit = getCropPriceUnit(selectedCrop);

        const provenance = {
            futures: futuresSource,
            basis: {
                value: basis,
                confidence: basisConfidence,
                source: basisSourceLabel,
                timestamp: now,
                staleAfterMinutes: hasRealBid ? 60 : 120,
            },
            freight: {
                value: freightCost,
                confidence: 'estimated' as const,
                source: `BNSF Tariff 4022 (${freightInfo.mode}) ${priceUnit}`,
                timestamp: now,
                staleAfterMinutes: 720,
            },
            fees: {
                value: 0,
                confidence: 'verified' as const,
                source: 'No fees',
                timestamp: now,
                staleAfterMinutes: 10080,
            },
        };

        const verified = [provenance.futures.confidence, provenance.basis.confidence, provenance.freight.confidence]
            .every((confidence) => confidence === 'verified');

        return {
            ...buyer,
            basis: parseFloat(basis.toFixed(2)),
            freightCost: parseFloat((-freightCost).toFixed(2)),
            freightMode: freightInfo.mode,
            freightFormula: freightInfo.formula,
            cashPrice: parseFloat(cashPrice.toFixed(2)),
            netPrice: parseFloat(netPrice.toFixed(2)),
            futuresPrice: currentFutures,
            benchmarkDiff: isNaN(benchmarkDiff) ? 0 : benchmarkDiff,
            lastUpdated: now,
            provenance,
            verified,
            dataSource: hasRealBid ? (buyer.bidSource || 'scraped-bid') : basisSourceLabel,
            priceSource: hasRealBid
                ? (buyer.bidDate && (Date.now() - new Date(buyer.bidDate).getTime()) > 36 * 60 * 60 * 1000
                    ? 'stale' as const
                    : 'live_bid' as const)
                : 'usda_estimate' as const,
        };
    }));

    const enrichedBuyers = enrichBuyersWithRailConfidence(dynamicBuyers, TRANSLOADERS);
    cacheService.set('buyers', cacheKey, enrichedBuyers, CACHE_TTL.BUYERS_MS);
    return applyFilters(enrichedBuyers, filters);
}

export function invalidateBuyerCache(crop: string = DEFAULT_CROP): void {
    cacheService.invalidate('buyers', crop);
}

export function getBuyerCacheAge(crop: string = DEFAULT_CROP): number | null {
    return cacheService.getAge('buyers', crop);
}

export async function getMarketDataInfo(): Promise<{ futuresPrice: number; dataSource: string; lastUpdated: string }> {
    const marketData = marketDataService.getMarketData();
    const usdaData = usdaMarketService.getDataFreshness();

    return {
        futuresPrice: marketData.futuresPrice,
        dataSource: `${marketData.source} / ${usdaData.source}`,
        lastUpdated: `${marketData.lastUpdated} / ${usdaData.lastUpdated}`,
    };
}
