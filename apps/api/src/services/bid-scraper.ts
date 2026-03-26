import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { dbQuery } from '../db/pool.js';

/**
 * Firecrawl Cash Bid Scraper — The Core Data Pipeline
 *
 * Scrapes posted cash bids from BNSF-served grain facilities.
 * Runs weekdays at 5:00 AM CT via Railway cron.
 *
 * Target sources (priority order):
 *  1. Elevator/facility bid pages (individual websites)
 *  2. Barchart cash grain pages (aggregated)
 *  3. USDA AMS regional basis (API, already proxied)
 */

// Firecrawl client (lazy init)
let firecrawl: FirecrawlApp | null = null;

function getFirecrawl(): FirecrawlApp {
    if (!firecrawl) {
        if (!env.FIRECRAWL_API_KEY) {
            throw new Error('FIRECRAWL_API_KEY is not configured');
        }
        firecrawl = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
    }
    return firecrawl;
}

// -- Bid extraction types --

export interface ScrapedBid {
    facilityName: string;
    commodity: string;         // 'Corn', 'Soybeans', 'Wheat', etc.
    cashBid: number | null;    // $/bushel
    basis: number | null;      // $/bushel relative to futures
    deliveryPeriod: string;    // 'Spot', 'Mar 26', etc.
    source: string;            // URL scraped
    scrapedAt: string;         // ISO timestamp
}

export interface ScrapeTarget {
    buyerId: string;           // UUID from buyers table
    name: string;
    bidPageUrl: string;        // URL to scrape
    state: string;
    city: string;
    extractionHints: string[]; // keywords to look for in page content
}

// -- Known Scrape Targets --
// These are BNSF-served facilities with known public bid pages.
// We'll expand this list as we discover more.

/**
 * Build a Barchart cash grain URL for a specific area.
 * Barchart organizes bids by state/region.
 */
function barchartCashUrl(state: string): string {
    // Barchart cash grain by state
    return `https://www.barchart.com/futures/quotes/ZC*0/cash-prices?state=${state}`;
}

/**
 * Scrape a single bid page and extract cash bid data.
 * Uses Firecrawl to render the page and extract markdown content,
 * then parses for bid information.
 */
