import { Router } from 'express';
import { logger } from '../logger.js';
import { env } from '../env.js';

export const usdaRouter = Router();

function errorMeta(error: unknown) {
    if (error instanceof Error) {
        return { error: error.message, stack: error.stack };
    }
    return { error: String(error) };
}

// ── MARS API v1.2 Report IDs per state ──────────────────────────────
// Each maps to the daily grain bids report for that geographic region
const GRAIN_REPORT_IDS: Record<string, number> = {
    ND: 3878, // North Dakota Daily Grain Bids
    SD: 3186, // South Dakota Daily Grain Bids
    MN: 3049, // Southern Minnesota Daily Grain Bids  
    IA: 2850, // Iowa Daily Cash Grain Bids
    NE: 3225, // Nebraska Daily Elevator Grain Bids
    KS: 2886, // Kansas Daily Grain Bids
    TX: 2711, // Texas Daily Grain Bids
    CO: 2912, // Colorado Daily Grain Bids
    MT: 2771, // Montana Daily Elevator Grain Bids
    IL: 3192, // Illinois Grain Bids
    MO: 2932, // Missouri Daily Grain Bids
    OK: 3100, // Oklahoma Daily Grain Bids
    AR: 2960, // Arkansas Daily Grain Bids
    OH: 2851, // Ohio Daily Grain Bids
    IN: 3463, // Indiana Grain Bids
    MS: 2928, // Mississippi Daily Grain Bids
    TN: 3088, // Tennessee Daily Grain Bids
    KY: 2892, // Kentucky Daily Grain Bids
    CA: 3146, // California Grain Bids
    OR: 3148, // Portland Daily Grain Bids (PNW)
    WA: 3148, // Portland Daily Grain Bids (PNW)
    WY: 3239, // Wyoming Daily Grain Bids
};

// Sunflower-specific report
const SUNFLOWER_REPORT_ID = 2887; // National Daily Sunflower, Canola, Millet, and Flaxseed Report

// ── Grain report proxy (USDA MARS v1.2) ──────────────────────────────
usdaRouter.get('/grain-report', async (req, res) => {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');
        const state = String(req.query.state ?? 'ND');
        logger.info('Fetching USDA grain report', { commodity, state });

        const apiKey = (env as any).USDA_API_KEY;
        if (!apiKey) {
            logger.warn('USDA_API_KEY not set, returning fallback data');
            return res.json(buildFallbackResponse());
        }

        // Determine the right report for this state
        const reportId = GRAIN_REPORT_IDS[state] || GRAIN_REPORT_IDS.ND;

        // Fetch with allSections=true — no date filter = latest report data
        // The API returns sections: [Report Header, Report Detail]
        // Report Detail contains the actual bid data with commodity, prices, basis
        const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}?allSections=true`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
            },
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            throw new Error(`USDA API returned ${response.status} for report ${reportId}`);
        }

        const data = await response.json();
        res.json(parseGrainBidResponse(data, commodity, state));
    } catch (error) {
        logger.error('USDA API proxy error', errorMeta(error));
        res.json(buildFallbackResponse());
    }
});

// ── Sunflower report endpoint ──────────────────────────────────────────
usdaRouter.get('/sunflower-report', async (_req, res) => {
    try {
        const apiKey = (env as any).USDA_API_KEY;
        if (!apiKey) {
            return res.json({ success: false, degraded: true, source: 'fallback', data: {} });
        }

        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;

        const response = await fetch(
            `https://marsapi.ams.usda.gov/services/v1.2/reports/${SUNFLOWER_REPORT_ID}?q=report_date=${dateStr}&allSections=true`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (response.ok) {
            const data = await response.json();
            const results = Array.isArray(data) ? data : (data as any)?.results || [];
            const sunflowerBids = results.filter((r: any) =>
                r.commodity?.toLowerCase().includes('sunflower')
            );

            return res.json({
                success: true,
                degraded: false,
                source: 'usda-ams',
                data: {
                    bids: sunflowerBids.map((r: any) => ({
                        commodity: r.commodity,
                        class: r.class,
                        tradeLoc: r.trade_loc,
                        basisMin: r['basis Min'],
                        basisMax: r['basis Max'],
                        priceMin: r['price Min'],
                        priceMax: r['price Max'],
                        avgPrice: r.avg_price,
                        direction: r['basis Min Direction'],
                        reportDate: r.report_date,
                    })),
                },
                fetchedAt: new Date().toISOString(),
            });
        }

        res.json({ success: false, degraded: true, source: 'fallback', data: {} });
    } catch (error) {
        logger.error('Sunflower report error', errorMeta(error));
        res.json({ success: false, degraded: true, source: 'fallback', data: {} });
    }
});

