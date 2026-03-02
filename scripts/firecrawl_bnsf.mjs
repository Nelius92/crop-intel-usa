import fs from 'fs';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
    console.error("ERROR: FIRECRAWL_API_KEY is not set in your .env file.");
    process.exit(1);
}

const scrapeBnsfTransloaders = async () => {
    console.log("Using Firecrawl API to scrape BNSF Premier Transload Network details...");
    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
                url: 'https://www.bnsf.com/ship-with-bnsf/transloading/',
                formats: ['markdown'],
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Firecrawl API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log("Scrape successful. First 500 chars of markdown:");
        console.log(data.data.markdown.substring(0, 500));

        fs.writeFileSync('./tmp_firecrawl_bnsf.md', data.data.markdown);
        console.log("Saved raw markdown to ./tmp_firecrawl_bnsf.md");

    } catch (e) {
        console.error(e);
    }
};

scrapeBnsfTransloaders();
