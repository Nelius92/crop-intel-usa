import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import { isDatabaseConfigured } from '../db/pool.js';
import { getBuyerById, getBuyerProvenanceSummary, listBuyers } from '../repositories/buyers-repo.js';
import { env } from '../env.js';

export const buyersRouter = Router();

const listQuerySchema = z.object({
    state: z.string().trim().min(2).max(2).optional(),
    crop: z.string().trim().min(1).max(64).optional(),
    type: z.string().trim().min(1).max(32).optional(),
    region: z.string().trim().min(1).max(80).optional(),
    scope: z.enum(['corridor', 'out_of_scope', 'all']).optional(),
    verifiedOnly: z.coerce.boolean().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(2000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

const idParamSchema = z.object({
    id: z.string().uuid(),
});

function singleQueryValue(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
}

buyersRouter.get('/', async (req, res, next) => {
    try {
        if (!isDatabaseConfigured()) {
            return res.status(503).json({
                error: 'Database not configured',
                code: 'DATABASE_NOT_CONFIGURED',
            });
        }

        const parsed = listQuerySchema.parse({
            state: singleQueryValue(req.query.state),
            crop: singleQueryValue(req.query.crop),
            type: singleQueryValue(req.query.type),
            region: singleQueryValue(req.query.region),
            scope: singleQueryValue(req.query.scope),
            verifiedOnly: singleQueryValue(req.query.verifiedOnly),
            search: singleQueryValue(req.query.search),
            limit: singleQueryValue(req.query.limit),
            offset: singleQueryValue(req.query.offset),
        });

        logger.info('Fetching buyers from database', parsed);

        const result = await listBuyers({
            state: parsed.state,
            crop: parsed.crop,
            type: parsed.type,
            region: parsed.region,
            scope: parsed.scope ?? 'corridor',
            verifiedOnly: parsed.verifiedOnly ?? false,
            search: parsed.search,
            limit: parsed.limit,
            offset: parsed.offset,
        });

        res.json({
            data: result.data,
            count: result.count,
            directoryUpdatedAt: result.directoryUpdatedAt,
            filters: {
                ...parsed,
                scope: parsed.scope ?? 'corridor',
                verifiedOnly: parsed.verifiedOnly ?? false,
            },
        });
    } catch (error) {
        next(error);
    }
});

buyersRouter.get('/:id', async (req, res, next) => {
    try {
        if (!isDatabaseConfigured()) {
            return res.status(503).json({
                error: 'Database not configured',
                code: 'DATABASE_NOT_CONFIGURED',
            });
        }

        const { id } = idParamSchema.parse(req.params);

        logger.info('Fetching buyer by ID', { id });

        const buyer = await getBuyerById(id);

        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        const provenance = await getBuyerProvenanceSummary(id);

        res.json({
            data: buyer,
            provenance,
        });
    } catch (error) {
        next(error);
    }
});

// ── POST /sync — Trigger buyer contact sync (protected, async) ──────
const syncQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    staleDays: z.coerce.number().int().min(1).max(365).optional(),
    delayMs: z.coerce.number().int().min(50).max(2000).optional(),
});

let activeSyncStatus: {
    running: boolean;
    startedAt: string | null;
    result: unknown | null;
    error: string | null;
} = { running: false, startedAt: null, result: null, error: null };

buyersRouter.post('/sync', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const expectedToken = env.GOOGLE_MAPS_API_KEY;

        if (!token || !expectedToken || token !== expectedToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!isDatabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }

        if (activeSyncStatus.running) {
            return res.status(409).json({
                error: 'Sync already in progress',
                startedAt: activeSyncStatus.startedAt,
            });
        }

        const parsed = syncQuerySchema.parse(req.body ?? {});
        logger.info('Starting buyer contact sync (async)', parsed);

        // Mark as running and return 202 immediately
        activeSyncStatus = {
            running: true,
            startedAt: new Date().toISOString(),
            result: null,
            error: null,
        };

        res.status(202).json({
            message: 'Sync started',
            startedAt: activeSyncStatus.startedAt,
            checkStatus: '/api/buyers/sync/status',
        });

        // Fire-and-forget: run sync in background
        const { runBuyerContactSync } = await import('../services/buyer-contact-sync.js');
        runBuyerContactSync({
            limit: parsed.limit ?? 200,
            staleDays: parsed.staleDays ?? 30,
            delayMs: parsed.delayMs ?? 200,
        })
            .then((summary) => {
                activeSyncStatus = { running: false, startedAt: activeSyncStatus.startedAt, result: summary, error: null };
                logger.info('Buyer contact sync completed', summary);
            })
            .catch((err) => {
                activeSyncStatus = { running: false, startedAt: activeSyncStatus.startedAt, result: null, error: String(err) };
                logger.error('Buyer contact sync failed', { error: String(err) });
            });
    } catch (error) {
        next(error);
    }
});

buyersRouter.get('/sync/status', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || token !== env.GOOGLE_MAPS_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ data: activeSyncStatus });
});
