/**
 * Live Sunflower Price Scraper — National Sunflower Association
 * 
 * Scrapes daily sunflower cash bids from NSA daily market news page.
 * Source: https://www.sunflowernsa.com/growers/Marketing/daily-market-news/
 * 
 * Prices are in $/cwt (per hundredweight).
 * Key plants: ADM Enderlin, Cargill West Fargo, Colorado Mills Lamar
 * 
 * Usage: npx tsx scripts/scrape-sunflower-bids.ts
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

// ── NSA Daily Market News ──

const NSA_URL = 'https://www.sunflowernsa.com/growers/Marketing/daily-market-news/';

interface SunflowerPrice {
    plant: string;
    city: string;
    state: string;
    cashPrice: number | null;     // $/cwt
    aogPrice: number | null;      // Act of God $/cwt
    earlyHarvest: number | null;  // Early delivery premium $/cwt
    priceUnit: '$/cwt';
    source: string;
    scrapedAt: string;
}

/**
 * Parse NSA daily market news markdown for sunflower prices.
 * 
 * NSA format (example from 03/19/2026):
 *   "ADM Enderlin, Cargill West Fargo and Colorado Mills crush plants are offering
 *    2026 new crop cash and Act of God (AOG) High Oleic contracts. ADM is at $23.30
 *    cash and $22.80 AOG. Cargill is at $23.20 cash and 22.70 AOG. Colorado Mills
 *    is at $22.20 AOG."
 */
function parseSunflowerPrices(markdown: string): SunflowerPrice[] {
    const prices: SunflowerPrice[] = [];
    const now = new Date().toISOString();

    // Normalize text: join lines, clean up
    const text = markdown.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

    // ── Strategy 1: Parse structured contract pricing ──
    // Look for "ADM is at $XX.XX cash and $XX.XX AOG"
    const admCashMatch = text.match(/ADM\s+(?:is\s+)?at\s+\$?([\d.]+)\s*cash/i);
    const admAogMatch = text.match(/ADM\s+(?:is\s+)?at\s+\$?[\d.]+\s*cash\s+and\s+\$?([\d.]+)\s*AOG/i);

    if (admCashMatch) {
        prices.push({
            plant: 'ADM Enderlin (Northern Sun)',
            city: 'Enderlin',
            state: 'ND',
            cashPrice: parseFloat(admCashMatch[1]),
            aogPrice: admAogMatch ? parseFloat(admAogMatch[1]) : null,
            earlyHarvest: null,
            priceUnit: '$/cwt',
            source: NSA_URL,
            scrapedAt: now
        });
    }

    // Cargill: "Cargill is at $XX.XX cash and XX.XX AOG"
    const cargillCashMatch = text.match(/Cargill\s+(?:is\s+)?at\s+\$?([\d.]+)\s*cash/i);
    const cargillAogMatch = text.match(/Cargill\s+(?:is\s+)?at\s+\$?[\d.]+\s*cash\s+and\s+\$?([\d.]+)\s*AOG/i);

    if (cargillCashMatch) {
        prices.push({
            plant: 'Cargill West Fargo',
            city: 'West Fargo',
            state: 'ND',
            cashPrice: parseFloat(cargillCashMatch[1]),
            aogPrice: cargillAogMatch ? parseFloat(cargillAogMatch[1]) : null,
            earlyHarvest: null,
            priceUnit: '$/cwt',
            source: NSA_URL,
            scrapedAt: now
        });
    }

    // Colorado Mills: "Colorado Mills is at $XX.XX AOG"
    const coloradoAogMatch = text.match(/Colorado\s+Mills\s+(?:is\s+)?at\s+\$?([\d.]+)\s*AOG/i);
    const coloradoCashMatch = text.match(/Colorado\s+Mills\s+(?:is\s+)?at\s+\$?([\d.]+)\s*cash/i);

    if (coloradoAogMatch || coloradoCashMatch) {
        prices.push({
            plant: 'Colorado Mills',
            city: 'Lamar',
            state: 'CO',
            cashPrice: coloradoCashMatch ? parseFloat(coloradoCashMatch[1]) : null,
            aogPrice: coloradoAogMatch ? parseFloat(coloradoAogMatch[1]) : null,
            earlyHarvest: null,
            priceUnit: '$/cwt',
            source: NSA_URL,
            scrapedAt: now
        });
    }

    // Cargill early harvest: "Cargill West Fargo is also offering an early harvest ... price of $XX.XX cash"
    const earlyHarvestMatch = text.match(/early\s+harvest.*?price\s+of\s+\$?([\d.]+)\s*cash/i);
    if (earlyHarvestMatch) {
        // Update existing Cargill entry or add new one
        const cargill = prices.find(p => p.plant.includes('Cargill'));
        if (cargill) {
            cargill.earlyHarvest = parseFloat(earlyHarvestMatch[1]);
        }
    }

    // ── Strategy 2: Fallback — look for price patterns near plant names ──
    if (prices.length === 0) {
        console.log('  ⚠ Pattern matching failed, trying broader extraction...');

        // Look for any $XX.XX patterns near key words
        const pricePatterns = [
            { regex: /ADM.*?\$?(2[0-9]\.\d{2})/gi, plant: 'ADM Enderlin (Northern Sun)', city: 'Enderlin', state: 'ND' },
            { regex: /Cargill.*?\$?(2[0-9]\.\d{2})/gi, plant: 'Cargill West Fargo', city: 'West Fargo', state: 'ND' },
            { regex: /Colorado.*?Mills.*?\$?(2[0-9]\.\d{2})/gi, plant: 'Colorado Mills', city: 'Lamar', state: 'CO' },
            { regex: /Enderlin.*?\$?(2[0-9]\.\d{2})/gi, plant: 'ADM Enderlin (Northern Sun)', city: 'Enderlin', state: 'ND' },
        ];

        for (const { regex, plant, city, state } of pricePatterns) {
            const match = regex.exec(text);
            if (match && !prices.find(p => p.plant === plant)) {
                prices.push({
                    plant, city, state,
                    cashPrice: parseFloat(match[1]),
                    aogPrice: null,
                    earlyHarvest: null,
                    priceUnit: '$/cwt',
                    source: NSA_URL,
                    scrapedAt: now
                });
            }
        }
    }

    return prices;
}

