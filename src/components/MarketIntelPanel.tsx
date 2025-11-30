import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { geminiService } from '../services/gemini';
import { Buyer } from '../types';
import { FreightCalculator } from './FreightCalculator';

interface MarketIntelPanelProps {
    buyers: Buyer[];
}

export const MarketIntelPanel: React.FC<MarketIntelPanelProps> = ({ buyers }) => {
    const [insights, setInsights] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'intel' | 'freight'>('intel');

    const generateIntel = async () => {
        if (buyers.length === 0) return;
        setLoading(true);
        const result = await geminiService.getMarketIntel(buyers);
        setInsights(result);
        setLoading(false);
    };

    // Auto-generate when buyers load
    useEffect(() => {
        if (buyers.length > 0 && !insights) {
            generateIntel();
        }
    }, [buyers]);

    return (
        <div className="w-full h-full bg-zinc-900/90 backdrop-blur-md rounded-xl border border-white/10 p-6 flex flex-col relative overflow-hidden group shadow-2xl">
            {/* Background Gradient Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/20 transition-all duration-700"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
                        <Sparkles className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Market Intel</h3>
                        <div className="flex gap-2 text-xs mt-1">
                            <button
                                onClick={() => setActiveTab('intel')}
                                className={`px-2 py-0.5 rounded transition-colors ${activeTab === 'intel' ? 'bg-white/20 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('freight')}
                                className={`px-2 py-0.5 rounded transition-colors ${activeTab === 'freight' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Freight
                            </button>
                        </div>
                    </div>
                </div>
                {activeTab === 'intel' && (
                    <button
                        onClick={generateIntel}
                        disabled={loading || buyers.length === 0}
                        className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-30 border border-white/5"
                        title="Refresh Intel"
                    >
                        <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 relative z-10 custom-scrollbar">
                {activeTab === 'intel' ? (
                    insights ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="whitespace-pre-line text-slate-300 leading-relaxed">
                                {insights}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                            {loading ? (
                                <div className="animate-pulse text-sm">Analyzing market data...</div>
                            ) : (
                                <p className="text-sm text-center">Waiting for data...</p>
                            )}
                        </div>
                    )
                ) : (
                    <FreightCalculator buyers={buyers} />
                )}
            </div>
        </div>
    );
};
