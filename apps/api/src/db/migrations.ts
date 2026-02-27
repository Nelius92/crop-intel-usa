import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dbQuery, getDbPool, isDatabaseConfigured } from './pool.js';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveMigrationsDir(): string {
    const candidates = [
        path.resolve(__dirname, '../../migrations'),
        path.resolve(process.cwd(), 'apps/api/migrations'),
        path.resolve(process.cwd(), 'migrations'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`Could not find migrations directory. Checked: ${candidates.join(', ')}`);
}

async function ensureMigrationsTable(): Promise<void> {
    await dbQuery(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

export interface MigrationRunSummary {
    applied: string[];
    skipped: string[];
    migrationsDir: string;
}

export async function runMigrations(): Promise<MigrationRunSummary> {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is required to run migrations');
    }

    const migrationsDir = resolveMigrationsDir();
    const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    await ensureMigrationsTable();

    const appliedRows = await dbQuery<{ version: string }>(
        'SELECT version FROM schema_migrations'
    );
    const appliedVersions = new Set(appliedRows.rows.map((row) => row.version));

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const fileName of migrationFiles) {
        if (appliedVersions.has(fileName)) {
            skipped.push(fileName);
            continue;
        }

        const filePath = path.join(migrationsDir, fileName);
        const sql = fs.readFileSync(filePath, 'utf-8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');

        const client = await getDbPool().connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
                [fileName, checksum]
            );
            await client.query('COMMIT');
            applied.push(fileName);
            logger.info('Applied migration', { fileName });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Migration failed', {
                fileName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        } finally {
            client.release();
        }
    }

    return { applied, skipped, migrationsDir };
}
