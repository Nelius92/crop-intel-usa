import type { Request, Response } from 'express';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { parseGrainBidResponse } from './parser.js';
import {
    buildFallbackResponse,
    buildFallbackStateBasis,
    errorMeta,
    GRAIN_REPORT_IDS,
    regionalBasisCache,
    REGIONAL_BASIS_TTL_MS,
    SUNFLOWER_REPORT_ID,
} from './shared.js';

export async function handleGrainReport(req: Request, res: Response) {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');
        const state = String(req.query.state ?? 'ND');
        logger.info('Fetching USDA grain report', { commodity, state });

        const apiKey = env.USDA_API_KEY;
        if (!apiKey) {
            logger.warn('USDA_API_KEY not set, returning fallback data');
            return res.json(buildFallbackResponse());
        }

        const reportId = GRAIN_REPORT_IDS[state] || GRAIN_REPORT_IDS.ND;
        const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}?allSections=true`;
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
            },
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            throw new Error(`USDA API returned ${response.status} for report ${reportId}`);
        }

        const data = await response.json();
        return res.json(parseGrainBidResponse(data, commodity, state));
    } catch (error) {
        logger.error('USDA API proxy error', errorMeta(error));
        return res.json(buildFallbackResponse());
    }
}

export async function handleSunflowerReport(_req: Request, res: Response) {
    try {
        const apiKey = env.USDA_API_KEY;
        if (!apiKey) {
            return res.json({ success: false, degraded: true, source: 'fallback', data: {} });
        }

        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        const response = await fetch(
            `https://marsapi.ams.usda.gov/services/v1.2/reports/${SUNFLOWER_REPORT_ID}?q=report_date=${dateStr}&allSections=true`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (response.ok) {
            const data = (await response.json()) as { results?: any[] } | any[];
            const results = Array.isArray(data) ? data : data?.results || [];
            const sunflowerBids = results.filter((row: any) => row.commodity?.toLowerCase().includes('sunflower'));

            return res.json({
                success: true,
                degraded: false,
                source: 'usda-ams',
                data: {
                    bids: sunflowerBids.map((row: any) => ({
                        commodity: row.commodity,
                        class: row.class,
                        tradeLoc: row.trade_loc,
                        basisMin: row['basis Min'],
                        basisMax: row['basis Max'],
                        priceMin: row['price Min'],
                        priceMax: row['price Max'],
                        avgPrice: row.avg_price,
                        direction: row['basis Min Direction'],
                        reportDate: row.report_date,
                    })),
                },
                fetchedAt: new Date().toISOString(),
            });
        }

        return res.json({ success: false, degraded: true, source: 'fallback', data: {} });
    } catch (error) {
        logger.error('Sunflower report error', errorMeta(error));
        return res.json({ success: false, degraded: true, source: 'fallback', data: {} });
    }
}

