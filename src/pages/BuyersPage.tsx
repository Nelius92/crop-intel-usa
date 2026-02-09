import React, { useState, useEffect } from 'react';
import { LiveQuoteBoard } from '../components/LiveQuoteBoard';
import { BuyerTable } from '../components/BuyerTable';
import { OpportunityDrawer } from '../components/OpportunityDrawer';
import { fetchRealBuyersFromGoogle, enrichBuyerWithGoogleData } from '../services/buyersService';
import { marketDataService } from '../services/marketDataService';
import { calculateFreight } from '../services/railService';
import { Buyer, CropType } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface BuyersPageProps {
    selectedCrop: CropType;
}

export const BuyersPage: React.FC<BuyersPageProps> = ({ selectedCrop }) => {
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);

    const [oracle, setOracle] = useState<any>(null);

    const fetchBuyers = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get market data with Hankinson benchmark
            const marketData = marketDataService.getMarketData();
            const hankinson = marketDataService.getHankinsonBenchmark();

            setOracle({
                futuresPrice: marketData.futuresPrice,
                contractMonth: marketData.contractMonth,
                hankinsonBasis: hankinson.basis,
                hankinsonCashPrice: hankinson.cashPrice
            });

            // 2. Fetch buyers with USDA-based pricing (uses buyersService)
            const liveData = await fetchRealBuyersFromGoogle();

            // 3. Sort by Net Price descending (Best deals first)
            const sortedData = [...liveData].sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0));
            setBuyers(sortedData);
            setLoading(false);

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
    }, [selectedCrop]);

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
                        <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                            {selectedCrop.split(' ')[0]} <span className="text-orange-500">Intel</span>
                        </h2>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm flex-wrap">
                            <span className="hidden sm:inline">Sorted by Net Price</span>
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

                    {/* Hankinson Benchmark Badge */}
                    {oracle && (
                        <div className="hidden sm:flex flex-col items-end bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Hankinson Benchmark</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-emerald-300 font-mono text-sm">
                                    {oracle.hankinsonBasis >= 0 ? '+' : ''}{oracle.hankinsonBasis.toFixed(2)} basis
                                </span>
                                <span className="text-white font-bold font-mono">
                                    ${oracle.hankinsonCashPrice.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={fetchBuyers}
                        disabled={loading}
                        className="p-2 bg-white/5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Mobile Hankinson Banner */}
                {oracle && (
                    <div className="sm:hidden mt-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2 flex justify-between items-center">
                        <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Hankinson</span>
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-300 font-mono text-xs">
                                {oracle.hankinsonBasis >= 0 ? '+' : ''}{oracle.hankinsonBasis.toFixed(2)}
                            </span>
                            <span className="text-white font-bold font-mono text-sm">
                                ${oracle.hankinsonCashPrice.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}
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
