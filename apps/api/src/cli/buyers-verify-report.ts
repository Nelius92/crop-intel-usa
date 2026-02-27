import { runMigrations } from '../db/migrations.js';
import { closeDbPool, dbQuery, isDatabaseConfigured } from '../db/pool.js';

async function main() {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is required');
    }

    await runMigrations();

    const [summary, reviewCount, corridorCoverage] = await Promise.all([
        dbQuery<{
            verifiedStatus: string | null;
            count: number;
        }>(`
            SELECT COALESCE(bc.verified_status, 'none') AS "verifiedStatus", COUNT(*)::int AS count
            FROM buyers b
            LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
            WHERE b.active = TRUE
            GROUP BY COALESCE(bc.verified_status, 'none')
            ORDER BY count DESC
        `),
        dbQuery<{ count: number }>(`
            SELECT COUNT(*)::int AS count
            FROM buyer_review_queue
            WHERE status = 'open'
        `),
        dbQuery<{
            totalCorridor: number;
            readyCorridor: number;
        }>(`
            SELECT
                COUNT(*)::int AS "totalCorridor",
                COUNT(*) FILTER (
                    WHERE bc.facility_phone IS NOT NULL
                      AND bc.website_url IS NOT NULL
                      AND bc.verified_status IN ('verified', 'needs_review')
                )::int AS "readyCorridor"
            FROM buyers b
            LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
            WHERE b.active = TRUE AND b.launch_scope = 'corridor'
        `),
    ]);

    console.log('Buyer Contact Verification Report');
    console.log('================================');
    for (const row of summary.rows) {
        console.log(`${row.verifiedStatus}: ${row.count}`);
    }
    console.log(`Open review queue: ${reviewCount.rows[0]?.count ?? 0}`);

    const coverage = corridorCoverage.rows[0];
    if (coverage) {
        const pct = coverage.totalCorridor > 0
            ? Math.round((coverage.readyCorridor / coverage.totalCorridor) * 100)
            : 0;
        console.log(`Corridor coverage: ${coverage.readyCorridor}/${coverage.totalCorridor} (${pct}%)`);
    }
}

main()
    .catch((error) => {
        console.error('buyers:verify:report failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
