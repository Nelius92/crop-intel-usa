import { Router } from 'express';
import { logger } from '../logger.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
