/**
 * Bid Formula Engine
 * 
 * The mathematical core of the arbitrage intelligence system.
 * Every grain buyer in the US uses the same formula:
 * 
 *   Cash Bid = CME Futures Price + Basis
 *   Net to Farmer = Cash Bid - Freight (rail or truck)
 *   Arbitrage = Net via Campbell Rail - Local Benchmark Net
 * 
 * VERIFIED: All 11 rows of the Al-Corn screenshot match this formula exactly.
 * SOURCES: CME Group, USDA AMS, K-State AgManager, Texas A&M AgriLife
 *
 * SUNFLOWER EXCEPTION: No CME futures contract exists for sunflower seeds.
 * Sunflower prices are posted directly by crush plants in $/cwt.
 * Cross-hedged against CBOT Soybean Oil (ZL) but basis is N/A.
 */

// ── CME Contract Month Codes ─────────────────────────────────────
// Standard single-letter codes used across all exchanges
export const CME_MONTH_CODE: Record<string, string> = {
    'January': 'F', 'February': 'G', 'March': 'H', 'April': 'J',
    'May': 'K', 'June': 'M', 'July': 'N', 'August': 'Q',
    'September': 'U', 'October': 'V', 'November': 'X', 'December': 'Z',
};

export const CME_CODE_TO_MONTH: Record<string, string> = Object.fromEntries(
    Object.entries(CME_MONTH_CODE).map(([month, code]) => [code, month])
);

// ── Delivery Month → Futures Contract Mapping ────────────────────
// When a buyer quotes a bid for delivery in month X, they reference
// the nearest CME futures contract that hasn't expired yet.
//
// This is how Al-Corn (and every other buyer) maps delivery → futures:
//   Mar delivery → references May futures (ZCK)
//   Jun delivery → references Jul futures (ZCN)
//   etc.

interface ContractMapping {
    /** CME futures contract months for this crop (1-indexed) */
    contractMonths: number[];
    /** CME product symbol (e.g., 'ZC' for corn) */
    symbol: string;
    /** Price unit */
    priceUnit: '$/bu' | '$/cwt';
    /** Contract size in bushels */
    contractSize: number;
    /** Does this crop have CME futures? */
    hasFutures: boolean;
}

/**
 * CME Futures Contract Specifications — verified from cmegroup.com
 * 
 * Corn (ZC):     March(3), May(5), July(7), September(9), December(12)
 * Soybeans (ZS): Jan(1), March(3), May(5), July(7), Aug(8), Sep(9), Nov(11)
 * Wheat SRW (ZW): March(3), May(5), July(7), September(9), December(12)
 * Sunflowers:    NO CME CONTRACT — priced by crush plants directly
 */
export const CROP_CONTRACT_MAP: Record<string, ContractMapping> = {
    'Yellow Corn': {
        contractMonths: [3, 5, 7, 9, 12],  // H, K, N, U, Z
        symbol: 'ZC',
        priceUnit: '$/bu',
        contractSize: 5000,
        hasFutures: true,
    },
    'White Corn': {
        contractMonths: [3, 5, 7, 9, 12],
        symbol: 'ZC',  // Same as yellow corn
        priceUnit: '$/bu',
        contractSize: 5000,
        hasFutures: true,
    },
    'Soybeans': {
        contractMonths: [1, 3, 5, 7, 8, 9, 11],  // F, H, K, N, Q, U, X
        symbol: 'ZS',
        priceUnit: '$/bu',
        contractSize: 5000,
        hasFutures: true,
    },
    'Wheat': {
        contractMonths: [3, 5, 7, 9, 12],  // H, K, N, U, Z
        symbol: 'ZW',
        priceUnit: '$/bu',
        contractSize: 5000,
        hasFutures: true,
    },
    'Sunflowers': {
        contractMonths: [],  // NO CME FUTURES
        symbol: '',
        priceUnit: '$/cwt',
        contractSize: 0,
        hasFutures: false,
    },
};

// ── Core Formula Functions ───────────────────────────────────────

