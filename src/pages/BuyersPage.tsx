import React, { useState, useEffect, useCallback } from 'react';
import { LiveQuoteBoard } from '../components/LiveQuoteBoard';
import { BuyerTable } from '../components/BuyerTable';
import { OpportunityDrawer } from '../components/OpportunityDrawer';
import {
    fetchRealBuyersFromGoogle,
    enrichBuyerWithGoogleData,
    invalidateBuyerCache,
    getBuyerCacheAge
} from '../services/buyersService';
import { marketDataService } from '../services/marketDataService';
import { calculateFreight } from '../services/railService';
import { Buyer, CropType } from '../types';
import { RefreshCw, AlertTriangle, Clock } from 'lucide-react';

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
    const [oracle, setOracle] = useState<any>(null);
    const [cacheAge, setCacheAge] = useState<number | null>(null);
    const [fromCache, setFromCache] = useState(false);

    const fetchBuyers = useCallback(async (forceRefresh: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            const marketData = marketDataService.getCropMarketData(selectedCrop);
            setOracle({
                futuresPrice: marketData.futuresPrice,
                contractMonth: marketData.contractMonth,
                hankinsonBasis: marketData.hankinsonBasis,
                hankinsonCashPrice: marketData.hankinsonCashPrice
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

            const sortedData = [...liveData].sort((a, b) => (b.netPrice ?? 0) - (a.netPrice ?? 0));
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
            console.log("Auto-refreshing market data...");
            fetchBuyers(false);
        }, 1_800_000); // 30 min auto-refresh
        return () => clearInterval(intervalId);
    }, [fetchBuyers]);

    const handleRefresh = () => fetchBuyers(true);

    const handleSelectBuyer = async (buyer: Buyer) => {
        setSelectedBuyer(buyer);
        try {
            const enriched = await enrichBuyerWithGoogleData(buyer);
            const freight = await calculateFreight(
                { lat: enriched.lat, lng: enriched.lng, state: enriched.state, city: enriched.city },
                enriched.name
            );
            const netPrice = (enriched.cashPrice || 0) - freight.ratePerBushel;
            const finalBuyer = {
                ...enriched,
                freightCost: parseFloat((-freight.ratePerBushel).toFixed(2)),
                netPrice: parseFloat(netPrice.toFixed(2))
            };
            setSelectedBuyer(prev => prev?.id === finalBuyer.id ? finalBuyer : prev);
            setBuyers(prev => prev.map(b => b.id === finalBuyer.id ? finalBuyer : b));
        } catch (err) {
            console.error("Failed to enrich buyer data", err);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-black relative overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 pt-16 sm:pt-20 px-4 pb-2 sm:pb-4 bg-black/80 backdrop-blur-sm z-20 border-b border-white/5">
                <div className="flex flex-row justify-between items-center gap-3 sm:gap-4 bg-zinc-900/90 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10 shadow-xl">
                    <div>
                        <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                            {selectedCrop === 'Yellow Corn' ? 'Yellow' : selectedCrop === 'White Corn' ? 'White' : selectedCrop} <span className="text-orange-500">Intel</span>
                        </h2>
                        <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm flex-wrap">
                            <span className="hidden sm:inline">Sorted by Net Price</span>
                            {oracle && (
                                <>
                                    <span className="hidden sm:inline text-zinc-600">•</span>
                                    <span className="text-corn-accent font-mono text-xs sm:text-sm">
                                        {oracle.contractMonth} @ ${oracle.futuresPrice.toFixed(2)}
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
                                    <span className={`flex items-center gap-1 font-mono text-xs ${fromCache ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                        <Clock size={10} />
                                        {fromCache ? `Cached · ${formatAge(cacheAge)}` : formatAge(cacheAge)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Hankinson Benchmark Badge */}
                    {oracle && oracle.hankinsonBasis !== 0 && (
                        <div className="hidden md:flex flex-col items-end bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Benchmark</span>
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
                        onClick={handleRefresh}
                        disabled={loading}
                        title="Force refresh all prices"
                        className="p-2 bg-white/5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Mobile Hankinson Banner */}
                {oracle && oracle.hankinsonBasis !== 0 && (
                    <div className="md:hidden mt-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2 flex justify-between items-center">
                        <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Benchmark</span>
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

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4 custom-scrollbar">
                {/* Top Quotes (compact for directory mode) */}
                <div className="flex-shrink-0">
                    {loading && buyers.length === 0 ? (
                        <div className="w-full h-[200px] bg-corn-card/50 rounded-xl animate-pulse" />
                    ) : buyers.length > 0 ? (
                        <LiveQuoteBoard buyers={buyers.slice(0, 10)} onSelect={handleSelectBuyer} />
                    ) : null}
                </div>

                {/* Buyer Directory Table (with built-in filters) */}
                <div className="flex-1 min-h-0">
                    <BuyerTable
                        buyers={buyers}
                        onSelect={handleSelectBuyer}
                        allBuyers={buyers}
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
