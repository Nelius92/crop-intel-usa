import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import { isDatabaseConfigured } from '../db/pool.js';
import { getBuyerById, getBuyerProvenanceSummary, listBuyers } from '../repositories/buyers-repo.js';

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
