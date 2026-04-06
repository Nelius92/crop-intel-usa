import React, { useState, useEffect, useCallback } from 'react';
import { LiveQuoteBoard } from '../components/LiveQuoteBoard';
import { BuyerTable } from '../components/BuyerTable';
import { OpportunityDrawer } from '../components/OpportunityDrawer';
import {
    fetchRealBuyersFromGoogle,
    invalidateBuyerCache,
    getBuyerCacheAge
} from '../services/buyersService';
import { marketDataService } from '../services/marketDataService';
import { Buyer, CropType } from '../types';
import { RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { getCropPriceUnit } from '../services/bnsfService';
import { calculateBuyerIntelScore } from '../services/buyerIntelService';

interface BuyersPageProps {
    selectedCrop: CropType;
}

/** Format a cache age (ms) as a human-readable relative string. */
function formatAge(ageMs: number): string {
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return hrs === 1 ? '1 hr ago' : `${hrs} hr ago`;
}

export const BuyersPage: React.FC<BuyersPageProps> = ({ selectedCrop }) => {
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
    const [oracle, setOracle] = useState<{
        futuresPrice: number;
        contractMonth: string;
        benchmarkBasis: number;
        benchmarkCashPrice: number;
        benchmarkName: string;
    } | null>(null);
    const [cacheAge, setCacheAge] = useState<number | null>(null);
    const [fromCache, setFromCache] = useState(false);

    const fetchBuyers = useCallback(async (forceRefresh: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            const marketData = marketDataService.getCropMarketData(selectedCrop);
            const benchmark = marketDataService.getBenchmark(selectedCrop);
            setOracle({
                futuresPrice: marketData.futuresPrice,
                contractMonth: marketData.contractMonth,
                benchmarkBasis: benchmark.basis,
                benchmarkCashPrice: benchmark.cashPrice,
                benchmarkName: benchmark.name
            });

            // If forced, invalidate the buyers cache first
            if (forceRefresh) {
                invalidateBuyerCache(selectedCrop);
            }

            const ageBeforeFetch = getBuyerCacheAge(selectedCrop);
            const liveData = await fetchRealBuyersFromGoogle(selectedCrop, undefined, forceRefresh);
            const ageAfterFetch = getBuyerCacheAge(selectedCrop);

            // Came from cache if age existed before and data was returned quickly (no compute)
            setFromCache(ageBeforeFetch !== null && !forceRefresh);
            setCacheAge(ageAfterFetch);

            // Sort by Intel Score (primary) then Net Price (tiebreaker)
            const benchmarkNet = marketData.futuresPrice + benchmark.basis - (benchmark.freight ?? 0);
            const sortedData = [...liveData].sort((a, b) => {
                const scoreA = calculateBuyerIntelScore(a, selectedCrop, benchmarkNet).score;
                const scoreB = calculateBuyerIntelScore(b, selectedCrop, benchmarkNet).score;
                if (scoreB !== scoreA) return scoreB - scoreA;
                return (b.netPrice ?? 0) - (a.netPrice ?? 0);
            });
            setBuyers(sortedData);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Unable to refresh buyer data.");
            setLoading(false);
        }
    }, [selectedCrop]);

    // Update the cache age display every minute
    useEffect(() => {
        const tick = setInterval(() => {
            setCacheAge(getBuyerCacheAge(selectedCrop));
        }, 60_000);
        return () => clearInterval(tick);
    }, [selectedCrop]);

    useEffect(() => {
        fetchBuyers(false);
        const intervalId = setInterval(() => {
            fetchBuyers(false);
        }, 1_800_000); // 30 min auto-refresh
        return () => clearInterval(intervalId);
    }, [fetchBuyers]);

    const handleRefresh = () => fetchBuyers(true);

    const handleSelectBuyer = (buyer: Buyer) => {
        setSelectedBuyer(buyer);
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#0f1014] relative overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 pt-16 sm:pt-20 px-4 pb-2 sm:pb-4 bg-[#0f1014] z-20 border-b border-[#2a2d36]">
                <div className="flex flex-row justify-between items-center gap-3 sm:gap-4 bg-[#13151a] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#2a2d36] shadow-xl shadow-black/50">
                    <div>
                        <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                            Crop <span className="text-red-500">Intel</span>
                        </h2>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm flex-wrap">
                            <span className="hidden sm:inline">Sorted by Intel Score</span>
                            {oracle && (
                                <>
                                    <span className="hidden sm:inline text-zinc-600">•</span>
                                    <span className="text-red-400 font-mono text-xs sm:text-sm">
                                        {oracle.contractMonth} @ ${oracle.futuresPrice.toFixed(2)}{getCropPriceUnit(selectedCrop)}
                                    </span>
                                </>
                            )}
                            <span className="text-zinc-600">•</span>
                            <span className="text-slate-400 font-mono text-xs">
                                {buyers.length} facilities
                            </span>
                            {/* Cache age indicator */}
                            {cacheAge !== null && (
                                <>
                                    <span className="text-zinc-600">•</span>
                                    <span className={`flex items-center gap-1 font-mono text-xs ${fromCache ? 'text-red-400' : 'text-zinc-400'}`}>
                                        <Clock size={10} />
                                        {fromCache ? `Cached · ${formatAge(cacheAge)}` : formatAge(cacheAge)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Benchmark Badge */}
                    {oracle && oracle.benchmarkBasis !== undefined && (
                        <div className="hidden md:flex flex-col items-end bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-1.5 shadow-[0_0_10px_rgba(239,68,68,0.05)]">
                            <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Benchmark</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-red-300 font-mono text-sm">
                                    {oracle.benchmarkBasis >= 0 ? '+' : ''}{oracle.benchmarkBasis.toFixed(2)} basis
                                </span>
                                <span className="text-white font-bold font-mono">
                                    ${oracle.benchmarkCashPrice.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Force refresh all prices"
                        className="p-2 bg-[#1a1c23] rounded-lg border border-[#2a2d36] text-white hover:bg-[#1e2028] transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Mobile Benchmark Banner */}
                {oracle && oracle.benchmarkBasis !== undefined && (
                    <div className="md:hidden mt-2 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2 flex justify-between items-center shadow-[0_0_10px_rgba(239,68,68,0.05)]">
                        <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Benchmark</span>
                        <div className="flex items-center gap-2">
                            <span className="text-red-300 font-mono text-xs">
                                {oracle.benchmarkBasis >= 0 ? '+' : ''}{oracle.benchmarkBasis.toFixed(2)}
                            </span>
                            <span className="text-white font-bold font-mono text-sm">
                                ${oracle.benchmarkCashPrice.toFixed(2)}
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

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4 custom-scrollbar">
                {/* Top Quotes (compact for directory mode) */}
                <div className="flex-shrink-0">
                    {loading && buyers.length === 0 ? (
                        <div className="w-full h-[200px] bg-[#1a1c23] rounded-xl animate-pulse" />
                    ) : buyers.length > 0 ? (
                        <LiveQuoteBoard buyers={buyers.slice(0, 10)} onSelect={handleSelectBuyer} selectedCrop={selectedCrop} />
                    ) : null}
                </div>

                {/* Buyer Directory Table (with built-in filters) */}
                <div className="w-full pb-8">
                    <BuyerTable
                        buyers={buyers}
                        onSelect={handleSelectBuyer}
                        allBuyers={buyers}
                        selectedCrop={selectedCrop}
                        benchmarkPrice={oracle?.benchmarkCashPrice}
                    />
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
