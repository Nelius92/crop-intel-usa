import cors from 'cors';
import { env } from '../env.js';

const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'https://crop-intel-usa.vercel.app',
].filter(Boolean);

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.vercel.app'))) {
            return callback(null, true);
        }
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});