export async function handleRegionalBasis(req: Request, res: Response) {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');
        const cacheKey = `regional-basis-${commodity}`;

        const cached = regionalBasisCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < REGIONAL_BASIS_TTL_MS) {
            logger.info('Regional basis cache hit', { commodity, states: Object.keys(cached.data).length });
            return res.json({
                success: true,
                source: 'usda-ams-cached',
                degraded: false,
                commodity,
                states: cached.data,
                stateCount: Object.keys(cached.data).length,
                fetchedAt: new Date(cached.fetchedAt).toISOString(),
            });
        }

        const apiKey = env.USDA_API_KEY;
        if (!apiKey) {
            logger.warn('USDA_API_KEY not set for regional-basis');
            return res.json({
                success: false,
                source: 'fallback',
                degraded: true,
                commodity,
                states: buildFallbackStateBasis(),
                stateCount: 0,
                fetchedAt: new Date().toISOString(),
            });
        }

        const uniqueReports = new Map<number, string[]>();
        for (const [state, reportId] of Object.entries(GRAIN_REPORT_IDS)) {
            if (!uniqueReports.has(reportId)) {
                uniqueReports.set(reportId, []);
            }
            uniqueReports.get(reportId)!.push(state);
        }

        logger.info('Fetching USDA regional basis for all states', {
            commodity,
            uniqueReports: uniqueReports.size,
            totalStates: Object.keys(GRAIN_REPORT_IDS).length,
        });

        const commodityFilter = commodity.toLowerCase().replace('yellow ', '');
        const stateBasis: Record<string, any> = {};

        const fetchPromises = Array.from(uniqueReports.entries()).map(async ([reportId, states]) => {
            try {
                const response = await fetch(
                    `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}?allSections=true`,
                    {
                        headers: {
                            Accept: 'application/json',
                            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                        },
                        signal: AbortSignal.timeout(15000),
                    }
                );

                if (!response.ok) {
                    logger.warn(`USDA report ${reportId} returned ${response.status}`);
                    return;
                }

                const data = await response.json();
                let results: any[] = [];
                if (Array.isArray(data)) {
                    const detailSection = data.find((section: any) => section.reportSection === 'Report Detail');
                    results = detailSection?.results || [];
                    if (results.length === 0 && data.length > 0 && data[0].commodity) {
                        results = data;
                    }
                }

                const bids = results.filter((row: any) => {
                    const rowCommodity = (row.commodity || '').toLowerCase();
                    const rowClass = (row.class || '').toLowerCase();
                    return row.current === 'Yes' && (rowCommodity.includes(commodityFilter) || rowClass.includes(commodityFilter));
                });

                if (bids.length === 0) {
                    return;
                }

                let totalBasis = 0;
                let totalPrice = 0;
                let basisCount = 0;
                let priceCount = 0;
                let minBasis = Infinity;
                let maxBasis = -Infinity;

                for (const bid of bids) {
                    const basisMin = bid['basis Min'];
                    const basisMax = bid['basis Max'];
                    if (basisMin != null && basisMax != null) {
                        const avgBasis = (basisMin + basisMax) / 2;
                        totalBasis += avgBasis;
                        basisCount++;
                        if (avgBasis < minBasis) minBasis = avgBasis;
                        if (avgBasis > maxBasis) maxBasis = avgBasis;
                    }
                    if (bid.avg_price != null) {
                        totalPrice += bid.avg_price;
                        priceCount++;
                    }
                }

                const avgBasis = basisCount > 0 ? totalBasis / basisCount : 0;
                const avgPrice = priceCount > 0 ? totalPrice / priceCount : 0;
                const reportDate = bids[0]?.report_date || '';

                for (const state of states) {
                    stateBasis[state] = {
                        avgBasis: parseFloat(avgBasis.toFixed(1)),
                        avgBasisDollars: parseFloat((avgBasis / 100).toFixed(4)),
                        minBasis: parseFloat((minBasis === Infinity ? 0 : minBasis).toFixed(1)),
                        maxBasis: parseFloat((maxBasis === -Infinity ? 0 : maxBasis).toFixed(1)),
                        avgPrice: parseFloat(avgPrice.toFixed(2)),
                        bidCount: bids.length,
                        reportDate,
                        source: 'usda-ams' as const,
                    };
                }
            } catch (error) {
                logger.warn(`Failed to fetch USDA report ${reportId}`, errorMeta(error));
            }
        });

        await Promise.all(fetchPromises);
        regionalBasisCache.set(cacheKey, { data: stateBasis, fetchedAt: Date.now() });

        logger.info('Regional basis aggregation complete', {
            commodity,
            statesWithData: Object.keys(stateBasis).length,
        });

        return res.json({
            success: true,
            source: 'usda-ams',
            degraded: false,
            commodity,
            states: stateBasis,
            stateCount: Object.keys(stateBasis).length,
            fetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Regional basis aggregation error', errorMeta(error));
        return res.json({
            success: false,
            source: 'fallback',
            degraded: true,
            commodity: String(req.query.commodity ?? 'Corn'),
            states: buildFallbackStateBasis(),
            stateCount: 0,
            fetchedAt: new Date().toISOString(),
        });
    }
}

export async function handleFuturesPrice(_req: Request, res: Response) {
    try {
        logger.info('Fetching current futures price');

        const response = await fetch(
            'https://api.transportation.usda.gov/wips/services/GTR/GrainPrices?format=json',
            { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
            const data = await response.json() as any[];
            const cornData = data?.find?.((entry: any) => entry.commodity?.toLowerCase().includes('corn'));

            if (cornData?.price) {
                return res.json({
                    success: true,
                    futuresPrice: parseFloat(cornData.price),
                    contract: "ZCK6 (May '26)",
                    source: 'usda-gtr',
                    degraded: false,
                    fetchedAt: new Date().toISOString(),
                });
            }
        }

        return res.json({
            success: true,
            futuresPrice: 4.35,
            contract: "ZCK6 (May '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Futures price fetch error', errorMeta(error));
        return res.json({
            success: true,
            futuresPrice: 4.35,
            contract: "ZCK6 (May '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString(),
        });
    }
}
