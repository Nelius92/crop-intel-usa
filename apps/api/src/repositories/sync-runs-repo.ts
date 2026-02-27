import { dbQuery } from '../db/pool.js';

export async function getLatestBuyerContactSyncRun(): Promise<{
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    processedCount: number;
    updatedCount: number;
    reviewCount: number;
    errorCount: number;
    summaryJson: unknown;
} | null> {
    const result = await dbQuery<{
        id: string;
        status: string;
        startedAt: Date;
        endedAt: Date | null;
        processedCount: number;
        updatedCount: number;
        reviewCount: number;
        errorCount: number;
        summaryJson: unknown;
    }>(`
        SELECT
            id,
            status,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            processed_count AS "processedCount",
            updated_count AS "updatedCount",
            review_count AS "reviewCount",
            error_count AS "errorCount",
            summary_json AS "summaryJson"
        FROM sync_runs
        WHERE job_type = 'buyer_contact_sync'
        ORDER BY started_at DESC
        LIMIT 1
    `);

    const row = result.rows[0];
    if (!row) return null;

    return {
        ...row,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
    };
}

export async function getOpenBuyerReviewCount(): Promise<number> {
    const result = await dbQuery<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM buyer_review_queue
        WHERE status = 'open'
    `);
    return result.rows[0]?.count ?? 0;
}
