/**
 * Morning Bid Scan — CLI Entry Point
 * 
 * Run daily at 6 AM CT to collect the best grain bids nationwide.
 * 
 * Usage:
 *   npx tsx src/scripts/morningBidScan.ts
 *   npx tsx src/scripts/morningBidScan.ts --crops "Yellow Corn,Soybeans"
 * 
 * The scan:
 * 1. Runs all 3 tiers (Barchart → Firecrawl → USDA)
 * 2. Validates every bid against Cash = Futures + Basis
 * 3. Saves to src/data/live_bids.json
 * 4. Prints a summary with the top 5 bids per crop
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Dynamic Import Workaround ────────────────────────────────────
// The bidScraperService uses import.meta.env (Vite), so for CLI
// we set the env vars that it expects before importing.

// Barchart and Firecrawl keys need to be in .env
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || process.env.VITE_FIRECRAWL_API_KEY;
const BARCHART_API_KEY = process.env.BARCHART_API_KEY || process.env.VITE_BARCHART_API_KEY;

// ── Types (mirrors bidFormulaEngine) ─────────────────────────────
interface ScrapedBid {
    buyerName: string;
    city: string;
    state: string;
    crop: string;
    deliveryPeriod: string;
    contractMonth: string;
    futuresPrice: number;
    basis: number;
    cashBid: number;
    change?: number;
    scrapedAt: string;
    source: string;
    sourceUrl?: string;
    priceUnit: string;
    validated: boolean;
}

interface MorningScanResult {
    scanTime: string;
    totalBids: number;
    bidsBySource: Record<string, number>;
    validatedBids: number;
    failedValidation: number;
    bids: ScrapedBid[];
    errors: string[];
}

// ── Configuration ────────────────────────────────────────────────
const SCAN_ZIP_CODES = ['56009', '58102', '57104', '55401', '68102', '66101', '79101', '30301', '70112', '97201'];

const FIRECRAWL_TARGETS = [
    { name: 'Al-Corn Clean Fuel', url: 'https://al-corn.com/cash-bids/', crop: 'Yellow Corn', type: 'ethanol' },
];

const BARCHART_CROP_NAMES: Record<string, string> = {
    'Yellow Corn': 'Corn',
    'Soybeans': 'Soybeans',
    'Wheat': 'Wheat',
    'White Corn': 'Corn',
};

// ── Formula Functions ────────────────────────────────────────────
function calculateCashBid(futures: number, basis: number): number {
    return Math.round((futures + basis) * 100) / 100;
}

function _calculateBasis(cashBid: number, futures: number): number {
    return Math.round((cashBid - futures) * 100) / 100;
}

function validateBid(bid: number, futures: number, basis: number): { valid: boolean; expected: number; diff: number } {
    const expected = calculateCashBid(futures, basis);
    const diff = Math.abs(bid - expected);
    return { valid: diff <= 0.02, expected, diff: Math.round(diff * 100) / 100 };
}

// ── Tier 1: Barchart ─────────────────────────────────────────────
async function fetchBarchartBids(zipCodes: string[], crops: string[]): Promise<ScrapedBid[]> {
    if (!BARCHART_API_KEY) {
        console.log('  ⚠️  No BARCHART_API_KEY — skipping Tier 1');
        return [];
    }

    const bids: ScrapedBid[] = [];
    const now = new Date().toISOString();

    for (const zip of zipCodes) {
        for (const crop of crops) {
            const barchartCrop = BARCHART_CROP_NAMES[crop];
            if (!barchartCrop) continue;

            try {
                const url = `https://ondemand.websol.barchart.com/getGrainBids.json?apikey=${BARCHART_API_KEY}&zipCode=${zip}&commodity=${encodeURIComponent(barchartCrop)}&maxDistance=250`;
                const response = await fetch(url);
                if (!response.ok) continue;

                const data = await response.json();
                for (const r of data.results || []) {
                    const futures = parseFloat(r.futuresPrice) || 0;
                    const basis = parseFloat(r.basis) || 0;
                    const cashBid = parseFloat(r.cashPrice) || calculateCashBid(futures, basis);
                    const val = futures > 0 && basis !== 0 ? validateBid(cashBid, futures, basis) : { valid: false, expected: 0, diff: 0 };

                    bids.push({
                        buyerName: r.locationName || 'Unknown',
                        city: r.city || '', state: r.state || '',
                        crop, deliveryPeriod: r.deliveryPeriod || 'Spot',
                        contractMonth: r.contractMonth || '',
                        futuresPrice: futures, basis, cashBid,
                        change: parseFloat(r.change) || 0,
                        scrapedAt: now, source: 'barchart-api',
                        priceUnit: '$/bu', validated: val.valid,
                    });
                }
            } catch { /* skip */ }
        }
    }

    return bids;
}

