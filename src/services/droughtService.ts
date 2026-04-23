/**
 * Drought Monitor Service — Crop Intel
 *
 * Fetches live drought severity data from the free U.S. Drought Monitor REST API.
 * Data updates every Thursday morning. We cache in-memory for 24 hours.
 *
 * Source: https://droughtmonitor.unl.edu
 * API:    https://usdmdataservices.unl.edu/api/
 * Cost:   $0 — public domain government data
 *
 * IMPORTANT: The USDM API returns area in square miles, NOT percentages.
 * We compute percentages by dividing each drought level by total area.
 * Field names from API are lowercase: d0, d1, d2, d3, d4, none
 * State identifier is stateAbbreviation (e.g. "KS"), queried by FIPS code.
 */

// ── Types ─────────────────────────────────────────────────────────────

export type DroughtSeverity = 'none' | 'abnormal' | 'moderate' | 'severe' | 'extreme' | 'exceptional';

export interface StateDrought {
    stateCode: string;      // e.g. "KS", "TX"
    stateName: string;      // e.g. "Kansas"
    none: number;           // % area with no drought
    d0: number;             // % area Abnormally Dry or worse
    d1: number;             // % area Moderate Drought or worse
    d2: number;             // % area Severe Drought or worse
    d3: number;             // % area Extreme Drought or worse
    d4: number;             // % area Exceptional Drought
    severity: DroughtSeverity;
    weekOf: string;         // ISO date string of the data week
}

