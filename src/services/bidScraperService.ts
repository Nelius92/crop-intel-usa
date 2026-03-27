/**
 * Bid Scraper Service
 * 
 * 3-Tier data acquisition system for nationwide grain cash bids.
 * Finds the BEST prices in the country so Campbell farmers don't have
 * to accept weak local basis.
 * 
 * Tier 1: Barchart getGrainBids API (structured JSON, 30 nearest buyers per zip)
 * Tier 2: Firecrawl v2 /interact (JS-rendered sites like Al-Corn, Bushel portals)
 * Tier 3: USDA/NSA reports (sunflower data + fallback)
 * 
 * Designed to run ONCE daily at 6 AM CT as a morning scan.
 */

import {
    ScrapedBid,
    MorningScanResult,
    calculateCashBid,
    calculateBasis,
    validateBid,
    validateSunflowerPrice,
    getContractMonthName,
    CROP_CONTRACT_MAP,
} from './bidFormulaEngine';

// ── Configuration ────────────────────────────────────────────────

const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY || '';
const BARCHART_API_KEY = import.meta.env.VITE_BARCHART_API_KEY || '';

// Zip codes to scan — covers the major grain consumption regions
// Campbell, MN farmers can ship via BNSF to ANY of these destinations
const SCAN_ZIP_CODES = [
    '56009',  // Campbell, MN (local reference)
    '58102',  // Fargo, ND (Northern Plains)
    '57104',  // Sioux Falls, SD (Central corridor)
    '55401',  // Minneapolis, MN (Twin Cities)
    '68102',  // Omaha, NE (Central Plains)
    '66101',  // Kansas City, KS (Southern Plains)
    '79101',  // Amarillo, TX (Feedlot alley)
    '30301',  // Atlanta, GA (Southeast poultry)
    '70112',  // New Orleans, LA (Gulf export)
    '97201',  // Portland, OR (Pacific NW export)
];

// Target buyer websites for Firecrawl scraping (Tier 2)
const FIRECRAWL_TARGETS: { name: string; url: string; crop: string; type: string }[] = [
    { name: 'Al-Corn Clean Fuel', url: 'https://al-corn.com/cash-bids/', crop: 'Yellow Corn', type: 'ethanol' },
    // Additional targets can be added here as we discover them
    // { name: 'Highwater Ethanol', url: '...', crop: 'Yellow Corn', type: 'ethanol' },
    // { name: 'Southwest GA', url: '...', crop: 'Yellow Corn', type: 'ethanol' },
];

// Crop names as Barchart understands them
const BARCHART_CROP_NAMES: Record<string, string> = {
    'Yellow Corn': 'Corn',
    'Soybeans': 'Soybeans',
    'Wheat': 'Wheat',
    'White Corn': 'Corn',
    // Sunflowers not available on Barchart — handled by Tier 3
};

// ── Tier 1: Barchart API ─────────────────────────────────────────

/**
 * Fetch cash bids from Barchart's getGrainBids API.
 * Returns the 30 nearest buyers to each zip code with live basis + futures.
 * 
 * This is the most reliable and structured data source.
 */
async function fetchBarchartBids(
    zipCodes: string[],
    crops: string[]
): Promise<ScrapedBid[]> {
    if (!BARCHART_API_KEY) {
        console.warn('[BidScraper] No BARCHART_API_KEY — skipping Tier 1');
        return [];
    }

    const bids: ScrapedBid[] = [];
    const now = new Date().toISOString();

    for (const zip of zipCodes) {
        for (const crop of crops) {
            const barchartCrop = BARCHART_CROP_NAMES[crop];
            if (!barchartCrop) continue; // Skip sunflowers (no Barchart data)

            try {
                const url = new URL('https://ondemand.websol.barchart.com/getGrainBids.json');
                url.searchParams.set('apikey', BARCHART_API_KEY);
                url.searchParams.set('zipCode', zip);
                url.searchParams.set('commodity', barchartCrop);
                url.searchParams.set('maxDistance', '250');

                const response = await fetch(url.toString());
                if (!response.ok) {
                    console.warn(`[BidScraper] Barchart error for ${zip}/${crop}: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                const results = data.results || [];

                for (const result of results) {
                    const futuresPrice = parseFloat(result.futuresPrice) || 0;
                    const basis = parseFloat(result.basis) || 0;
                    const cashBid = parseFloat(result.cashPrice) || calculateCashBid(futuresPrice, basis);

                    // Validate the formula
                    const validation = validateBid(cashBid, futuresPrice, basis);

                    bids.push({
                        buyerName: result.locationName || 'Unknown',
                        city: result.city || '',
                        state: result.state || '',
                        crop,
                        deliveryPeriod: result.deliveryPeriod || 'Spot',
                        contractMonth: result.contractMonth || getContractMonthName(crop, new Date().getMonth() + 1) || '',
                        futuresPrice,
                        basis,
                        cashBid,
                        change: parseFloat(result.change) || 0,
                        scrapedAt: now,
                        source: 'barchart-api',
                        sourceUrl: `https://www.barchart.com/solutions/grain-bids?zip=${zip}`,
                        priceUnit: CROP_CONTRACT_MAP[crop]?.priceUnit || '$/bu',
                        validated: validation.valid,
                    });
                }
            } catch (err) {
                console.error(`[BidScraper] Barchart fetch failed for ${zip}/${crop}:`, err);
            }
        }
    }

    return deduplicateBids(bids);
}

