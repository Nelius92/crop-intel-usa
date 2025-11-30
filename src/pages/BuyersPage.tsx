import React, { useState, useEffect } from 'react';
import { BuyerChart } from '../components/BuyerChart';
import { BuyerTable } from '../components/BuyerTable';
import { MarketIntelPanel } from '../components/MarketIntelPanel';
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

    const fetchBuyers = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Use Google Places API to get real buyers (The Body)
            const googleData = await fetchRealBuyersFromGoogle();

            if (googleData.length === 0) {
                setError("No buyers found. Verify API Key permissions (Places API enabled?) and billing.");
                setLoading(false);
                return;
            }

            // Show Google data immediately (with placeholder prices)
            setBuyers(googleData);

            // 2. Use Gemini API to enrich with market data (The Brain)
            // We do this without blocking the UI, but we show a loading state if we want, 
            // or just let the prices "pop" in. Let's keep loading true for a moment or use a separate state.
            // For "Hand-in-Hand" feel, let's wait for the brain to finish so the user sees the complete picture.

            try {
                const enrichedData = await geminiService.enrichBuyersWithMarketData(googleData);

                // 3. Calculate Freight & Net Price for each buyer
                const buyersWithFreight = await Promise.all(enrichedData.map(async (buyer) => {
                    const freight = await calculateFreight({ lat: buyer.lat, lng: buyer.lng }, buyer.name);
                    const netPrice = (buyer.cashPrice || 0) - freight.ratePerBushel;
                    return {
                        ...buyer,
                        freightCost: freight.ratePerBushel,
                        netPrice: parseFloat(netPrice.toFixed(2))
                    };
                }));

                // Sort by Net Price descending (Best Deal for Seller)
                const sortedData = buyersWithFreight.sort((a, b) => (b.netPrice || 0) - (a.netPrice || 0));
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
        <div className="w-full min-h-screen flex flex-col bg-black relative pt-48 px-4 pb-24 gap-6 overflow-y-auto overflow-x-hidden">
            {/* Header - Floating Dark Glass Bar */}
            <div className="absolute top-20 left-4 right-4 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Buyer <span className="text-orange-500">Intelligence</span></h2>
                    <p className="text-zinc-400 text-sm">Real-time bids and logistics analysis</p>
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
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Charts and Table (2/3) */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-[600px]">
                    <div className="h-[200px] flex-shrink-0">
                        {loading && buyers.length === 0 ? (
                            <div className="w-full h-full bg-corn-card/50 rounded-xl animate-pulse" />
                        ) : buyers.length > 0 ? (
                            <BuyerChart buyers={buyers} onSelect={handleSelectBuyer} />
                        ) : (
                            <div className="w-full h-full bg-corn-card/50 rounded-xl flex items-center justify-center text-slate-500">
                                No buyer data available.
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-h-[400px]">
                        <BuyerTable buyers={buyers} onSelect={handleSelectBuyer} />
                    </div>
                </div>

                {/* Right Column: Market Intel (1/3) */}
                <div className="lg:col-span-1 h-[300px] lg:h-auto">
                    <MarketIntelPanel buyers={buyers} />
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
