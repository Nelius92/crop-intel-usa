import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { buyersRouter } from './routes/buyers.js';
import { usdaRouter } from './routes/usda.js';
import { env } from './env.js';
import { logger } from './logger.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(corsMiddleware);
app.use(rateLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
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

// Error handling (must be last)
app.use(errorHandler);

const PORT = env.PORT;

app.listen(PORT, () => {
    logger.info(`🚀 API server running on port ${PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
});
