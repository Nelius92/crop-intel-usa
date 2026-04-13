import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { z } from 'zod';
import { backendGeminiService } from '../services/gemini.service.js';
import { calculateBuyerIntelScore, type BuyerIntelInput } from '../services/buyerIntelScore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CropType = 'Yellow Corn' | 'White Corn' | 'Soybeans' | 'Wheat' | 'Sunflowers';

interface BuyerRecord {
    id: string;
    name: string;
    type: string;
    city: string;
    state: string;
    region?: string;
    lat: number;
    lng: number;
    basis: number;
    cashPrice: number;
    railAccessible?: boolean;
    nearTransload?: boolean;
    cropType?: CropType;
    contactName?: string;
    contactPhone?: string;
    website?: string;
}

const cropSchema = z.enum(['Yellow Corn', 'White Corn', 'Soybeans', 'Wheat', 'Sunflowers']).default('Yellow Corn');
const buyersRequestSchema = z.object({
    crop: cropSchema.optional(),
});
const marketIntelRequestSchema = z.object({
    crop: cropSchema.optional(),
    buyers: z.array(z.any()).optional(),
});
const enrichBuyersRequestSchema = z.object({
    crop: cropSchema.optional(),
    buyers: z.array(z.any()),
    oracle: z.object({
        futuresPrice: z.number(),
        contractMonth: z.string(),
        benchmarkBasis: z.number(),
        centralRegionBasis: z.number().optional().default(-0.6),
        lastUpdated: z.string().optional(),
    }),
});

function resolveBuyersJsonPath(): string {
    const candidates = [
        path.resolve(__dirname, '../../../../src/data/buyers.json'),
        path.resolve(process.cwd(), 'src/data/buyers.json'),
        path.resolve(process.cwd(), '../src/data/buyers.json'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`buyers.json not found. Checked: ${candidates.join(', ')}`);
}

let buyersCache: BuyerRecord[] | null = null;
let buyersCacheLoadedAt = 0;

function loadSeedBuyers(): BuyerRecord[] {
    const now = Date.now();
    if (buyersCache && now - buyersCacheLoadedAt < 60_000) return buyersCache;

    const buyersPath = resolveBuyersJsonPath();
    const raw = fs.readFileSync(buyersPath, 'utf-8');
    buyersCache = JSON.parse(raw) as BuyerRecord[];
    buyersCacheLoadedAt = now;
    return buyersCache;
}

function cropDefaults(crop: CropType) {
    switch (crop) {
        case 'Soybeans':
            return { futuresPrice: 11.42, contractMonth: "ZSH6 (Mar '26)", benchmarkBasis: -0.8 };
        case 'Wheat':
            return { futuresPrice: 5.42, contractMonth: "ZWH6 (Mar '26)", benchmarkBasis: -0.6 };
        case 'White Corn':
            return { futuresPrice: 4.6, contractMonth: "ZCH6 (Mar '26)", benchmarkBasis: -0.1 };
        case 'Sunflowers':
            return { futuresPrice: 23.30, contractMonth: 'Spot Cash (High-Oleic)', benchmarkBasis: 0 };
        case 'Yellow Corn':
        default:
            return { futuresPrice: 4.3, contractMonth: "ZCH6 (Mar '26)", benchmarkBasis: -0.47 };
    }
}

function seededRandom(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
}

function buildHeatmap(crop: CropType) {
    const buyers = loadSeedBuyers()
        .filter((b) => (b.cropType ?? 'Yellow Corn') === crop)
        .slice(0, 24);
    const defaults = cropDefaults(crop);

    return buyers.map((buyer, idx) => {
        const jitter = seededRandom(`${buyer.id}:${crop}:${idx}`);
        const basis = typeof buyer.basis === 'number' ? buyer.basis : -0.25;
        const cash = parseFloat((defaults.futuresPrice + basis + (jitter - 0.5) * 0.1).toFixed(2));
        const change24h = parseFloat((((jitter - 0.5) * 8)).toFixed(2));
        return {
            id: `heat-${buyer.id}`,
            lat: buyer.lat,
            lng: buyer.lng,
            cornPrice: cash,
            basis: parseFloat(basis.toFixed(2)),
            change24h,
            isOpportunity: change24h > 2 || basis > 0.5,
            regionName: buyer.region || `${buyer.city}, ${buyer.state}`,
            marketLabel: buyer.name,
        };
    });
}

function buildBuyers(crop: CropType) {
    return loadSeedBuyers()
        .filter((buyer) => (buyer.cropType ?? 'Yellow Corn') === crop)
        .slice(0, 40);
}

function buildOracle(crop: CropType) {
    const defaults = cropDefaults(crop);
    return {
        futuresPrice: defaults.futuresPrice,
        contractMonth: defaults.contractMonth,
        benchmarkBasis: defaults.benchmarkBasis,
        centralRegionBasis: crop === 'Yellow Corn' ? -0.6 : -0.25,
        lastUpdated: new Date().toISOString(),
    };
}

function buildMarketIntel(crop: CropType, buyers: any[]): string {
    const topStates = buyers
        .reduce<Record<string, number>>((acc, b) => {
            const state = String(b?.state || 'NA');
            acc[state] = (acc[state] || 0) + 1;
            return acc;
        }, {});
    const stateList = Object.entries(topStates)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([state]) => state)
        .join(', ');

    return `**${crop} Market Update: Basis Opportunities by Rail Corridor**\n\nCrop Intel is running in local production mode with verified buyer directory contacts. Current activity is concentrated in ${stateList || 'core corridor states'}, with rail-served facilities and export-linked buyers showing the strongest marketing opportunities. Use the buyer table to compare net bids after freight and call the facility grain desk directly from the app.`;
}