/**
 * Scrape the NSA daily oilseed price averages page for additional pricing.
 * Source: https://www.sunflowernsa.com/growers/Marketing/daily-oilseed-sunflower-price/
 */
const NSA_OILSEED_URL = 'https://www.sunflowernsa.com/growers/Marketing/daily-oilseed-sunflower-price/';

async function scrapeNSAOilseedAverages(): Promise<SunflowerPrice[]> {
    const prices: SunflowerPrice[] = [];
    try {
        console.log('  📡 Scraping NSA oilseed price averages...');
        const result = await firecrawl.scrape(NSA_OILSEED_URL, {
            formats: ['markdown'],
            timeout: 30000,
        } as any) as any;

        if (!result.markdown) {
            console.log('    ⚠ No content from NSA oilseed page');
            return prices;
        }

        // Look for daily average tables
        const text = result.markdown;
        console.log(`    ✓ Got ${text.length} chars from NSA oilseed averages`);

        // Parse running averages for crush plants
        const wfAvgMatch = text.match(/West\s+Fargo.*?(\d{2}\.\d{2})/i);
        const endAvgMatch = text.match(/Enderlin.*?(\d{2}\.\d{2})/i);
        const coAvgMatch = text.match(/(?:Lamar|Colorado).*?(\d{2}\.\d{2})/i);
        const now = new Date().toISOString();

        if (wfAvgMatch) {
            prices.push({
                plant: 'Cargill West Fargo (avg)',
                city: 'West Fargo', state: 'ND',
                cashPrice: parseFloat(wfAvgMatch[1]), aogPrice: null, earlyHarvest: null,
                priceUnit: '$/cwt', source: NSA_OILSEED_URL, scrapedAt: now
            });
        }
        if (endAvgMatch) {
            prices.push({
                plant: 'ADM Enderlin (avg)',
                city: 'Enderlin', state: 'ND',
                cashPrice: parseFloat(endAvgMatch[1]), aogPrice: null, earlyHarvest: null,
                priceUnit: '$/cwt', source: NSA_OILSEED_URL, scrapedAt: now
            });
        }
        if (coAvgMatch) {
            prices.push({
                plant: 'Colorado Mills (avg)',
                city: 'Lamar', state: 'CO',
                cashPrice: parseFloat(coAvgMatch[1]), aogPrice: null, earlyHarvest: null,
                priceUnit: '$/cwt', source: NSA_OILSEED_URL, scrapedAt: now
            });
        }
    } catch (error: any) {
        console.error(`    ✗ NSA oilseed scrape failed: ${error.message}`);
    }
    return prices;
}