// ── Tier 2: Firecrawl /interact ──────────────────────────────────
async function scrapeWithFirecrawl(target: { name: string; url: string; crop: string }): Promise<ScrapedBid[]> {
    if (!FIRECRAWL_API_KEY) {
        console.log('  ⚠️  No FIRECRAWL_API_KEY — skipping Tier 2');
        return [];
    }

    const now = new Date().toISOString();
    const bids: ScrapedBid[] = [];

    try {
        console.log(`  🔍 Scraping: ${target.name} (${target.url})`);

        // Step 1: Scrape the page with JS rendering
        const scrapeRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
                url: target.url,
                formats: ['markdown'],
                waitFor: 8000,
            }),
        });

        if (!scrapeRes.ok) {
            console.error(`  ❌ Scrape failed: ${scrapeRes.status}`);
            return [];
        }

        const scrapeData = await scrapeRes.json();
        const scrapeId = scrapeData?.data?.metadata?.scrapeId;

        if (!scrapeId) {
            console.log('  ℹ️  No scrapeId — trying markdown extraction');
            const md = scrapeData?.data?.markdown || '';
            // Try to find prices in the markdown
            const priceLines = md.split('\n').filter((l: string) => /\d\.\d{2,4}/.test(l));
            console.log(`  Found ${priceLines.length} price-containing lines`);
            return bids;
        }

        // Step 2: Interact with Playwright code
        // Al-Corn uses CIH/DTN widget — NOT in an iframe, injected directly into DOM
        // Key selectors discovered from live inspection:
        //   Rows: tr[data-delivery-period]
        //   Delivery: td > .cih-chart-btn > span:nth-child(2)
        //   Futures Month: td > .cih-flex-row > span:nth-child(1)
        //   Futures Price: td > .cih-flex-row > span:nth-child(3)
        //   Basis: td:nth-child(4)
        //   Cash Bid: td:nth-child(5)
        console.log(`  🤖 Running Playwright on session: ${scrapeId}`);
        const interactRes = await fetch(
            `https://api.firecrawl.dev/v2/scrape/${scrapeId}/interact`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                    code: `
                        // Wait for the CIH/DTN widget to render
                        try {
                            await page.waitForSelector('tr[data-delivery-period], .cih-bid-prices, table', { timeout: 15000 });
                        } catch(e) {
                            console.log('Widget not found, trying broader selectors...');
                        }

                        // Extra wait for the widget to populate data
                        await new Promise(r => setTimeout(r, 3000));

                        // Strategy 1: CIH/DTN widget (Al-Corn, most ethanol plants)
                        let rows = await page.$$eval('tr[data-delivery-period]', trs =>
                            trs.map(tr => {
                                const cells = [...tr.querySelectorAll('td')];
                                // CIH widget layout: Delivery | Futures(month+price) | Change | Basis | Bid
                                const deliveryEl = tr.querySelector('.cih-chart-btn span:nth-child(2)') || cells[0];
                                const futuresMonthEl = tr.querySelector('.cih-flex-row span:nth-child(1)');
                                const futuresPriceEl = tr.querySelector('.cih-flex-row span:nth-child(3)');
                                
                                return {
                                    delivery: deliveryEl?.textContent?.trim() || '',
                                    contractMonth: futuresMonthEl?.textContent?.trim() || '',
                                    futuresPrice: futuresPriceEl?.textContent?.trim() || '',
                                    change: cells[2]?.textContent?.trim() || '0',
                                    basis: cells[3]?.textContent?.trim() || '0',
                                    cashBid: cells[4]?.textContent?.trim() || '0',
                                };
                            })
                        );

                        // Strategy 2: Generic table fallback
                        if (rows.length === 0) {
                            const tables = await page.$$eval('table', tables =>
                                tables.map(t => {
                                    return [...t.querySelectorAll('tr')].map(tr =>
                                        [...tr.querySelectorAll('td, th')].map(c => c.textContent?.trim() || '')
                                    );
                                })
                            );
                            // Convert to generic format
                            for (const table of tables) {
                                for (const rawRow of table) {
                                    if (rawRow.length >= 5) {
                                        rows.push({
                                            delivery: rawRow[0] || '',
                                            contractMonth: rawRow[1] || '',
                                            futuresPrice: rawRow[2] || '',
                                            change: rawRow[3] || '0',
                                            basis: rawRow[4] || '0',
                                            cashBid: rawRow[5] || rawRow[4] || '0',
                                        });
                                    }
                                }
                            }
                        }

                        JSON.stringify({ rows, count: rows.length });
                    `,
                    language: 'node',
                    timeout: 30,
                }),
            }
        );

        // Step 3: Cleanup
        try {
            await fetch(`https://api.firecrawl.dev/v2/scrape/${scrapeId}/interact`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
            });
        } catch { /* best effort */ }

        if (!interactRes.ok) {
            console.error(`  ❌ Interact failed: ${interactRes.status}`);
            return [];
        }

        const interactData = await interactRes.json();
        const resultStr = interactData?.result || interactData?.stdout || '{}';

        let parsed: { rows?: Array<{ delivery: string; contractMonth: string; futuresPrice: string; change: string; basis: string; cashBid: string }>; count?: number };
        try {
            parsed = JSON.parse(resultStr);
        } catch {
            console.log('  ⚠️  Could not parse interact result');
            console.log('  Raw result:', resultStr.substring(0, 200));
            return [];
        }

        // Parse CIH widget rows (structured objects)
        if (parsed.rows && parsed.rows.length > 0) {
            console.log(`  📋 Found ${parsed.rows.length} raw rows from widget`);
            for (const row of parsed.rows) {
                const futures = parseFloat(row.futuresPrice?.replace(/[,$]/g, '')) || 0;
                const basis = parseFloat(row.basis?.replace(/[,$]/g, '')) || 0;
                const cashBid = parseFloat(row.cashBid?.replace(/[,$]/g, '')) || 0;
                const change = parseFloat(row.change?.replace(/[,$]/g, '')) || 0;

                if (cashBid > 0 && futures > 0) {
                    const val = validateBid(cashBid, futures, basis);
                    bids.push({
                        buyerName: target.name,
                        city: 'Claremont', state: 'MN',
                        crop: target.crop,
                        deliveryPeriod: row.delivery || 'Spot',
                        contractMonth: row.contractMonth || '',
                        futuresPrice: futures, basis, cashBid, change,
                        scrapedAt: now,
                        source: 'firecrawl-interact',
                        sourceUrl: target.url,
                        priceUnit: '$/bu',
                        validated: val.valid,
                    });

                    // Log each validated bid
                    const checkMark = val.valid ? '✅' : '⚠️';
                    console.log(`    ${checkMark} ${row.delivery}: Futures $${futures.toFixed(4)} + Basis ${basis >= 0 ? '+' : ''}${basis.toFixed(2)} = $${cashBid.toFixed(2)}`);
                }
            }
        } else {
            console.log('  ℹ️  No structured rows returned from widget');
        }

        console.log(`  ✅ Extracted ${bids.length} bids from ${target.name}`);

    } catch (err) {
        console.error(`  ❌ Error scraping ${target.name}:`, (err as Error).message);
    }

    return bids;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║     🌾 CORN INTEL — Morning Bid Scan             ║');
    console.log('║     Finding the best prices in the country       ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');

    // Parse CLI args
    const args = process.argv.slice(2);
    const cropArg = args.find(a => a.startsWith('--crops='))?.split('=')[1];
    const crops = cropArg
        ? cropArg.split(',').map(c => c.trim())
        : ['Yellow Corn', 'Soybeans', 'Wheat', 'Sunflowers'];

    console.log(`📋 Crops: ${crops.join(', ')}`);
    console.log(`🔑 Firecrawl API: ${FIRECRAWL_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`🔑 Barchart API:  ${BARCHART_API_KEY ? '✅ Set' : '⚠️ Not set (Tier 1 skipped)'}`);
    console.log('');

    const startTime = Date.now();
    const allBids: ScrapedBid[] = [];
    const errors: string[] = [];

    // ── Tier 1: Barchart ──
    console.log('━━━ Tier 1: Barchart API ━━━');
    try {
        const bids = await fetchBarchartBids(SCAN_ZIP_CODES, crops);
        console.log(`  📊 ${bids.length} bids from ${SCAN_ZIP_CODES.length} zip codes`);
        allBids.push(...bids);
    } catch (err) {
        const msg = `Tier 1 failed: ${(err as Error).message}`;
        errors.push(msg);
        console.error(`  ❌ ${msg}`);
    }
    console.log('');

    // ── Tier 2: Firecrawl ──
    console.log('━━━ Tier 2: Firecrawl /interact ━━━');
    for (const target of FIRECRAWL_TARGETS) {
        if (crops.includes(target.crop)) {
            try {
                const bids = await scrapeWithFirecrawl(target);
                allBids.push(...bids);
            } catch (err) {
                errors.push(`Firecrawl ${target.name}: ${(err as Error).message}`);
            }
        }
    }
    console.log('');

    // ── Tier 3: USDA/NSA ──
    console.log('━━━ Tier 3: USDA/NSA Fallback ━━━');
    if (crops.includes('Sunflowers') && FIRECRAWL_API_KEY) {
        console.log('  🌻 Fetching sunflower prices from NSA...');
        // Basic sunflower price fetch via Firecrawl scrape
        try {
            const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                    url: 'https://sunflowernsa.com/markets/',
                    formats: ['markdown'],
                    waitFor: 5000,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const md: string = data?.data?.markdown || '';
                // Look for price patterns
                const matches = md.match(/\$?\d{2}\.\d{2}/g) || [];
                const prices = matches.map(m => parseFloat(m.replace('$', ''))).filter(p => p >= 14 && p <= 40);
                if (prices.length > 0) {
                    console.log(`  ✅ Found ${prices.length} sunflower prices: $${prices.join(', $')}/cwt`);
                } else {
                    console.log('  ℹ️  No sunflower prices extracted');
                }
            }
        } catch {
            console.log('  ⚠️  NSA scrape failed');
        }
    }
    console.log('');

    // ── Dedup & Results ──
    const seen = new Map<string, ScrapedBid>();
    for (const bid of allBids) {
        const key = `${bid.buyerName}|${bid.crop}|${bid.deliveryPeriod}`;
        if (!seen.has(key) || bid.scrapedAt > seen.get(key)!.scrapedAt) {
            seen.set(key, bid);
        }
    }
    const finalBids = Array.from(seen.values());
    const validated = finalBids.filter(b => b.validated).length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // ── Print Summary ──
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log(`║  📊 SCAN COMPLETE — ${elapsed}s                       ║`);
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  Total Bids:    ${String(finalBids.length).padEnd(34)}║`);
    console.log(`║  Validated:     ${String(validated).padEnd(34)}║`);
    console.log(`║  Failed:        ${String(finalBids.length - validated).padEnd(34)}║`);
    console.log(`║  Errors:        ${String(errors.length).padEnd(34)}║`);
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');

    // Print top 5 bids per crop
    for (const crop of crops) {
        const cropBids = finalBids
            .filter(b => b.crop === crop && b.cashBid > 0)
            .sort((a, b) => b.cashBid - a.cashBid)
            .slice(0, 5);

        if (cropBids.length > 0) {
            const _unit = cropBids[0].priceUnit;
            console.log(`🌾 TOP 5 ${crop.toUpperCase()} BIDS:`);
            console.log('  ┌─────────────────────────────────┬──────────┬──────────┬──────────┐');
            console.log('  │ Buyer                           │ Cash Bid │ Basis    │ Source   │');
            console.log('  ├─────────────────────────────────┼──────────┼──────────┼──────────┤');
            for (const bid of cropBids) {
                const name = bid.buyerName.substring(0, 31).padEnd(31);
                const price = `$${bid.cashBid.toFixed(2)}`.padEnd(8);
                const basis = (bid.basis >= 0 ? '+' : '') + bid.basis.toFixed(2);
                const src = bid.source.substring(0, 8).padEnd(8);
                console.log(`  │ ${name} │ ${price} │ ${basis.padEnd(8)} │ ${src} │`);
            }
            console.log('  └─────────────────────────────────┴──────────┴──────────┴──────────┘');
            console.log('');
        }
    }

    // ── Save Results ──
    const outDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const result: MorningScanResult = {
        scanTime: new Date().toISOString(),
        totalBids: finalBids.length,
        bidsBySource: {},
        validatedBids: validated,
        failedValidation: finalBids.length - validated,
        bids: finalBids,
        errors,
    };

    // Count by source
    for (const bid of finalBids) {
        result.bidsBySource[bid.source] = (result.bidsBySource[bid.source] || 0) + 1;
    }

    const outPath = path.resolve(outDir, 'live_bids.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`💾 Saved to ${outPath}`);

    if (errors.length > 0) {
        console.log('');
        console.log('⚠️  Errors:');
        for (const err of errors) {
            console.log(`   - ${err}`);
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