export const aiRouter = Router();

aiRouter.post('/heatmap', async (req, res, next) => {
    try {
        const parsed = buyersRequestSchema.parse(req.body ?? {});
        const crop = parsed.crop ?? 'Yellow Corn';
        const data = await backendGeminiService.generateHeatmap(crop, () => buildHeatmap(crop));
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

aiRouter.post('/buyers', async (req, res, next) => {
    try {
        const parsed = buyersRequestSchema.parse(req.body ?? {});
        const crop = parsed.crop ?? 'Yellow Corn';
        const data = await backendGeminiService.generateBuyers(crop, () => buildBuyers(crop));
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

aiRouter.post('/market-intel', async (req, res, next) => {
    try {
        const parsed = marketIntelRequestSchema.parse(req.body ?? {});
        const crop = parsed.crop ?? 'Yellow Corn';
        const buyers = parsed.buyers ?? [];
        const data = await backendGeminiService.generateMarketIntel(crop, buyers, () => buildMarketIntel(crop, buyers));
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

aiRouter.post('/oracle', async (req, res, next) => {
    try {
        const parsed = buyersRequestSchema.parse(req.body ?? {});
        const crop = parsed.crop ?? 'Yellow Corn';
        const data = await backendGeminiService.generateOracle(crop, () => buildOracle(crop));
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

aiRouter.post('/enrich-buyers', async (req, res, next) => {
    try {
        const parsed = enrichBuyersRequestSchema.parse(req.body ?? {});
        const crop = parsed.crop ?? 'Yellow Corn';
        const { futuresPrice } = parsed.oracle;

        const fallbackData = parsed.buyers.map((buyer: any, index: number) => {
            const basis = typeof buyer.basis === 'number' ? buyer.basis : (crop === 'Yellow Corn' ? -0.25 : 0);
            const freightCost = Math.abs(Number(buyer.freightCost ?? 0));
            const cashPrice = parseFloat((futuresPrice + basis).toFixed(2));
            const netPrice = parseFloat((cashPrice - freightCost).toFixed(2));

            return {
                ...buyer,
                id: buyer.id ?? `buyer-${index}`,
                cashPrice,
                futuresPrice,
                netPrice,
                verified: buyer.verified ?? false,
                lastUpdated: new Date().toISOString(),
            };
        });

        const data = await backendGeminiService.enrichBuyers(crop, parsed.buyers, parsed.oracle, () => fallbackData);
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

// ── Buyer Intelligence Score + Explanation ───────────────────────────
const buyerIntelRequestSchema = z.object({
    crop: cropSchema,
    buyerData: z.object({
        name: z.string(),
        type: z.string(),
        city: z.string(),
        state: z.string(),
        netPrice: z.number().nullable().optional(),
        benchmarkPrice: z.number().optional(),
        railConfidence: z.number().nullable().optional(),
        verifiedStatus: z.string().nullable().optional(),
        hasPhone: z.boolean().optional(),
        freightCost: z.number().nullable().optional(),
        hasRealBid: z.boolean().optional(),
        website: z.string().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
    }),
    withExplanation: z.boolean().optional().default(false),
});

aiRouter.post('/buyer-intel', async (req, res, next) => {
    try {
        const parsed = buyerIntelRequestSchema.parse(req.body ?? {});
        const { crop, buyerData, withExplanation } = parsed;

        // Step 1: Deterministic score (instant)
        const intelInput: BuyerIntelInput = {
            buyerType: buyerData.type,
            crop: crop as any,
            netPrice: buyerData.netPrice,
            benchmarkPrice: buyerData.benchmarkPrice,
            railConfidence: buyerData.railConfidence,
            verifiedStatus: buyerData.verifiedStatus,
            hasPhone: buyerData.hasPhone ?? !!buyerData.contactPhone,
            freightCost: buyerData.freightCost,
            hasRealBid: buyerData.hasRealBid,
            website: buyerData.website,
        };

        const intelResult = calculateBuyerIntelScore(intelInput);

        // Step 2: Gemini + Firecrawl explanation (on-demand, cached)
        let explanation: string | null = null;
        if (withExplanation) {
            explanation = await backendGeminiService.generateBuyerExplanation({
                ...buyerData,
                crop,
                intelScore: intelResult.score,
                intelLabel: intelResult.label,
                signals: intelResult.signals,
            });
        }

        res.json({
            data: {
                ...intelResult,
                explanation,
            },
        });
    } catch (error) {
        next(error);
    }
});
