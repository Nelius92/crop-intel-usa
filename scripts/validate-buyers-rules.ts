/**
 * Buyer Validation Script — Rule-Based (no API calls)
 * 
 * Uses industry pattern matching to validate buyers.
 * Known grain companies, ethanol plants, and facility types
 * are classified without needing Gemini.
 * 
 * Usage: npx tsx scripts/validate-buyers-rules.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Known grain companies (buy directly from farmers) ──
const CONFIRMED_GRAIN_COMPANIES = [
    // Major grain traders
    'cargill', 'adm', 'archer daniels', 'bunge', 'dreyfus', 'cofco',
    'viterra', 'gavilon', 'scoular', 'columbia grain', 'bartlett',
    // Major cooperatives  
    'chs ', 'chs-', 'landus', 'ag processing', 'agp ',
    'farmers union', 'harvest land', 'centra sota', 'dakota growers',
    'minn-dak', 'crystal sugar', 'american crystal',
    // Ethanol majors (always buy corn)
    'poet ', 'poet-', 'green plains', 'valero', 'aventine',
    'guardian', 'red trail', 'tharaldson', 'blue flint', 'dakota spirit',
    'bushmills', 'granite falls', 'highwater', 'al-corn', 'southwest georgia',
    'heron lake', 'southwest iowa',
    // Elevator chains
    'arthur companies', 'sb&b', 'farmer\'s elevator', 'farmers elevator',
    'grain terminal', 'wheat growers',
    // Feed / processing
    'purina', 'cargill animal', 'tyson', 'jbs', 'smithfield',
    'foster farms', 'pilgrim',
    // Export terminals
    'export', 'terminal',
];

// ── Known NON-grain-buyer patterns ──
const NOT_A_BUYER_PATTERNS = [
    'producers dairy',     // Dairy processor, not grain buyer
    'high plains farm credit', // FSA lending, not grain
    'farm credit',         // Financial institution
    'insurance',          // Crop insurance
    'equipment',          // Farm equipment dealer
    'veterinary',         // Vet services
    'trucking',           // Just hauling
    'bank',              // Financial
    'credit union',       // Financial
    'seed company',       // Sells seed, doesn't buy grain
    'fertilizer',         // Input supplier
];

// ── Types that almost always buy grain ──
const GRAIN_BUYER_TYPES = ['ethanol', 'elevator', 'export', 'shuttle', 'river', 'processor'];

// ── Types that need verification ──
const NEEDS_VERIFICATION_TYPES = ['feedlot', 'transload'];

interface Buyer {
    id: string;
    name: string;
    type: string;
    city: string;
    state: string;
    website?: string;
    contactPhone?: string;
    cropType?: string;
    verified?: boolean;
}

interface ValidationResult {
    buyerId: string;
    name: string;
    city: string;
    state: string;
    type: string;
    cropType: string;
    status: 'confirmed_buyer' | 'likely_buyer' | 'needs_verification' | 'suspect';
    confidence: number;
    reasoning: string;
    hasPhone: boolean;
    hasWebsite: boolean;
}

// Load buyers
const buyersPath = path.resolve(__dirname, '../src/data/buyers.json');
const buyers: Buyer[] = JSON.parse(fs.readFileSync(buyersPath, 'utf-8'));

function validateBuyer(buyer: Buyer): ValidationResult {
    const nameLower = buyer.name.toLowerCase();
    const typeLower = (buyer.type || '').toLowerCase();
    
    // Rule 1: Known grain company name match → confirmed
    const knownMatch = CONFIRMED_GRAIN_COMPANIES.find(c => nameLower.includes(c));
    if (knownMatch) {
        return {
            buyerId: buyer.id,
            name: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            cropType: buyer.cropType || 'Yellow Corn',
            status: 'confirmed_buyer',
            confidence: 90,
            reasoning: `Name matches known grain company pattern: "${knownMatch}"`,
            hasPhone: !!buyer.contactPhone,
            hasWebsite: !!buyer.website,
        };
    }
    
    // Rule 2: Known non-buyer pattern → suspect
    const riskMatch = NOT_A_BUYER_PATTERNS.find(p => nameLower.includes(p));
    if (riskMatch) {
        return {
            buyerId: buyer.id,
            name: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            cropType: buyer.cropType || 'Yellow Corn',
            status: 'suspect',
            confidence: 30,
            reasoning: `Name matches non-buyer pattern: "${riskMatch}" — likely not a grain buyer`,
            hasPhone: !!buyer.contactPhone,
            hasWebsite: !!buyer.website,
        };
    }
    
    // Rule 3: Type-based classification
    if (GRAIN_BUYER_TYPES.includes(typeLower)) {
        // Ethanol plants with "ethanol" or "energy" in name → confirmed
        if (typeLower === 'ethanol' && (nameLower.includes('ethanol') || nameLower.includes('energy') || nameLower.includes('biofuel'))) {
            return {
                buyerId: buyer.id,
                name: buyer.name,
                city: buyer.city,
                state: buyer.state,
                type: buyer.type,
                cropType: buyer.cropType || 'Yellow Corn',
                status: 'confirmed_buyer',
                confidence: 85,
                reasoning: 'Ethanol plant — buys corn as primary feedstock',
                hasPhone: !!buyer.contactPhone,
                hasWebsite: !!buyer.website,
            };
        }
        
        // Elevators, export, shuttle → likely buyer
        return {
            buyerId: buyer.id,
            name: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            cropType: buyer.cropType || 'Yellow Corn',
            status: 'likely_buyer',
            confidence: 70,
            reasoning: `Type "${buyer.type}" typically buys grain — needs phone verification`,
            hasPhone: !!buyer.contactPhone,
            hasWebsite: !!buyer.website,
        };
    }
    
    // Rule 4: Feedlots and transloads need verification
    if (NEEDS_VERIFICATION_TYPES.includes(typeLower)) {
        // CA/TX feedlots are more likely to buy corn direct
        if (typeLower === 'feedlot' && ['CA', 'TX', 'CO', 'KS', 'NE'].includes(buyer.state)) {
            return {
                buyerId: buyer.id,
                name: buyer.name,
                city: buyer.city,
                state: buyer.state,
                type: buyer.type,
                cropType: buyer.cropType || 'Yellow Corn',
                status: 'likely_buyer',
                confidence: 65,
                reasoning: `Feedlot in ${buyer.state} — likely buys corn, but may use broker`,
                hasPhone: !!buyer.contactPhone,
                hasWebsite: !!buyer.website,
            };
        }
        
        return {
            buyerId: buyer.id,
            name: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            cropType: buyer.cropType || 'Yellow Corn',
            status: 'needs_verification',
            confidence: 50,
            reasoning: `Type "${buyer.type}" — may or may not buy grain directly. Call to verify.`,
            hasPhone: !!buyer.contactPhone,
            hasWebsite: !!buyer.website,
        };
    }
    
    // Rule 5: Processor — usually buys but depends on what they process
    if (typeLower === 'processor') {
        // Flour mills, oil mills, feed mills buy grain
        if (nameLower.includes('mill') || nameLower.includes('flour') || nameLower.includes('oil') || 
            nameLower.includes('feed') || nameLower.includes('pasta') || nameLower.includes('starch') ||
            nameLower.includes('malt') || nameLower.includes('sweetener') || nameLower.includes('ingredient')) {
            return {
                buyerId: buyer.id,
                name: buyer.name,
                city: buyer.city,
                state: buyer.state,
                type: buyer.type,
                cropType: buyer.cropType || 'Yellow Corn',
                status: 'confirmed_buyer',
                confidence: 80,
                reasoning: 'Processor with grain-processing keywords — buys raw grain',
                hasPhone: !!buyer.contactPhone,
                hasWebsite: !!buyer.website,
            };
        }
        
        return {
            buyerId: buyer.id,
            name: buyer.name,
            city: buyer.city,
            state: buyer.state,
            type: buyer.type,
            cropType: buyer.cropType || 'Yellow Corn',
            status: 'needs_verification',
            confidence: 55,
            reasoning: 'Processor — may buy grain but could be downstream manufacturer. Verify.',
            hasPhone: !!buyer.contactPhone,
            hasWebsite: !!buyer.website,
        };
    }
    
    // Rule 6: Default — needs verification
    return {
        buyerId: buyer.id,
        name: buyer.name,
        city: buyer.city,
        state: buyer.state,
        type: buyer.type,
        cropType: buyer.cropType || 'Yellow Corn',
        status: 'needs_verification',
        confidence: 40,
        reasoning: 'Unknown facility type — needs manual verification',
        hasPhone: !!buyer.contactPhone,
        hasWebsite: !!buyer.website,
    };
}

// Run validation
const results = buyers.map(validateBuyer);

// Summary
const confirmed = results.filter(r => r.status === 'confirmed_buyer');
const likely = results.filter(r => r.status === 'likely_buyer');
const needsVerify = results.filter(r => r.status === 'needs_verification');
const suspect = results.filter(r => r.status === 'suspect');

console.log('\n══════════════════════════════════════════════');
console.log('  BUYER VALIDATION — Rule-Based Analysis');
console.log('══════════════════════════════════════════════\n');
console.log(`  ✅ Confirmed grain buyers:  ${confirmed.length}`);
console.log(`  🟡 Likely grain buyers:     ${likely.length}`);
console.log(`  ❓ Needs verification:      ${needsVerify.length}`);
console.log(`  ❌ Suspect (not a buyer):   ${suspect.length}`);
console.log(`  ──────────────────────────────────────`);
console.log(`  📊 Total:                   ${results.length}\n`);

// Show suspects
if (suspect.length > 0) {
    console.log('  ❌ SUSPECTS (should be removed/hidden):\n');
    for (const r of suspect) {
        console.log(`    ${r.name} (${r.city}, ${r.state}) — ${r.reasoning}`);
    }
}

// Show needs-verification
if (needsVerify.length > 0) {
    console.log('\n  ❓ NEEDS PHONE VERIFICATION:\n');
    for (const r of needsVerify) {
        const phone = r.hasPhone ? '📞 has phone' : '⚠ NO phone';
        console.log(`    ${r.name} (${r.city}, ${r.state}) — ${r.type} — ${phone}`);
    }
}

// Show confirmed without phone (need to find their number)
const confirmedNoPhone = confirmed.filter(r => !r.hasPhone);
if (confirmedNoPhone.length > 0) {
    console.log(`\n  ✅ CONFIRMED but NO PHONE (${confirmedNoPhone.length} — need to find):\n`);
    for (const r of confirmedNoPhone) {
        console.log(`    ${r.name} (${r.city}, ${r.state})`);
    }
}

// Save results
const outPath = path.resolve(__dirname, 'buyer_validations.json');
fs.writeFileSync(outPath, JSON.stringify({
    validatedAt: new Date().toISOString(),
    totalBuyers: results.length,
    summary: {
        confirmed: confirmed.length,
        likely: likely.length,
        needsVerification: needsVerify.length,
        suspect: suspect.length,
    },
    results: results.sort((a, b) => {
        const order = { confirmed_buyer: 0, likely_buyer: 1, needs_verification: 2, suspect: 3 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    }),
}, null, 2));
console.log(`\n  ✓ Full results → ${outPath}`);
console.log('');