export async function scrapeBidPage(target: ScrapeTarget): Promise<ScrapedBid[]> {
    const fc = getFirecrawl();
    const bids: ScrapedBid[] = [];

    try {
        logger.info('Scraping bid page', {
            facility: target.name,
            url: target.bidPageUrl,
        });

        const result = await fc.scrape(target.bidPageUrl, {
            formats: ['markdown'],
        } as any) as any;

        if (!result.markdown) {
            logger.warn('Scrape returned no content', {
                facility: target.name,
                url: target.bidPageUrl,
            });
            return bids;
        }

        const markdown = result.markdown as string;

        // Parse bid data from the scraped content
        const parsedBids = extractBidsFromMarkdown(markdown, target);
        bids.push(...parsedBids);

        logger.info('Scraped bids successfully', {
            facility: target.name,
            bidCount: bids.length,
        });
    } catch (error) {
        logger.error('Firecrawl scrape error', {
            facility: target.name,
            url: target.bidPageUrl,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return bids;
}

/**
 * Extract bid data from scraped markdown content.
 * Looks for patterns like "$4.30", "basis -0.47", etc.
 */
function extractBidsFromMarkdown(
    markdown: string,
    target: ScrapeTarget
): ScrapedBid[] {
    const bids: ScrapedBid[] = [];
    const now = new Date().toISOString();

    // Common commodities to look for
    const commodities = ['corn', 'soybeans', 'wheat', 'milo', 'sorghum', 'sunflower'];

    // Pattern: price like $4.30 or 4.30
    const pricePattern = /\$?\d+\.\d{2}/g;

    // Pattern: basis like -0.47 or +0.25 or -47 (in cents)
    const basisPattern = /[+-]\d+\.?\d*/g;

    // Split into lines and look for bid-related info
    const lines = markdown.split('\n');

    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        // Check if line mentions a commodity or the facility
        const hasCommodity = commodities.some(c => lowerLine.includes(c));
        const hasFacilityHint = target.extractionHints.some(h =>
            lowerLine.includes(h.toLowerCase())
        );

        if (!hasCommodity && !hasFacilityHint) continue;

        // Extract prices from this line
        const prices = line.match(pricePattern);
        const bases = line.match(basisPattern);

        if (prices && prices.length > 0) {
            const cashBid = parseFloat(prices[0].replace('$', ''));

            // Sanity check — grain prices should be between $2 and $25/bu
            if (cashBid < 2 || cashBid > 25) continue;

            let basis: number | null = null;
            if (bases && bases.length > 0) {
                const rawBasis = parseFloat(bases[0]);
                // If basis looks like cents (e.g., -47), convert to dollars
                basis = Math.abs(rawBasis) > 5 ? rawBasis / 100 : rawBasis;
            }

            // Determine commodity
            let commodity = 'Corn'; // default
            if (lowerLine.includes('soybean')) commodity = 'Soybeans';
            else if (lowerLine.includes('wheat')) commodity = 'Wheat';
            else if (lowerLine.includes('milo') || lowerLine.includes('sorghum')) commodity = 'Sorghum';
            else if (lowerLine.includes('sunflower')) commodity = 'Sunflowers';

            // Determine delivery period
            let deliveryPeriod = 'Spot';
            if (lowerLine.includes('mar')) deliveryPeriod = "Mar '26";
            else if (lowerLine.includes('may')) deliveryPeriod = "May '26";
            else if (lowerLine.includes('jul')) deliveryPeriod = "Jul '26";

            bids.push({
                facilityName: target.name,
                commodity,
                cashBid,
                basis,
                deliveryPeriod,
                source: target.bidPageUrl,
                scrapedAt: now,
            });
        }
    }

    // Deduplicate — keep the first bid per commodity
    const seen = new Set<string>();
    return bids.filter(bid => {
        const key = `${bid.facilityName}::${bid.commodity}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Scrape Barchart cash grain page for a given state.
 * Returns bids for all facilities listed on that page.
 */
export async function scrapeBarchartState(state: string): Promise<ScrapedBid[]> {
    const fc = getFirecrawl();
    const url = barchartCashUrl(state);
    const bids: ScrapedBid[] = [];

    try {
        logger.info('Scraping Barchart cash grain', { state, url });

        const result = await fc.scrape(url, {
            formats: ['markdown'],
        } as any) as any;

        if (!result.markdown) {
            logger.warn('Barchart scrape returned no content', { state });
            return bids;
        }

        // Parse the Barchart table (typically: Location | Basis | Cash Price | Delivery)
        const lines = (result.markdown as string).split('\n');
        const now = new Date().toISOString();

        for (const line of lines) {
            // Look for table rows with pipe separators
            if (!line.includes('|')) continue;

            const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
            if (cells.length < 3) continue;

            // Try to extract: Location | Basis | Price
            const location = cells[0];
            const priceMatch = cells.find((c: string) => /\d+\.\d{2}/.test(c));
            const basisMatch = cells.find((c: string) => /[+-]?\d+\.?\d*/.test(c) && c !== priceMatch);

            if (!priceMatch) continue;

            const cashBid = parseFloat(priceMatch.replace(/[^0-9.-]/g, ''));
            if (cashBid < 2 || cashBid > 25) continue;

            let basis: number | null = null;
            if (basisMatch) {
                const rawBasis = parseFloat(basisMatch.replace(/[^0-9.+-]/g, ''));
                basis = Math.abs(rawBasis) > 5 ? rawBasis / 100 : rawBasis;
            }

            bids.push({
                facilityName: location,
                commodity: 'Corn',
                cashBid,
                basis,
                deliveryPeriod: 'Spot',
                source: url,
                scrapedAt: now,
            });
        }

        logger.info('Barchart scrape complete', {
            state,
            bidCount: bids.length,
        });
    } catch (error) {
        logger.error('Barchart scrape error', {
            state,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return bids;
}

/**
 * Scrape Scoular Bushel Portal for cash bids.
 * This handles the specific markdown format returned by their portal.
 */
export async function scrapeScoularBids(): Promise<ScrapedBid[]> {
    const fc = getFirecrawl();
    const url = 'https://portal.bushelpowered.com/scoular/cash-bids';
    const bids: ScrapedBid[] = [];

    try {
        logger.info('Scraping Scoular cash bids', { url });

        const result = await fc.scrape(url, {
            formats: ['markdown'],
            waitFor: 5000
        });

        if (!result.markdown) {
            logger.warn('Scoular scrape returned no content');
            return bids;
        }

        const lines = result.markdown.split('\n').map(l => l.trim()).filter(Boolean);
        const now = new Date().toISOString();

        let currentLocation = '';
        let currentCommodity = '';
        let headersFound = false;
        let valuesBuffer: string[] = [];

        for (const line of lines) {
            if (line.startsWith('##### ')) {
                // e.g., "##### Downs, KS" -> "Downs"
                currentLocation = line.replace('##### ', '').split(',')[0].trim();
                headersFound = false;
                valuesBuffer = [];
                continue;
            }
            if (line.startsWith('###### ')) {
                currentCommodity = line.replace('###### ', '').trim();
                headersFound = false;
                valuesBuffer = [];
                continue;
            }
            if (line === 'Futures Month') {
                headersFound = true;
                valuesBuffer = [];
                continue;
            }
            if (line === '* * *' || line.includes('---')) {
                headersFound = false;
                valuesBuffer = [];
                continue;
            }

            if (headersFound && currentLocation && currentCommodity) {
                valuesBuffer.push(line);
                if (valuesBuffer.length === 6) {
                    const [delivery, bidStr, basisStr] = valuesBuffer;

                    if (bidStr !== '—' && !isNaN(parseFloat(bidStr))) {
                        let commodity = currentCommodity;
                        if (commodity === 'YC') commodity = 'Corn';
                        else if (commodity === 'YSB') commodity = 'Soybeans';
                        else if (commodity === 'HRWW') commodity = 'Wheat';
                        else if (commodity === 'SOR') commodity = 'Sorghum';

                        bids.push({
                            facilityName: `Scoular ${currentLocation}`,
                            commodity,
                            cashBid: parseFloat(bidStr),
                            basis: basisStr !== '—' ? parseFloat(basisStr) : null,
                            deliveryPeriod: delivery,
                            source: url,
                            scrapedAt: now
                        });
                    }
                    valuesBuffer = [];
                }
            }
        }

        logger.info('Scoular scrape complete', { bidCount: bids.length });
    } catch (error) {
        logger.error('Scoular scrape error', {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return bids;
}

/**
 * Upsert scraped bids into the buyers table.
 * Matches by facility name + state using fuzzy matching.
 */
export async function upsertScrapedBids(bids: ScrapedBid[]): Promise<{
    matched: number;
    updated: number;
    unmatched: string[];
}> {
    let matched = 0;
    let updated = 0;
    const unmatched: string[] = [];

    for (const bid of bids) {
        if (bid.cashBid === null) continue;

        try {
            // Try to match to an existing buyer by name (fuzzy)
            const result = await dbQuery<{ id: string; name: string }>(
                `SELECT id, name FROM buyers
                 WHERE active = TRUE
                   AND LOWER(name) LIKE $1
                 ORDER BY name
                 LIMIT 1`,
                [`%${bid.facilityName.toLowerCase().split(' ')[0]}%`]
            );

            if (result.rows.length === 0) {
                unmatched.push(bid.facilityName);
                continue;
            }

            matched++;
            const buyer = result.rows[0];

            // Update the buyer's cash bid columns
            const updateResult = await dbQuery(
                `UPDATE buyers
                 SET cash_bid = $2,
                     posted_basis = $3,
                     bid_date = CURRENT_DATE,
                     bid_source = $4,
                     updated_at = NOW()
                 WHERE id = $1`,
                [buyer.id, bid.cashBid, bid.basis, bid.source]
            );

            if ((updateResult.rowCount ?? 0) > 0) {
                updated++;
                logger.info('Updated buyer bid', {
                    buyerId: buyer.id,
                    buyerName: buyer.name,
                    cashBid: bid.cashBid,
                    basis: bid.basis,
                    source: bid.source,
                });
            }
        } catch (error) {
            logger.error('Bid upsert error', {
                facility: bid.facilityName,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return { matched, updated, unmatched };
}

// -- Pipeline Orchestration --

/** BNSF corridor states to scrape from Barchart */
const BNSF_STATES = [
    // Northern Plains (home territory)
    'ND', 'SD', 'MN', 'MT', 'WY',
    // Central Corridor
    'NE', 'KS', 'IA', 'MO', 'CO',
    // Southern Corridor
    'TX', 'OK', 'AR', 'LA', 'MS', 'AL', 'TN',
    // Western Corridor
    'CA', 'WA', 'OR', 'ID', 'NM',
    // Eastern Corridor
    'IL', 'WI', 'IN', 'OH',
];

export interface PipelineResult {
    startedAt: string;
    endedAt: string;
    statesScraped: number;
    totalBidsFound: number;
    matched: number;
    updated: number;
    unmatched: string[];
    errors: string[];
}

/**
 * Run the full daily bid scraping pipeline.
 * Called by the cron job at 5:00 AM CT on weekdays.
 * Scrapes Barchart (all BNSF states) + Bushel portals.
 */
export async function runDailyBidPipeline(): Promise<PipelineResult> {
    const startedAt = new Date().toISOString();
    const allBids: ScrapedBid[] = [];
    const errors: string[] = [];
    let statesScraped = 0;

    logger.info('=== Starting Daily Bid Pipeline ===', {
        startedAt,
        totalStates: BNSF_STATES.length,
        bushelPortals: BUSHEL_PORTALS.length,
    });

    // Phase 1: Scrape Barchart cash grain — batched 5 states at a time
    const BATCH_SIZE = 5;
    for (let i = 0; i < BNSF_STATES.length; i += BATCH_SIZE) {
        const batch = BNSF_STATES.slice(i, i + BATCH_SIZE);
        logger.info(`Scraping Barchart batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
            states: batch,
        });

        const batchResults = await Promise.allSettled(
            batch.map(async (state) => {
                const bids = await scrapeBarchartState(state);
                statesScraped++;
                return { state, bids };
            })
        );

        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                allBids.push(...result.value.bids);
            } else {
                const msg = `Barchart batch error: ${result.reason}`;
                errors.push(msg);
                logger.error(msg);
            }
        }

        // Rate limit between batches
        if (i + BATCH_SIZE < BNSF_STATES.length) {
            await sleep(3000);
        }
    }

    // Phase 2: Scrape Bushel-powered portals
    logger.info('Scraping Bushel portals', { count: BUSHEL_PORTALS.length });
    for (const portal of BUSHEL_PORTALS) {
        try {
            const portalBids = await scrapeBushelPortal(portal);
            allBids.push(...portalBids);
            await sleep(1500);
        } catch (error) {
            const msg = `Bushel ${portal.name}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            logger.error(msg);
        }
    }

    // Phase 2.5: Direct Scoular Scrape (may overlap with Bushel but has custom parser)
    try {
        const scoularBids = await scrapeScoularBids();
        allBids.push(...scoularBids);
    } catch (error) {
        const msg = `Scoular Scrape: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
        logger.error(msg);
    }

    logger.info('Scraping complete. Starting upsert phase.', {
        totalBidsFound: allBids.length,
        statesScraped,
    });

    // Phase 3: Upsert bids into Postgres
    const { matched, updated, unmatched } = await upsertScrapedBids(allBids);

    const endedAt = new Date().toISOString();

    const result: PipelineResult = {
        startedAt,
        endedAt,
        statesScraped,
        totalBidsFound: allBids.length,
        matched,
        updated,
        unmatched: [...new Set(unmatched)].slice(0, 50),
        errors,
    };

    logger.info('=== Daily Bid Pipeline Complete ===', result);

    return result;
}

