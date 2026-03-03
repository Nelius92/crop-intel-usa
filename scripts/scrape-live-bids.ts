/**
 * Live Cash Bid Scraper — Bushel-Powered Portals
 * 
 * Scrapes grain elevator portals for real cash bid prices.
 * Uses Firecrawl with browser Actions to render JS content.
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

// --- Bushel-Powered Portal Configuration ---

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
    const bids: ScrapedBid[] = [];

    try {
        console.log(`  Scraping ${portal.name} portal...`);
        const result = await firecrawl.scrape(portal.url, {
            formats: ['markdown'],
            actions: [
                { type: 'wait', milliseconds: 5000 },
                { type: 'scroll', direction: 'down', amount: 5 },
                { type: 'wait', milliseconds: 2000 },
            ],
            timeout: 30000,
        } as any) as any;

        if (!result.markdown) {
            console.log(`    ⚠ No content from ${portal.name}`);
            return bids;
        }

        const lines = result.markdown.split('\n').map((l: string) => l.trim()).filter(Boolean);
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
                            facilityName: `${portal.name} ${currentLocation}`,
                            commodity,
                            cashBid: parseFloat(bidStr),
                            basis: basisStr !== '—' ? parseFloat(basisStr) : null,
                            deliveryPeriod: delivery,
                            source: portal.url,
                            scrapedAt: now,
                            state: portal.states[0]
                        });
                    }
                    valuesBuffer = [];
                }
            }
        }

        console.log(`    ✓ ${portal.name}: ${bids.length} bids found`);
    } catch (error: any) {
        console.error(`    ✗ ${portal.name} failed: ${error.message}`);
    }

    return bids;
}

async function main() {
    console.log('==============================================');
    console.log('  🌽 Corn Intel — Live Cash Bid Scraper');
    console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
    console.log('==============================================\n');

    const allBids: ScrapedBid[] = [];

    // Scrape all Bushel-powered portals
    console.log('  📡 Scraping Bushel-Powered Portals\n');
    for (const portal of BUSHEL_PORTALS) {
        const bids = await scrapeBushelPortal(portal);
        allBids.push(...bids);
        await new Promise(r => setTimeout(r, 1000));
    }

    // Filter to corn only
    const cornBids = allBids.filter(b =>
        b.commodity === 'Corn' && b.cashBid !== null
    );

    // Sort by cash bid descending
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
        portalsScraped: BUSHEL_PORTALS.length,
        bids: cornBids,
        stateAverages: stateAvgs
    }, null, 2));
    console.log(`\n  ✓ Full results saved to ${outPath}`);

    console.log('\n==============================================\n');
}

main().catch(console.error);
