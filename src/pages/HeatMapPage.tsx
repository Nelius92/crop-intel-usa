import React, { useEffect, useState } from 'react';
import { CornMap } from '../components/CornMap';
import { MapControls } from '../components/MapControls';
import { fetchTransloaders } from '../services/transloaderService';
import { CropType, HeatmapPoint, Buyer, Transloader } from '../types';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchRealBuyersFromGoogle } from '../services/buyersService';
import { fetchMorningRecommendationBuyers } from '../services/morningRecommendationsService';

const PRIMARY_CORRIDOR_STATES = new Set([
    'ND', 'MN', 'SD', 'IA', 'NE', 'KS',
    'TX', 'WA', 'OR', 'CA', 'OK', 'MO'
]);

function rankTopStatesByCashBid(buyers: Buyer[]): string[] {
    const byState = new Map<string, Buyer[]>();
    for (const buyer of buyers) {
        if (!byState.has(buyer.state)) byState.set(buyer.state, []);
        byState.get(buyer.state)!.push(buyer);
    }

    const rankedStates = Array.from(byState.entries())
        .map(([state, stateBuyers]) => {
            const sortedByCash = [...stateBuyers].sort((a, b) => (b.cashPrice || 0) - (a.cashPrice || 0));
            const topCashSlice = sortedByCash.slice(0, 3);
            const avgTopCash = topCashSlice.reduce((sum, b) => sum + (b.cashPrice || 0), 0) / Math.max(topCashSlice.length, 1);
            const avgTopNet = topCashSlice.reduce((sum, b) => sum + (b.netPrice || 0), 0) / Math.max(topCashSlice.length, 1);
            const avgRailConfidence = stateBuyers.reduce((sum, b) => sum + (b.railConfidence || 0), 0) / Math.max(stateBuyers.length, 1);

            return {
                state,
                avgTopCash,
                avgTopNet,
                avgRailConfidence,
                count: stateBuyers.length
            };
        })
        .sort((a, b) =>
            (b.avgTopCash - a.avgTopCash) ||
            (b.avgTopNet - a.avgTopNet) ||
            (b.avgRailConfidence - a.avgRailConfidence) ||
            (b.count - a.count)
        );

    return rankedStates.slice(0, 3).map((entry) => entry.state);
}

/**
 * Build heatmap points from buyer data.
 * Thresholds are crop-aware so opportunity dots light up correctly for all commodities.
 */
function buildHeatmapFromBuyers(buyers: Buyer[], crop: CropType = 'Yellow Corn'): HeatmapPoint[] {
    // Crop-aware thresholds for opportunity classification
    const thresholds: Record<string, { netPrice: number; cashPrice: number }> = {
        'Yellow Corn':    { netPrice: 4.75, cashPrice: 5.0 },
        'Soybeans':       { netPrice: 10.50, cashPrice: 11.0 },
        'Hard Red Spring Wheat': { netPrice: 5.50, cashPrice: 6.0 },
        'Sunflowers':     { netPrice: 20.0, cashPrice: 22.0 },
        'Durum Wheat':    { netPrice: 7.0, cashPrice: 7.5 },
    };
    const t = thresholds[crop] || thresholds['Yellow Corn'];

    return buyers
        .filter((buyer) => Number.isFinite(buyer.lat) && Number.isFinite(buyer.lng))
        .sort((a, b) => (b.cashPrice || 0) - (a.cashPrice || 0))
        .slice(0, 80)
        .map((buyer) => ({
            id: `buyer-heat-${buyer.id}`,
            lat: buyer.lat,
            lng: buyer.lng,
            cornPrice: Number((buyer.cashPrice || 0).toFixed(2)),
            basis: Number((buyer.basis || 0).toFixed(2)),
            change24h: 0,
            isOpportunity:
                (buyer.netPrice || 0) >= t.netPrice ||
                (buyer.cashPrice || 0) >= t.cashPrice ||
                (buyer.railConfidence || 0) >= 70,
            regionName: `${buyer.city}, ${buyer.state}`,
            marketLabel: `${buyer.name} · ${buyer.type} · ${buyer.railConfidence || 0}% rail`,
            buyerId: buyer.id   // Store ID for click-to-buyer resolution
        }));
}

function selectBnsfPriorityBuyers(allBuyers: Buyer[]): Buyer[] {
    const corridorBuyers = allBuyers.filter((buyer) => PRIMARY_CORRIDOR_STATES.has(buyer.state));
    const railCandidates = corridorBuyers.filter((buyer) => (buyer.railConfidence || 0) >= 40 || buyer.railAccessible);
    const strongBnsf = railCandidates.filter((buyer) => (buyer.railConfidence || 0) >= 70);
    return strongBnsf.length > 0 ? strongBnsf : railCandidates;
}

function sortBestBnsfBuyers(buyers: Buyer[]): Buyer[] {
    return [...buyers].sort((a, b) =>
        ((b.netPrice || 0) - (a.netPrice || 0)) ||
        ((b.cashPrice || 0) - (a.cashPrice || 0)) ||
        ((b.railConfidence || 0) - (a.railConfidence || 0)) ||
        ((b.basis ?? 0) - (a.basis ?? 0))
    );
}

interface HeatMapPageProps {
    selectedCrop: CropType;
    isVisible?: boolean;
}