// -- Bushel Portal Configs --

interface BushelPortal {
    name: string;
    url: string;
    states: string[];
}

const BUSHEL_PORTALS: BushelPortal[] = [
    { name: 'Scoular', url: 'https://portal.bushelpowered.com/scoular/cash-bids', states: ['KS', 'NE', 'CO'] },
    { name: 'CHS Farmers Alliance', url: 'https://portal.bushelpowered.com/chsfarmersalliance/cash-bids', states: ['MN', 'ND', 'SD', 'MT'] },
    { name: 'Gavilon', url: 'https://portal.bushelpowered.com/gavilon/cash-bids', states: ['NE', 'IA', 'KS', 'TX'] },
    { name: 'Premier Companies', url: 'https://portal.bushelpowered.com/premierag/cash-bids', states: ['TX', 'KS', 'OK'] },
    { name: 'AGP', url: 'https://portal.bushelpowered.com/agp/cash-bids', states: ['NE', 'IA', 'MO', 'MN'] },
    { name: 'CHS Dakota Plains', url: 'https://portal.bushelpowered.com/chsdakotaplainsag/cash-bids', states: ['ND', 'MN'] },
    { name: 'CHS Northern Grain', url: 'https://portal.bushelpowered.com/chsnortherngrain/cash-bids', states: ['MN', 'ND'] },
    { name: 'United Cooperative', url: 'https://portal.bushelpowered.com/unitedcooperative/cash-bids', states: ['WI', 'MN'] },
];

