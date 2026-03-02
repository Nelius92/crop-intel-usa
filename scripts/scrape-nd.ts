import FirecrawlApp from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

async function main() {
    // CHS Northern Grain - corn bids (serves MN/ND)
    console.log('\\n=== CHS Northern Grain ===');
    try {
        const chs = await fc.scrape('https://chsnortherngrain.com/grain-bids/', {
            formats: ['markdown'],
            waitFor: 8000,
        } as any) as any;
        console.log((chs.markdown || '').slice(0, 5000));
    } catch (e: any) { console.log('CHS failed:', e.message); }

    // Plains Grain ND
    console.log('\\n=== Plains Grain (Marion ND) ===');
    try {
        const pg = await fc.scrape('https://plainsgrain.com/cash-bids/', {
            formats: ['markdown'],
            waitFor: 8000,
        } as any) as any;
        console.log((pg.markdown || '').slice(0, 5000));
    } catch (e: any) { console.log('Plains failed:', e.message); }
}
main();
