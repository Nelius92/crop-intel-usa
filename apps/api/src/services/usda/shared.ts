export function errorMeta(error: unknown) {
    if (error instanceof Error) {
        return { error: error.message, stack: error.stack };
    }
    return { error: String(error) };
}

export const GRAIN_REPORT_IDS: Record<string, number> = {
    ND: 3878,
    SD: 3186,
    MN: 3049,
    IA: 2850,
    NE: 3225,
    KS: 2886,
    TX: 2711,
    CO: 2912,
    MT: 2771,
    IL: 3192,
    MO: 2932,
    OK: 3100,
    AR: 2960,
    OH: 2851,
    IN: 3463,
    MS: 2928,
    TN: 3088,
    KY: 2892,
    CA: 3146,
    OR: 3148,
    WA: 3148,
    WY: 3239,
};

export const SUNFLOWER_REPORT_ID = 2887;
export const REGIONAL_BASIS_TTL_MS = 60 * 60 * 1000;

export const regionalBasisCache = new Map<string, { data: any; fetchedAt: number }>();

export function buildFallbackStateBasis(): Record<string, any> {
    return {
        ND: { avgBasis: -75, avgBasisDollars: -0.75, avgPrice: 3.90, bidCount: 0, source: 'fallback' },
        SD: { avgBasis: -70, avgBasisDollars: -0.70, avgPrice: 3.95, bidCount: 0, source: 'fallback' },
        MN: { avgBasis: -65, avgBasisDollars: -0.65, avgPrice: 4.00, bidCount: 0, source: 'fallback' },
        IA: { avgBasis: -38, avgBasisDollars: -0.38, avgPrice: 4.25, bidCount: 0, source: 'fallback' },
        IL: { avgBasis: -25, avgBasisDollars: -0.25, avgPrice: 4.40, bidCount: 0, source: 'fallback' },
        NE: { avgBasis: -30, avgBasisDollars: -0.30, avgPrice: 4.35, bidCount: 0, source: 'fallback' },
        KS: { avgBasis: -30, avgBasisDollars: -0.30, avgPrice: 4.35, bidCount: 0, source: 'fallback' },
        TX: { avgBasis: 87, avgBasisDollars: 0.87, avgPrice: 5.50, bidCount: 0, source: 'fallback' },
        CA: { avgBasis: 163, avgBasisDollars: 1.63, avgPrice: 6.30, bidCount: 0, source: 'fallback' },
        CO: { avgBasis: -20, avgBasisDollars: -0.20, avgPrice: 4.45, bidCount: 0, source: 'fallback' },
        OH: { avgBasis: -25, avgBasisDollars: -0.25, avgPrice: 4.40, bidCount: 0, source: 'fallback' },
        IN: { avgBasis: -20, avgBasisDollars: -0.20, avgPrice: 4.45, bidCount: 0, source: 'fallback' },
        WA: { avgBasis: 25, avgBasisDollars: 0.25, avgPrice: 4.90, bidCount: 0, source: 'fallback' },
        OR: { avgBasis: 25, avgBasisDollars: 0.25, avgPrice: 4.90, bidCount: 0, source: 'fallback' },
    };
}

export function buildFallbackResponse() {
    return {
        success: false,
        degraded: true,
        source: 'fallback',
        error: 'Failed to fetch from USDA API',
        fallback: true,
        data: {
            results: [
                { region: 'Northern Plains', state: 'ND', basis: -65, trend: 'DOWN' },
                { region: 'Corn Belt', state: 'IA', basis: -25, trend: 'FLAT' },
                { region: 'Texas', state: 'TX', basis: -15, trend: 'FLAT' },
                { region: 'California', state: 'CA', basis: 50, trend: 'FLAT' },
                { region: 'PNW', state: 'WA', basis: 25, trend: 'UP' },
                { region: 'Southeast', state: 'GA', basis: 5, trend: 'FLAT' },
                { region: 'Central Plains', state: 'NE', basis: -30, trend: 'FLAT' },
                { region: 'Southern Plains', state: 'CO', basis: -20, trend: 'FLAT' },
            ],
        },
        fetchedAt: new Date().toISOString(),
    };
}
