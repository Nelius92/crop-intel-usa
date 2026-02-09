import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    FRONTEND_URL: z.string().url().default('http://localhost:5174'),

    // API Keys (backend only)
    GEMINI_API_KEY: z.string().min(10).optional(),
    GOOGLE_MAPS_API_KEY: z.string().min(10).optional(),

    // BNSF (optional for now, will use fallback)
    BNSF_CERT_PATH: z.string().optional(),
    BNSF_KEY_PATH: z.string().optional(),
    FEATURE_BNSF_RATES_ENABLED: z.coerce.boolean().default(false),

    // Database (will add later)
    DATABASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
