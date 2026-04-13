---
description: How to use Firecrawl for web scraping with browser rendering, actions, and structured extraction
---

# Firecrawl Scraping Guide — Crop Intel App

> Current approach: **Bushel-powered portals only** (Barchart blocked, Browser Sandbox TBD)

## Overview
Firecrawl is our primary web scraping service. We use the `@mendable/firecrawl-js` SDK (v4.15.0+).

**API Key:** Stored in `.env` as `FIRECRAWL_API_KEY`

## Key Features We Use

### 1. Browser Actions (for JS-rendered pages)
Use `actions` to interact with pages before scraping — essential for Bushel-powered portals.

```typescript
const result = await firecrawl.scrape(url, {
    formats: ['markdown'],
    actions: [
        { type: 'wait', milliseconds: 5000 },    // Wait for JS to render
        { type: 'scroll', direction: 'down', amount: 5 }, // Scroll to load lazy content
        { type: 'wait', milliseconds: 2000 },    // Wait for scroll-triggered loads
    ],
    timeout: 30000,
} as any);
```

**Action types:** `wait`, `click`, `scroll`, `write`, `press`, `screenshot`, `scrape`

### 2. JSON Extraction with Schema
Extract structured data using a JSON schema — lets Firecrawl's LLM parse the page into your desired format.

```typescript
const result = await firecrawl.scrape(url, {
    formats: [
        'markdown',
        { type: 'json', schema: {
            type: 'object',
            properties: {
                bids: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            location: { type: 'string' },
                            cashBid: { type: 'number' },
                            basis: { type: 'number' },
                        },
                        required: ['location', 'cashBid'],
                    },
                },
            },
            required: ['bids'],
        }}
    ],
    timeout: 120000,
} as any);

// Access structured data
const bids = result.json?.bids;
```

### 3. Prompt-based Extraction (no schema)
For simpler cases, use a prompt instead of a schema:

```typescript
const result = await firecrawl.scrape(url, {
    formats: [{ type: 'json', prompt: 'Extract all corn cash bid prices with facility names' }],
});
```

## Data Sources

### Bushel-Powered Portals ✅ (recommended)
These work reliably with Firecrawl Actions + markdown parsing.

| Portal | URL | States |
|--------|-----|--------|
| Scoular | `portal.bushelpowered.com/scoular/cash-bids` | KS, NE, CO |
| CHS Farmers Alliance | `portal.bushelpowered.com/chsfarmersalliance/cash-bids` | MN, ND, SD, MT |
| Gavilon | `portal.bushelpowered.com/gavilon/cash-bids` | NE, IA, KS, TX |
| Premier Companies | `portal.bushelpowered.com/premierag/cash-bids` | TX, KS, OK |
| AGP | `portal.bushelpowered.com/agp/cash-bids` | NE, IA, MO, MN |

### Barchart ❌ (blocked — future work)
`barchart.com/futures/quotes/ZC*0/cash-prices` has anti-bot detection. Tried:
- `firecrawl.scrape()` with Actions — returns empty page
- Browser Sandbox (`firecrawl.browser()`) — hangs, likely needs higher plan

### USDA AMS API ❌ (requires auth)
`marsapi.ams.usda.gov/services/v1.1/reports/` returns 403 — needs API key registration.

## Running the Scraper

```bash
npx tsx scripts/scrape-live-bids.ts
```

Output: `/tmp/live-bids.json`

## Browser Sandbox (for future Barchart work)

Firecrawl Browser Sandbox gives a full remote Playwright session:
```typescript
const session = await firecrawl.browser({ ttl: 60 });
const result = await firecrawl.browserExecute(session.id, {
  code: 'await page.goto("https://..."); ...',
  language: 'node',
});
await firecrawl.deleteBrowser(session.id);
```
Docs: https://docs.firecrawl.dev/features/browser

## Tips
- **Rate limit:** 1s between portal requests
- **Timeout:** 30s for Actions scrapes
- **Caching:** Results saved to `/tmp/live-bids.json`