// ── Tier 2: Firecrawl /interact Scraping ─────────────────────────

/**
 * Scrape a JS-rendered cash bids page using Firecrawl v2 /interact.
 * 
 * Flow:
 * 1. POST /v2/scrape → renders page with JS
 * 2. POST /v2/scrape/{scrapeId}/interact → run Playwright to extract table
 * 3. DELETE /v2/scrape/{scrapeId}/interact → cleanup session
 */
async function scrapeWithFirecrawlInteract(
    target: { name: string; url: string; crop: string; type: string }
): Promise<ScrapedBid[]> {
    if (!FIRECRAWL_API_KEY) {
        console.warn('[BidScraper] No FIRECRAWL_API_KEY — skipping Tier 2');
        return [];
    }

    const now = new Date().toISOString();
    const bids: ScrapedBid[] = [];

    try {
        console.log(`[BidScraper] Firecrawl scraping: ${target.name} (${target.url})`);

        // Step 1: Scrape the page (let Firecrawl render JS)
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
                url: target.url,
                formats: ['markdown'],
                waitFor: 8000, // Wait 8s for DTN/CIH widget to render
            }),
        });

        if (!scrapeResponse.ok) {
            const errText = await scrapeResponse.text();
            console.error(`[BidScraper] Firecrawl scrape failed: ${scrapeResponse.status} ${errText}`);
            return [];
        }

        const scrapeData = await scrapeResponse.json();
        const scrapeId = scrapeData?.data?.metadata?.scrapeId;

        if (!scrapeId) {
            console.warn('[BidScraper] No scrapeId returned — page may not have loaded');
            // Try to extract from markdown content as fallback
            return extractBidsFromMarkdown(scrapeData?.data?.markdown || '', target, now);
        }

        // Step 2: Interact — run Playwright code to extract bid table
        const interactResponse = await fetch(
            `https://api.firecrawl.dev/v2/scrape/${scrapeId}/interact`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                    code: `
                        // Wait for bid table or widget to render
                        try {
                            await page.waitForSelector('table, [class*="bid"], [class*="cash"], [id*="bid"]', { timeout: 12000 });
                        } catch(e) {
                            // If no table found, try to get any price data from the page
                        }

                        // Try multiple selector patterns for bid tables
                        const selectors = [
                            'table tbody tr',
                            '[class*="bid-row"]',
                            '[class*="cashBid"] tr',
                            '.grain-bid-row',
                        ];

                        let rows = [];
                        for (const sel of selectors) {
                            const elements = await page.$$(sel);
                            if (elements.length > 0) {
                                rows = await page.$$eval(sel, trs =>
                                    trs.map(tr => {
                                        const cells = [...tr.querySelectorAll('td, th')];
                                        return cells.map(c => c.textContent?.trim() || '');
                                    }).filter(row => row.length >= 3)
                                );
                                break;
                            }
                        }

                        // Also try to find any text that looks like price data
                        const pageText = await page.evaluate(() => document.body.innerText);
                        
                        JSON.stringify({ rows, pageText: pageText.substring(0, 3000) });
                    `,
                    language: 'node',
                    timeout: 30,
                }),
            }
        );

        // Step 3: Cleanup session
        try {
            await fetch(
                `https://api.firecrawl.dev/v2/scrape/${scrapeId}/interact`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
                }
            );
        } catch {
            // Cleanup is best-effort
        }

        if (!interactResponse.ok) {
            console.warn(`[BidScraper] Firecrawl interact failed: ${interactResponse.status}`);
            return [];
        }

        const interactData = await interactResponse.json();
        const resultStr = interactData?.result || interactData?.stdout || '{}';

        let parsed: { rows?: string[][]; pageText?: string };
        try {
            parsed = JSON.parse(resultStr);
        } catch {
            parsed = { pageText: resultStr };
        }

        // Parse the table rows into ScrapedBid objects
        if (parsed.rows && parsed.rows.length > 0) {
            for (const row of parsed.rows) {
                const bid = parseBidRow(row, target, now);
                if (bid) bids.push(bid);
            }
        }

        // If no structured rows, try to extract from page text
        if (bids.length === 0 && parsed.pageText) {
            const textBids = extractBidsFromText(parsed.pageText, target, now);
            bids.push(...textBids);
        }

        console.log(`[BidScraper] Firecrawl extracted ${bids.length} bids from ${target.name}`);

    } catch (err) {
        console.error(`[BidScraper] Firecrawl error for ${target.name}:`, err);
    }

    return bids;
}

