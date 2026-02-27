import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../env.js';
import { logger } from '../logger.js';

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
    return Boolean(env.DATABASE_URL);
}

function createPool(): Pool {
    if (!env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for database operations');
    }

    const nextPool = new Pool({
        connectionString: env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });

    nextPool.on('error', (error) => {
        logger.error('Postgres pool error', {
            error: error.message,
            stack: error.stack,
        });
    });

    return nextPool;
}

export function getDbPool(): Pool {
    if (!pool) {
        pool = createPool();
    }

    return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    return getDbPool().query<T>(text, params);
}

export async function withDbTransaction<T>(
    fn: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await getDbPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function pingDatabase(): Promise<{
    configured: boolean;
    ok: boolean;
    latencyMs: number | null;
    error?: string;
}> {
    if (!isDatabaseConfigured()) {
        return {
            configured: false,
            ok: false,
            latencyMs: null,
            error: 'DATABASE_URL is not configured',
        };
    }

    const startedAt = Date.now();
    try {
        await dbQuery('SELECT 1');
        return {
            configured: true,
            ok: true,
            latencyMs: Date.now() - startedAt,
        };
    } catch (error) {
        return {
            configured: true,
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function closeDbPool(): Promise<void> {
    if (pool) {
        const activePool = pool;
        pool = null;
        await activePool.end();
    }
}
