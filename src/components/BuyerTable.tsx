import React, { useState, useMemo } from 'react';
import { Buyer, RailConfidenceLevel } from '../types';
import { Train, Filter, X, ShieldCheck } from 'lucide-react';

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

interface BuyerTableProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
    allBuyers?: Buyer[];
}

export const BuyerTable: React.FC<BuyerTableProps> = ({ buyers, onSelect, allBuyers }) => {
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
        let result = [...buyers];
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

    const displayed = filtered.slice(0, visibleCount);
    const hasMore = visibleCount < filtered.length;
    const activeFilterCount = [filterType, filterState, bnsfOnly, searchQuery].filter(Boolean).length;

    const clearFilters = () => {
        setFilterType(''); setFilterState(''); setBnsfOnly(false); setSearchQuery('');
    };

    return (
        <div className="w-full bg-[#120202]/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-depth overflow-hidden flex flex-col h-full animate-fade-in-up">
            {/* Header with count and filter toggle */}
            <div className="p-4 border-b border-white/5 bg-gradient-to-r from-red-900/10 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-white tracking-wide">Buyer Directory</h3>
                        <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-md font-mono">
                            {filtered.length} of {buyers.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* BNSF Toggle */}
                        <button
                            onClick={() => setBnsfOnly(!bnsfOnly)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${bnsfOnly
                                ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <Train size={14} />
                            BNSF-Served
                        </button>
                        {/* Filter toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${showFilters || activeFilterCount > 0
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <Filter size={14} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                {showFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search name, city..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-48"
                        />
                        {/* Type */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#1a1a1a]">All Types</option>
                            {uniqueTypes.map(t => (
                                <option key={t} value={t} className="bg-[#1a1a1a] capitalize">{t}</option>
                            ))}
                        </select>
                        {/* State */}
                        <select
                            value={filterState}
                            onChange={(e) => setFilterState(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#1a1a1a]">All States</option>
                            {uniqueStates.map(s => (
                                <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
                            ))}
                        </select>
                        {/* Clear */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="w-full overflow-auto flex-1">
                {/* Desktop Table View */}
                <div className="hidden md:block w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Basis</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cash</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-red-400">Freight</th>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-green-400">Net</th>
                                <th className="px-3 py-3 text-xs font-semibold text-emerald-400 uppercase tracking-wider text-right">vs Hank</th>
                                <th className="px-3 py-3 text-xs font-semibold text-orange-400 uppercase tracking-wider text-center">Rail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayed.map((buyer) => (
                                <tr
                                    key={buyer.id}
                                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors cursor-pointer group"
                                    onClick={() => onSelect(buyer)}
                                >
                                    <td className="px-3 py-3">
                                        <div className="font-medium text-slate-200 text-sm group-hover:text-corn-accent transition-colors flex items-center gap-1.5">
                                            {buyer.name}
                                            {buyer.verified && (
                                                <ShieldCheck size={14} className="text-green-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">{buyer.contactPhone}</div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize border border-white/5
                                            ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    buyer.type === 'export' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                        buyer.type === 'crush' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                                            buyer.type === 'shuttle' || buyer.type === 'transload' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                                'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {buyer.type}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="text-sm text-slate-300">{buyer.city}, {buyer.state}</div>
                                        <div className="text-xs text-slate-500">{buyer.region}</div>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-sm">
                                        <span className={`font-semibold ${buyer.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-sm text-slate-300">
                                        ${buyer.cashPrice?.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-sm text-red-400" title={buyer.freightFormula || ''}>
                                        <span className="opacity-60 mr-0.5">{buyer.freightMode === 'rail' ? '🚂' : '🚛'}</span>
                                        ${Math.abs(buyer.freightCost ?? 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-green-400">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-sm">
                                        {buyer.benchmarkDiff !== undefined ? (
                                            <span className={`font-semibold ${buyer.benchmarkDiff >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                {buyer.benchmarkDiff >= 0 ? '+' : ''}{buyer.benchmarkDiff.toFixed(2)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <RailBadge buyer={buyer} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col gap-2 p-3">
                    {displayed.map((buyer) => (
                        <div
                            key={buyer.id}
                            onClick={() => onSelect(buyer)}
                            className="bg-white/5 rounded-lg p-3 border border-white/5 active:bg-white/10 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                                        {buyer.name}
                                        {buyer.verified && <ShieldCheck size={12} className="text-green-400 flex-shrink-0" />}
                                    </h4>
                                    <div className="text-xs text-slate-400">{buyer.city}, {buyer.state}</div>
                                </div>
                                <div className="text-right ml-2 flex-shrink-0">
                                    <div className="text-lg font-mono font-bold text-green-400">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </div>
                                    <div className="text-xs text-red-400 font-mono">
                                        {buyer.freightMode === 'rail' ? '🚂' : '🚛'} -${Math.abs(buyer.freightCost ?? 0).toFixed(2)} frt
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium capitalize border
                                    ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                        buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {buyer.type}
                                </span>
                                <RailBadge buyer={buyer} />
                                {buyer.benchmarkDiff !== undefined && (
                                    <span className={`text-xs font-mono font-semibold ${buyer.benchmarkDiff >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        vs Hank: {buyer.benchmarkDiff >= 0 ? '+' : ''}{buyer.benchmarkDiff.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Load More / Empty State */}
                {hasMore && (
                    <div className="p-4 text-center border-t border-white/5">
                        <button
                            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-300 transition-colors border border-white/10"
                        >
                            Load more ({filtered.length - visibleCount} remaining)
                        </button>
                    </div>
                )}
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        {buyers.length === 0 ? 'Loading buyer data...' : 'No buyers match your filters'}
                    </div>
                )}
            </div>
        </div>
    );
};