async function scrapeBushelPortal(portal: BushelPortal): Promise<ScrapedBid[]> {
    const fc = getFirecrawl();
    const bids: ScrapedBid[] = [];

    try {
        logger.info(`Scraping Bushel portal: ${portal.name}`, { url: portal.url });

        const result = await fc.scrape(portal.url, {
            formats: ['markdown'],
            waitFor: 5000,
        }) as any;

        if (!result.markdown) {
            logger.warn(`Bushel portal returned no content: ${portal.name}`);
            return bids;
        }

        const lines = (result.markdown as string).split('\n').map((l: string) => l.trim()).filter(Boolean);
        const now = new Date().toISOString();

        let currentLocation = '';
        let currentCommodity = '';
        let headersFound = false;
        let valuesBuffer: string[] = [];

        for (const line of lines) {
            if (line.startsWith('##### ')) {
                currentLocation = line.replace('##### ', '').split(',')[0].trim();
                headersFound = false;
                valuesBuffer = [];
                continue;
            }
            if (line.startsWith('###### ')) {
                currentCommodity = line.replace('###### ', '').trim();
                headersFound = false;
                valuesBuffer = [];
                continue;
            }
            if (line === 'Futures Month') {
                headersFound = true;
                valuesBuffer = [];
                continue;
            }
            if (line === '* * *' || line.includes('---')) {
                headersFound = false;
                valuesBuffer = [];
                continue;
            }

            if (headersFound && currentLocation && currentCommodity) {
                valuesBuffer.push(line);
                if (valuesBuffer.length === 6) {
                    const [delivery, bidStr, basisStr] = valuesBuffer;

                    if (bidStr !== '—' && !isNaN(parseFloat(bidStr))) {
                        let commodity = currentCommodity;
                        if (commodity === 'YC') commodity = 'Corn';
                        else if (commodity === 'YSB') commodity = 'Soybeans';
                        else if (commodity === 'HRWW') commodity = 'Wheat';
                        else if (commodity === 'SOR') commodity = 'Sorghum';

                        bids.push({
                            facilityName: `${portal.name} ${currentLocation}`,
                            commodity,
                            cashBid: parseFloat(bidStr),
                            basis: basisStr !== '—' ? parseFloat(basisStr) : null,
                            deliveryPeriod: delivery,
                            source: portal.url,
                            scrapedAt: now,
                        });
                    }
                    valuesBuffer = [];
                }
            }
        }

        logger.info(`Bushel portal scraped: ${portal.name}`, { bidCount: bids.length });
    } catch (error) {
        logger.error(`Bushel portal error: ${portal.name}`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return bids;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
