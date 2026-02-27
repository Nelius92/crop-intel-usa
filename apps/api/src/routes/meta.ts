import { Router } from 'express';
import { isDatabaseConfigured } from '../db/pool.js';
import { getLatestBuyerContactSyncRun, getOpenBuyerReviewCount } from '../repositories/sync-runs-repo.js';

export const metaRouter = Router();

metaRouter.get('/sync-status', async (_req, res, next) => {
    try {
        if (!isDatabaseConfigured()) {
            return res.status(503).json({
                error: 'Database not configured',
                code: 'DATABASE_NOT_CONFIGURED',
            });
        }

        const [latestRun, openReviewCount] = await Promise.all([
            getLatestBuyerContactSyncRun(),
            getOpenBuyerReviewCount(),
        ]);

        return res.json({
            lastRun: latestRun,
            openReviewCount,
        });
    } catch (error) {
        return next(error);
    }
});
