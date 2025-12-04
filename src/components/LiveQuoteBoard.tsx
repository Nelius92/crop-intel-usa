import React from 'react';
import { Buyer } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface LiveQuoteBoardProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
}

export const LiveQuoteBoard: React.FC<LiveQuoteBoardProps> = ({ buyers, onSelect }) => {
    const [isMinimized, setIsMinimized] = React.useState(false);

    // Get top 3 buyers by basis
    const topBuyers = [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3);

    return (
        <div className={`w-full bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-4 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-[60px]' : 'h-full'}`}>
            <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={16} className="text-corn-accent" />
                    Live Market Quotes
                </h3>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-mono text-green-500">MARKET OPEN</span>
                    </div>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowUpRight size={16} className={`transform transition-transform duration-300 ${isMinimized ? 'rotate-180' : 'rotate-0'}`} />
                    </button>
                </div>
            </div>

            <div className={`flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 transition-opacity duration-300 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {topBuyers.map((buyer, index) => (
                    <div
                        key={buyer.id}
                        onClick={() => onSelect(buyer)}
                        className="relative group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-corn-accent/30 rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between"
                    >
                        {/* Rank Badge */}
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-600 group-hover:text-corn-accent transition-colors">
                            #{index + 1}
                        </div>

                        {/* Symbol / Name */}
                        <div className="mb-2">
                            <div className="text-xs text-slate-400 font-mono mb-1 flex items-center gap-2">
                                <span>{buyer.city.toUpperCase()}</span>
                                {buyer.isManual ? (
                                    <span className="text-[9px] font-bold text-black bg-yellow-400 px-1 rounded">VERIFIED</span>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1 rounded">EST</span>
                                )}
                            </div>
                            <div className="text-lg font-bold text-white leading-tight truncate pr-4">{buyer.name}</div>
                        </div>

                        {/* Price Grid */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {/* Bid (Basis) */}
                            <div className="bg-black/30 rounded p-2 border border-white/5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Basis (Bid)</div>
                                <div className={`text-xl font-mono font-bold flex items-center ${buyer.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                    {buyer.basis >= 0 ? <ArrowUpRight size={14} className="ml-1 opacity-50" /> : <ArrowDownRight size={14} className="ml-1 opacity-50" />}
                                </div>
                            </div>

                            {/* Ask (Cash) - Conceptual mapping for visual balance */}
                            <div className="bg-black/30 rounded p-2 border border-white/5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Cash (Spot)</div>
                                <div className="text-xl font-mono font-bold text-white flex items-center">
                                    {buyer.cashPrice?.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Spread / Net */}
                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                            <div className="text-[10px] text-slate-500">Net: <span className="text-slate-300 font-mono">${buyer.netPrice?.toFixed(2) || '-'}</span></div>
                            <div className="text-[10px] text-corn-accent font-medium tracking-wide">TRADE NOW</div>
                        </div>
                    </div>
                ))}

                {topBuyers.length === 0 && (
                    <div className="col-span-3 flex items-center justify-center text-slate-500 text-sm">
                        Waiting for market data...
                    </div>
                )}
            </div>
        </div>
    );
};
