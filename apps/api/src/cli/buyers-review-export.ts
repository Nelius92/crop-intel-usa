import fs from 'fs';
import path from 'path';
import { closeDbPool, dbQuery, isDatabaseConfigured } from '../db/pool.js';
import { runMigrations } from '../db/migrations.js';

function csvEscape(value: unknown): string {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function main() {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is required');
    }

    await runMigrations();

    const rows = await dbQuery<{
        reviewQueueId: string;
        buyerId: string;
        buyerName: string;
        city: string;
        state: string;
        reasonCode: string;
        currentPhone: string | null;
        currentWebsite: string | null;
        suggestedPhone: string | null;
        suggestedWebsite: string | null;
    }>(`
        SELECT
            q.id AS "reviewQueueId",
            b.id AS "buyerId",
            b.name AS "buyerName",
            b.city,
            b.state,
            q.reason_code AS "reasonCode",
            bc.facility_phone AS "currentPhone",
            bc.website_url AS "currentWebsite",
            COALESCE(
                q.candidate_json->>'proposedPhone',
                q.candidate_json->>'observed_phone'
            ) AS "suggestedPhone",
            COALESCE(
                q.candidate_json->>'proposedWebsite',
                q.candidate_json->>'observed_website'
            ) AS "suggestedWebsite"
        FROM buyer_review_queue q
        JOIN buyers b ON b.id = q.buyer_id
        LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
        WHERE q.status = 'open'
        ORDER BY b.state, b.name
    `);

    const exportsDir = path.resolve(process.cwd(), 'apps/api/exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(exportsDir, `buyer-review-${stamp}.csv`);

    const header = [
        'reviewQueueId',
        'buyerId',
        'buyerName',
        'city',
        'state',
        'reasonCode',
        'currentPhone',
        'currentWebsite',
        'suggestedPhone',
        'suggestedWebsite',
        'approvedPhone',
        'approvedWebsite',
        'notes',
    ];

    const lines = [
        header.join(','),
        ...rows.rows.map((row) => [
            row.reviewQueueId,
            row.buyerId,
            row.buyerName,
            row.city,
            row.state,
            row.reasonCode,
            row.currentPhone ?? '',
            row.currentWebsite ?? '',
            row.suggestedPhone ?? '',
            row.suggestedWebsite ?? '',
            '',
            '',
            '',
        ].map(csvEscape).join(',')),
    ];

    fs.writeFileSync(outPath, lines.join('\n') + '\n');
    console.log(`Exported ${rows.rows.length} open review rows to ${outPath}`);
}

main()
    .catch((error) => {
        console.error('buyers:review:export failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