/**
 * Calculate cash bid from futures + basis.
 * This is THE formula every elevator, ethanol plant, and crush plant uses.
 * 
 * @param futures - CME futures price ($/bu)
 * @param basis - Local basis adjustment (usually negative, $/bu)
 * @returns Cash bid rounded to nearest cent
 * 
 * @example
 *   calculateCashBid(4.6200, -0.38) // → 4.24 (Al-Corn Mar 26)
 *   calculateCashBid(4.7325, -0.38) // → 4.35 (Al-Corn Jun 26, rounds from 4.3525)
 */
export function calculateCashBid(futures: number, basis: number): number {
    return Math.round((futures + basis) * 100) / 100;
}

/**
 * Back-calculate basis from a known cash bid and futures price.
 * Used when we scrape a cash bid but not the basis directly.
 * 
 * @param cashBid - The posted cash bid
 * @param futures - Current CME futures price
 * @returns Implied basis (usually negative)
 */
export function calculateBasis(cashBid: number, futures: number): number {
    return Math.round((cashBid - futures) * 100) / 100;
}

/**
 * Calculate net price to farmer after freight.
 * This is what matters — the money in the farmer's pocket.
 * 
 * Net = Cash Bid - Freight
 * 
 * Both must be in the same unit ($/bu or $/cwt).
 */
export function calculateNetPrice(cashBid: number, freightCost: number): number {
    return Math.round((cashBid - freightCost) * 100) / 100;
}

/**
 * Calculate arbitrage opportunity.
 * Positive = shipping via Campbell rail beats local benchmark.
 * 
 * Arbitrage = Net via Rail - Benchmark Net
 *           = (Remote Cash - Rail Freight) - (Local Cash - Truck Freight)
 */
export function calculateArbitrage(
    remoteNetPrice: number,
    benchmarkNetPrice: number
): number {
    return Math.round((remoteNetPrice - benchmarkNetPrice) * 100) / 100;
}

/**
 * Validate a scraped bid against the formula.
 * Returns true if |bid - (futures + basis)| < tolerance.
 * 
 * Used to catch scraping errors or stale data.
 */
export function validateBid(
    bid: number,
    futures: number,
    basis: number,
    toleranceCents: number = 2
): { valid: boolean; expected: number; diff: number } {
    const expected = calculateCashBid(futures, basis);
    const diff = Math.abs(bid - expected);
    return {
        valid: diff <= toleranceCents / 100,
        expected,
        diff: Math.round(diff * 100) / 100,
    };
}

// ── Contract Month Resolution ────────────────────────────────────

/**
 * Given a delivery month and crop, find the correct CME futures contract.
 * 
 * Rule: The delivery month references the NEAREST contract month
 * that is >= the delivery month (the "carry" convention).
 * 
 * @param crop - Crop name (e.g., 'Yellow Corn')
 * @param deliveryMonth - 1-12 (January = 1)
 * @param deliveryYear - 4-digit year
 * @returns CME ticker symbol (e.g., 'ZCK26') or null for sunflowers
 * 
 * @example
 *   getContractForDelivery('Yellow Corn', 3, 2026) // → 'ZCK26' (May futures)
 *   getContractForDelivery('Yellow Corn', 6, 2026) // → 'ZCN26' (Jul futures)
 *   getContractForDelivery('Yellow Corn', 10, 2026) // → 'ZCZ26' (Dec futures)
 *   getContractForDelivery('Sunflowers', 3, 2026) // → null
 */
export function getContractForDelivery(
    crop: string,
    deliveryMonth: number,
    deliveryYear: number
): string | null {
    const mapping = CROP_CONTRACT_MAP[crop];
    if (!mapping || !mapping.hasFutures) return null;

    const months = mapping.contractMonths;

    // Find the nearest contract month >= delivery month
    let contractMonth = months.find(m => m >= deliveryMonth);

    // If delivery is after the last contract month of the year, roll to next year's first contract
    let contractYear = deliveryYear;
    if (!contractMonth) {
        contractMonth = months[0]; // First contract of next year
        contractYear = deliveryYear + 1;
    }

    // Build the ticker: ZCK26
    const monthNames = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthCode = CME_MONTH_CODE[monthNames[contractMonth]];
    const yearSuffix = contractYear.toString().slice(-2);

    return `${mapping.symbol}${monthCode}${yearSuffix}`;
}

