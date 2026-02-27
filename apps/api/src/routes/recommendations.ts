import { Router } from 'express';
import { z } from 'zod';
import { isDatabaseConfigured } from '../db/pool.js';
import { logger } from '../logger.js';
import {
    getLatestMorningRecommendationRun,
    listMorningRecommendationsForRun,
} from '../repositories/recommendations-repo.js';

export const recommendationsRouter = Router();

const morningQuerySchema = z.object({
    crop: z.string().trim().min(1).max(64).default('Yellow Corn'),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    verifiedOnly: z.coerce.boolean().optional(),
    scope: z.enum(['corridor', 'out_of_scope', 'all']).optional(),
});

function singleQueryValue(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
}

recommendationsRouter.get('/morning', async (req, res, next) => {
    try {
        if (!isDatabaseConfigured()) {
            return res.status(503).json({
                error: 'Database not configured',
                code: 'DATABASE_NOT_CONFIGURED',
            });
        }

        const parsed = morningQuerySchema.parse({
            crop: singleQueryValue(req.query.crop) ?? 'Yellow Corn',
            limit: singleQueryValue(req.query.limit),
            verifiedOnly: singleQueryValue(req.query.verifiedOnly),
            scope: singleQueryValue(req.query.scope),
        });

        logger.info('Fetching morning recommendations', parsed);

        const run = await getLatestMorningRecommendationRun(parsed.crop);
        if (!run) {
            return res.status(404).json({
                error: 'No morning recommendations available yet',
                code: 'MORNING_RECOMMENDATIONS_NOT_FOUND',
                crop: parsed.crop,
            });
        }

        const data = await listMorningRecommendationsForRun({
            runId: run.id,
            limit: parsed.limit,
            verifiedOnly: parsed.verifiedOnly ?? false,
            scope: parsed.scope ?? 'corridor',
        });

        return res.json({
            run,
            topStates: run.topStates,
            data,
            count: data.length,
            filters: {
                crop: parsed.crop,
                limit: parsed.limit ?? 25,
                verifiedOnly: parsed.verifiedOnly ?? false,
                scope: parsed.scope ?? 'corridor',
            },
        });
    } catch (error) {
        return next(error);
    }
});