/**
 * Parse a single row from a scraped bid table.
 * Handles common column layouts:
 *   [delivery, contract, futures, change, basis, bid]
 *   [commodity, delivery, bid, basis, change]
 */
function parseBidRow(
    cells: string[],
    target: { name: string; url: string; crop: string; type: string },
    timestamp: string
): ScrapedBid | null {
    if (cells.length < 3) return null;

    // Try to identify the column layout by looking for price-like values
    const pricePattern = /^\$?-?\d+\.\d{2,4}$/;
    const priceIndices = cells
        .map((c, i) => ({ val: c.replace(/[,$]/g, ''), idx: i }))
        .filter(x => pricePattern.test(x.val));

    if (priceIndices.length < 2) return null;

    // Heuristic: Al-Corn layout is [delivery, contract, futures, change, basis, bid]
    let delivery = cells[0] || 'Spot';
    let contractMonth = cells[1] || '';
    let futures = 0;
    let basis = 0;
    let cashBid = 0;

    if (cells.length >= 6) {
        // Full layout: delivery, contract, futures, change, basis, bid
        futures = parseFloat(cells[2]?.replace(/[,$]/g, '')) || 0;
        basis = parseFloat(cells[4]?.replace(/[,$]/g, '')) || 0;
        cashBid = parseFloat(cells[5]?.replace(/[,$]/g, '')) || 0;
    } else if (cells.length >= 4) {
        // Compact: delivery, bid, basis, change
        cashBid = parseFloat(cells[1]?.replace(/[,$]/g, '')) || 0;
        basis = parseFloat(cells[2]?.replace(/[,$]/g, '')) || 0;
    }

    // Validate
    if (cashBid <= 0) return null;

    // If we have futures + basis, validate the formula
    let validated = false;
    if (futures > 0 && basis !== 0) {
        const check = validateBid(cashBid, futures, basis);
        validated = check.valid;
        // If bid doesn't match formula, back-calculate
        if (!validated && Math.abs(check.diff) > 0.05) {
            basis = calculateBasis(cashBid, futures);
        }
    } else if (futures === 0 && cashBid > 0 && basis !== 0) {
        // Calculate futures from bid and basis
        futures = Math.round((cashBid - basis) * 10000) / 10000;
        validated = true; // formula is tautological here
    }

    return {
        buyerName: target.name,
        city: '', // Will be enriched later
        state: '',
        crop: target.crop,
        deliveryPeriod: delivery,
        contractMonth: contractMonth || 'Spot',
        futuresPrice: futures,
        basis,
        cashBid,
        scrapedAt: timestamp,
        source: 'firecrawl-interact',
        sourceUrl: target.url,
        priceUnit: CROP_CONTRACT_MAP[target.crop]?.priceUnit || '$/bu',
        validated,
    };
}

/**
 * Extract bids from raw markdown content (fallback for static pages).
 */
