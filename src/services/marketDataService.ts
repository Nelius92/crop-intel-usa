// Service to manage global market data
// Connected to real market data sources for production accuracy

export interface MarketData {
    futuresPrice: number;
    contractMonth: string;
    lastUpdated: string;
    source: 'usda' | 'cme' | 'cached' | 'fallback';
    // Hankinson Renewable Energy benchmark (user's reference point)
    hankinsonBasis: number;
    hankinsonCashPrice: number;
}

// Cache for futures price to avoid excessive fetches
let cachedMarketData: MarketData | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Fallback values based on current market (updated Feb 6, 2026 @ 10:30 PM CT)
// CME ZCH6 (Mar '26) closing price
const FALLBACK_FUTURES_PRICE = 4.30;
const FALLBACK_CONTRACT = "ZCH6 (Mar '26)";
const FALLBACK_HANKINSON_BASIS = -0.47; // Hankinson typical basis

// Helper to create market data with Hankinson values
function createMarketData(
    futuresPrice: number,
    contractMonth: string,
    source: MarketData['source'],
    hankinsonBasis: number = FALLBACK_HANKINSON_BASIS
): MarketData {
    return {
        futuresPrice,
        contractMonth,
        lastUpdated: new Date().toISOString(),
        source,
        hankinsonBasis,
        hankinsonCashPrice: parseFloat((futuresPrice + hankinsonBasis).toFixed(2))
    };
}

export const marketDataService = {
    // Get current CBOT Corn Futures Price with caching
    getCurrentFuturesPrice: (): number => {
        if (cachedMarketData && Date.now() - lastFetchTime < CACHE_DURATION_MS) {
            return cachedMarketData.futuresPrice;
        }
        return FALLBACK_FUTURES_PRICE;
    },

    // Get the active contract month
    getActiveContract: (): string => {
        if (cachedMarketData) {
            return cachedMarketData.contractMonth;
        }
        return FALLBACK_CONTRACT;
    },

    // Get Hankinson benchmark data (critical for user comparisons)
    getHankinsonBenchmark: (): { basis: number; cashPrice: number } => {
        if (cachedMarketData) {
            return {
                basis: cachedMarketData.hankinsonBasis,
                cashPrice: cachedMarketData.hankinsonCashPrice
            };
        }
        return {
            basis: FALLBACK_HANKINSON_BASIS,
            cashPrice: FALLBACK_FUTURES_PRICE + FALLBACK_HANKINSON_BASIS
        };
    },

    // Get full market data with source info
    getMarketData: (): MarketData => {
        if (cachedMarketData && Date.now() - lastFetchTime < CACHE_DURATION_MS) {
            return cachedMarketData;
        }
        return createMarketData(FALLBACK_FUTURES_PRICE, FALLBACK_CONTRACT, 'fallback');
    },

    // Async fetch of latest futures price from real source
    fetchLatestFuturesPrice: async (): Promise<MarketData> => {
        try {
            const response = await fetch(
                'https://api.transportation.usda.gov/wips/services/GTR/GrainPrices?format=json',
                { signal: AbortSignal.timeout(5000) }
            );

            if (response.ok) {
                const data = await response.json();
                const cornData = data?.find?.((d: any) =>
                    d.commodity?.toLowerCase().includes('corn')
                );

                if (cornData?.price) {
                    cachedMarketData = createMarketData(
                        parseFloat(cornData.price),
                        FALLBACK_CONTRACT,
                        'usda'
                    );
                    lastFetchTime = Date.now();
                    return cachedMarketData;
                }
            }
        } catch (error) {
            console.warn('Failed to fetch USDA prices, using cached/fallback:', error);
        }

        if (cachedMarketData) {
            return { ...cachedMarketData, source: 'cached' };
        }

        cachedMarketData = createMarketData(FALLBACK_FUTURES_PRICE, FALLBACK_CONTRACT, 'fallback');
        lastFetchTime = Date.now();
        return cachedMarketData;
    },

    // Update Hankinson basis manually (from daily check)
    updateHankinsonBasis: (basis: number): void => {
        const futures = cachedMarketData?.futuresPrice || FALLBACK_FUTURES_PRICE;
        cachedMarketData = createMarketData(futures, FALLBACK_CONTRACT, 'cached', basis);
        lastFetchTime = Date.now();
        console.log(`Hankinson basis updated to ${basis >= 0 ? '+' : ''}${basis.toFixed(2)} → Cash: $${cachedMarketData.hankinsonCashPrice.toFixed(2)}`);
    },

    // Update fallback price manually (for admin/morning updates)
    setFallbackPrice: (price: number, contract?: string): void => {
        cachedMarketData = createMarketData(
            price,
            contract || FALLBACK_CONTRACT,
            'cached',
            cachedMarketData?.hankinsonBasis || FALLBACK_HANKINSON_BASIS
        );
        lastFetchTime = Date.now();
        console.log(`Market price updated to $${price.toFixed(2)}`);
    }
};
