import React, { useEffect, useState } from 'react';
import { CornMap } from '../components/CornMap';
import { TopPricesCard } from '../components/TopPricesCard';
import { geminiService } from '../services/gemini';
import { HeatmapPoint } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const HeatMapPage: React.FC = () => {
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await geminiService.getLiveHeatmapData();
            if (data.length === 0) {
                setError("Unable to fetch market data.");
            } else {
                setHeatmapData(data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            setError("Connection failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000);
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
                hoveredRegionId={hoveredRegionId}
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

            <div className="absolute bottom-24 sm:top-20 right-4 sm:right-6 pointer-events-auto z-10">
                <TopPricesCard
                    data={heatmapData}
                    loading={loading && heatmapData.length === 0}
                    onHoverRegion={setHoveredRegionId}
                />
            </div>
        </div>
    );
};
