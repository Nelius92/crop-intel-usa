import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Sparkles, Loader2, Droplets } from 'lucide-react';
import { HeatmapPoint, Buyer, Transloader, CropType } from '../types';
import { BNSFOpportunity } from '../services/bnsfScraperService';
import { getCorridorName } from '../services/railConfidenceService';
import { calculateBuyerIntelScore, fetchBuyerExplanation } from '../services/buyerIntelService';
import { getDroughtForState, StateDrought, severityEmoji, severityLabel } from '../services/droughtService';
import { marketDataService } from '../services/marketDataService';
import { BuyerActionSection, BnsfOpportunityActionSection } from './opportunity-drawer/ActionSections';
import { MarketDataSection } from './opportunity-drawer/MarketDataSection';
import { CalculationBreakdown } from './opportunity-drawer/TrustSections';
import { DrawerItem, isBnsfOpportunity, isBuyer, isTransloader } from './opportunity-drawer/typeGuards';

interface OpportunityDrawerProps {
    item: HeatmapPoint | Buyer | Transloader | BNSFOpportunity | null;
    onClose: () => void;
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({ item, onClose }) => {
    const [showExplain, setShowExplain] = useState(false);
    const [showIntel, setShowIntel] = useState(false);
    const [intelExplanation, setIntelExplanation] = useState<string | null>(null);
    const [loadingExplanation, setLoadingExplanation] = useState(false);
    const [droughtInfo, setDroughtInfo] = useState<StateDrought | null>(null);

    // Reset intel state when switching between buyers
    useEffect(() => {
        setShowIntel(false);
        setIntelExplanation(null);
        setLoadingExplanation(false);
        setShowExplain(false);
        setDroughtInfo(null);

        // Fetch drought data for the buyer's state
        if (item && isBuyer(item) && item.state) {
            getDroughtForState(item.state)
                .then(data => setDroughtInfo(data))
                .catch(() => setDroughtInfo(null));
        }
    }, [item]);

    if (!item) return null;

    return (
        <AnimatePresence>
            {item && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-2 sm:px-6 py-20 sm:py-24"
                >
                    <div className="w-full max-w-lg bg-[#120202]/90 backdrop-blur-xl border border-white/10 shadow-neon-red rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-auto ring-1 ring-white/5 max-h-full flex flex-col">

                        {/* Header Section */}
                        <div className="relative p-4 sm:p-6 pb-2">
                            <button
                                onClick={onClose}
                                className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                                <X size={18} />
                            </button>

                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 pr-12">
                                {isBuyer(item) || isTransloader(item) || isBnsfOpportunity(item) ? item.name : 'Market Opportunity'}
                            </h2>
                            <p className="text-zinc-400 text-sm">
                                {isBuyer(item) || isTransloader(item) ? `${item.city}, ${item.state}` : isBnsfOpportunity(item) ? `${item.location.city}, ${item.location.state}` : (item.regionName || `Region: ${item.lat.toFixed(2)}, ${item.lng.toFixed(2)}`)}
                            </p>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6 custom-scrollbar">

                            <MarketDataSection item={item as DrawerItem} />

                            {/* ─── Drought Monitor: Supply Intelligence ─── */}
                            {isBuyer(item) && droughtInfo && (
                                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Droplets size={14} className="text-red-400" />
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                            Supply Intelligence — {droughtInfo.stateName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-lg">{severityEmoji(droughtInfo.severity)}</span>
                                        <div>
                                            <p className="text-sm font-semibold text-white">
                                                {severityLabel(droughtInfo.severity)}
                                            </p>
                                            <p className="text-[11px] text-zinc-400">
                                                Week of {droughtInfo.weekOf}
                                            </p>
                                        </div>
                                    </div>
                                    {droughtInfo.severity !== 'none' && (
                                        <>
                                            <div className="grid grid-cols-5 gap-1 mb-2">
                                                {[
                                                    { label: 'D0', value: droughtInfo.d0, color: 'bg-yellow-400/30 text-yellow-300' },
                                                    { label: 'D1', value: droughtInfo.d1, color: 'bg-amber-400/30 text-amber-300' },
                                                    { label: 'D2', value: droughtInfo.d2, color: 'bg-orange-400/30 text-orange-300' },
                                                    { label: 'D3', value: droughtInfo.d3, color: 'bg-red-500/30 text-red-300' },
                                                    { label: 'D4', value: droughtInfo.d4, color: 'bg-red-800/30 text-red-200' },
                                                ].map(d => (
                                                    <div key={d.label} className={`text-center rounded px-1 py-0.5 text-[10px] font-mono ${d.value > 0 ? d.color : 'bg-zinc-800/50 text-zinc-600'}`}>
                                                        <div className="font-bold">{d.label}</div>
                                                        <div>{d.value.toFixed(0)}%</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-zinc-400 italic">
                                                {droughtInfo.d2 > 20
                                                    ? '⚡ Local supply stressed — buyer may bid aggressively'
                                                    : droughtInfo.d1 > 25
                                                        ? '📊 Developing drought — monitor basis for tightening'
                                                        : '📋 Minor dryness — limited supply impact expected'}
                                            </p>
                                        </>
                                    )}
                                    {droughtInfo.severity === 'none' && (
                                        <p className="text-[11px] text-zinc-500">
                                            No drought conditions in {droughtInfo.stateName}. Local supply is healthy.
                                        </p>
                                    )}
                                    <p className="text-[9px] text-zinc-600 mt-1">
                                        Source: U.S. Drought Monitor (USDA/NOAA/UNL)
                                    </p>
                                </div>
                            )}

                            {/* ─── Trust Layer: Explain This Calculation ─── */}
                            {isBuyer(item) && item.provenance && (
                                <div>
                                    <button
                                        onClick={() => setShowExplain(!showExplain)}
                                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors group"
                                    >
                                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                            Explain This Calculation
                                        </span>
                                        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showExplain ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {showExplain && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <CalculationBreakdown buyer={item} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* ─── Rail Evidence Detail ─── */}
                            {isBuyer(item) && item.railEvidence && (
                                <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Rail Served Evidence</div>
                                    <div className="space-y-1.5 text-xs font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Distance to Track</span>
                                            <span className="text-zinc-300">{item.railEvidence.distanceToTrackMiles} mi</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Nearest Corridor</span>
                                            <span className="text-zinc-300">{getCorridorName(item.railEvidence.nearestCorridorId)}</span>
                                        </div>
                                        {item.railEvidence.nearestTransloadMiles && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Nearest Transload</span>
                                                <span className="text-zinc-300">{item.railEvidence.nearestTransloadMiles} mi</span>
                                            </div>
                                        )}
                                        {item.railEvidence.facilityTypeBonus && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Facility Bonus</span>
                                                <span className="text-green-400">+20 pts (rail-dependent type)</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-1 border-t border-white/5">
                                            <span className="text-zinc-400 font-semibold">Score</span>
                                            <span className={`font-bold ${item.railEvidence.score >= 70 ? 'text-cyan-400'
                                                : item.railEvidence.score >= 40 ? 'text-sky-400'
                                                    : item.railEvidence.score >= 15 ? 'text-amber-400'
                                                        : 'text-slate-500'
                                                }`}>{item.railEvidence.score}/100</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* ─── Why Contact This Buyer? ─── */}
                            {isBuyer(item) && (() => {
                                const crop = (item.cropType || 'Yellow Corn') as CropType;
                                const benchmark = marketDataService.getBenchmark(crop);
                                const intel = calculateBuyerIntelScore(item, crop, benchmark.cashPrice);

                                const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
                                    green: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
                                    blue: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
                                    amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
                                    gray: { bg: 'bg-slate-500/15', text: 'text-slate-500', border: 'border-slate-500/30' },
                                };
                                const bc = BADGE_COLORS[intel.color] || BADGE_COLORS.gray;

                                const handleFetchExplanation = async () => {
                                    if (intelExplanation) { setShowIntel(!showIntel); return; }
                                    setShowIntel(true);
                                    setLoadingExplanation(true);
                                    try {
                                        const explanation = await fetchBuyerExplanation(item, crop, benchmark.cashPrice);
                                        setIntelExplanation(explanation);
                                    } catch {
                                        setIntelExplanation(`${item.name} is a ${item.type} facility in ${item.city}, ${item.state}. Contact the grain desk to discuss ${crop} delivery.`);
                                    } finally {
                                        setLoadingExplanation(false);
                                    }
                                };

                                return (
                                    <div>
                                        <button
                                            onClick={handleFetchExplanation}
                                            className="w-full flex items-center justify-between py-3 px-3 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={14} className={bc.text} />
                                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                                    Why Contact This Buyer?
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${bc.bg} ${bc.text} ${bc.border}`}>
                                                    {intel.emoji} {intel.score}/100
                                                </span>
                                            </div>
                                            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showIntel ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showIntel && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pt-3 space-y-3">
                                                        {/* Score Breakdown Bars */}
                                                        <div className="space-y-2">
                                                            {intel.signals.map((signal) => (
                                                                <div key={signal.name} className="flex items-center gap-2">
                                                                    <div className="w-24 text-[10px] text-zinc-500 font-medium truncate">{signal.name}</div>
                                                                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${signal.points >= signal.maxPoints * 0.8 ? 'bg-emerald-500' : signal.points >= signal.maxPoints * 0.4 ? 'bg-sky-500' : signal.points > 0 ? 'bg-amber-500' : 'bg-zinc-700'}`}
                                                                            style={{ width: `${(signal.points / signal.maxPoints) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <div className="w-10 text-right text-[10px] font-mono text-zinc-400">{signal.points}/{signal.maxPoints}</div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Gemini Explanation */}
                                                        <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                                                            {loadingExplanation ? (
                                                                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                    Analyzing buyer profile...
                                                                </div>
                                                            ) : intelExplanation ? (
                                                                <p className="text-xs text-zinc-300 leading-relaxed">{intelExplanation}</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })()}

                            {/* Buyer Actions (Only for Buyers) */}
                            {isBuyer(item) && (
                                <BuyerActionSection buyer={item} />
                            )}

                            {/* BNSF Opportunity Actions */}
                            {isBnsfOpportunity(item) && (
                                <BnsfOpportunityActionSection item={item} />
                            )}

                            {/* Transloader About Section */}
                            {isTransloader(item) && (
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Facility Info</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        {item.name} is a premier transloading facility in {item.city}, {item.state}.
                                        It is served by {item.railroad?.join(' and ') || 'rail'} and specializes in handling {item.commodities?.join(', ') || 'various commodities'}.
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
