/**
 * Buyer Validation Script
 * 
 * Uses Google Search + Gemini to validate whether each buyer
 * in our database actually buys grain from farmers.
 * 
 * Usage: npx tsx scripts/validate-buyers.ts
 * 
 * Output: scripts/buyer_validations.json
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found in .env');
    process.exit(1);
}

// Types
interface Buyer {
    id: string;
    name: string;
    type: string;
    city: string;
    state: string;
    website?: string;
    contactPhone?: string;
    cropType?: string;
}

interface ValidationResult {
    buyerId: string;
    buyerName: string;
    city: string;
    state: string;
    type: string;
    status: 'confirmed_buyer' | 'likely_buyer' | 'not_a_buyer' | 'closed' | 'unknown';
    confidence: number; // 0-100
    reasoning: string;
    buysGrain: boolean;
    acceptsCorn: boolean;
    acceptsSoybeans: boolean;
    acceptsWheat: boolean;
    acceptsSunflowers: boolean;
    hasPublicBids: boolean;
    bidPageUrl: string | null;
    validatedAt: string;
}

// Load buyers from JSON
const buyersPath = path.resolve(__dirname, '../src/data/buyers.json');
const buyers: Buyer[] = JSON.parse(fs.readFileSync(buyersPath, 'utf-8'));

console.log(`\n🔍 Buyer Validation — ${buyers.length} buyers to validate\n`);

// Deduplicate by name to avoid wasting API calls
const uniqueBuyers = new Map<string, Buyer>();
for (const b of buyers) {
    const key = `${b.name}::${b.state}`;
    if (!uniqueBuyers.has(key)) {
        uniqueBuyers.set(key, b);
    }
}
console.log(`Unique buyers: ${uniqueBuyers.size} (after dedup by name+state)\n`);

async function validateBuyer(buyer: Buyer): Promise<ValidationResult> {
    const prompt = `You are validating whether a grain facility is a real, active grain buyer.

FACILITY:
- Name: ${buyer.name}
- Type: ${buyer.type}
- Location: ${buyer.city}, ${buyer.state}
- Website: ${buyer.website || 'none'}
- Listed crop: ${buyer.cropType || 'Yellow Corn'}

QUESTION: Does this facility actively buy grain (corn, soybeans, wheat, sunflowers) directly from farmers or grain dealers?

Based on your knowledge, answer with a JSON object (no markdown, just raw JSON):
{
  "status": "confirmed_buyer" | "likely_buyer" | "not_a_buyer" | "closed" | "unknown",
  "confidence": <0-100>,
  "reasoning": "<1-2 sentences explaining why>",
  "buysGrain": <true/false>,
  "acceptsCorn": <true/false>,
  "acceptsSoybeans": <true/false>,
  "acceptsWheat": <true/false>,
  "acceptsSunflowers": <true/false>,
  "hasPublicBids": <true/false>,
  "bidPageUrl": "<URL where they post bids, or null>"
}

RULES:
- Ethanol plants almost always buy corn — mark as "confirmed_buyer" if the plant name is real
- Feed mills buy grain — "confirmed_buyer" or "likely_buyer"
- Feedlots may buy corn directly or through brokers — "likely_buyer" unless clearly just livestock
- Export terminals at ports are "confirmed_buyer"
- If you're unsure, use "unknown" with lower confidence
- Companies like Cargill, ADM, Bunge, CHS, POET are always "confirmed_buyer"
- If the facility name sounds made up or doesn't match a real company, use "unknown"`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract JSON from response (may be wrapped in ```json blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            buyerId: buyer.id,
            buyerName: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            status: parsed.status || 'unknown',
            confidence: parsed.confidence || 50,
            reasoning: parsed.reasoning || 'No reasoning provided',
            buysGrain: parsed.buysGrain ?? false,
            acceptsCorn: parsed.acceptsCorn ?? false,
            acceptsSoybeans: parsed.acceptsSoybeans ?? false,
            acceptsWheat: parsed.acceptsWheat ?? false,
            acceptsSunflowers: parsed.acceptsSunflowers ?? false,
            hasPublicBids: parsed.hasPublicBids ?? false,
            bidPageUrl: parsed.bidPageUrl || null,
            validatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error(`  ✗ Failed: ${buyer.name} — ${error instanceof Error ? error.message : String(error)}`);
        return {
            buyerId: buyer.id,
            buyerName: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            status: 'unknown',
            confidence: 0,
            reasoning: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
            buysGrain: false,
            acceptsCorn: false,
            acceptsSoybeans: false,
            acceptsWheat: false,
            acceptsSunflowers: false,
            hasPublicBids: false,
            bidPageUrl: null,
            validatedAt: new Date().toISOString(),
        };
    }
}

async function main() {
    const results: ValidationResult[] = [];
    const buyerList = Array.from(uniqueBuyers.values());
    
    // Process in batches of 5 (Gemini rate limits)
    const BATCH = 5;
    for (let i = 0; i < buyerList.length; i += BATCH) {
        const batch = buyerList.slice(i, i + BATCH);
        const batchNum = Math.floor(i / BATCH) + 1;
        const totalBatches = Math.ceil(buyerList.length / BATCH);
        
        console.log(`Batch ${batchNum}/${totalBatches} — validating: ${batch.map(b => b.name).join(', ')}`);
        
        const batchResults = await Promise.all(batch.map(validateBuyer));
        results.push(...batchResults);
        
        // Print results
        for (const r of batchResults) {
            const icon = r.status === 'confirmed_buyer' ? '✅' 
                : r.status === 'likely_buyer' ? '🟡'
                : r.status === 'not_a_buyer' ? '❌'
                : r.status === 'closed' ? '🚫'
                : '❓';
            console.log(`  ${icon} ${r.buyerName} (${r.city}, ${r.state}) → ${r.status} [${r.confidence}%]`);
            if (r.status === 'not_a_buyer' || r.status === 'closed') {
                console.log(`     Reason: ${r.reasoning}`);
            }
        }
        
        // Rate limit (15 RPM for gemini-2.0-flash)
        if (i + BATCH < buyerList.length) {
            await new Promise(r => setTimeout(r, 4000));
        }
    }
    
    // Summary
    const confirmed = results.filter(r => r.status === 'confirmed_buyer').length;
    const likely = results.filter(r => r.status === 'likely_buyer').length;
    const notBuyer = results.filter(r => r.status === 'not_a_buyer').length;
    const closed = results.filter(r => r.status === 'closed').length;
    const unknown = results.filter(r => r.status === 'unknown').length;
    const withBidPage = results.filter(r => r.bidPageUrl).length;
    
    console.log('\n══════════════════════════════════════════');
    console.log('  VALIDATION SUMMARY');
    console.log('══════════════════════════════════════════');
    console.log(`  ✅ Confirmed buyers:  ${confirmed}`);
    console.log(`  🟡 Likely buyers:     ${likely}`);
    console.log(`  ❌ Not a buyer:       ${notBuyer}`);
    console.log(`  🚫 Closed:           ${closed}`);
    console.log(`  ❓ Unknown:          ${unknown}`);
    console.log(`  📊 With bid page URL: ${withBidPage}`);
    console.log('══════════════════════════════════════════\n');
    
    // List non-buyers
    if (notBuyer + closed > 0) {
        console.log('  FACILITIES TO REMOVE:');
        for (const r of results.filter(r => r.status === 'not_a_buyer' || r.status === 'closed')) {
            console.log(`    ${r.buyerName} (${r.city}, ${r.state}) — ${r.reasoning}`);
        }
    }
    
    // List facilities with bid pages (for scraping)
    if (withBidPage > 0) {
        console.log('\n  FACILITIES WITH BID PAGES (can scrape):');
        for (const r of results.filter(r => r.bidPageUrl)) {
            console.log(`    ${r.buyerName} → ${r.bidPageUrl}`);
        }
    }
    
    // Save results
    const outPath = path.resolve(__dirname, 'buyer_validations.json');
    fs.writeFileSync(outPath, JSON.stringify({
        validatedAt: new Date().toISOString(),
        totalBuyers: results.length,
        summary: { confirmed, likely, notBuyer, closed, unknown, withBidPage },
        results: results.sort((a, b) => {
            const order = { confirmed_buyer: 0, likely_buyer: 1, unknown: 2, not_a_buyer: 3, closed: 4 };
            return (order[a.status] ?? 5) - (order[b.status] ?? 5);
        }),
    }, null, 2));
    console.log(`\n  ✓ Saved to ${outPath}`);
}

main().catch(console.error);