export interface DroughtCache {
    data: Map<string, StateDrought>;
    fetchedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────

// Use proxy to avoid CORS — Vite proxy (dev) or Vercel rewrite (prod)
const USDM_API_BASE = '/drought-api';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// State FIPS codes → abbreviation + name
const STATE_FIPS: Record<string, { code: string; name: string }> = {
    '01': { code: 'AL', name: 'Alabama' },
    '02': { code: 'AK', name: 'Alaska' },
    '04': { code: 'AZ', name: 'Arizona' },
    '05': { code: 'AR', name: 'Arkansas' },
    '06': { code: 'CA', name: 'California' },
    '08': { code: 'CO', name: 'Colorado' },
    '09': { code: 'CT', name: 'Connecticut' },
    '10': { code: 'DE', name: 'Delaware' },
    '12': { code: 'FL', name: 'Florida' },
    '13': { code: 'GA', name: 'Georgia' },
    '15': { code: 'HI', name: 'Hawaii' },
    '16': { code: 'ID', name: 'Idaho' },
    '17': { code: 'IL', name: 'Illinois' },
    '18': { code: 'IN', name: 'Indiana' },
    '19': { code: 'IA', name: 'Iowa' },
    '20': { code: 'KS', name: 'Kansas' },
    '21': { code: 'KY', name: 'Kentucky' },
    '22': { code: 'LA', name: 'Louisiana' },
    '23': { code: 'ME', name: 'Maine' },
    '24': { code: 'MD', name: 'Maryland' },
    '25': { code: 'MA', name: 'Massachusetts' },
    '26': { code: 'MI', name: 'Michigan' },
    '27': { code: 'MN', name: 'Minnesota' },
    '28': { code: 'MS', name: 'Mississippi' },
    '29': { code: 'MO', name: 'Missouri' },
    '30': { code: 'MT', name: 'Montana' },
    '31': { code: 'NE', name: 'Nebraska' },
    '32': { code: 'NV', name: 'Nevada' },
    '33': { code: 'NH', name: 'New Hampshire' },
    '34': { code: 'NJ', name: 'New Jersey' },
    '35': { code: 'NM', name: 'New Mexico' },
    '36': { code: 'NY', name: 'New York' },
    '37': { code: 'NC', name: 'North Carolina' },
    '38': { code: 'ND', name: 'North Dakota' },
    '39': { code: 'OH', name: 'Ohio' },
    '40': { code: 'OK', name: 'Oklahoma' },
    '41': { code: 'OR', name: 'Oregon' },
    '42': { code: 'PA', name: 'Pennsylvania' },
    '44': { code: 'RI', name: 'Rhode Island' },
    '45': { code: 'SC', name: 'South Carolina' },
    '46': { code: 'SD', name: 'South Dakota' },
    '47': { code: 'TN', name: 'Tennessee' },
    '48': { code: 'TX', name: 'Texas' },
    '49': { code: 'UT', name: 'Utah' },
    '50': { code: 'VT', name: 'Vermont' },
    '51': { code: 'VA', name: 'Virginia' },
    '53': { code: 'WA', name: 'Washington' },
    '54': { code: 'WV', name: 'West Virginia' },
    '55': { code: 'WI', name: 'Wisconsin' },
    '56': { code: 'WY', name: 'Wyoming' },
};

// Reverse lookup: state abbreviation → fips
const CODE_TO_FIPS: Record<string, string> = {};
const CODE_TO_NAME: Record<string, string> = {};
for (const [fips, info] of Object.entries(STATE_FIPS)) {
    CODE_TO_FIPS[info.code] = fips;
    CODE_TO_NAME[info.code] = info.name;
}

// ── Severity Classification ───────────────────────────────────────────

export function classifySeverity(d0: number, d1: number, d2: number, d3: number, d4: number): DroughtSeverity {
    if (d4 > 5) return 'exceptional';
    if (d3 > 10) return 'extreme';
    if (d2 > 20) return 'severe';
    if (d1 > 25) return 'moderate';
    if (d0 > 30) return 'abnormal';
    return 'none';
}

export function severityLabel(severity: DroughtSeverity): string {
    switch (severity) {
        case 'exceptional': return 'Exceptional Drought (D4)';
        case 'extreme': return 'Extreme Drought (D3)';
        case 'severe': return 'Severe Drought (D2)';
        case 'moderate': return 'Moderate Drought (D1)';
        case 'abnormal': return 'Abnormally Dry (D0)';
        default: return 'No Drought';
    }
}

export function severityEmoji(severity: DroughtSeverity): string {
    switch (severity) {
        case 'exceptional': return '🔴';
        case 'extreme': return '🔴';
        case 'severe': return '🟠';
        case 'moderate': return '🟡';
        case 'abnormal': return '🟡';
        default: return '🟢';
    }
}

export function severityColor(severity: DroughtSeverity): string {
    switch (severity) {
        case 'exceptional': return '#730000';
        case 'extreme': return '#E60000';
        case 'severe': return '#FFAA00';
        case 'moderate': return '#FCD37F';
        case 'abnormal': return '#FFFF00';
        default: return '#22c55e';
    }
}

// ── Cache ─────────────────────────────────────────────────────────────

let cache: DroughtCache | null = null;

function debugDrought(message: string, ...args: unknown[]) {
    if (import.meta.env.DEV) {
        console.info(message, ...args);
    }
}

function isCacheValid(): boolean {
    if (!cache) return false;
    return (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
}

// ── API Response Type ─────────────────────────────────────────────────
// API returns lowercase fields and area in square miles (not percentages)
interface USDMStateRow {
    mapDate: string;
    stateAbbreviation: string;
    none: number;      // sq mi with no drought
    d0: number;        // sq mi D0+ (Abnormally Dry or worse)
    d1: number;        // sq mi D1+ (Moderate or worse)
    d2: number;        // sq mi D2+ (Severe or worse)
    d3: number;        // sq mi D3+ (Extreme or worse)
    d4: number;        // sq mi D4  (Exceptional)
    validStart: string;
    validEnd: string;
    statisticFormatID: number;
}

/**
 * Fetch drought data for all US states by querying each state's FIPS.
 * We batch all 50 states in a single request using `aoi=us` on the
 * CountyStatistics endpoint, then aggregate by state for efficiency.
 *
 * Actually: The StateStatistics endpoint works when you pass individual
 * FIPS codes. We'll query them all in parallel for speed.
 */
export async function fetchStateDroughtData(): Promise<Map<string, StateDrought>> {
    if (isCacheValid() && cache) {
        debugDrought('[DroughtService] Returning cached drought data');
        return cache.data;
    }

    debugDrought('[DroughtService] Fetching fresh drought data from USDM API...');

    // Use a 90-day lookback to find the most recent data week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90);

    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

    const result = new Map<string, StateDrought>();
    const fipsList = Object.keys(STATE_FIPS);

    // Fetch all states in parallel (batches of 10 to be polite)
    const batchSize = 10;
    for (let i = 0; i < fipsList.length; i += batchSize) {
        const batch = fipsList.slice(i, i + batchSize);
        const promises = batch.map(async (fips) => {
            const info = STATE_FIPS[fips];
            const url = `${USDM_API_BASE}/StateStatistics/GetDroughtSeverityStatisticsByArea` +
                `?aoi=${fips}&startdate=${formatDate(startDate)}&enddate=${formatDate(endDate)}&statisticsType=1`;

            try {
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                });

                if (!response.ok) return;

                const rows: USDMStateRow[] = await response.json();
                if (!Array.isArray(rows) || rows.length === 0) return;

                // Get the most recent week (highest mapDate)
                const latest = rows.reduce((best, row) =>
                    row.mapDate > best.mapDate ? row : best, rows[0]);

                // Convert sq mi to percentages
                const totalArea = latest.none + latest.d0;
                if (totalArea <= 0) return;

                const d0Pct = (latest.d0 / totalArea) * 100;
                const d1Pct = (latest.d1 / totalArea) * 100;
                const d2Pct = (latest.d2 / totalArea) * 100;
                const d3Pct = (latest.d3 / totalArea) * 100;
                const d4Pct = (latest.d4 / totalArea) * 100;

                result.set(info.code, {
                    stateCode: info.code,
                    stateName: info.name,
                    none: 100 - d0Pct,
                    d0: d0Pct,
                    d1: d1Pct,
                    d2: d2Pct,
                    d3: d3Pct,
                    d4: d4Pct,
                    severity: classifySeverity(d0Pct, d1Pct, d2Pct, d3Pct, d4Pct),
                    weekOf: latest.validStart?.split('T')[0] || latest.mapDate?.split('T')[0] || '',
                });
            } catch (err) {
                // Silently skip individual state failures
                console.warn(`[DroughtService] Failed to fetch ${info.code}:`, err);
            }
        });

        await Promise.all(promises);
    }

