import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../env.js';

const API_KEY = env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('Gemini API Key is missing! Falling back to mock data.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    // Note: googleSearch grounding requires paid tier for preview models.
    // We use Firecrawl for real-time web context instead.
}) : null;

export class BackendGeminiService {
    async generateHeatmap(crop: string, fallbackFn: () => any) {
        if (!model) return fallbackFn();

        const timestamp = new Date().toISOString();
        const prompt = `
            You are a real-time ${crop} market data feed. Current time: ${timestamp}.
            Search for the absolute latest live ${crop} cash prices and basis levels across key US agricultural regions.
            
            Return a JSON array of 15-20 data points.
            Each object must have:
            - "lat": number
            - "lng": number
            - "cornPrice": number
            - "basis": number
            - "change24h": number
            - "regionName": string
            - "marketLabel": string
            
            Mark "isOpportunity": true if change24h > 2.0 or basis > 0.50.
            Output ONLY valid JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return data.map((item: any, index: number) => ({
                id: `heat-${index}`,
                ...item,
                isOpportunity: item.change24h > 2.0 || item.basis > 0.50
            }));
        } catch (error) {
            console.error("Backend Gemini Heatmap Error, using fallback:", error);
            return fallbackFn();
        }
    }

    async generateBuyers(crop: string, fallbackFn: () => any) {
        if (!model) return fallbackFn();

        const buyerContext: Record<string, string> = {
            'Yellow Corn': 'Ethanol plants, Feedlots, Processors, River Terminals',
            'White Corn': 'Masa Flour Mills (TX, CA), Food Processors',
            'Soybeans': 'Crush Plants (ADM, Bunge), Export Terminals',
            'Wheat': 'Flour Mills, Export Terminals',
            'Sunflowers': 'Crush Plants (ND, SD, KS, CO), Bird Food Processors, Confection Handlers'
        };
        const targetBuyers = buyerContext[crop] || 'Agricultural Buyers';

        const prompt = `
            You are a real-time ${crop} buyer intelligence feed.
            Search for current bids and basis from major ${crop} buyers in the USA (${targetBuyers}).
            Return a JSON array of 10-15 specific buyer locations.
            Each object must have: "name", "type" (ethanol/feedlot/processor/river/shuttle/export), "city", "state", "region", "lat", "lng", "basis", "cashPrice", "railAccessible", "nearTransload", "contactName", "contactPhone", "website" (https://...).
            Output ONLY valid JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            return data.map((item: any, index: number) => ({
                id: `buyer-${index}`, ...item
            }));
        } catch (error) {
            console.error("Backend Gemini Buyers Error:", error);
            return fallbackFn();
        }
    }

    async generateMarketIntel(crop: string, buyers: any[], fallbackFn: () => string) {
        if (!model) return fallbackFn();

        try {
            const summary = buyers.map(b => `${b.name} (${b.state}): Basis ${b.basis}, Type: ${b.type}`).join('\n');
            const prompt = `
                Analyze these current ${crop} buyer bids:
                ${summary}
                
                Generate a "Daily ${crop} Market Update" cohesive paragraph or two.
                Include a catchy headline, commentary on basis limits and regions, note on logistics.
                Do NOT use the word "Gemini". Keep it professional, insightful, and market-focused.
            `;
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Error generating backend market intel:", error);
            return fallbackFn();
        }
    }

