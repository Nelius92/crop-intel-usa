import React, { useEffect, useState } from 'react';
import { CornMap } from '../components/CornMap';
import { MarketIntelPanel } from '../components/MarketIntelPanel';
import { geminiService } from '../services/gemini';

import { fetchTransloaders } from '../services/transloaderService';
import { calculateFreight } from '../services/railService';
import { CropType, HeatmapPoint, Buyer, Transloader } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface HeatMapPageProps {
    selectedCrop: CropType;
}

export const HeatMapPage: React.FC<HeatMapPageProps> = ({ selectedCrop }) => {
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [transloaders, setTransloaders] = useState<Transloader[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Heatmap Data (for the map) - Pass selectedCrop
            const heatData = await geminiService.getLiveHeatmapData(selectedCrop);
            setHeatmapData(heatData);

            // 2. Fetch Transloaders (Keep static for now, or filter if we had crop types)
            const transloaderData = await fetchTransloaders();
            setTransloaders(transloaderData);

            // 3. Fetch Buyers (for the Top 3 Widget) - Pass selectedCrop
            // Get Oracle Truths first
            const oracleData = await geminiService.getMarketOracle(selectedCrop);

            // Use Gemini for Live Buyer Data (Dynamic per crop)
            const liveBuyers = await geminiService.getLiveBuyerData(selectedCrop);

            if (liveBuyers.length > 0) {
                // Enrich with Oracle Data
                const enrichedData = await geminiService.enrichBuyersWithMarketData(liveBuyers, oracleData, selectedCrop);

                // Calculate Freight & Net Price
                // Freight calculation might need name/lat/lng
                const buyersWithFreight = await Promise.all(enrichedData.map(async (buyer) => {
                    const freight = await calculateFreight({ lat: buyer.lat, lng: buyer.lng }, buyer.name);
                    const netPrice = (buyer.cashPrice || 0) - freight.ratePerBushel;
                    return {
                        ...buyer,
                        freightCost: freight.ratePerBushel,
                        netPrice: parseFloat(netPrice.toFixed(2)),
                    };
                }));

                // Sort by Basis descending
                const sortedBuyers = buyersWithFreight.sort((a, b) => b.basis - a.basis);
                setBuyers(sortedBuyers);
            }

            setLastUpdated(new Date());

        } catch (err) {
            console.error(err);
            setError("Connection failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 30 minutes (1800000 ms)
        const interval = setInterval(fetchData, 1800000);
        return () => clearInterval(interval);
    }, [selectedCrop]);

    // Calculate Top 3 States for "Glow" effect
    const [topStates, setTopStates] = useState<string[]>([]);

    useEffect(() => {
        if (buyers.length === 0) return;

        // Group by state and calc avg net price
        const stateStats: Record<string, { total: number, count: number }> = {};
        buyers.forEach(b => {
            if (!stateStats[b.state]) stateStats[b.state] = { total: 0, count: 0 };
            stateStats[b.state].total += (b.netPrice || 0);
            stateStats[b.state].count++;
        });

        const stateAvgs = Object.entries(stateStats).map(([state, stats]) => ({
            state,
            avg: stats.total / stats.count
        }));

        // Sort desc
        const top3 = stateAvgs.sort((a, b) => b.avg - a.avg).slice(0, 3).map(s => s.state);
        setTopStates(top3);
    }, [buyers]);

    return (
        <div className="w-full h-full relative">
            <CornMap
                showHeatmap={true}
                showBuyers={false}
                showRail={true}
                showTransloaders={true}
                view="usa"
                theme="green-glow"
                heatmapData={heatmapData}
                transloaders={transloaders}
                hoveredRegionId={null}
                topStates={topStates}
            />

            {/* Overlay Elements */}
            <div className="absolute top-20 left-4 sm:left-6 pointer-events-none z-10">
                <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                    National <span className="text-green-400">Price Heatmap</span>
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm drop-shadow-md max-w-md mt-1">
                    Live market intelligence.
                </p>
                {lastUpdated && (
                    <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
                        Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50">
                    <AlertTriangle size={16} />
                    <span>{error} Showing last known data.</span>
                </div>
            )}

            {/* Refresh Button */}
            <button
                onClick={fetchData}
                disabled={loading}
                className="absolute top-20 right-4 sm:right-96 mr-0 sm:mr-4 p-2.5 bg-[#120202]/60 backdrop-blur-xl rounded-full border border-white/10 text-corn-accent shadow-glass hover:shadow-glow hover:bg-corn-accent/10 transition-all active:scale-95 disabled:opacity-50 pointer-events-auto z-20"
                title="Refresh Live Data"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="absolute bottom-24 sm:top-20 right-4 sm:right-6 pointer-events-auto z-10 w-80">
                <MarketIntelPanel buyers={buyers} />
            </div>
        </div>
    );
};
