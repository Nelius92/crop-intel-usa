/**
 * Utility function to normalize freight capacity costs into a per-bushel basis.
 * Ensures the Net Price logic remains unit-consistent.
 *
 * @param cost Current nominal cost
 * @param impliedUnit The implied logic string (or 'per_car', 'per_ton') 
 *                    If not provided, we infer based on realistic boundary values.
 * @returns Normalization to $/bu rate
 */
export function normalizeFreightData(cost: number, impliedUnit?: string): number {
    // 1. Explicit Unit Checks
    if (impliedUnit === 'per_car') {
        return cost / 5100;
    }
    if (impliedUnit === 'per_ton') {
        return cost / 35.71;
    }

    // 2. Magnitude Fallback Inference
    // If the unit is not explicitly passed (e.g. from the map or a BNSF scraper),
    // we can still deduce the likely unit by its raw magnitude.
    if (cost > 1000) {
        // It's undoubtedly a per-car rate (e.g., $4,000 to $7,000)
        return cost / 5100;
    }
    
    if (cost > 10 && cost < 1000) {
        // Most per-ton rates hover between $15 to $80. 
        // A per-bushel rate will virtually never exceed $5.00 for domestic targets.
        return cost / 35.71;
    }

    // If it's already between $0.00 and $10.00, it's likely a per-bushel rate
    return cost;
}