export const HeatMapPage: React.FC<HeatMapPageProps> = ({ selectedCrop, isVisible = true }) => {
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [transloaders, setTransloaders] = useState<Transloader[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [topStates, setTopStates] = useState<string[]>([]);

    // Map Layer Toggles — persisted to localStorage
    const [showHeatmap, setShowHeatmap] = useState(() =>
        localStorage.getItem('ci_layer_heatmap') !== 'false'
    );
    const [showRail, setShowRail] = useState(() =>
        localStorage.getItem('ci_layer_rail') !== 'false'
    );
    const [showBnsfOpportunities, setShowBnsfOpportunities] = useState(() =>
        localStorage.getItem('ci_layer_bnsf') !== 'false'
    );
    const [showTransloaders, setShowTransloaders] = useState(() =>
        localStorage.getItem('ci_layer_transloaders') !== 'false'
    );

    // Persist layer toggles whenever they change
    useEffect(() => {
        localStorage.setItem('ci_layer_heatmap', String(showHeatmap));
        localStorage.setItem('ci_layer_rail', String(showRail));
        localStorage.setItem('ci_layer_bnsf', String(showBnsfOpportunities));
        localStorage.setItem('ci_layer_transloaders', String(showTransloaders));
    }, [showHeatmap, showRail, showBnsfOpportunities, showTransloaders]);

    const fetchData = async (forceRefresh: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            // 1. Load static transloader network reference
            const transloaderData = await fetchTransloaders();
            setTransloaders(transloaderData);

            // 2. Prefer the persisted morning call list (Python ranker + optional web/PDF scraping).
            // If unavailable, fall back to live USDA/BNSF deterministic ranking in the browser.
            const morningRecommendations = await fetchMorningRecommendationBuyers(selectedCrop);
            if (morningRecommendations && morningRecommendations.buyers.length > 0) {
                setTopStates(morningRecommendations.topStates);
                setBuyers(sortBestBnsfBuyers(morningRecommendations.buyers).slice(0, 30));
                setHeatmapData(buildHeatmapFromBuyers(morningRecommendations.buyers, selectedCrop));
                setLastUpdated(new Date(morningRecommendations.runEndedAt ?? morningRecommendations.runStartedAt));
                return;
            }

            // 3. USDA-first + BNSF refinement fallback:
            // `fetchRealBuyersFromGoogle` computes cash/net pricing using futures + USDA regional basis + freight.
            const pricedBuyers = await fetchRealBuyersFromGoogle(selectedCrop, undefined, forceRefresh);

            const bnsfPriorityBuyers = selectBnsfPriorityBuyers(pricedBuyers);
            const rankingPool = bnsfPriorityBuyers.length > 0 ? bnsfPriorityBuyers : pricedBuyers;
            const rankedStates = rankTopStatesByCashBid(rankingPool);
            const refinedTopStateBuyers = sortBestBnsfBuyers(
                (bnsfPriorityBuyers.length > 0 ? bnsfPriorityBuyers : pricedBuyers)
                    .filter((buyer) => rankedStates.includes(buyer.state))
            );

            setTopStates(rankedStates);
            setBuyers(refinedTopStateBuyers.slice(0, 30));
            setHeatmapData(buildHeatmapFromBuyers(rankingPool, selectedCrop));

            setLastUpdated(new Date());

        } catch (err) {
            console.error('USDA/BNSF heatmap fetch failed:', err);
            setError("USDA/BNSF market load failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 30 minutes (1800000 ms)
        const interval = setInterval(fetchData, 1800000);
        return () => clearInterval(interval);
    }, [selectedCrop]);

    return (
        <div className="w-full h-full relative">
            <CornMap
                showHeatmap={showHeatmap}
                showBuyers={true}
                showRail={showRail}
                showBnsfOpportunities={showBnsfOpportunities}
                showTransloaders={showTransloaders}
                view="usa"
                theme="green-glow"
                heatmapData={heatmapData}
                buyers={buyers}
                transloaders={transloaders}
                hoveredRegionId={null}
                topStates={topStates}
                isVisible={isVisible}
            />

            {/* Right Side Stack: Map Controls */}
            <div className="absolute top-16 right-4 sm:top-20 sm:right-6 z-20 pointer-events-none flex flex-col items-end gap-4 w-[calc(100vw-32px)] sm:w-auto">
                <MapControls
                    showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap}
                    showRail={showRail} setShowRail={setShowRail}
                    showBnsfOpportunities={showBnsfOpportunities} setShowBnsfOpportunities={setShowBnsfOpportunities}
                    showTransloaders={showTransloaders} setShowTransloaders={setShowTransloaders}
                />
            </div>

            {/* Overlay Elements */}
            <div className="absolute top-16 sm:top-20 left-4 sm:left-6 pointer-events-none z-10">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                    National <span className="text-green-400">Price Heatmap</span>
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm drop-shadow-md max-w-md mt-1">
                    USDA-first cash bid ranking, then top 3 BNSF corridor states and best rail-served buyers.
                </p>
                {lastUpdated && (
                    <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
                        Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50">
                    <AlertTriangle size={16} />
                    <span>{error} Showing last known data.</span>
                </div>
            )}

            {/* Refresh Button */}
            <button
                onClick={() => fetchData(true)}
                disabled={loading}
                className="absolute top-16 sm:top-20 right-4 sm:right-6 lg:right-96 lg:mr-4 p-2.5 bg-[#120202]/60 backdrop-blur-xl rounded-full border border-white/10 text-corn-accent shadow-glass hover:shadow-glow hover:bg-corn-accent/10 transition-all active:scale-95 disabled:opacity-50 pointer-events-auto z-20"
                title="Refresh Live Data"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="hidden">
                {/* MarketIntelPanel moved to right flex stack */}
            </div>
        </div>
    );
};
