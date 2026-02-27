import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    FRONTEND_URL: z.string().url().default('http://localhost:5174'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    AUTO_RUN_MIGRATIONS: z.coerce.boolean().default(false),

    // API Keys (backend only)
    GEMINI_API_KEY: z.string().min(10).optional(),
    GOOGLE_MAPS_API_KEY: z.string().min(10).optional(),

    // BNSF (optional for now, will use fallback)
    BNSF_CERT_PATH: z.string().optional(),
    BNSF_KEY_PATH: z.string().optional(),
    FEATURE_BNSF_RATES_ENABLED: z.coerce.boolean().default(false),

    // Firecrawl (daily bid scraping pipeline)
    FIRECRAWL_API_KEY: z.string().min(3).optional(),

    // Redis (server-side cache — Upstash or Railway Redis)
    REDIS_URL: z.string().url().optional(),

    // Database
    DATABASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
