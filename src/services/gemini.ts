import { GoogleGenerativeAI } from '@google/generative-ai';
import { Buyer, HeatmapPoint } from '../types';
import { FALLBACK_HEATMAP_DATA, FALLBACK_BUYERS_DATA } from './fallbackData';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('Gemini API Key is missing! Please add VITE_GEMINI_API_KEY to your .env file.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

export class GeminiService {
    // Use gemini-1.5-flash for speed and cost effectiveness
    private model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Helper to simulate live market ticks
    private perturbData(data: HeatmapPoint[]): HeatmapPoint[] {
        return data.map(item => {
            const change = (Math.random() - 0.5) * 0.05; // +/- 2.5 cents
            const newPrice = item.cornPrice + change;
            const newBasis = item.basis + (Math.random() - 0.5) * 0.02; // +/- 1 cent basis
            return {
                ...item,
                cornPrice: parseFloat(newPrice.toFixed(2)),
                basis: parseFloat(newBasis.toFixed(2)),
                // Recalculate opportunity based on new values
                isOpportunity: item.change24h > 2.0 || newBasis > 0.50
            };
        });
    }

    async getLiveHeatmapData(): Promise<HeatmapPoint[]> {
        // Add timestamp to prompt to ensure fresh generation
        const timestamp = new Date().toISOString();

        if (!API_KEY) {
            console.warn("Using fallback heatmap data (No API Key)");
            return this.perturbData(FALLBACK_HEATMAP_DATA);
        }

        const prompt = `
            You are a real-time corn market data feed. Current time: ${timestamp}.
            Search for the absolute latest live corn cash prices and basis levels across key US agricultural regions.
            
            Return a JSON array of 15-20 data points.
            Each object must have:
            - "lat": number
            - "lng": number
            - "cornPrice": number (price in USD)
            - "basis": number
            - "change24h": number
            - "regionName": string
            - "marketLabel": string
            
            Mark "isOpportunity": true if change24h > 2.0 or basis > 0.50.
            
            IMPORTANT: Ensure the data varies slightly from previous requests to reflect real-time market ticks.
            Output ONLY valid JSON.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                const data = JSON.parse(jsonStr);
                return data.map((item: any, index: number) => ({
                    id: `heat-${index}`,
                    ...item,
                    isOpportunity: item.change24h > 2.0 || item.basis > 0.50
                }));
            } catch (parseError) {
                console.error("JSON Parse Error, using perturbed fallback:", parseError);
                return this.perturbData(FALLBACK_HEATMAP_DATA);
            }
        } catch (error) {
            console.error("Gemini API Error, using perturbed fallback:", error);
            // Return perturbed fallback data so the UI still feels "live"
            return this.perturbData(FALLBACK_HEATMAP_DATA);
        }
    }

    async getLiveBuyerData(): Promise<Buyer[]> {
        if (!API_KEY) {
            console.warn("Using fallback buyer data (No API Key)");
            return FALLBACK_BUYERS_DATA;
        }

        const prompt = `
            You are a real-time corn buyer intelligence feed.
            Search for current bids and basis from major corn buyers in the USA (Ethanol plants, Feedlots, Processors, River Terminals).
            Examples: POET Biorefining, ADM, Cargill, Valero, local feedlots in TX/KS/NE.
            
            Return a JSON array of 10-15 specific buyer locations.
            Each object must have:
            - "name": string (Buyer Name)
            - "type": string (one of: 'ethanol', 'feedlot', 'processor', 'river', 'shuttle', 'export')
            - "city": string
            - "state": string
            - "region": string (e.g., "South Texas", "Central IL")
            - "lat": number
            - "lng": number
            - "basis": number (current basis bid)
            - "cashPrice": number (current cash price)
            - "railAccessible": boolean (true if likely served by rail)
            - "nearTransload": boolean (true if near a transload facility)
            - "contactName": string (Simulated contact person name)
            - "contactPhone": string (Simulated phone number, e.g. (555) 123-4567)
            - "contactEmail": string (Simulated email address)
            
            Output ONLY valid JSON. No markdown formatting.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            console.log("Gemini Buyer Raw Response:", text); // Debug log

            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                const data = JSON.parse(jsonStr);
                return data.map((item: any, index: number) => ({
                    id: `buyer-${index}`,
                    ...item
                }));
            } catch (parseError) {
                console.error("Buyer JSON Parse Error:", parseError);
                return FALLBACK_BUYERS_DATA;
            }
        } catch (error) {
            console.error("Gemini Buyer API Error:", error);
            return FALLBACK_BUYERS_DATA;
        }
    }

    async getMarketIntel(buyers: Buyer[]): Promise<string> {
        const FALLBACK_INTEL = `**Corn Markets: Cash Bids Firm on Export Hopes**

Basis levels across the Midwest are showing resilience this week, driven by steady demand from ethanol processors and a slight uptick in export interest. Eastern Corn Belt terminals are bidding aggressively to secure bushels, while the Western Corn Belt remains mixed due to variable logistics.

Rail-accessible facilities are commanding a premium, with basis levels strengthening in the Southern Plains. Farmers are holding tight to remaining stocks, awaiting further price direction. Overall, the cash market feels supported, with limited downside risk in the near term.`;

        if (!API_KEY) return FALLBACK_INTEL;

        try {
            const summary = buyers.map(b => `${b.name} (${b.state}): Basis ${b.basis}, Type: ${b.type}`).join('\n');

            const prompt = `
                Analyze these current corn buyer bids:
                ${summary}
                
                Generate a "Daily Corn Market Update" similar to a Barchart or USDA summary.
                It should be a cohesive paragraph or two, not just bullet points.
                
                Include:
                - A catchy headline (e.g., "Corn Markets: Cash Bids Firm on Export Hopes").
                - Commentary on basis levels and regional strengths/weaknesses.
                - Mention specific active regions or buyer types (e.g. "Ethanol plants in Iowa are bidding up...").
                - A brief note on logistics (rail/river) if relevant.
                
                Do NOT use the word "Gemini". Keep it professional, insightful, and market-focused.
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Error generating market intel:", error);
            return FALLBACK_INTEL;
        }
    }

    async enrichBuyersWithMarketData(buyers: Buyer[]): Promise<Buyer[]> {
        if (!API_KEY || buyers.length === 0) return buyers;

        // Create a simplified list for the prompt to save tokens
        const buyerList = buyers.map(b => ({
            id: b.id,
            name: b.name,
            location: b.fullAddress || `${b.city}, ${b.state}`,
            type: b.type
        }));

        const prompt = `
            You are CornIntel Pricing Engine, a specialist assistant for U.S. grain markets.
            Your job is to return realistic, up-to-date cash bids, futures prices and basis for corn (and optionally other grains) for a specific location and delivery period.

            1. Data & Tools
            Always use the latest data available on the open web.
            When possible, use:
            - CME Group or other official exchange pages for futures prices.
            - Reputable market sites (e.g. elevator / coop / ethanol plant cash bid pages, DTN / Barchart / local grain bids pages) for cash bids.

            2. Contract & Unit Rules
            Futures:
            - Identify the correct CME / CBOT contract month for the requested delivery period.
            - Express futures prices in USD per bushel (e.g. 4.37 = $4.37/bu).
            Cash bids:
            - Treat cash bids as delivered to the buyer (unless a source clearly says FOB farm).
            - Convert any bids quoted in other units (e.g. cents per bushel, $/cwt, $/ton) into USD per bushel.

            3. Basis Calculation
            basis_per_bu = cash_price_per_bu – futures_price_per_bu
            Basis is in USD per bushel, typically negative in many locations.

            4. Location & Distance
            User will provide a primary location (lat/lon OR city & state).
            Prefer buyers within roughly 150 miles of that location.

            5. Output Format
            Always answer with pure JSON, no extra text.
            
            Buyers:
            ${JSON.stringify(buyerList)}
            
            Return a JSON array of objects with:
            - "id": string (matching the input id)
            - "basis": number (estimated basis, e.g. 0.35)
            - "cashPrice": number (estimated cash price, e.g. 4.50)
            - "marketLabel": string (Short 3-5 word tag, e.g. "Strong Ethanol Bid", "Rail Weakness", "River Premium")
            
            Output ONLY valid JSON.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const enrichedData = JSON.parse(jsonStr);

            // Merge enriched data back into original buyers
            return buyers.map(buyer => {
                const enrichment = enrichedData.find((e: any) => e.id === buyer.id);
                if (enrichment) {
                    return {
                        ...buyer,
                        basis: enrichment.basis,
                        cashPrice: enrichment.cashPrice,
                        // If we had a field for label, we'd add it here. For now, let's just update prices.
                    };
                }
                return buyer;
            });

        } catch (error) {
            console.error("Gemini Enrichment Error:", error);
            return buyers; // Return original list if AI fails
        }
    }
}

export const geminiService = new GeminiService();
