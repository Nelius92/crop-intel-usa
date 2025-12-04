import React, { useState } from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { Buyer } from '../types';
import { FreightCalculator } from './FreightCalculator';

interface MarketIntelPanelProps {
    buyers: Buyer[];
}

export const MarketIntelPanel: React.FC<MarketIntelPanelProps> = ({ buyers }) => {
    const [activeTab, setActiveTab] = useState<'top3' | 'freight'>('top3');
    const [isMinimized, setIsMinimized] = useState(false);

    // Get top 3 buyers (assumes buyers are already sorted by basis)
    const topBuyers = buyers.slice(0, 3);

    return (
        <div className={`w-full bg-zinc-900/90 backdrop-blur-md rounded-xl border border-white/10 flex flex-col relative overflow-hidden group shadow-2xl transition-all duration-300 ${isMinimized ? 'h-[60px]' : 'h-full'}`}>
            {/* Background Gradient Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>

            <div
                className="flex items-center justify-between p-4 relative z-10 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20">
                        <TrendingUp className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Top Opportunities</h3>
                        <div className={`flex gap-2 text-xs mt-1 transition-opacity duration-300 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab('top3'); }}
                                className={`px-2 py-0.5 rounded transition-colors ${activeTab === 'top3' ? 'bg-white/20 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Top 3 Buyers
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab('freight'); }}
                                className={`px-2 py-0.5 rounded transition-colors ${activeTab === 'freight' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Freight Calc
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-1 rounded text-slate-400 transition-colors">
                    {/* Chevron icon could be added here if imported, using rotation for now or just relying on height change */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transform transition-transform duration-300 ${isMinimized ? 'rotate-180' : 'rotate-0'}`}
                    >
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto px-6 pb-6 pr-2 relative z-10 custom-scrollbar transition-opacity duration-300 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {activeTab === 'top3' ? (
                    <div className="flex flex-col gap-3">
                        {topBuyers.length > 0 ? (
                            topBuyers.map((buyer, index) => (
                                <div key={buyer.id} className="bg-white/5 rounded-lg p-3 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            <span className="font-medium text-white truncate max-w-[120px]">{buyer.name}</span>
                                        </div>
                                        <span className={`text-sm font-mono font-bold ${buyer.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {buyer.basis >= 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-zinc-400 pl-7">
                                        <span>{buyer.city}, {buyer.state}</span>
                                        <div className="flex items-center gap-1 text-zinc-300">
                                            <DollarSign size={12} />
                                            <span>${buyer.cashPrice?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-zinc-500 py-8">
                                No data available
                            </div>
                        )}
                    </div>
                ) : (
                    <FreightCalculator buyers={buyers} />
                )}
            </div>
        </div>
    );
};
