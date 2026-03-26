import React, { useState, useMemo } from 'react';
import { Buyer, CropType, RailConfidenceLevel } from '../types';
import { Train, Filter, X, ShieldCheck, Search, Sparkles, AlertTriangle, CircleDot } from 'lucide-react';
import { calculateBuyerIntelScore } from '../services/buyerIntelService';

const RAIL_BADGE: Record<RailConfidenceLevel, { label: string; color: string }> = {
    confirmed: { label: 'BNSF ✓', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    likely: { label: 'Likely', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    possible: { label: 'Possible', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    unverified: { label: 'Unverified', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' }
};

const RailBadge: React.FC<{ buyer: Buyer }> = ({ buyer }) => {
    const level = buyer.railServedConfidence || (buyer.railAccessible ? 'likely' : 'unverified');
    const cfg = RAIL_BADGE[level];
    const evidence = buyer.railEvidence;
    const tooltip = evidence
        ? `Score: ${evidence.score}/100 · ${evidence.distanceToTrackMiles}mi to track${evidence.nearestTransloadMiles ? ` · Transload ${evidence.nearestTransloadMiles}mi` : ''}`
        : 'No evidence';
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.color}`}
            title={tooltip}>
            <Train size={10} />
            {cfg.label}
        </span>
    );
};

const INTEL_BADGE_STYLES: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    gray: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
};

const BUYER_STATUS_BADGE: Record<string, { label: string; color: string; icon: 'check' | 'dot' | 'warn' }> = {
    confirmed_buyer: { label: 'CONFIRMED', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: 'check' },
    likely_buyer:    { label: 'LIKELY', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', icon: 'dot' },
    needs_verification: { label: 'UNCONFIRMED', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: 'warn' },
    suspect:         { label: 'SUSPECT', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: 'warn' },
};

const StatusBadge: React.FC<{ buyer: Buyer }> = ({ buyer }) => {
    const status = buyer.buyerStatus || 'likely_buyer';
    const cfg = BUYER_STATUS_BADGE[status] || BUYER_STATUS_BADGE.likely_buyer;
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${cfg.color}`}
            title={buyer.statusReason || status}>
            {cfg.icon === 'check' ? <ShieldCheck size={9} /> : cfg.icon === 'warn' ? <AlertTriangle size={9} /> : <CircleDot size={9} />}
            {cfg.label}
        </span>
    );
};

const PriceSourceBadge: React.FC<{ buyer: Buyer }> = ({ buyer }) => {
    // Determine price source from provenance confidence
    let source = buyer.priceSource || 'usda_estimate';
    if (!buyer.priceSource && buyer.provenance) {
        const confidence = buyer.provenance.basis.confidence;
        if (confidence === 'verified') source = 'live_bid';
        else if (confidence === 'estimated') source = 'usda_estimate';
        else source = 'default';
    }
    const config: Record<string, { label: string; color: string }> = {
        live_bid:     { label: '● LIVE', color: 'text-emerald-400' },
        usda_estimate:{ label: '◐ USDA EST', color: 'text-amber-400' },
        stale:        { label: '○ STALE', color: 'text-red-400' },
        default:      { label: '○ DEFAULT', color: 'text-slate-500' },
    };
    const cfg = config[source] || config.usda_estimate;
    return (
        <span className={`text-[9px] font-mono font-bold ${cfg.color} opacity-70`} 
            title={`Price is ${source === 'live_bid' ? 'a real scraped bid' : source === 'usda_estimate' ? 'estimated from USDA state average' : source === 'stale' ? 'older than 7 days' : 'a fallback default'}`}>
            {cfg.label}
        </span>
    );
};

interface BuyerTableProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
    allBuyers?: Buyer[];
    selectedCrop?: CropType;
    benchmarkPrice?: number;
}

