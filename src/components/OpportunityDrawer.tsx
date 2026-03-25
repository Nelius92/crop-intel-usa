import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Navigation, Share2, Train, Globe, ChevronDown, User, Clock, Sparkles, Loader2 } from 'lucide-react';
import { HeatmapPoint, Buyer, Transloader, isDataStale, CropType } from '../types';
import { BNSFOpportunity } from '../services/bnsfScraperService';
import { SourceLabel, formatTimeAgo } from './TrustBadge';
import { getCorridorName } from '../services/railConfidenceService';
import { marketDataService } from '../services/marketDataService';
import { calculateBuyerIntelScore, fetchBuyerExplanation } from '../services/buyerIntelService';

interface OpportunityDrawerProps {
    item: HeatmapPoint | Buyer | Transloader | BNSFOpportunity | null;
    onClose: () => void;
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({ item, onClose }) => {
    const isBuyer = (item: any): item is Buyer => 'type' in item && ['elevator', 'processor', 'feedlot', 'shuttle', 'export', 'river', 'ethanol'].includes(item.type);
    const isTransloader = (item: any): item is Transloader => 'type' in item && item.type === 'transload';
    const isBnsfOpportunity = (item: any): item is BNSFOpportunity => item && 'livePriceBase' in item;
    const [showExplain, setShowExplain] = useState(false);
    const [showIntel, setShowIntel] = useState(false);
    const [intelExplanation, setIntelExplanation] = useState<string | null>(null);
    const [loadingExplanation, setLoadingExplanation] = useState(false);

    if (!item) return null;

    return (
        <AnimatePresence>
            {item && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none px-2 sm:px-4 pb-2 sm:pb-4"
                >
                    <div className="w-full max-w-lg bg-[#120202]/90 backdrop-blur-xl border border-white/10 shadow-neon-red rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-auto ring-1 ring-white/5 max-h-[85vh] flex flex-col">

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

                            {/* Live Market Data Section */}
                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                                    {isTransloader(item) ? 'Facility Details' : 'Live Market Data'}
                                </h3>
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    {isBuyer(item) ? (
                                        <>
                                            <DataCard label="Net Price" value={`$${item.netPrice?.toFixed(2) || '-'}`} color="text-red-400" highlight />
                                            <DataCard label="Cash Bid" value={item.cashPrice !== undefined ? `$${item.cashPrice.toFixed(2)}` : 'CALL'} />
                                            {item.basis !== undefined ? (
                                                <DataCard label="Basis" value={`${item.basis > 0 ? '+' : ''}${item.basis.toFixed(2)}`} color={item.basis >= 0 ? 'text-green-400' : 'text-red-400'} />
                                            ) : (
                                                <DataCard label="Basis" value="NO BID" />
                                            )}
                                            <DataCard label={`Freight (${item.freightMode === 'rail' ? '🚂 Rail' : '🚛 Truck'})`} value={`-$${Math.abs(item.freightCost ?? 0).toFixed(2)}`} color="text-red-400" />
                                            {(() => {
                                                const level = item.railServedConfidence || (item.railAccessible ? 'likely' : 'unverified');
                                                const railLabel = level === 'confirmed' ? 'BNSF Confirmed'
                                                    : level === 'likely' ? 'Likely Rail Access'
                                                        : level === 'possible' ? 'Possible Rail Access'
                                                            : 'Unverified Rail Access';
                                                const railColor = level === 'confirmed' ? 'text-cyan-400'
                                                    : level === 'likely' ? 'text-sky-400'
                                                        : level === 'possible' ? 'text-amber-400'
                                                            : 'text-slate-500';
                                                return (
                                                    <DataCard
                                                        label="Rail Access"
                                                        value={railLabel}
                                                        color={railColor}
                                                        icon={<Train size={14} />}
                                                    />
                                                );
                                            })()}
                                            {item.benchmarkDiff !== undefined ? (
                                                <DataCard label="vs Benchmark" value={isNaN(item.benchmarkDiff) ? 'N/A' : `${item.benchmarkDiff >= 0 ? '+' : ''}${item.benchmarkDiff.toFixed(2)}`} color={isNaN(item.benchmarkDiff) ? 'text-slate-500' : item.benchmarkDiff >= 0 ? 'text-green-400' : 'text-red-400'} />
                                            ) : (
                                                <DataCard label="Region" value={item.region} />
                                            )}
                                        </>
                                    ) : isTransloader(item) ? (
                                        <>
                                            <DataCard label="Railroad" value={item.railroad?.join(', ') || 'N/A'} icon={<Train size={14} />} highlight />
                                            <DataCard label="Commodities" value={item.commodities?.[0] || 'General'} />
                                            <DataCard label="State" value={item.state || 'N/A'} />
                                            <DataCard label="Type" value="Transload" />
                                        </>
                                    ) : isBnsfOpportunity(item) ? (
                                        <>
                                            <DataCard label="Live Rail Bid" value={`$${(item as any).currentPrice?.toFixed(2) || item.livePriceBase.toFixed(2)}`} color="text-red-400" highlight />
                                            <DataCard label="Est. Freight" value={`-$${item.freightRateOverride.toFixed(2)}`} color="text-red-400" icon={<Train size={14} />} />
                                            <DataCard label="Facility Type" value={(item.category || '').replace('_', ' ').toUpperCase()} />
                                            <DataCard label="Capacity" value={item.capacity || 'Unknown'} />
                                            {item.managerName && (
                                                <DataCard label="Manager" value={item.managerName} icon={<User size={14} />} />
                                            )}
                                            {item.operatingHours && (
                                                <DataCard label="Hours" value={item.operatingHours} icon={<Clock size={14} />} />
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <DataCard label="Price" value={`$${item.cornPrice?.toFixed(2) || '0.00'}`} highlight />
                                            <DataCard label="Basis" value={`${(item.basis || 0) > 0 ? '+' : ''}${(item.basis || 0).toFixed(2)}`} />
                                            <DataCard label="24h Change" value={`${(item.change24h || 0) > 0 ? '+' : ''}${item.change24h || 0}%`} color={(item.change24h || 0) > 0 ? 'text-green-400' : 'text-red-400'} />
                                            <DataCard label="Status" value={item.isOpportunity ? 'Hot' : 'Normal'} color={item.isOpportunity ? 'text-white' : 'text-zinc-400'} />
                                        </>
                                    )}
                                </div>

                                {/* ─── Trust Layer: Data Freshness ─── */}
                                {isBuyer(item) && item.provenance && (
                                    <DataFreshnessBar provenance={item.provenance} />
                                )}
                            </div>

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
                                <>
                                    <div className="h-px bg-zinc-800" />
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                        <ActionButton
                                            icon={<Navigation size={20} />}
                                            label="Directions"
                                            active
                                            onClick={() => {
                                                const query = encodeURIComponent(`${item.fullAddress || item.name + ' ' + item.city + ' ' + item.state}`);
                                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                            }}
                                        />
                                        <ActionButton
                                            icon={<Phone size={20} />}
                                            label="Call"
                                            onClick={() => window.location.href = `tel:${item.contactPhone}`}
                                            disabled={!item.contactPhone}
                                        />
                                        <ActionButton
                                            icon={<Globe size={20} />}
                                            label="Website"
                                            onClick={() => {
                                                const url = item.website?.startsWith('http') ? item.website : `https://${item.website}`;
                                                window.open(url, '_blank');
                                            }}
                                            disabled={!item.website}
                                        />
                                        <ActionButton
                                            icon={<Share2 size={20} />}
                                            label="Share"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${item.name}: ${item.cashPrice !== undefined ? '$' + item.cashPrice.toFixed(2) : 'CALL'} Cash`);
                                                alert('Bid info copied to clipboard!');
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* BNSF Opportunity Actions */}
                            {isBnsfOpportunity(item) && (
                                <>
                                    <div className="h-px bg-zinc-800" />
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                        <ActionButton
                                            icon={<Navigation size={20} />}
                                            label="Directions"
                                            active
                                            onClick={() => {
                                                const query = encodeURIComponent(`${item.name} ${item.location.city} ${item.location.state}`);
                                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                            }}
                                        />
                                        <ActionButton
                                            icon={<Phone size={20} />}
                                            label="Call"
                                            onClick={() => window.location.href = `tel:${item.contactInfo}`}
                                            disabled={!item.contactInfo}
                                        />
                                        <ActionButton
                                            icon={<Globe size={20} />}
                                            label="Website"
                                            onClick={() => {
                                                const url = item.website?.startsWith('http') ? item.website : `https://${item.website}`;
                                                window.open(url, '_blank');
                                            }}
                                            disabled={!item.website}
                                        />
                                        <ActionButton
                                            icon={<Share2 size={20} />}
                                            label="Share"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${item.name} (${item.category}): ${item.contactInfo}`);
                                                alert('Opportunity info copied to clipboard!');
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-500 font-mono">
                                        Source: BNSF Firecrawl Scrape / Verified Target
                                    </div>
                                </>
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

// ─── Calculation Breakdown (Trust Layer core) ─────────────────────
const CalculationBreakdown: React.FC<{ buyer: Buyer }> = ({ buyer }) => {
    const p = buyer.provenance!;
    const benchmarkName = marketDataService.getBenchmarkName(buyer.cropType);
    const benchmark = marketDataService.getBenchmark(buyer.cropType);
    // Benchmark net = buyer net - benchmarkDiff (back-calculated)
    const benchmarkNet = ((buyer.netPrice ?? 0) - (buyer.benchmarkDiff ?? 0));

    return (
        <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/5 space-y-2.5 text-sm font-mono">
            {/* Origin */}
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans font-bold mb-2">
                Origin: Campbell, MN (BNSF Wahpeton Sub)
            </div>

            {/* Futures */}
            <CalcRow
                label="Futures"
                value={`$${p.futures.value.toFixed(2)}`}
                ds={p.futures}
                indent={false}
            />
            {/* Basis */}
            <CalcRow
                label="+ Basis"
                value={`${p.basis.value >= 0 ? '+' : ''}$${p.basis.value.toFixed(2)}`}
                ds={p.basis}
                indent={false}
            />
            {/* Divider */}
            <div className="border-t border-dashed border-zinc-700 my-1" />
            {/* Cash */}
            <div className="flex justify-between items-center text-zinc-200">
                <span>= Cash</span>
                <span className="font-bold">{buyer.cashPrice !== undefined ? `$${buyer.cashPrice.toFixed(2)}` : '--'}</span>
            </div>
            {/* Freight */}
            <CalcRow
                label="– Freight"
                value={`-$${p.freight.value.toFixed(2)}`}
                ds={p.freight}
                indent={false}
                color="text-red-400"
            />
            {/* Fees */}
            <CalcRow
                label="– Fees"
                value={`$${p.fees.value.toFixed(2)}`}
                ds={p.fees}
                indent={false}
            />
            {/* Divider */}
            <div className="border-t border-dashed border-zinc-700 my-1" />
            {/* Net */}
            <div className="flex justify-between items-center">
                <span className="text-zinc-200 font-bold">= Net Price</span>
                <span className="text-red-400 font-bold text-base">
                    ${(p.futures.value + p.basis.value - p.freight.value - p.fees.value).toFixed(2)}
                </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-sans">
                ← What you receive at Campbell, MN
            </div>

            {/* Benchmark */}
            {buyer.benchmarkDiff !== undefined && (
                <div className="mt-3 pt-2.5 border-t border-zinc-800">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-sans">vs {benchmarkName} Benchmark</span>
                        <span className={`font-bold ${(p.futures.value + p.basis.value - p.freight.value - p.fees.value - benchmarkNet) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {((p.futures.value + p.basis.value - p.freight.value - p.fees.value) - benchmarkNet) >= 0 ? '+' : ''}
                            {((p.futures.value + p.basis.value - p.freight.value - p.fees.value) - benchmarkNet).toFixed(2)}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-600 font-sans mt-1">
                        {benchmarkName} Net = Cash − ${benchmark.freight.toFixed(2)} freight = ${benchmarkNet.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-600 font-sans">
                        Delta = ${(p.futures.value + p.basis.value - p.freight.value - p.fees.value).toFixed(2)} − ${benchmarkNet.toFixed(2)} = {((p.futures.value + p.basis.value - p.freight.value - p.fees.value) - benchmarkNet).toFixed(2)}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Calculation Row with Source Label ─────────────────────────────
const CalcRow: React.FC<{
    label: string;
    value: string;
    ds: import('../types').DataSource;
    indent?: boolean;
    color?: string;
}> = ({ label, value, ds, color = 'text-zinc-300' }) => (
    <div className="space-y-0.5">
        <div className="flex justify-between items-center">
            <span className={color}>{label}</span>
            <span className={`${color} font-semibold`}>{value}</span>
        </div>
        <div className="flex justify-end">
            <SourceLabel ds={ds} />
        </div>
    </div>
);

// ─── Data Freshness Bar ───────────────────────────────────────────
const DataFreshnessBar: React.FC<{ provenance: import('../types').PriceProvenance }> = ({ provenance }) => {
    const mostStale = [provenance.futures, provenance.basis, provenance.freight]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    const stale = isDataStale(mostStale);

    return (
        <div className={`mt-3 flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg border ${stale
            ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
            : 'bg-green-500/5 border-green-500/20 text-green-500'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <span>
                {stale ? '⚠ Data may be stale' : 'Data fresh'} · Basis updated {formatTimeAgo(provenance.basis.timestamp)}
                {' '}· Freight: {provenance.freight.source.split('·')[0].trim()}
            </span>
        </div>
    );
};

const ActionButton = ({ icon, label, active = false, onClick, disabled = false }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center gap-1.5 sm:gap-1 min-w-[70px] sm:min-w-[60px] group ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
        <div className={`p-3 sm:p-3 rounded-full transition-all duration-300 ${active
            ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110'
            : disabled
                ? 'bg-zinc-800 text-zinc-600'
                : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'
            }`}>
            {icon}
        </div>
        <span className={`text-[10px] font-medium tracking-wide text-center ${active ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {label}
        </span>
    </button>
);

const DataCard = ({ label, value, icon, color = 'text-white', highlight = false }: any) => (
    <div className={`p-3 rounded-xl border flex flex-col justify-center ${highlight ? 'bg-zinc-800 border-red-500/30' : 'bg-zinc-800/50 border-zinc-800'}`}>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-base font-bold ${color} flex items-center gap-1.5`}>
            {icon}
            {value}
        </div>
    </div>
);