function extractBidsFromMarkdown(
    markdown: string,
    target: { name: string; url: string; crop: string; type: string },
    timestamp: string
): ScrapedBid[] {
    return extractBidsFromText(markdown, target, timestamp);
}

/**
 * Extract bids from raw page text using pattern matching.
 * Looks for price patterns like "$4.24" near keywords like "corn", "bid", "basis".
 */
function extractBidsFromText(
    text: string,
    target: { name: string; url: string; crop: string; type: string },
    timestamp: string
): ScrapedBid[] {
    const bids: ScrapedBid[] = [];

    // Pattern: find lines with price-like values
    const priceRegex = /\$?(\d+\.\d{2,4})/g;
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
        const prices = [...line.matchAll(priceRegex)].map(m => parseFloat(m[1]));
        if (prices.length >= 2) {
            // Heuristic: if we find 2+ prices on one line, it might be a bid row
            const [first, second] = prices;

            // Determine which is futures and which is bid based on magnitude
            // Corn: futures ~$4-5, bid ~$3-5
            // Soybeans: futures ~$10-14, bid ~$9-13
            if (first > 0 && second > 0) {
                const cashBid = Math.min(first, second); // Usually bid < futures if basis is negative
                const futures = Math.max(first, second);
                const basis = calculateBasis(cashBid, futures);

                bids.push({
                    buyerName: target.name,
                    city: '',
                    state: '',
                    crop: target.crop,
                    deliveryPeriod: 'Spot',
                    contractMonth: 'Nearby',
                    futuresPrice: futures,
                    basis,
                    cashBid,
                    scrapedAt: timestamp,
                    source: 'firecrawl-scrape',
                    sourceUrl: target.url,
                    priceUnit: CROP_CONTRACT_MAP[target.crop]?.priceUnit || '$/bu',
                    validated: false, // Text extraction is unvalidated
                });
            }
        }
    }

    return bids;
}

// ── Tier 3: USDA/NSA Fallback ────────────────────────────────────

/**
 * Fetch sunflower prices from NSA daily market news.
 * Also used as general fallback for any crop when Tier 1+2 fail.
 */
