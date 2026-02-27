import fs from 'fs';
import { runMigrations } from '../db/migrations.js';
import { closeDbPool, isDatabaseConfigured, withDbTransaction } from '../db/pool.js';

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                cell += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                cell += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else if (ch !== '\r') {
            cell += ch;
        }
    }

    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function requiredArg(): string {
    const filePath = process.argv[2];
    if (!filePath) {
        throw new Error('Usage: npm --prefix apps/api run buyers:review:import -- <path-to-csv>');
    }
    return filePath;
}

async function main() {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is required');
    }

    await runMigrations();
    const filePath = requiredArg();
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCsv(text);
    if (rows.length < 2) {
        throw new Error('CSV has no data rows');
    }

    const header = rows[0];
    const idx = Object.fromEntries(header.map((key, i) => [key, i])) as Record<string, number>;
    for (const key of ['reviewQueueId', 'buyerId', 'approvedPhone', 'approvedWebsite']) {
        if (!(key in idx)) throw new Error(`Missing required CSV column: ${key}`);
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows.slice(1)) {
        const reviewQueueId = row[idx.reviewQueueId]?.trim();
        const buyerId = row[idx.buyerId]?.trim();
        const approvedPhone = row[idx.approvedPhone]?.trim() || null;
        const approvedWebsite = row[idx.approvedWebsite]?.trim() || null;
        const notes = row[idx.notes]?.trim() || null;

        if (!reviewQueueId || !buyerId) {
            skipped++;
            continue;
        }
        if (!approvedPhone && !approvedWebsite) {
            skipped++;
            continue;
        }

        await withDbTransaction(async (client) => {
            const roleResult = await client.query<{ type: string }>(
                'SELECT type FROM buyers WHERE id = $1 LIMIT 1',
                [buyerId]
            );
            if ((roleResult.rowCount ?? 0) === 0) {
                throw new Error(`Buyer not found for review row ${reviewQueueId}`);
            }
            const contactRole = roleResult.rows[0].type === 'transload' ? 'Operations' : 'Grain Desk';

            await client.query(
                `
                    INSERT INTO buyer_contacts (
                        buyer_id, contact_role, facility_phone, website_url,
                        verified_status, verified_at, verification_method,
                        confidence_score, last_checked_at, notes
                    ) VALUES (
                        $1, $2, $3, $4,
                        'verified', NOW(), 'manual_review',
                        100, NOW(), $5
                    )
                    ON CONFLICT (buyer_id) DO UPDATE
                    SET
                        contact_role = EXCLUDED.contact_role,
                        facility_phone = COALESCE(EXCLUDED.facility_phone, buyer_contacts.facility_phone),
                        website_url = COALESCE(EXCLUDED.website_url, buyer_contacts.website_url),
                        verified_status = 'verified',
                        verified_at = NOW(),
                        verification_method = 'manual_review',
                        confidence_score = 100,
                        last_checked_at = NOW(),
                        notes = COALESCE(EXCLUDED.notes, buyer_contacts.notes)
                `,
                [buyerId, contactRole, approvedPhone, approvedWebsite, notes ?? 'Approved via review CSV import']
            );

            await client.query(
                `
                    UPDATE buyer_review_queue
                    SET
                        status = 'resolved',
                        resolved_by = 'manual_csv_import',
                        resolved_at = NOW()
                    WHERE id = $1
                `,
                [reviewQueueId]
            );
        });

        imported++;
    }

    console.log(`Imported/approved: ${imported}`);
    console.log(`Skipped rows: ${skipped}`);
}

main()
    .catch((error) => {
        console.error('buyers:review:import failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