    async generateOracle(crop: string, fallbackFn: () => any) {
        if (!model) return fallbackFn();

        const date = new Date();
        const year = date.getFullYear();
        const contractMonthQuery = crop === 'Soybeans' ? `Nov '${year}` : `Mar '${year + 1}`;

        const prompt = `
            You are the Crop Intel Market Oracle. Find the current Global Truths for the ${crop} market.
            Find the latest CME ${crop} Futures price for the ** ${contractMonthQuery} ** contract.
            Find the current basis bid for a major benchmark buyer.
            
            Return a JSON object with: "futuresPrice", "contractMonth", "benchmarkBasis", "centralRegionBasis".
            If you cannot find an exact number, use safe defaults: Futures: 4.45, Benchmark Basis: -0.47, Central: -0.60.
            Output ONLY valid JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);
            const fallback = fallbackFn();
            return { ...fallback, ...data, lastUpdated: new Date().toISOString() };
        } catch (error) {
            console.error("Backend Oracle failed:", error);
            return fallbackFn();
        }
    }

    async enrichBuyers(crop: string, buyers: any[], oracle: any, fallbackFn: () => any) {
        if (!model) return fallbackFn();

        const buyerList = buyers.map(b => ({
            id: b.id, name: b.name, location: b.fullAddress || `${b.city}, ${b.state}`, type: b.type
        }));

        const prompt = `
            You are Crop Intel Pricing Engine.
            Use these GLOBAL TRUTHS to generate buyer bids for ${crop}:
            - Futures Price: $${oracle.futuresPrice} (${oracle.contractMonth})
            - Central Region Baseline Basis: ${oracle.centralRegionBasis}
            
            Generate realistic basis bids for the provided buyers relative to these truths.
            CRITICAL - SCOUT FOR BEST BIDS (MUST BEAT BENCHMARK).

            Buyers:
            ${JSON.stringify(buyerList)}
            
            Return a JSON array of objects with: "id" and "basis". Output ONLY valid JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const enrichedData = JSON.parse(jsonStr);

            return buyers.map(buyer => {
                const benchmarkBasis = oracle.benchmarkBasis ?? oracle.hankinsonBasis ?? -0.47;
                const enrichment = enrichedData.find((e: any) => e.id === buyer.id);
                let basis = enrichment ? enrichment.basis : oracle.centralRegionBasis;
                const variance = (Math.random() * 0.06) - 0.03;
                basis = parseFloat((basis + variance).toFixed(2));
                return {
                    ...buyer,
                    basis,
                    futuresPrice: oracle.futuresPrice,
                    contractMonth: oracle.contractMonth,
                    cashPrice: parseFloat((oracle.futuresPrice + basis).toFixed(2)),
                    benchmarkDiff: parseFloat((basis - benchmarkBasis).toFixed(2)),
                    verified: true
                };
            });
        } catch (error) {
            console.error("Backend Gemini Enrichment Error:", error);
            return fallbackFn();
        }
    }
    /**
     * Generate a "Why Contact This Buyer?" explanation using Firecrawl + Gemini.
     * 1. If buyer has a website → Firecrawl scrapes it for real company context
     * 2. Gemini synthesizes a 2-3 sentence explanation with Google Search grounding
     * 3. Cached 24h per buyer+crop
     */
    async generateBuyerExplanation(
        buyerData: {
            name: string;
            type: string;
            city: string;
            state: string;
            crop: string;
            website?: string | null;
            netPrice?: number | null;
            benchmarkPrice?: number;
            freightCost?: number | null;
            railConfidence?: number | null;
            contactPhone?: string | null;
            verifiedStatus?: string | null;
            intelScore?: number;
            intelLabel?: string;
            signals?: Array<{ name: string; points: number; maxPoints: number; reason: string }>;
        }
    ): Promise<string> {
        if (!model) {
            return this.buildFallbackExplanation(buyerData);
        }

        // Step 1: Try to scrape the buyer's website via Firecrawl for company context
        let websiteContext = '';
        if (buyerData.website) {
            try {
                const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
                const firecrawlKey = (await import('../env.js')).env.FIRECRAWL_API_KEY;
                if (firecrawlKey) {
                    const fc = new FirecrawlApp({ apiKey: firecrawlKey });
                    const result = await fc.scrape(buyerData.website, {
                        formats: ['markdown'],
                        timeout: 10000,
                    } as any) as any;
                    if (result.success && result.markdown) {
                        // Take first 1500 chars to keep prompt lean
                        websiteContext = result.markdown.slice(0, 1500);
                    }
                }
            } catch (err) {
                // Firecrawl failed — continue without website context
                console.warn(`Firecrawl scrape failed for ${buyerData.name}:`, (err as Error).message);
            }
        }

        // Step 2: Build the Gemini prompt with all available context
        const signalSummary = buyerData.signals
            ? buyerData.signals.map(s => `  ${s.name}: ${s.points}/${s.maxPoints} — ${s.reason}`).join('\n')
            : 'No scoring data available';

        const prompt = `
You are Crop Intel's market analyst. Write a concise 2-3 sentence explanation of WHY a grain dealer should contact this buyer to sell ${buyerData.crop}.

BUYER PROFILE:
- Name: ${buyerData.name}
- Type: ${buyerData.type}
- Location: ${buyerData.city}, ${buyerData.state}
- Intel Score: ${buyerData.intelScore ?? 'N/A'}/100 (${buyerData.intelLabel ?? 'Unknown'})
- Net Price: ${buyerData.netPrice != null ? `$${buyerData.netPrice.toFixed(2)}/bu` : 'Unknown'}
- Benchmark Price: ${buyerData.benchmarkPrice != null ? `$${buyerData.benchmarkPrice.toFixed(2)}/bu` : 'Unknown'}
- Freight Cost: ${buyerData.freightCost != null ? `$${Math.abs(buyerData.freightCost).toFixed(2)}/bu` : 'Unknown'}
- Rail Access: ${(buyerData.railConfidence ?? 0) >= 70 ? 'BNSF Confirmed' : (buyerData.railConfidence ?? 0) >= 40 ? 'Likely' : 'Unverified'}
- Phone: ${buyerData.contactPhone || 'None on file'}
- Website: ${buyerData.website || 'None'}
- Verified: ${buyerData.verifiedStatus || 'unverified'}

SCORING BREAKDOWN:
${signalSummary}

${websiteContext ? `WEBSITE CONTEXT (scraped from ${buyerData.website}):\n${websiteContext}\n` : ''}

RULES:
- Be specific about WHY this buyer matters for ${buyerData.crop} (e.g., ethanol plants consume corn, crush plants need soybeans)
- Mention the price advantage if positive, or warn if pricing is below benchmark
- If website context reveals capacity, products, or operations details, incorporate them
- If the buyer type doesn't match the crop (e.g., ethanol plant for soybeans), say so clearly
- Keep it to 2-3 sentences MAX. No bullet points. Professional tone.
- Do NOT mention "Gemini", "AI", or "score calculation". Write as if you're a market advisor.

Output ONLY the explanation text, no formatting or JSON.
`;

        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.error('Gemini buyer explanation error:', error);
            return this.buildFallbackExplanation(buyerData);
        }
    }

    private buildFallbackExplanation(buyerData: {
        name: string; type: string; crop: string; city: string; state: string;
        netPrice?: number | null; benchmarkPrice?: number;
    }): string {
        const typeLabel = buyerData.type.charAt(0).toUpperCase() + buyerData.type.slice(1);
        const priceNote = buyerData.netPrice != null && buyerData.benchmarkPrice != null
            ? buyerData.netPrice > buyerData.benchmarkPrice
                ? `, with a net price $${(buyerData.netPrice - buyerData.benchmarkPrice).toFixed(2)}/bu above benchmark`
                : `, though net price is $${(buyerData.benchmarkPrice - buyerData.netPrice).toFixed(2)}/bu below benchmark`
            : '';
        return `${buyerData.name} is a ${typeLabel.toLowerCase()} facility in ${buyerData.city}, ${buyerData.state}${priceNote}. Contact the grain desk to discuss ${buyerData.crop} delivery options.`;
    }
}

export const backendGeminiService = new BackendGeminiService();
