import { Router } from 'express';
import { logger } from '../logger.js';

export const usdaRouter = Router();

function errorMeta(error: unknown) {
    if (error instanceof Error) {
        return { error: error.message, stack: error.stack };
    }
    return { error: String(error) };
}

// Proxy for USDA AMS Market News API to avoid CORS issues in browser
usdaRouter.get('/grain-report', async (req, res) => {
    try {
        const commodity = String(req.query.commodity ?? 'Corn');

        logger.info('Fetching USDA grain report', { commodity });

        // Fetch from USDA AMS Market News API
        const response = await fetch(
            `https://marsapi.ams.usda.gov/services/v1.2/reports/LM_GR110?q=commodity=${encodeURIComponent(commodity)}`,
            {
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            }
        );

        if (!response.ok) {
            throw new Error(`USDA API returned ${response.status}`);
        }

        const data = await response.json();

        res.json({
            success: true,
            degraded: false,
            source: 'usda-ams',
            data: data,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        logger.error('USDA API proxy error', errorMeta(error));

        // Return fallback data on error
        res.json({
            success: false,
            degraded: true,
            source: 'fallback',
            error: 'Failed to fetch from USDA API',
            fallback: true,
            data: {
                results: [
                    { region: 'Texas', state: 'TX', basis: 85, trend: 'FLAT' },
                    { region: 'California', state: 'CA', basis: 145, trend: 'FLAT' },
                    { region: 'Washington', state: 'WA', basis: 110, trend: 'UP' },
                    { region: 'Midwest', state: 'IA', basis: -25, trend: 'DOWN' }
                ]
            },
            fetchedAt: new Date().toISOString()
        });
    }
});

// Futures price proxy (using USDA Grain Transportation Report)
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
                    contract: "ZCH6 (Mar '26)",
                    source: 'usda-gtr',
                    degraded: false,
                    fetchedAt: new Date().toISOString()
                });
            }
        }

        // Fallback
        res.json({
            success: true,
            futuresPrice: 4.30,
            contract: "ZCH6 (Mar '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Futures price fetch error', errorMeta(error));
        res.json({
            success: true,
            futuresPrice: 4.30,
            contract: "ZCH6 (Mar '26)",
            source: 'fallback',
            degraded: true,
            fetchedAt: new Date().toISOString()
        });
    }
});
