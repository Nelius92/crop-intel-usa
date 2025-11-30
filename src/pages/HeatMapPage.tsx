import React, { useEffect, useState } from 'react';
import { CornMap } from '../components/CornMap';
import { MarketIntelPanel } from '../components/MarketIntelPanel';
import { geminiService } from '../services/gemini';
import { fetchRealBuyersFromGoogle } from '../services/buyersService';
import { calculateFreight } from '../services/railService';
import { HeatmapPoint, Buyer } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const HeatMapPage: React.FC = () => {
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Heatmap Data (for the map)
            const heatData = await geminiService.getLiveHeatmapData();
            setHeatmapData(heatData);

            // 2. Fetch Buyers (for the Top 3 Widget)
            // Get Oracle Truths first
            const oracleData = await geminiService.getMarketOracle();

            // Get Google Buyers
            const googleData = await fetchRealBuyersFromGoogle();

            if (googleData.length > 0) {
                // Enrich with Oracle Data
                const enrichedData = await geminiService.enrichBuyersWithMarketData(googleData, oracleData);

                // Calculate Freight & Net Price
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
    }, []);

    return (
        <div className="w-full h-full relative">
            <CornMap
                showHeatmap={true}
                showBuyers={false}
                showRail={false}
                view="usa"
                theme="green-glow"
                heatmapData={heatmapData}
                hoveredRegionId={null}
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
                className="absolute top-20 right-4 sm:right-96 mr-0 sm:mr-4 p-2 bg-corn-card/50 backdrop-blur-md rounded-full border border-corn-accent/20 text-corn-accent hover:bg-corn-accent/10 transition-colors disabled:opacity-50 pointer-events-auto z-20"
                title="Refresh Live Data"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="absolute bottom-24 sm:top-20 right-4 sm:right-6 pointer-events-auto z-10 w-80 h-[300px]">
                <MarketIntelPanel buyers={buyers} />
            </div>
        </div>
    );
};
