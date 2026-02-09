---
description: Update grain prices from USDA AMS daily reports
---

# Update Prices Workflow

Run every morning at **6:00 AM Central Time** (Minnesota timezone) to update grain futures and regional basis prices.

## Quick Update (Manual)

// turbo
1. Run the morning price update script:
```bash
cd /Users/cornelius/Documents/Corn\ Intel && npx ts-node scripts/update-morning-prices.ts
```

## Automated Daily Updates (Cron Job)

To run automatically at 6am CT daily:

```bash
crontab -e
# Add: 0 6 * * * TZ=America/Chicago cd /Users/cornelius/Documents/Corn\ Intel && npx ts-node scripts/update-morning-prices.ts >> logs/price-update.log 2>&1
```

## Data Sources
- **Futures**: CME ZCH6 (March 2026 corn)
- **Basis**: USDA MARS API (marsapi.ams.usda.gov)
- **Freight**: BNSF rail calculations

## Manual Override

If APIs fail, update `FALLBACK_FUTURES_PRICE` in `src/services/marketDataService.ts`.

Get current prices:
- https://www.cmegroup.com/markets/agriculture/grains/corn.html
- https://www.barchart.com/futures/quotes/ZCH26

## Price Formula
```
Cash = Futures + Regional Basis
Net  = Cash - Freight
```
