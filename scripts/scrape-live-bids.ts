/**
 * Live Cash Bid Scraper — Today's Prices (No DB Required)
 * 
 * Scrapes Barchart cash grain pages for real posted bids.
 * Outputs results to stdout + writes to /tmp/live-bids.json.
 * 
 * Usage: npx tsx scripts/scrape-live-bids.ts
 */
import FirecrawlApp from '@mendable/firecrawl-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load FIRECRAWL_API_KEY from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not found in .env');
    process.exit(1);
}

const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

interface ScrapedBid {
    facilityName: string;
    commodity: string;
    cashBid: number | null;
    basis: number | null;
    deliveryPeriod: string;
    source: string;
    scrapedAt: string;
    state: string;
}

// BNSF corridor states + major feedlot/processor states
const SCRAPE_STATES = [
    'ND', 'MN', 'SD', 'IA', 'NE', 'KS', 'TX', 'CA', 'WA', 'OR', 'ID',
    'IL', 'IN', 'OH', 'MO'
];

function barchartUrl(state: string): string {
    return `https://www.barchart.com/futures/quotes/ZC*0/cash-prices?state=${state}`;
}

async function scrapeState(state: string): Promise<ScrapedBid[]> {
    const url = barchartUrl(state);
    const bids: ScrapedBid[] = [];

    try {
        console.log(`  Scraping ${state}...`);
        const result = await firecrawl.scrape(url, {
            formats: ['markdown'],
        } as any) as any;

        if (!result.markdown) {
            console.log(`    ⚠ No content for ${state}`);
            return bids;
        }

        const lines = (result.markdown as string).split('\n');
        const now = new Date().toISOString();

        for (const line of lines) {
            if (!line.includes('|')) continue;

            const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
            if (cells.length < 3) continue;

            // Skip header/separator rows
            if (cells[0].includes('---') || cells[0].toLowerCase().includes('location')) continue;

            const location = cells[0];
            const priceMatch = cells.find((c: string) => /\d+\.\d{2}/.test(c));
            const basisMatch = cells.find((c: string) => /[+-]?\d+\.?\d*/.test(c) && c !== priceMatch);

            if (!priceMatch) continue;

            const cashBid = parseFloat(priceMatch.replace(/[^0-9.-]/g, ''));
            // Sanity: corn should be between $2 and $8 per bushel
            if (cashBid < 2 || cashBid > 8) continue;

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
                state
            });
        }

        console.log(`    ✓ ${state}: ${bids.length} bids found`);
    } catch (error: any) {
        console.error(`    ✗ ${state} failed: ${error.message}`);
    }

    return bids;
}

// Also try Scoular portal (key BNSF-served facility)
async function scrapeScoular(): Promise<ScrapedBid[]> {
    const url = 'https://portal.bushelpowered.com/scoular/cash-bids';
    const bids: ScrapedBid[] = [];

    try {
        console.log('  Scraping Scoular portal...');
        const result = await firecrawl.scrape(url, {
            formats: ['markdown'],
            waitFor: 5000
        });

        if (!result.markdown) {
            console.log('    ⚠ No content from Scoular');
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

                        bids.push({
                            facilityName: `Scoular ${currentLocation}`,
                            commodity,
                            cashBid: parseFloat(bidStr),
                            basis: basisStr !== '—' ? parseFloat(basisStr) : null,
                            deliveryPeriod: delivery,
                            source: url,
                            scrapedAt: now,
                            state: 'KS' // Scoular primary locations
                        });
                    }
                    valuesBuffer = [];
                }
            }
        }

        console.log(`    ✓ Scoular: ${bids.length} bids found`);
    } catch (error: any) {
        console.error(`    ✗ Scoular failed: ${error.message}`);
    }

    return bids;
}

async function main() {
    console.log('==============================================');
    console.log('  🌽 Corn Intel — Live Cash Bid Scraper');
    console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
    console.log('==============================================\n');

    const allBids: ScrapedBid[] = [];

    // Scrape all BNSF corridor states
    for (const state of SCRAPE_STATES) {
        const bids = await scrapeState(state);
        allBids.push(...bids);
        // Be nice to Barchart — rate limit
        await new Promise(r => setTimeout(r, 1500));
    }

    // Scrape Scoular
    const scoularBids = await scrapeScoular();
    allBids.push(...scoularBids);

    // Filter to corn only
    const cornBids = allBids.filter(b =>
        b.commodity === 'Corn' && b.cashBid !== null
    );

    // Sort by cash bid descending (best prices first)
    cornBids.sort((a, b) => (b.cashBid ?? 0) - (a.cashBid ?? 0));

    // Print summary
    console.log('\n==============================================');
    console.log(`  Results: ${cornBids.length} corn bids found`);
    console.log('==============================================\n');

    // Show top 20
    console.log('  TOP 20 CASH BIDS (by price):');
    console.log('  ─'.padEnd(80, '─'));
    const top = cornBids.slice(0, 20);
    for (const bid of top) {
        const basisStr = bid.basis !== null
            ? `basis ${bid.basis >= 0 ? '+' : ''}${bid.basis.toFixed(2)}`
            : 'basis N/A';
        console.log(`  $${bid.cashBid!.toFixed(2)}  ${basisStr.padEnd(14)}  ${bid.facilityName.padEnd(30)}  ${bid.state}`);
    }

    // Summary by state
    console.log('\n  AVERAGE BY STATE:');
    console.log('  ─'.padEnd(60, '─'));
    const byState: Record<string, number[]> = {};
    for (const bid of cornBids) {
        if (!byState[bid.state]) byState[bid.state] = [];
        byState[bid.state].push(bid.cashBid!);
    }
    const stateAvgs = Object.entries(byState)
        .map(([state, prices]) => ({
            state,
            avg: prices.reduce((a, b) => a + b, 0) / prices.length,
            count: prices.length,
            best: Math.max(...prices)
        }))
        .sort((a, b) => b.avg - a.avg);

    for (const s of stateAvgs) {
        console.log(`  ${s.state}: avg $${s.avg.toFixed(2)}, best $${s.best.toFixed(2)} (${s.count} bids)`);
    }

    // Write to file
    const outPath = '/tmp/live-bids.json';
    fs.writeFileSync(outPath, JSON.stringify({
        scrapedAt: new Date().toISOString(),
        totalBids: cornBids.length,
        statesSscraped: SCRAPE_STATES.length,
        bids: cornBids,
        stateAverages: stateAvgs
    }, null, 2));
    console.log(`\n  ✓ Full results saved to ${outPath}`);

    console.log('\n==============================================\n');
}

main().catch(console.error);
