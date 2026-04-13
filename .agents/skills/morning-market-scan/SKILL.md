---
name: morning-market-scan
description: Daily morning market scan — check USDA prices, find best buyers, and generate action plan for the day
---

# Morning Market Scan

> Run this every morning before the grain desk opens. It checks live USDA data, identifies the best price opportunities across all crops, and generates a ready-to-use action plan.

## When to Use
- Every morning at market open (~7 AM CT)
- When a farmer calls asking about current prices
- When you need to compare which crop is most profitable today
- Before making any outreach calls to buyers

## Pre-requisites
- API must be live at `https://crop-intel-api-production.up.railway.app`
- USDA API key must be configured on Railway (`USDA_API_KEY`)
- Gemini API key must be configured on Railway (`GEMINI_API_KEY`)

## Steps

### 1. Check API Health
```bash
curl -s --max-time 10 "https://crop-intel-api-production.up.railway.app/health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'API: {d.get(\"status\")} | Uptime: {int(d.get(\"uptime\",0))}s')"
```

### 2. Pull USDA Grain Data for ALL Crops
Run each crop check individually:

**Corn (ND)**:
```bash
curl -s --max-time 20 "https://crop-intel-api-production.up.railway.app/api/usda/grain-report?commodity=Corn&state=ND" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('data',{}).get('summary',{})
print(f'CORN | Source: {d.get(\"source\")} | Avg: \${s.get(\"avgPrice\",0):.2f}/bu | Basis: {s.get(\"avgBasis\",0):.0f}¢ | Bids: {s.get(\"bidCount\",0)} | Date: {s.get(\"reportDate\",\"?\")}')
"
```

**Soybeans (ND)**:
```bash
curl -s --max-time 20 "https://crop-intel-api-production.up.railway.app/api/usda/grain-report?commodity=Soybeans&state=ND" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('data',{}).get('summary',{})
print(f'SOYBEANS | Source: {d.get(\"source\")} | Avg: \${s.get(\"avgPrice\",0):.2f}/bu | Basis: {s.get(\"avgBasis\",0):.0f}¢ | Bids: {s.get(\"bidCount\",0)}')
"
```

**Wheat (ND)**:
```bash
curl -s --max-time 20 "https://crop-intel-api-production.up.railway.app/api/usda/grain-report?commodity=Wheat&state=ND" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('data',{}).get('summary',{})
print(f'WHEAT | Source: {d.get(\"source\")} | Avg: \${s.get(\"avgPrice\",0):.2f}/bu | Basis: {s.get(\"avgBasis\",0):.0f}¢ | Bids: {s.get(\"bidCount\",0)}')
"
```

**Sunflowers**:
```bash
curl -s --max-time 20 "https://crop-intel-api-production.up.railway.app/api/usda/sunflower-report" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'SUNFLOWERS | Source: {d.get(\"source\")} | Degraded: {d.get(\"degraded\")}')
"
```

### 3. Check Best Opportunities Per Crop
For each crop, pull the buyer network and sort by net price:

```bash
curl -s --max-time 15 "https://crop-intel-api-production.up.railway.app/api/buyers?scope=all&crop=Yellow%20Corn" | python3 -c "
import json,sys
d=json.load(sys.stdin)
buyers=d.get('data',[])
# Sort by cash price descending
with_price = [b for b in buyers if b.get('cashBid') or b.get('postedBasis')]
print(f'=== YELLOW CORN: {len(buyers)} buyers ===')
for b in buyers[:5]:
    phone = b.get('facilityPhone','No Phone')
    rc = b.get('railConfidence',0) or 0
    rail = 'BNSF' if rc >= 70 else 'Likely' if rc >= 40 else 'Truck'
    print(f'  {b[\"name\"]} ({b[\"state\"]}) | Phone: {phone} | Rail: {rail}')
"
```

Repeat for `Soybeans`, `Wheat`, `Sunflowers`.

### 4. Generate AI Insights for Top Buyers
For each promising buyer (score > 60), get Gemini explanation:

```bash
curl -s --max-time 30 -X POST "https://crop-intel-api-production.up.railway.app/api/ai/buyer-intel" \
  -H "Content-Type: application/json" \
  -d '{
    "crop":"Yellow Corn",
    "buyerData":{
      "name":"BUYER_NAME",
      "type":"BUYER_TYPE",
      "city":"BUYER_CITY",
      "state":"BUYER_STATE",
      "netPrice":NET_PRICE,
      "benchmarkPrice":BENCHMARK,
      "railConfidence":RAIL_CONFIDENCE,
      "hasPhone":true,
      "freightCost":FREIGHT
    },
    "withExplanation":true
  }'
```

### 5. Generate Morning Summary
Compile findings into a clear morning briefing:
- Which crop has the best net price vs local benchmark today?
- Top 3 buyers to call for each active crop
- Any unusual market movements (basis changes > 5¢)
- Rail freight updates

### 6. Live Verification
Open the app at https://crop-intel-usa.vercel.app/ and verify:
- [ ] Benchmark price matches USDA data
- [ ] Live Market Quotes show correct basis/cash
- [ ] Buyer network count matches API response
- [ ] Crop switching works (Corn → Soybeans → Wheat → Sunflowers)
- [ ] AI intel scores are populating

## Output Format
Present findings as a table:

| Crop | Avg Price | Best Buyer | Net Price | vs Local | Action |
|------|-----------|------------|-----------|----------|--------|
| Corn | $X.XX | BuyerName (ST) | $X.XX | +$0.XX | CALL |
| Soy  | $X.XX | BuyerName (ST) | $X.XX | +$0.XX | CALL |

## Farm Context
- **Origin**: Campbell, MN (Zip 56522)
- **Rail Access**: BNSF mainline
- **Local Benchmark**: Hankinson Renewable Energy (corn), ADM Enderlin (sunflowers)
- **Freight**: $0.30/bu truck to Hankinson, BNSF Tariff 4022 for rail
