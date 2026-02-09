#!/usr/bin/env ts-node
/**
 * Morning Price Update Script
 * 
 * Runs daily at 6:00 AM Central Time (Minnesota) to update grain prices
 * 
 * Usage:
 *   npx ts-node scripts/update-morning-prices.ts
 * 
 * Cron (6am CT):
 *   0 6 * * * cd /path/to/corn-intel && npx ts-node scripts/update-morning-prices.ts
 * 
 * For server deployment, add to crontab:
 *   crontab -e
 *   0 6 * * * TZ=America/Chicago /path/to/node /path/to/scripts/update-morning-prices.ts >> /var/log/corn-intel-prices.log 2>&1
 */

import * as fs from 'fs';
import * as path from 'path';

interface PriceUpdate {
    futuresPrice: number;
    contract: string;
    source: string;
    timestamp: string;
    regionalBasis: Record<string, number>;
}

// Free data sources for corn futures
const DATA_SOURCES = {
    // USDA Transportation API (free, may have corn)
    USDA_TRANSPORT: 'https://api.transportation.usda.gov/wips/services/GTR/GrainPrices?format=json',
    // Barchart delayed quotes page (for scraping if needed)
    BARCHART: 'https://www.barchart.com/futures/quotes/ZCH26',
    // CME Group (10+ min delayed)
    CME: 'https://www.cmegroup.com/markets/agriculture/grains/corn.html'
};

// Current fallback (updated manually if APIs fail)
const MANUAL_FALLBACK = {
    futuresPrice: 4.30,  // CME ZCH6 as of Feb 6, 2026
    contract: "ZCH6 (Mar '26)",
    hankinsonBasis: -0.47,
    regionalBasis: {
        "California": 1.45,
        "Texas": 0.85,
        "Washington": 1.10,
        "Idaho": 0.95,
        "Midwest": -0.25,
        "PNW": 1.15
    }
};

async function fetchUSDAPrice(): Promise<number | null> {
    try {
        const response = await fetch(DATA_SOURCES.USDA_TRANSPORT, {
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const data = await response.json();
            const cornData = data?.find?.((d: any) =>
                d.commodity?.toLowerCase().includes('corn')
            );
            if (cornData?.price) {
                console.log(`✓ USDA price found: $${cornData.price}`);
                return parseFloat(cornData.price);
            }
        }
    } catch (error) {
        console.warn('USDA API unavailable:', error);
    }
    return null;
}

async function fetchUSDABasis(): Promise<Record<string, number> | null> {
    try {
        // Try USDA MARS API for regional basis
        const response = await fetch(
            'https://marsapi.ams.usda.gov/services/v1.2/reports/LM_GR110?q=commodity=Corn',
            {
                signal: AbortSignal.timeout(10000),
                headers: { 'Accept': 'application/json' }
            }
        );

        if (response.ok) {
            const data = await response.json();
            const results = data?.results || data?.data || [];

            const basisMap: Record<string, number> = {};
            for (const item of results) {
                if (item.region && item.basis !== undefined) {
                    const basisValue = typeof item.basis === 'string'
                        ? parseFloat(item.basis) / 100  // Convert cents to dollars
                        : item.basis;
                    basisMap[item.region] = basisValue;
                }
            }

            if (Object.keys(basisMap).length > 0) {
                console.log(`✓ USDA basis data loaded for ${Object.keys(basisMap).length} regions`);
                return basisMap;
            }
        }
    } catch (error) {
        console.warn('USDA MARS API unavailable:', error);
    }
    return null;
}

function updateMarketDataService(priceUpdate: PriceUpdate): void {
    const filePath = path.join(__dirname, '../src/services/marketDataService.ts');
    let content = fs.readFileSync(filePath, 'utf-8');

    // Update the fallback price
    content = content.replace(
        /const FALLBACK_FUTURES_PRICE = [\d.]+;/,
        `const FALLBACK_FUTURES_PRICE = ${priceUpdate.futuresPrice.toFixed(2)};`
    );

    // Update the comment with timestamp
    const dateStr = new Date().toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    content = content.replace(
        /\/\/ Fallback values based on current market \(updated .*?\)/,
        `// Fallback values based on current market (updated ${dateStr} CT)`
    );

    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated marketDataService.ts with price $${priceUpdate.futuresPrice.toFixed(2)}`);
}

function updateUSDAService(regionalBasis: Record<string, number>): void {
    const filePath = path.join(__dirname, '../src/services/usdaMarketService.ts');
    let content = fs.readFileSync(filePath, 'utf-8');

    // Update regional basis values
    for (const [region, basis] of Object.entries(regionalBasis)) {
        const regex = new RegExp(
            `"${region}":\\s*\\{[^}]*basisAdjustment:\\s*[\\d.-]+`,
            'g'
        );
        content = content.replace(regex, (match) => {
            return match.replace(/basisAdjustment:\s*[\d.-]+/, `basisAdjustment: ${basis.toFixed(2)}`);
        });
    }

    // Update report date
    const today = new Date().toISOString().split('T')[0];
    content = content.replace(
        /reportDate:\s*"[\d-]+"/g,
        `reportDate: "${today}"`
    );

    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated usdaMarketService.ts with ${Object.keys(regionalBasis).length} regional basis values`);
}

function logPriceHistory(priceUpdate: PriceUpdate): void {
    const logPath = path.join(__dirname, '../logs/price-history.json');
    const logDir = path.dirname(logPath);

    // Ensure logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // Load existing history
    let history: PriceUpdate[] = [];
    if (fs.existsSync(logPath)) {
        try {
            history = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        } catch {
            history = [];
        }
    }

    // Add new entry (keep last 90 days)
    history.push(priceUpdate);
    if (history.length > 90) {
        history = history.slice(-90);
    }

    fs.writeFileSync(logPath, JSON.stringify(history, null, 2));
    console.log(`✓ Price history logged (${history.length} entries)`);
}

async function main(): Promise<void> {
    console.log('==========================================');
    console.log('  Corn Intel - Morning Price Update');
    console.log(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
    console.log('==========================================\n');

    // Fetch latest prices
    const futuresPrice = await fetchUSDAPrice() || MANUAL_FALLBACK.futuresPrice;
    const regionalBasis = await fetchUSDABasis() || MANUAL_FALLBACK.regionalBasis;

    const priceUpdate: PriceUpdate = {
        futuresPrice,
        contract: MANUAL_FALLBACK.contract,
        source: futuresPrice === MANUAL_FALLBACK.futuresPrice ? 'manual' : 'usda',
        timestamp: new Date().toISOString(),
        regionalBasis
    };

    // Update source files
    updateMarketDataService(priceUpdate);
    updateUSDAService(regionalBasis);

    // Log history
    logPriceHistory(priceUpdate);

    // Print summary
    console.log('\n==========================================');
    console.log('  Update Complete');
    console.log('==========================================');
    console.log(`  Futures: $${futuresPrice.toFixed(2)} (${priceUpdate.source})`);
    console.log(`  Contract: ${priceUpdate.contract}`);
    console.log(`  Regions updated: ${Object.keys(regionalBasis).length}`);
    console.log('==========================================\n');
}

main().catch(console.error);
