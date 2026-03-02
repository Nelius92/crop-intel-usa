import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { buyersRouter } from './routes/buyers.js';
import { usdaRouter } from './routes/usda.js';
import { metaRouter } from './routes/meta.js';
import { aiRouter } from './routes/ai.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { placesRouter } from './routes/places.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { closeDbPool, isDatabaseConfigured } from './db/pool.js';
import { runMigrations } from './db/migrations.js';

export function createApp() {
    const app = express();

    // Trust the reverse proxy on the Mac mini/nginx deployment.
    app.set('trust proxy', env.TRUST_PROXY_HOPS);

    // Security middleware
    app.use(helmet());
    app.use(corsMiddleware);
    app.use(rateLimiter);

    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, _res, next) => {
        logger.info('Incoming request', {
            method: req.method,
            path: req.path,
            ip: req.ip,
        });
        next();
    });

    // Routes
    app.use('/health', healthRouter);
    app.use('/api/buyers', buyersRouter);
    app.use('/api/usda', usdaRouter);
    app.use('/api/meta', metaRouter);
    app.use('/api/ai', aiRouter);
    app.use('/api/recommendations', recommendationsRouter);
    app.use('/api/places', placesRouter);

    // Error handling (must be last)
    app.use(errorHandler);

    return app;
}

export const app = createApp();

export async function startServer() {
    if (env.AUTO_RUN_MIGRATIONS && isDatabaseConfigured()) {
        await runMigrations();
    }

    const PORT = env.PORT;

    const server = app.listen(PORT, () => {
        logger.info(`🚀 API server running on port ${PORT}`);
        logger.info(`Environment: ${env.NODE_ENV}`);
        logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down API server`);
        server.close(async () => {
            await closeDbPool();
            process.exit(0);
        });
        setTimeout(async () => {
            await closeDbPool();
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    return server;
}

void startServer();
