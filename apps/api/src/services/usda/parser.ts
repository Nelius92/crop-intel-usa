import { logger } from '../../logger.js';
import { buildFallbackResponse } from './shared.js';

export function parseGrainBidResponse(data: any, commodity: string, state: string) {
    let results: any[] = [];
    if (Array.isArray(data)) {
        const detailSection = data.find((section: any) => section.reportSection === 'Report Detail');
        results = detailSection?.results || [];
        if (results.length === 0 && data.length > 0 && data[0].commodity) {
            results = data;
        }
    } else {
        results = data?.results || [];
    }

    logger.info('USDA Report Detail parsed', { totalBids: results.length, state });
    const commodityFilter = commodity.toLowerCase().replace('yellow ', '');

    const bids = results.filter((row: any) => {
        const rowCommodity = (row.commodity || '').toLowerCase();
        const rowClass = (row.class || '').toLowerCase();
        return row.current === 'Yes' && (rowCommodity.includes(commodityFilter) || rowClass.includes(commodityFilter));
    });

    if (bids.length === 0) {
        logger.warn('No USDA bids matched commodity filter', { commodity, state, totalRecords: results.length });
        return buildFallbackResponse();
    }

    const parsedBids = bids.map((row: any) => ({
        commodity: row.commodity,
        class: row.class,
        grade: row.grade,
        tradeLoc: row.trade_loc,
        state: row.market_location_state || state,
        basisMin: row['basis Min'],
        basisMax: row['basis Max'],
        basisFuturesMonth: row['basis Min Futures Month'],
        basisDirection: row['basis Min Direction'],
        basisChange: row['basis Min Change'],
        priceMin: row['price Min'],
        priceMax: row['price Max'],
        avgPrice: row.avg_price,
        avgPriceYearAgo: row.avg_price_year_ago,
        priceDirection: row['price Min Direction'],
        priceChange: row['price Min Change'],
        deliveryPoint: row.delivery_point,
        freight: row.freight,
        transMode: row.trans_mode,
        reportDate: row.report_date,
    }));

    const avgBasis = parsedBids.reduce((sum: number, bid: any) => sum + ((bid.basisMin + bid.basisMax) / 2), 0) / parsedBids.length;
    const directions = parsedBids.map((bid: any) => bid.basisDirection);
    const trend = directions.filter((direction: string) => direction === 'UP').length > directions.length / 2
        ? 'UP'
        : directions.filter((direction: string) => direction === 'DOWN').length > directions.length / 2
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
                avgBasis,
                avgBasisDollars: avgBasis / 100,
                trend,
                avgPrice: parsedBids.reduce((sum: number, bid: any) => sum + (bid.avgPrice || 0), 0) / parsedBids.length,
                avgPriceYearAgo: parsedBids.reduce((sum: number, bid: any) => sum + (bid.avgPriceYearAgo || 0), 0) / parsedBids.length,
                futuresMonth: parsedBids[0]?.basisFuturesMonth || 'May (K)',
                bidCount: parsedBids.length,
                reportDate: parsedBids[0]?.reportDate,
            },
            bids: parsedBids,
            results: parsedBids.map((bid: any) => ({
                region: bid.tradeLoc,
                state: bid.state,
                basis: (bid.basisMin + bid.basisMax) / 2,
                trend: bid.basisDirection === 'UP' ? 'UP' : bid.basisDirection === 'DOWN' ? 'DOWN' : 'FLAT',
            })),
        },
        fetchedAt: new Date().toISOString(),
    };
}
