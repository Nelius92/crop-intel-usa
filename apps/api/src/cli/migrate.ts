import { runMigrations } from '../db/migrations.js';
import { closeDbPool } from '../db/pool.js';

async function main() {
    const summary = await runMigrations();
    console.log(`Migrations directory: ${summary.migrationsDir}`);
    console.log(`Applied: ${summary.applied.length}`);
    if (summary.applied.length > 0) {
        console.log(summary.applied.join('\n'));
    }
    console.log(`Skipped: ${summary.skipped.length}`);
}

main()
    .catch((error) => {
        console.error('Migration run failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