    // Update cache
    cache = { data: result, fetchedAt: Date.now() };
    debugDrought(`[DroughtService] Cached drought data for ${result.size} states`);

    return result;
}

/**
 * Get drought data for a specific state code (e.g. "KS", "TX").
 */
export async function getDroughtForState(stateCode: string): Promise<StateDrought | null> {
    const data = await fetchStateDroughtData();
    return data.get(stateCode.toUpperCase()) ?? null;
}

/**
 * Get a summary string for display (e.g. "🟠 Severe — 45% D2")
 */
export function formatDroughtSummary(drought: StateDrought | null): string {
    if (!drought) return '⚪ No data';
    if (drought.severity === 'none') return '🟢 No Drought';

    const emoji = severityEmoji(drought.severity);
    const label = drought.severity.charAt(0).toUpperCase() + drought.severity.slice(1);

    if (drought.d4 > 0) return `${emoji} ${label} — ${drought.d4.toFixed(0)}% D4`;
    if (drought.d3 > 0) return `${emoji} ${label} — ${drought.d3.toFixed(0)}% D3`;
    if (drought.d2 > 0) return `${emoji} ${label} — ${drought.d2.toFixed(0)}% D2`;
    if (drought.d1 > 0) return `${emoji} ${label} — ${drought.d1.toFixed(0)}% D1`;
    return `${emoji} ${label} — ${drought.d0.toFixed(0)}% D0`;
}

/**
 * Clear the in-memory cache.
 */
export function clearDroughtCache(): void {
    cache = null;
    debugDrought('[DroughtService] Cache cleared');
}
