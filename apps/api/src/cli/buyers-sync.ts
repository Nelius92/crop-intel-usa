import { runMigrations } from '../db/migrations.js';
import { closeDbPool } from '../db/pool.js';
import { runBuyerContactSync } from '../services/buyer-contact-sync.js';

function getNumericArg(name: string): number | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    const raw = process.argv[index + 1];
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

async function main() {
    await runMigrations();
    const summary = await runBuyerContactSync({
        limit: getNumericArg('--limit'),
        staleDays: getNumericArg('--stale-days'),
        delayMs: getNumericArg('--delay-ms'),
    });

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch((error) => {
        console.error('buyers:sync failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
