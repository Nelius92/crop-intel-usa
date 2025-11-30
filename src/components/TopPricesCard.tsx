import React from 'react';
import { HeatmapPoint } from '../types';
import { TrendingUp, DollarSign } from 'lucide-react';

interface TopPricesCardProps {
    data: HeatmapPoint[];
    loading?: boolean;
    onHoverRegion: (id: string | null) => void;
}

export const TopPricesCard: React.FC<TopPricesCardProps> = ({ data, loading, onHoverRegion }) => {
    // Sort by price descending and take top 3
    const topRegions = [...data]
        .sort((a, b) => b.cornPrice - a.cornPrice)
        .slice(0, 3);

    return (
        <div className="w-80 bg-corn-card/80 backdrop-blur-md rounded-xl border border-corn-accent/20 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-corn-accent" size={18} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 3 Markets</h3>
                <span className="flex h-2 w-2 relative ml-auto">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold text-red-400 tracking-wider">LIVE</span>
            </div>

            <div className="space-y-2">
                {loading ? (
                    // Skeleton Loading State
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-3 rounded-lg bg-white/5 animate-pulse">
                            <div className="flex justify-between items-center mb-2">
                                <div className="h-4 w-24 bg-slate-700 rounded"></div>
                                <div className="h-4 w-12 bg-slate-700 rounded"></div>
                            </div>
                            <div className="h-3 w-32 bg-slate-700/50 rounded"></div>
                        </div>
                    ))
                ) : (
                    topRegions.map((region, index) => (
                        <div
                            key={region.id}
                            className="group relative p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-corn-accent/30"
                            onMouseEnter={() => onHoverRegion(region.id)}
                            onMouseLeave={() => onHoverRegion(null)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-corn-accent/20 text-corn-accent text-xs font-bold">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <span className="text-sm font-medium text-slate-200 block">
                                            {region.regionName || 'Unknown Region'}
                                        </span>
                                        {region.marketLabel && (
                                            <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                                                {region.marketLabel}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pl-7 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 uppercase">Cash</span>
                                    <span className="text-lg font-bold text-white flex items-center">
                                        <DollarSign size={14} className="text-slate-400" />
                                        {region.cornPrice.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-slate-500 uppercase">Basis</span>
                                    <span className={`text-sm font-medium ${region.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {region.basis >= 0 ? '+' : ''}{region.basis.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {!loading && topRegions.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-sm">
                        No market data available.
                    </div>
                )}
            </div>
        </div>
    );
};