async function main() {
    console.log('==============================================');
    console.log('  🌻 Corn Intel — Sunflower Price Scraper');
    console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
    console.log('==============================================\n');

    // Phase 1: Scrape NSA Daily Market News
    console.log('  📡 Scraping NSA Daily Market News...\n');
    let dayPrices: SunflowerPrice[] = [];

    try {
        const result = await firecrawl.scrape(NSA_URL, {
            formats: ['markdown'],
            timeout: 30000,
        } as any) as any;

        if (result.markdown) {
            console.log(`    ✓ Got ${result.markdown.length} chars from NSA daily page`);
            dayPrices = parseSunflowerPrices(result.markdown);
            console.log(`    ✓ Parsed ${dayPrices.length} prices\n`);
        } else {
            console.log('    ⚠ No content from NSA daily page\n');
        }
    } catch (error: any) {
        console.error(`    ✗ NSA daily scrape failed: ${error.message}\n`);
    }

    // Phase 2: Scrape NSA Oilseed Averages (for validation)
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
    const avgPrices = await scrapeNSAOilseedAverages();

    // ── Print Results ──
    console.log('\n==============================================');
    console.log('  SUNFLOWER PRICES ($/cwt, High-Oleic)');
    console.log('  ─'.padEnd(70, '─'));

    for (const p of dayPrices) {
        const cashStr = p.cashPrice ? `$${p.cashPrice.toFixed(2)} cash` : 'N/A';
        const aogStr = p.aogPrice ? `$${p.aogPrice.toFixed(2)} AOG` : '';
        const earlyStr = p.earlyHarvest ? `$${p.earlyHarvest.toFixed(2)} early` : '';
        console.log(`  ${p.plant.padEnd(35)} ${cashStr.padEnd(15)} ${aogStr.padEnd(15)} ${earlyStr}`);
    }

    if (avgPrices.length > 0) {
        console.log('\n  RUNNING AVERAGES (from oilseed page):');
        console.log('  ─'.padEnd(50, '─'));
        for (const p of avgPrices) {
            console.log(`  ${p.plant.padEnd(35)} $${p.cashPrice?.toFixed(2)}`);
        }
    }

    // ── Benchmark Summary ──
    const enderlin = dayPrices.find(p => p.plant.includes('Enderlin'));
    if (enderlin?.cashPrice) {
        console.log('\n  ── BENCHMARK UPDATE ──');
        console.log(`  Enderlin ADM: $${enderlin.cashPrice.toFixed(2)}/cwt (benchmark)`);
        for (const p of dayPrices) {
            if (p.plant.includes('Enderlin') || !p.cashPrice) continue;
            const diff = p.cashPrice - enderlin.cashPrice;
            const sign = diff >= 0 ? '+' : '';
            console.log(`  ${p.plant}: ${sign}$${diff.toFixed(2)} vs Enderlin`);
        }
    }

    // ── Write output ──
    const output = {
        scrapedAt: new Date().toISOString(),
        source: 'National Sunflower Association',
        priceUnit: '$/cwt',
        commodity: 'Sunflowers (High-Oleic)',
        dailyPrices: dayPrices,
        oilseedAverages: avgPrices,
        benchmarkEnderlin: enderlin?.cashPrice ?? null
    };

    const outPath = '/tmp/sunflower-bids.json';
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n  ✓ Full results saved to ${outPath}`);
    console.log('\n==============================================\n');
}

main().catch(console.error);