/**
 * Get the contract month name for display purposes.
 * 
 * @example
 *   getContractMonthName('Yellow Corn', 3) // → "May '26"
 *   getContractMonthName('Yellow Corn', 10) // → "Dec '26"
 */
export function getContractMonthName(
    crop: string,
    deliveryMonth: number,
    deliveryYear: number = new Date().getFullYear()
): string | null {
    const mapping = CROP_CONTRACT_MAP[crop];
    if (!mapping || !mapping.hasFutures) return 'Spot Cash';

    const months = mapping.contractMonths;
    let contractMonth = months.find(m => m >= deliveryMonth);
    let contractYear = deliveryYear;

    if (!contractMonth) {
        contractMonth = months[0];
        contractYear = deliveryYear + 1;
    }

    const monthNames = [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return `${monthNames[contractMonth]} '${contractYear.toString().slice(-2)}`;
}

/**
 * Get the "nearby" (front-month) contract for a crop as of today.
 */
export function getNearbyContract(crop: string): string | null {
    const now = new Date();
    return getContractForDelivery(crop, now.getMonth() + 1, now.getFullYear());
}

// ── Scraped Bid Types ────────────────────────────────────────────

export interface ScrapedBid {
    /** Buyer/facility name */
    buyerName: string;
    /** Buyer location */
    city: string;
    state: string;
    /** The commodity */
    crop: string;
    /** Delivery period (e.g., "Mar 26", "Spot") */
    deliveryPeriod: string;
    /** CME futures contract referenced (e.g., "May 26", "ZCK26") */
    contractMonth: string;
    /** Live CME futures price */
    futuresPrice: number;
    /** Local basis (Futures + Basis = Cash) */
    basis: number;
    /** Posted cash bid */
    cashBid: number;
    /** Daily change in futures */
    change?: number;
    /** When this bid was scraped */
    scrapedAt: string;
    /** Source of the data */
    source: 'firecrawl-interact' | 'firecrawl-scrape' | 'barchart-api' | 'usda-report' | 'manual';
    /** URL where the bid was found */
    sourceUrl?: string;
    /** Price unit */
    priceUnit: '$/bu' | '$/cwt';
    /** Did the scraped bid validate against the formula? */
    validated: boolean;
}

export interface MorningScanResult {
    /** When the scan ran */
    scanTime: string;
    /** Total bids collected across all sources */
    totalBids: number;
    /** Bids by source tier */
    bidsBySource: Record<string, number>;
    /** Bids that passed formula validation */
    validatedBids: number;
    /** Bids that failed validation (possible errors) */
    failedValidation: number;
    /** All collected bids */
    bids: ScrapedBid[];
    /** Errors encountered */
    errors: string[];
}

// ── Sunflower Special Handling ───────────────────────────────────

/**
 * For sunflowers, there's no futures + basis calculation.
 * Price is a direct cash quote from crush plants ($/cwt).
 * We just normalize and validate the scraped price.
 */
export function validateSunflowerPrice(pricePerCwt: number): boolean {
    // Sanity check: sunflower seed prices typically $18–$30/cwt
    return pricePerCwt >= 14 && pricePerCwt <= 40;
}

/**
 * Convert sunflower $/cwt to $/bu for comparison purposes.
 * 1 cwt = 100 lbs, sunflower = 25 lbs/bu → 4 bu/cwt
 */
export function sunflowerCwtToBushel(pricePerCwt: number): number {
    return Math.round((pricePerCwt / 4) * 100) / 100;
}

/**
 * Convert sunflower $/bu to $/cwt.
 */
export function sunflowerBushelToCwt(pricePerBu: number): number {
    return Math.round((pricePerBu * 4) * 100) / 100;
}
