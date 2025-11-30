import React, { useState, useEffect } from 'react';
import { LiveQuoteBoard } from '../components/LiveQuoteBoard';
import { BuyerTable } from '../components/BuyerTable';
import { OpportunityDrawer } from '../components/OpportunityDrawer';
import { enrichBuyerWithGoogleData, fetchRealBuyersFromGoogle } from '../services/buyersService';
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

            // 2. Use Google Places API to get real buyers (The Body)
            const googleData = await fetchRealBuyersFromGoogle();

            if (googleData.length === 0) {
                setError("No buyers found. Verify API Key permissions (Places API enabled?) and billing.");
                setLoading(false);
                return;
            }

            // Show Google data immediately (with placeholder prices)
            setBuyers(googleData);

            // 3. Use Gemini API to enrich with market data (The Brain)
            try {
                // Pass the Oracle Truths to the enrichment engine
                const enrichedData = await geminiService.enrichBuyersWithMarketData(googleData, oracleData);

                // 4. Calculate Freight, Net Price & Benchmark Diff for each buyer
                const buyersWithFreight = await Promise.all(enrichedData.map(async (buyer) => {
                    const freight = await calculateFreight({ lat: buyer.lat, lng: buyer.lng }, buyer.name);
                    const netPrice = (buyer.cashPrice || 0) - freight.ratePerBushel;
                    return {
                        ...buyer,
                        freightCost: freight.ratePerBushel,
                        netPrice: parseFloat(netPrice.toFixed(2)),
                        // benchmarkDiff is already calculated by the service using Oracle data
                    };
                }));

                // Sort by Basis descending (Highest Bids First)
                const sortedData = buyersWithFreight.sort((a, b) => b.basis - a.basis);
                setBuyers(sortedData);
            } catch (aiError) {
                console.error("AI Enrichment failed, using raw Google data", aiError);
                // Fallback to sorting what we have (likely 0 basis)
                setBuyers(googleData);
            }

        } catch (err) {
            console.error(err);
            setError("Unable to refresh buyer data.");
        } finally {
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
        <div className="w-full h-full flex flex-col bg-black relative pt-48 px-4 pb-24 gap-6 overflow-y-auto overflow-x-hidden">
            {/* Header - Floating Dark Glass Bar */}
            <div className="absolute top-20 left-4 right-4 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Buyer <span className="text-orange-500">Intelligence</span></h2>
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <span>Real-time bids</span>
                        {oracle && (
                            <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-corn-accent font-mono">
                                    Market: {oracle.contractMonth} @ ${oracle.futuresPrice.toFixed(2)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <button
                    onClick={fetchBuyers}
                    disabled={loading}
                    className="p-2 bg-white/5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50 self-end sm:self-auto"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} />
                    <span>{error} Showing last known data.</span>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="flex-1 flex flex-col gap-6">
                <div className="h-[240px] flex-shrink-0">
                    {loading && buyers.length === 0 ? (
                        <div className="w-full h-full bg-corn-card/50 rounded-xl animate-pulse" />
                    ) : buyers.length > 0 ? (
                        <LiveQuoteBoard buyers={buyers} onSelect={handleSelectBuyer} />
                    ) : (
                        <div className="w-full h-full bg-corn-card/50 rounded-xl flex items-center justify-center text-slate-500">
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
