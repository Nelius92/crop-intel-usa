// Service to manage global market data
// In the future, this can be connected to a real market data API (e.g., DTN, Barchart)

export const marketDataService = {
    // Current CBOT Corn Futures Price (Reference for all basis calculations)
    // TODO: Connect to live API
    getCurrentFuturesPrice: (): number => {
        return 4.48; // Current market reference
    },

    // Get the active contract month
    getActiveContract: (): string => {
        return "ZCH6 (Mar '26)";
    }
};
