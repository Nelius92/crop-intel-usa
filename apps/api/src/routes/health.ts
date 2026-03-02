import { Router } from 'express';
import { pingDatabase } from '../db/pool.js';

export const healthRouter = Router();

function livePayload() {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    };
}

healthRouter.get('/', (_req, res) => {
    res.json(livePayload());
});

healthRouter.get('/live', (_req, res) => {
    res.json(livePayload());
});

healthRouter.get('/ready', async (_req, res) => {
    const database = await pingDatabase();
    const ok = database.ok;

    res.status(ok ? 200 : 503).json({
        status: ok ? 'ready' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
            database,
        },
    });
});

healthRouter.get('/legacy', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
