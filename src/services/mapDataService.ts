import { HeatmapPoint } from '../types';

// Midwest bounding box approx
const MIN_LAT = 37.0;
const MAX_LAT = 49.0;
const MIN_LNG = -104.0;
const MAX_LNG = -80.0;

import { RAIL_LINES, distToSegment } from './railService';

export const generateHeatmapData = (count: number = 100): HeatmapPoint[] => {
    const points: HeatmapPoint[] = [];

    for (let i = 0; i < count; i++) {
        const lat = MIN_LAT + Math.random() * (MAX_LAT - MIN_LAT);
        const lng = MIN_LNG + Math.random() * (MAX_LNG - MIN_LNG);

        // Calculate proximity to nearest rail line
        let minRailDist = Infinity;
        for (const line of RAIL_LINES) {
            for (let j = 0; j < line.path.length - 1; j++) {
                const start = line.path[j];
                const end = line.path[j + 1];
                const dist = distToSegment({ lat, lng }, start, end);
                if (dist < minRailDist) minRailDist = dist;
            }
        }

        // Bias data based on rail proximity
        // Closer to rail = higher price, better basis
        const railBonus = Math.max(0, (100 - minRailDist) / 100); // 0 to 1 factor

        // Mock price between 4.00 and 6.00 + rail bonus
        const cornPrice = 4.00 + Math.random() * 1.50 + (railBonus * 0.50);

        // Mock basis between -30 and +10 + rail bonus
        const basis = Math.floor(Math.random() * 41) - 30 + Math.floor(railBonus * 10);

        // Mock change between -5% and +5%
        const change24h = (Math.random() * 10) - 5;

        // Opportunity logic: Top 20% price (> 5.60) OR change > 2% OR very close to rail (< 20 miles)
        const isOpportunity = cornPrice > 5.60 || change24h > 2.0 || minRailDist < 20;

        points.push({
            id: `hm-${i}`,
            lat,
            lng,
            cornPrice: parseFloat(cornPrice.toFixed(2)),
            basis,
            change24h: parseFloat(change24h.toFixed(2)),
            isOpportunity
        });
    }

    return points;
};
