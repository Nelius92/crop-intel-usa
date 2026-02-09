---
description: Full app testing workflow - verify all features work correctly
---

# Test App Workflow

Complete testing checklist for CornIntel app before production use.

## Prerequisites
```bash
cd /Users/cornelius/Documents/Corn\ Intel
npm run dev
```
Wait for "Local: http://localhost:5173/" message.

## Test Checklist

### 1. App Launch
- [ ] App loads without console errors
- [ ] Map displays correctly
- [ ] No blank screens

### 2. Heatmap Page
- [ ] Heatmap data loads (colored markers visible)
- [ ] Price legend displays
- [ ] Rail lines visible (orange BNSF lines)
- [ ] Transload markers visible
- [ ] Click on heatmap point opens drawer

### 3. Buyers Page
- [ ] Navigate to Buyers tab
- [ ] Buyer list loads
- [ ] Prices display in table
- [ ] Sort by basis works

### 4. Buyer Detail Drawer
For first 5 buyers, verify:
- [ ] Click opens drawer
- [ ] Name displays correctly
- [ ] Basis and Cash Bid show
- [ ] Website button enabled (if website exists)
- [ ] Call button shows phone number
- [ ] Close button works

### 5. Website Links (Critical)
// turbo
Test each website opens correctly:

1. Click buyer with website
2. Click "Website" button
3. Verify new tab opens to correct URL
4. Verify page loads (not 404)

### 6. Price Accuracy
Check prices are reasonable:
- California buyers: ~$5.50 - $6.50
- Midwest buyers: ~$4.00 - $4.80
- Texas buyers: ~$4.80 - $5.50

### 7. Freight Calculator
- [ ] Enter sample origin
- [ ] Select destination
- [ ] Calculate shows rate
- [ ] Net price updates

## Reporting Results

Create a summary of any issues found:

```markdown
## Test Results - [DATE]

### Passed
- [List passing features]

### Failed
- [Feature]: [Description of issue]

### Needs Fix
- [Priority items for next sprint]
```

## Quick Smoke Test
// turbo-all
```bash
# Build check
npm run build

# Type check
npx tsc --noEmit
```
