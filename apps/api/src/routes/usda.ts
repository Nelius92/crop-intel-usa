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

// ── Grain report proxy ────────────────────────────────────────────────
// Strategy:
//  1. Try authenticated MARS v1.2 API (if USDA_API_KEY is set)
//  2. Fall back to public v3.1 grain report metadata
//  3. Fall back to hardcoded regional data
usdaRouter.get('/grain-report', async (req, res) => {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');
        logger.info('Fetching USDA grain report', { commodity });

        // Strategy 1: Authenticated MARS v1.2 API (best data quality)
        const apiKey = (env as any).USDA_API_KEY;
        if (apiKey) {
            try {
                const authResponse = await fetch(
                    `https://marsapi.ams.usda.gov/services/v1.2/reports/LM_GR110?q=commodity=${encodeURIComponent(commodity)}`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                        },
                        signal: AbortSignal.timeout(10000),
                    }
                );

                if (authResponse.ok) {
                    const data = await authResponse.json();
                    logger.info('USDA grain report from authenticated v1.2 API', { commodity });
                    return res.json({
                        success: true,
                        degraded: false,
                        source: 'usda-ams',
                        data,
                        fetchedAt: new Date().toISOString(),
                    });
                }
                logger.warn('USDA v1.2 auth API failed', { status: authResponse.status });
            } catch (err) {
                logger.warn('USDA v1.2 auth API error', errorMeta(err));
            }
        }

        // Strategy 2: Public v3.1 grain reports (no auth needed, limited data)
        try {
            const pubResponse = await fetch(
                'https://marsapi.ams.usda.gov/services/v3.1/public/listPublishedReports?format=json',
                { signal: AbortSignal.timeout(8000) }
            );

            if (pubResponse.ok) {
                const pubData = await pubResponse.json() as any;
                const reports = pubData?.reports || [];

                // Extract grain-related reports for freshness info
                const grainReports = reports.filter((r: any) => {
                    const title = (r.reportTitle || '').toLowerCase();
                    return title.includes('grain') || title.includes('corn') || title.includes('soybean');
                });

                if (grainReports.length > 0) {
                    logger.info('USDA grain reports from public v3.1 API', {
                        count: grainReports.length,
                    });

                    return res.json({
                        success: true,
                        degraded: true,
                        source: 'usda-ams-public',
                        data: {
                            results: grainReports.map((r: any) => ({
                                reportTitle: r.reportTitle,
                                publishedDate: r.publishedDate,
                                reportBeginDate: r.reportBeginDate,
                                reportEndDate: r.reportEndDate,
                                id: r.id,
                            })),
                            reportCount: grainReports.length,
                            latestReport: grainReports[0]?.publishedDate,
                        },
                        fetchedAt: new Date().toISOString(),
                    });
                }
            }
        } catch (err) {
            logger.warn('USDA v3.1 public API error', errorMeta(err));
        }

        // Strategy 3: Hardcoded fallback
        logger.warn('All USDA sources failed, using fallback data');
        res.json(buildFallbackResponse());
    } catch (error) {
        logger.error('USDA API proxy error', errorMeta(error));
        res.json(buildFallbackResponse());
    }
});

// ── Futures price proxy ───────────────────────────────────────────────
usdaRouter.get('/futures-price', async (_req, res) => {
    try {
        logger.info('Fetching current futures price');

        // Try USDA Grain Transportation Report
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