// ── Multi-state regional basis aggregator ─────────────────────────────
// Fetches USDA grain bids for ALL states in parallel, returns per-state
// average basis. This powers accurate pricing for every buyer location.
const regionalBasisCache = new Map<string, { data: any; fetchedAt: number }>();
const REGIONAL_BASIS_TTL_MS = 60 * 60 * 1000; // 60 minutes

usdaRouter.get('/regional-basis', async (req, res) => {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');
        const cacheKey = `regional-basis-${commodity}`;

        // Check in-memory cache
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

        const apiKey = (env as any).USDA_API_KEY;
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

        // De-duplicate report IDs (OR and WA share the same report)
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

        // Fetch all unique reports in parallel (with per-request timeout)
        const fetchPromises = Array.from(uniqueReports.entries()).map(
            async ([reportId, states]) => {
                try {
                    const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}?allSections=true`;
                    const response = await fetch(url, {
                        headers: {
                            Accept: 'application/json',
                            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                        },
                        signal: AbortSignal.timeout(15000),
                    });

                    if (!response.ok) {
                        logger.warn(`USDA report ${reportId} returned ${response.status}`);
                        return;
                    }

                    const data = await response.json();

                    // Extract Report Detail section
                    let results: any[] = [];
                    if (Array.isArray(data)) {
                        const detailSection = data.find(
                            (s: any) => s.reportSection === 'Report Detail'
                        );
                        results = detailSection?.results || [];
                        if (results.length === 0 && data.length > 0 && data[0].commodity) {
                            results = data;
                        }
                    }

                    // Filter to matching commodity + current bids
                    const bids = results.filter((r: any) => {
                        const rc = (r.commodity || '').toLowerCase();
                        const rClass = (r.class || '').toLowerCase();
                        return (
                            r.current === 'Yes' &&
                            (rc.includes(commodityFilter) || rClass.includes(commodityFilter))
                        );
                    });

                    if (bids.length === 0) return;

                    // Calculate average basis and price for these bids
                    let totalBasis = 0;
                    let totalPrice = 0;
                    let basisCount = 0;
                    let priceCount = 0;
                    let minBasis = Infinity;
                    let maxBasis = -Infinity;

                    for (const bid of bids) {
                        const bMin = bid['basis Min'];
                        const bMax = bid['basis Max'];
                        if (bMin != null && bMax != null) {
                            const avg = (bMin + bMax) / 2;
                            totalBasis += avg;
                            basisCount++;
                            if (avg < minBasis) minBasis = avg;
                            if (avg > maxBasis) maxBasis = avg;
                        }
                        if (bid.avg_price != null) {
                            totalPrice += bid.avg_price;
                            priceCount++;
                        }
                    }

                    const avgBasis = basisCount > 0 ? totalBasis / basisCount : 0;
                    const avgPrice = priceCount > 0 ? totalPrice / priceCount : 0;
                    const reportDate = bids[0]?.report_date || '';

                    // Assign to each state that uses this report
                    for (const state of states) {
                        stateBasis[state] = {
                            avgBasis: parseFloat(avgBasis.toFixed(1)),       // in cents
                            avgBasisDollars: parseFloat((avgBasis / 100).toFixed(4)), // in dollars
                            minBasis: parseFloat((minBasis === Infinity ? 0 : minBasis).toFixed(1)),
                            maxBasis: parseFloat((maxBasis === -Infinity ? 0 : maxBasis).toFixed(1)),
                            avgPrice: parseFloat(avgPrice.toFixed(2)),
                            bidCount: bids.length,
                            reportDate,
                            source: 'usda-ams' as const,
                        };
                    }
                } catch (err) {
                    logger.warn(`Failed to fetch USDA report ${reportId}`, errorMeta(err));
                }
            }
        );

        await Promise.all(fetchPromises);

        // Cache the results
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
});

function buildFallbackStateBasis(): Record<string, any> {
    return {
        ND: { avgBasis: -75, avgBasisDollars: -0.75, avgPrice: 3.90, bidCount: 0, source: 'fallback' },
        SD: { avgBasis: -70, avgBasisDollars: -0.70, avgPrice: 3.95, bidCount: 0, source: 'fallback' },
        MN: { avgBasis: -65, avgBasisDollars: -0.65, avgPrice: 4.00, bidCount: 0, source: 'fallback' },
        IA: { avgBasis: -38, avgBasisDollars: -0.38, avgPrice: 4.25, bidCount: 0, source: 'fallback' },
        IL: { avgBasis: -25, avgBasisDollars: -0.25, avgPrice: 4.40, bidCount: 0, source: 'fallback' },
        NE: { avgBasis: -30, avgBasisDollars: -0.30, avgPrice: 4.35, bidCount: 0, source: 'fallback' },
        KS: { avgBasis: -30, avgBasisDollars: -0.30, avgPrice: 4.35, bidCount: 0, source: 'fallback' },
        TX: { avgBasis: 87, avgBasisDollars: 0.87, avgPrice: 5.50, bidCount: 0, source: 'fallback' },
        CA: { avgBasis: 163, avgBasisDollars: 1.63, avgPrice: 6.30, bidCount: 0, source: 'fallback' },
        CO: { avgBasis: -20, avgBasisDollars: -0.20, avgPrice: 4.45, bidCount: 0, source: 'fallback' },
        OH: { avgBasis: -25, avgBasisDollars: -0.25, avgPrice: 4.40, bidCount: 0, source: 'fallback' },
        IN: { avgBasis: -20, avgBasisDollars: -0.20, avgPrice: 4.45, bidCount: 0, source: 'fallback' },
        WA: { avgBasis: 25, avgBasisDollars: 0.25, avgPrice: 4.90, bidCount: 0, source: 'fallback' },
        OR: { avgBasis: 25, avgBasisDollars: 0.25, avgPrice: 4.90, bidCount: 0, source: 'fallback' },
    };
}

// ── Futures price proxy ───────────────────────────────────────────────
usdaRouter.get('/futures-price', async (_req, res) => {
    try {
        logger.info('Fetching current futures price');

        const response = await fetch(
            'https://api.transportation.usda.gov/wips/services/GTR/GrainPrices?format=json',
            { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
            const data = await response.json() as any[];
            const cornData = data?.find?.((d: any) =>
                d.commodity?.toLowerCase().includes('corn')
            );

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

        // Fallback
        res.json({
            success: true,
            futuresPrice: 4.35,
            contract: "ZCK6 (May '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Futures price fetch error', errorMeta(error));
        res.json({
            success: true,
            futuresPrice: 4.35,
            contract: "ZCK6 (May '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString(),
        });
    }
});

// ── Parse MARS v1.2 grain bid response ────────────────────────────────
function parseGrainBidResponse(data: any, commodity: string, state: string) {
    // The API returns sections: [{reportSection:"Report Header", results:[...]}, {reportSection:"Report Detail", results:[...]}]
    // We need the "Report Detail" section which has the actual bid data
    let results: any[] = [];
    if (Array.isArray(data)) {
        const detailSection = data.find((s: any) => s.reportSection === 'Report Detail');
        results = detailSection?.results || [];
        // If no section structure, try flat array
        if (results.length === 0 && data.length > 0 && data[0].commodity) {
            results = data;
        }
    } else {
        results = data?.results || [];
    }

    logger.info('USDA Report Detail parsed', { totalBids: results.length, state });

    // Map commodity name to a match filter
    const commodityFilter = commodity.toLowerCase().replace('yellow ', '');

    // Filter to matching commodity + current (most recent report)
    const bids = results.filter((r: any) => {
        const rc = (r.commodity || '').toLowerCase();
        const rClass = (r.class || '').toLowerCase();
        const isCurrent = r.current === 'Yes';
        // Match "Corn" for Yellow Corn, "Soybeans" for Soybeans, etc.
        return isCurrent && (rc.includes(commodityFilter) || rClass.includes(commodityFilter));
    });

    if (bids.length === 0) {
        logger.warn('No USDA bids matched commodity filter', { commodity, state, totalRecords: results.length });
        return buildFallbackResponse();
    }

    // Extract structured bid data
    const parsedBids = bids.map((r: any) => ({
        commodity: r.commodity,
        class: r.class,
        grade: r.grade,
        tradeLoc: r.trade_loc,
        state: r.market_location_state || state,
        basisMin: r['basis Min'],
        basisMax: r['basis Max'],
        basisFuturesMonth: r['basis Min Futures Month'],
        basisDirection: r['basis Min Direction'],
        basisChange: r['basis Min Change'],
        priceMin: r['price Min'],
        priceMax: r['price Max'],
        avgPrice: r.avg_price,
        avgPriceYearAgo: r.avg_price_year_ago,
        priceDirection: r['price Min Direction'],
        priceChange: r['price Min Change'],
        deliveryPoint: r.delivery_point,
        freight: r.freight,
        transMode: r.trans_mode,
        reportDate: r.report_date,
    }));

    // Calculate average basis across all ND sub-regions
    const avgBasis = parsedBids.reduce((sum: number, b: any) => {
        const basis = (b.basisMin + b.basisMax) / 2;
        return sum + basis;
    }, 0) / parsedBids.length;

    // Determine overall trend
    const directions = parsedBids.map((b: any) => b.basisDirection);
    const trend = directions.filter((d: string) => d === 'UP').length > directions.length / 2
        ? 'UP'
        : directions.filter((d: string) => d === 'DOWN').length > directions.length / 2
            ? 'DOWN'
            : 'FLAT';

    return {
        success: true,
        degraded: false,
        source: 'usda-ams',
        data: {
            summary: {
                commodity,
                state,
                avgBasis: avgBasis, // in cents
                avgBasisDollars: avgBasis / 100, // in dollars
                trend,
                avgPrice: parsedBids.reduce((s: number, b: any) => s + (b.avgPrice || 0), 0) / parsedBids.length,
                avgPriceYearAgo: parsedBids.reduce((s: number, b: any) => s + (b.avgPriceYearAgo || 0), 0) / parsedBids.length,
                futuresMonth: parsedBids[0]?.basisFuturesMonth || 'May (K)',
                bidCount: parsedBids.length,
                reportDate: parsedBids[0]?.reportDate,
            },
            bids: parsedBids,
            // Regional adjustments format for frontend compatibility
            results: parsedBids.map((b: any) => ({
                region: b.tradeLoc,
                state: b.state,
                basis: (b.basisMin + b.basisMax) / 2,
                trend: b.basisDirection === 'UP' ? 'UP' : b.basisDirection === 'DOWN' ? 'DOWN' : 'FLAT',
            })),
        },
        fetchedAt: new Date().toISOString(),
    };
}

function buildFallbackResponse() {
    return {
        success: false,
        degraded: true,
        source: 'fallback',
        error: 'Failed to fetch from USDA API',
        fallback: true,
        data: {
            results: [
                { region: 'Northern Plains', state: 'ND', basis: -65, trend: 'DOWN' },
                { region: 'Corn Belt', state: 'IA', basis: -25, trend: 'FLAT' },
                { region: 'Texas', state: 'TX', basis: -15, trend: 'FLAT' },
                { region: 'California', state: 'CA', basis: 50, trend: 'FLAT' },
                { region: 'PNW', state: 'WA', basis: 25, trend: 'UP' },
                { region: 'Southeast', state: 'GA', basis: 5, trend: 'FLAT' },
                { region: 'Central Plains', state: 'NE', basis: -30, trend: 'FLAT' },
                { region: 'Southern Plains', state: 'CO', basis: -20, trend: 'FLAT' },
            ],
        },
        fetchedAt: new Date().toISOString(),
    };
}