export const BuyerTable: React.FC<BuyerTableProps> = ({ buyers, onSelect, allBuyers, selectedCrop = 'Yellow Corn', benchmarkPrice }) => {
    const [filterType, setFilterType] = useState<string>('');
    const [filterState, setFilterState] = useState<string>('');
    const [bnsfOnly, setBnsfOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Page size for virtual scrolling
    const PAGE_SIZE = 50;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Extract unique values from allBuyers or buyers
    const source = allBuyers || buyers;
    const uniqueStates = useMemo(() => [...new Set(source.map(b => b.state))].sort(), [source]);
    const uniqueTypes = useMemo(() => [...new Set(source.map(b => b.type))].sort(), [source]);

    // Apply client-side filters
    const filtered = useMemo(() => {
        // Always filter out suspect/non-buyers
        let result = buyers.filter(b => b.buyerStatus !== 'suspect');
        if (filterType) result = result.filter(b => b.type === filterType);
        if (filterState) result = result.filter(b => b.state === filterState);
        if (bnsfOnly) result = result.filter(b => (b.railConfidence ?? 0) >= 70);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(b =>
                b.name.toLowerCase().includes(q) ||
                b.city.toLowerCase().includes(q) ||
                b.region?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [buyers, filterType, filterState, bnsfOnly, searchQuery]);

    // Calculate intel scores for all filtered buyers
    const scoredBuyers = useMemo(() => {
        return filtered.map(buyer => ({
            buyer,
            intel: calculateBuyerIntelScore(buyer, selectedCrop, benchmarkPrice),
        }));
    }, [filtered, selectedCrop, benchmarkPrice]);

    // Sort by intel score descending (best first)
    const sorted = useMemo(() => {
        return [...scoredBuyers].sort((a, b) => b.intel.score - a.intel.score);
    }, [scoredBuyers]);

    const displayed = sorted.slice(0, visibleCount);
    const hasMore = visibleCount < sorted.length;
    const activeFilterCount = [filterType, filterState, bnsfOnly, searchQuery].filter(Boolean).length;

    const clearFilters = () => {
        setFilterType(''); setFilterState(''); setBnsfOnly(false); setSearchQuery('');
    };

    return (
        <div className="w-full bg-[#13151a] rounded-2xl border border-[#2a2d36] shadow-xl flex flex-col animate-fade-in-up mb-8">
            {/* Header with count and filter toggle */}
            <div className="px-6 py-4 border-b border-[#2a2d36] bg-[#1a1c23] flex justify-between items-center z-20 sticky top-0 rounded-t-2xl">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-100 uppercase tracking-widest drop-shadow-md">
                        Buyer Network
                    </h2>
                    <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-widest">
                        {buyers.length} ONLINE
                    </span>
                    {activeFilterCount > 0 && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ml-2">
                            <Filter size={10} />
                            {activeFilterCount} Active
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg border transition-all duration-200 
                            ${showFilters
                                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                : 'bg-[#2a2d36]/50 border-[#2a2d36] text-slate-400 hover:bg-[#2a2d36] hover:text-slate-200'
                            }`}
                        title="Toggle Filters"
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Collapsible Filter Bar */}
            <div className={`transition-all duration-300 ease-in-out border-b border-[#2a2d36] bg-[#13151a] overflow-hidden
                ${showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 border-transparent'}`}>
                {showFilters && (
                    <div className="px-6 py-4 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <Search size={14} className="text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search buyers, city..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#1a1c23] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 focus:bg-[#1e2028] transition-colors w-48 placeholder:text-slate-600"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Type:</span>
                            <div className="flex gap-2">
                                {uniqueTypes.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(filterType === type ? '' : type)}
                                        className={`px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors border
                                            ${filterType === type
                                                ? 'bg-red-500/20 text-red-500 border-red-500/30'
                                                : filterType === ''
                                                    ? 'bg-[#1a1c23] text-slate-200 border-[#2a2d36]'
                                                    : 'bg-transparent text-slate-400 border-transparent hover:bg-[#1a1c23]'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* State */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">State:</span>
                            <select
                                value={filterState}
                                onChange={(e) => setFilterState(e.target.value)}
                                className="bg-[#1a1c23] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-[#1a1c23]">All States</option>
                                {uniqueStates.map(s => (
                                    <option key={s} value={s} className="bg-[#1a1c23]">{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* BNSF Toggle */}
                        <button
                            onClick={() => setBnsfOnly(!bnsfOnly)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${bnsfOnly
                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                : 'bg-[#1a1c23] text-slate-400 border-[#2a2d36] hover:bg-[#1e2028]'
                                }`}
                        >
                            <Train size={14} />
                            BNSF-Served
                        </button>

                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
                            >
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="w-full flex-1">
                {/* Desktop Premium Grid View */}
                <div className="hidden lg:block w-full min-w-[900px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-[2.2fr,0.8fr,1fr,1.3fr,0.9fr,0.9fr,1fr,1fr,1fr,1fr] gap-3 px-6 py-4 bg-[#1a1c23] sticky top-0 z-10 border-b border-[#2a2d36]">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Facility Name</div>
                        <div className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest text-center flex items-center gap-1 justify-center"><Sparkles size={10} />Intel</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Type</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Basis</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Cash Price</div>
                        <div className="text-xs font-bold text-red-500/80 uppercase tracking-widest text-right">Freight</div>
                        <div className="text-xs font-bold text-red-400 uppercase tracking-widest text-right">Net Price</div>
                        <div className="text-xs font-bold text-red-500/80 uppercase tracking-widest text-right">vs Benchmark</div>
                        <div className="text-xs font-bold text-orange-400/80 uppercase tracking-widest text-center">Rail Access</div>
                    </div>

                    {/* Data Rows */}
                    <div className="flex flex-col divide-y divide-[#2a2d36]">
                        {displayed.map(({ buyer, intel }) => (
                            <div
                                key={buyer.id}
                                onClick={() => onSelect(buyer)}
                                className="grid grid-cols-[2.2fr,0.8fr,1fr,1.3fr,0.9fr,0.9fr,1fr,1fr,1fr,1fr] gap-3 px-6 py-4 items-center bg-transparent hover:bg-[#1e2028] transition-all duration-200 cursor-pointer group"
                            >
                                {/* Name column */}
                                <div className="flex flex-col">
                                    <div className="font-bold text-slate-200 text-[15px] group-hover:text-red-400 transition-colors flex items-center gap-2 truncate">
                                        {buyer.name}
                                        {buyer.verified && (
                                            <ShieldCheck size={14} className="text-red-500 flex-shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500 font-mono">{buyer.contactPhone || 'No Phone'}</span>
                                        <StatusBadge buyer={buyer} />
                                    </div>
                                </div>

                                {/* Intel Score Column */}
                                <div className="flex justify-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${INTEL_BADGE_STYLES[intel.color] || INTEL_BADGE_STYLES.gray}`}
                                        title={`Score: ${intel.score}/100 — ${intel.signals.map(s => `${s.name}: ${s.points}/${s.maxPoints}`).join(', ')}`}>
                                        <span>{intel.emoji}</span>
                                        <span className="hidden xl:inline">{intel.label}</span>
                                        <span className="xl:hidden">{intel.score}</span>
                                    </span>
                                </div>

                                {/* Type Column */}
                                <div>
                                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                                        ${buyer.type === 'ethanol' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                buyer.type === 'export' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    buyer.type === 'crush' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                                        buyer.type === 'shuttle' || buyer.type === 'transload' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {buyer.type}
                                    </span>
                                </div>

                                {/* Location Column */}
                                <div className="flex flex-col">
                                    <div className="text-[13px] font-medium text-slate-300 truncate">{buyer.city}, {buyer.state}</div>
                                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5 truncate">{buyer.region}</div>
                                </div>

                                {/* Basis Column */}
                                <div className="text-right flex flex-col items-end">
                                    {buyer.basis != null ? (
                                        <span className={`text-sm font-mono font-medium ${buyer.basis > 0 ? 'text-emerald-400' : buyer.basis < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600 text-[11px] tracking-wider">NO BID</span>
                                    )}
                                    <PriceSourceBadge buyer={buyer} />
                                </div>

                                {/* Cash Price Column */}
                                <div className="text-right text-[15px] font-mono font-bold text-slate-200">
                                    {buyer.cashPrice != null ? `$${buyer.cashPrice.toFixed(2)}` : <span className="text-slate-500 text-xs">--</span>}
                                </div>

                                {/* Freight Column */}
                                <div className="text-right flex flex-col items-end" title={buyer.freightFormula || ''}>
                                    <div className="text-[15px] font-mono font-bold text-red-500">
                                        -${Math.abs(buyer.freightCost ?? 0).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-red-500/50 mt-0.5 tracking-wider">
                                        {buyer.freightMode === 'rail' ? 'RAIL FRT' : 'TRUCK FRT'}
                                    </div>
                                </div>

                                {/* Net Price Column */}
                                <div className="text-right">
                                    <div className="text-[17px] font-mono font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </div>
                                </div>

                                {/* vs Benchmark Column */}
                                <div className="text-right">
                                    {buyer.benchmarkDiff !== undefined && !isNaN(buyer.benchmarkDiff) ? (
                                        <div className={`text-sm font-mono font-bold px-2 py-1 inline-block rounded border ${buyer.benchmarkDiff >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {buyer.benchmarkDiff >= 0 ? '+' : ''}{buyer.benchmarkDiff.toFixed(2)}
                                        </div>
                                    ) : <span className="text-slate-600">-</span>}
                                </div>

                                {/* Rail Column */}
                                <div className="flex justify-center">
                                    <RailBadge buyer={buyer} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mobile / Tablet Card View */}
                <div className="lg:hidden flex flex-col gap-3 p-4">
                    {displayed.map(({ buyer, intel }) => (
                        <div
                            key={buyer.id}
                            onClick={() => onSelect(buyer)}
                            className="bg-[#1a1c23] rounded-xl p-4 border border-[#2a2d36] shadow-lg hover:border-red-500/50 hover:bg-[#1e2028] transition-all cursor-pointer group relative overflow-hidden"
                        >
                            {/* Accent line on left */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-4 pl-2">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h4 className="font-bold text-slate-100 text-[15px] flex items-center gap-2 truncate group-hover:text-red-400 transition-colors">
                                        {buyer.name}
                                        {buyer.verified && <ShieldCheck size={14} className="text-red-500 flex-shrink-0" />}
                                    </h4>
                                    <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{buyer.city}, {buyer.state}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest mb-0.5">NET PRICE</div>
                                    <div className="text-xl font-mono font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4 pl-2 border-y border-[#2a2d36] py-3">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">CASH</div>
                                    <div className="font-mono text-sm text-slate-200 font-bold">${buyer.cashPrice?.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">BASIS</div>
                                    {buyer.basis != null ? (
                                        <div className={`font-mono text-sm font-bold ${buyer.basis > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                        </div>
                                    ) : (
                                        <div className="font-mono text-[11px] text-slate-600 tracking-wider mt-1">NO BID</div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-red-500/70 uppercase tracking-widest mb-1">FREIGHT</div>
                                    <div className="font-mono text-sm font-bold text-red-500">
                                        -${Math.abs(buyer.freightCost ?? 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap pl-2">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${INTEL_BADGE_STYLES[intel.color] || INTEL_BADGE_STYLES.gray}`}>
                                    {intel.emoji} {intel.label}
                                </span>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                                    ${buyer.type === 'ethanol' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {buyer.type}
                                </span>
                                <RailBadge buyer={buyer} />
                                {buyer.benchmarkDiff != null && !isNaN(buyer.benchmarkDiff) && (
                                    <span className={`ml-auto px-2 py-1 rounded text-[10px] font-mono font-bold border ${buyer.benchmarkDiff >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        vs BM: {buyer.benchmarkDiff >= 0 ? '+' : ''}{buyer.benchmarkDiff.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Load More / Empty State */}
                {hasMore && (
                    <div className="p-4 text-center border-t border-[#2a2d36] mt-4">
                        <button
                            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-sm font-bold tracking-wider uppercase text-red-400 transition-colors border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                        >
                            Load more ({sorted.length - visibleCount} remaining)
                        </button>
                    </div>
                )}
                {filtered.length === 0 && (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-[#1a1c23] border border-[#2a2d36] flex items-center justify-center mb-4 text-slate-600">
                            <Search size={24} />
                        </div>
                        <p className="text-lg font-medium text-slate-300">No buyers found</p>
                        <p className="text-sm mt-1">{buyers.length === 0 ? 'Loading buyer data from network...' : 'Try adjusting your filters'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