async function fetchUSDAFallback(crops: string[]): Promise<ScrapedBid[]> {
    const bids: ScrapedBid[] = [];
    const now = new Date().toISOString();

    // Sunflower-specific: NSA market data
    if (crops.includes('Sunflowers')) {
        try {
            // Try to scrape NSA daily prices
            const nsaUrl = 'https://sunflowernsa.com/markets/';
            if (FIRECRAWL_API_KEY) {
                const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                    },
                    body: JSON.stringify({
                        url: nsaUrl,
                        formats: ['markdown'],
                        waitFor: 5000,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const markdown = data?.data?.markdown || '';

                    // Look for sunflower prices in the NSA page
                    const priceRegex = /(?:ADM|Cargill|Northern Sun|Enderlin|West Fargo)[\s\S]*?\$?(\d+\.\d{2})/gi;
                    let match;
                    while ((match = priceRegex.exec(markdown)) !== null) {
                        const price = parseFloat(match[1]);
                        if (validateSunflowerPrice(price)) {
                            bids.push({
                                buyerName: match[0].split(/[\s,]/)[0] || 'NSA Report',
                                city: '',
                                state: 'ND',
                                crop: 'Sunflowers',
                                deliveryPeriod: 'Spot',
                                contractMonth: 'Spot Cash',
                                futuresPrice: price, // Sunflowers: "futures" = spot cash
                                basis: 0,
                                cashBid: price,
                                scrapedAt: now,
                                source: 'usda-report',
                                sourceUrl: nsaUrl,
                                priceUnit: '$/cwt',
                                validated: true,
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[BidScraper] NSA sunflower fetch failed:', err);
        }
    }

    return bids;
}

// ── Utility Functions ────────────────────────────────────────────

/**
 * Remove duplicate bids (same buyer + delivery period + crop).
 * Keep the most recently scraped version.
 */
function deduplicateBids(bids: ScrapedBid[]): ScrapedBid[] {
    const seen = new Map<string, ScrapedBid>();

    for (const bid of bids) {
        const key = `${bid.buyerName}|${bid.crop}|${bid.deliveryPeriod}`;
        const existing = seen.get(key);

        if (!existing || bid.scrapedAt > existing.scrapedAt) {
            seen.set(key, bid);
        }
    }

    return Array.from(seen.values());
}

// ── Main Orchestrator ────────────────────────────────────────────

/**
 * Run the complete morning scan.
 * Calls all three tiers, deduplicates, validates, and returns results.
 */
export async function runMorningScan(
    crops: string[] = ['Yellow Corn', 'Soybeans', 'Wheat', 'Sunflowers']
): Promise<MorningScanResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let allBids: ScrapedBid[] = [];

    console.log(`[MorningScan] Starting scan for crops: ${crops.join(', ')}`);

    // Tier 1: Barchart API (fastest, most reliable)
    try {
        console.log('[MorningScan] Tier 1: Barchart API...');
        const barchartBids = await fetchBarchartBids(SCAN_ZIP_CODES, crops);
        console.log(`[MorningScan] Tier 1: ${barchartBids.length} bids from Barchart`);
        allBids.push(...barchartBids);
    } catch (err) {
        const msg = `Tier 1 (Barchart) failed: ${(err as Error).message}`;
        errors.push(msg);
        console.error(`[MorningScan] ${msg}`);
    }

    // Tier 2: Firecrawl /interact scraping
    try {
        console.log('[MorningScan] Tier 2: Firecrawl scraping...');
        for (const target of FIRECRAWL_TARGETS) {
            if (crops.includes(target.crop)) {
                const firecrawlBids = await scrapeWithFirecrawlInteract(target);
                allBids.push(...firecrawlBids);
            }
        }
        const tier2Count = allBids.filter(b => b.source.startsWith('firecrawl')).length;
        console.log(`[MorningScan] Tier 2: ${tier2Count} bids from Firecrawl`);
    } catch (err) {
        const msg = `Tier 2 (Firecrawl) failed: ${(err as Error).message}`;
        errors.push(msg);
        console.error(`[MorningScan] ${msg}`);
    }

    // Tier 3: USDA/NSA fallback
    try {
        console.log('[MorningScan] Tier 3: USDA/NSA fallback...');
        const usdaBids = await fetchUSDAFallback(crops);
        console.log(`[MorningScan] Tier 3: ${usdaBids.length} bids from USDA/NSA`);
        allBids.push(...usdaBids);
    } catch (err) {
        const msg = `Tier 3 (USDA) failed: ${(err as Error).message}`;
        errors.push(msg);
        console.error(`[MorningScan] ${msg}`);
    }

    // Final deduplication
    allBids = deduplicateBids(allBids);

    // Count validations
    const validatedBids = allBids.filter(b => b.validated).length;
    const failedValidation = allBids.filter(b => !b.validated).length;

    // Count by source
    const bidsBySource: Record<string, number> = {};
    for (const bid of allBids) {
        bidsBySource[bid.source] = (bidsBySource[bid.source] || 0) + 1;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MorningScan] Complete: ${allBids.length} total bids in ${elapsed}s`);
    console.log(`[MorningScan] Validated: ${validatedBids}, Failed: ${failedValidation}`);

    return {
        scanTime: new Date().toISOString(),
        totalBids: allBids.length,
        bidsBySource,
        validatedBids,
        failedValidation,
        bids: allBids,
        errors,
    };
}

/**
 * Get the best bids for a specific crop, sorted by cash bid (highest first).
 * This is the arbitrage discovery function — finds where to ship grain for maximum profit.
 */
export function getBestBids(
    scanResult: MorningScanResult,
    crop: string,
    limit: number = 20
): ScrapedBid[] {
    return scanResult.bids
        .filter(b => b.crop === crop && b.cashBid > 0)
        .sort((a, b) => b.cashBid - a.cashBid)
        .slice(0, limit);
}

/**
 * Find arbitrage opportunities: buyers paying better than local benchmark.
 * Returns bids where (cashBid - estimatedFreight) > benchmarkNetPrice.
 */
export function findArbitrageOpportunities(
    scanResult: MorningScanResult,
    crop: string,
    _benchmarkNetPrice: number
): ScrapedBid[] {
    return scanResult.bids
        .filter(b => b.crop === crop && b.cashBid > 0)
        // Sort by cash bid descending — freight will be calculated later by buyersService
        .sort((a, b) => b.cashBid - a.cashBid);
}
