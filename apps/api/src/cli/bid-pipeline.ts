/**
 * CLI: Run Daily Bid Pipeline
 *
 * Usage: npx tsx src/cli/bid-pipeline.ts
 *
 * Scrapes BNSF-served facility cash bids via Firecrawl,
 * upserts results into Postgres. Designed to run as Railway cron:
 *   Schedule: 0 11 * * 1-5  (5:00 AM CT = 11:00 UTC, weekdays only)
 */

import { runDailyBidPipeline } from '../services/bid-scraper.js';
import { isDatabaseConfigured, closeDbPool } from '../db/pool.js';
import { logger } from '../logger.js';

async function main() {
    logger.info('🔥 Starting bid pipeline CLI...');

    if (!isDatabaseConfigured()) {
        logger.error('DATABASE_URL not configured. Cannot run bid pipeline.');
        process.exit(1);
    }

    try {
        const result = await runDailyBidPipeline();

        logger.info('Pipeline complete', {
            statesScraped: result.statesScraped,
            totalBidsFound: result.totalBidsFound,
            matched: result.matched,
            updated: result.updated,
            unmatchedCount: result.unmatched.length,
            errorCount: result.errors.length,
        });

        if (result.unmatched.length > 0) {
            logger.info('Unmatched facilities:', { unmatched: result.unmatched });
        }

        if (result.errors.length > 0) {
            logger.warn('Pipeline errors:', { errors: result.errors });
        }

        console.log('\n✅ Pipeline result:');
        console.log(`   States scraped: ${result.statesScraped}`);
        console.log(`   Bids found:     ${result.totalBidsFound}`);
        console.log(`   Matched:        ${result.matched}`);
        console.log(`   Updated in DB:  ${result.updated}`);
        console.log(`   Unmatched:      ${result.unmatched.length}`);
        console.log(`   Errors:         ${result.errors.length}`);
    } catch (error) {
        logger.error('Pipeline failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    } finally {
        await closeDbPool();
    }
}

void main();
