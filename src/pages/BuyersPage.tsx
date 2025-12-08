import React, { useState, useEffect } from 'react';
import { LiveQuoteBoard } from '../components/LiveQuoteBoard';
import { BuyerTable } from '../components/BuyerTable';
import { OpportunityDrawer } from '../components/OpportunityDrawer';
import { enrichBuyerWithGoogleData } from '../services/buyersService';
import { geminiService } from '../services/gemini';
import { calculateFreight } from '../services/railService';
import { Buyer } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const BuyersPage: React.FC = () => {
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);

    const [oracle, setOracle] = useState<any>(null);

    const fetchBuyers = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get the Market Oracle Truths FIRST
            const oracleData = await geminiService.getMarketOracle();
            setOracle(oracleData);

            // 2. Use our high-quality generated data (The Real Deal)
            // We prioritize this over live Google fetch to ensure pricing accuracy and consistency
            // with the "trusted analyst" persona.
            // 2. Use our high-quality generated data (The Real Deal)
            // We prioritize this over live Google fetch to ensure pricing accuracy and consistency
            // with the "trusted analyst" persona.
            import('../services/buyersService').then(async module => {
                const realData = await module.fetchRealBuyersFromGoogle();

                // Sort by Basis descending (Highest Bids First)
                const sortedData = [...realData].sort((a, b) => b.basis - a.basis);
                setBuyers(sortedData);
                setLoading(false);
            });

        } catch (err) {
            console.error(err);
            setError("Unable to refresh buyer data.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBuyers();

        // Auto-refresh every 30 minutes (1800000 ms)
        const intervalId = setInterval(() => {
            console.log("Auto-refreshing market data...");
            fetchBuyers();
        }, 1800000);

        return () => clearInterval(intervalId);
    }, []);

    const handleSelectBuyer = async (buyer: Buyer) => {
        // Set immediately to show drawer
        setSelectedBuyer(buyer);

        // Enrich with real-time Google Data in background
        try {
            const enriched = await enrichBuyerWithGoogleData(buyer);
            // Re-calculate freight if needed, or just preserve existing
            const freight = await calculateFreight({ lat: enriched.lat, lng: enriched.lng }, enriched.name);
            const netPrice = (enriched.cashPrice || 0) - freight.ratePerBushel;

            const finalBuyer = {
                ...enriched,
                freightCost: freight.ratePerBushel,
                netPrice: parseFloat(netPrice.toFixed(2))
            };

            setSelectedBuyer(prev => prev?.id === finalBuyer.id ? finalBuyer : prev);

            // Update in list as well
            setBuyers(prev => prev.map(b => b.id === finalBuyer.id ? finalBuyer : b));
        } catch (err) {
            console.error("Failed to enrich buyer data", err);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-black relative overflow-hidden">
            {/* Header - Static Sticky Bar */}
            <div className="flex-shrink-0 pt-20 px-4 pb-2 sm:pb-4 bg-black/80 backdrop-blur-sm z-20 border-b border-white/5">
                <div className="flex flex-row justify-between items-center gap-4 bg-zinc-900/90 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10 shadow-xl">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">Buyer <span className="text-orange-500">Intel</span></h2>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm">
                            <span className="hidden sm:inline">Real-time bids</span>
                            {oracle && (
                                <>
                                    <span className="hidden sm:inline text-zinc-600">•</span>
                                    <span className="text-corn-accent font-mono">
                                        {oracle.contractMonth} @ ${oracle.futuresPrice.toFixed(2)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={fetchBuyers}
                        disabled={loading}
                        className="p-2 bg-white/5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="px-4 py-2">
                    <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} />
                        <span>{error} Showing last known data.</span>
                    </div>
                </div>
            )}

            {/* Main Content Grid - Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-6 custom-scrollbar">
                <div className="flex-shrink-0">
                    {loading && buyers.length === 0 ? (
                        <div className="w-full h-[240px] bg-corn-card/50 rounded-xl animate-pulse" />
                    ) : buyers.length > 0 ? (
                        <LiveQuoteBoard buyers={buyers} onSelect={handleSelectBuyer} />
                    ) : (
                        <div className="w-full h-[240px] bg-corn-card/50 rounded-xl flex items-center justify-center text-slate-500">
                            No buyer data available.
                        </div>
                    )}
                </div>
                <div>
                    <BuyerTable buyers={buyers} onSelect={handleSelectBuyer} />
                </div>
            </div>

            {/* Detail Drawer */}
            {selectedBuyer && (
                <OpportunityDrawer
                    item={selectedBuyer}
                    onClose={() => setSelectedBuyer(null)}
                />
            )}
        </div>
    );
};
