import React from 'react';
import { Buyer, getOverallConfidence } from '../types';
import { Train, Truck } from 'lucide-react';
import { TrustBadge, FreshnessDot } from './TrustBadge';

interface BuyerTableProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
}

export const BuyerTable: React.FC<BuyerTableProps> = ({ buyers, onSelect }) => {
    return (
        <div className="w-full bg-[#120202]/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-depth overflow-hidden flex flex-col h-full animate-fade-in-up">
            <div className="p-4 border-b border-white/5 bg-gradient-to-r from-red-900/10 to-transparent">
                <h3 className="text-lg font-bold text-white tracking-wide">Buyer Directory</h3>
            </div>

            <div className="w-full">
                {/* Desktop Table View */}
                <div className="hidden md:block w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Region</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Basis</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cash</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-red-400">Freight</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-green-400">Net Price</th>
                                <th className="px-4 py-4 text-xs font-semibold text-emerald-400 uppercase tracking-wider text-right">vs Hank</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Logistics</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {buyers.map((buyer) => (
                                <tr
                                    key={buyer.id}
                                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors cursor-pointer group"
                                    onClick={() => onSelect(buyer)}
                                >
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-slate-200 text-base group-hover:text-corn-accent transition-colors flex items-center gap-1.5">
                                            {buyer.name}
                                            {buyer.provenance && (
                                                <TrustBadge
                                                    confidence={getOverallConfidence(buyer.provenance)}
                                                    source={buyer.provenance.basis.source}
                                                    timestamp={buyer.provenance.basis.timestamp}
                                                    staleAfterMinutes={60}
                                                />
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">{buyer.city}, {buyer.state}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium capitalize border border-white/5
                                            ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {buyer.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-300">{buyer.region}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-white/90">{buyer.contactName || 'N/A'}</span>
                                            <span className="text-xs text-slate-400 font-mono mt-0.5">{buyer.contactPhone}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-base">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {buyer.provenance && <FreshnessDot dataSource={buyer.provenance.basis} />}
                                            <span className={`font-semibold ${buyer.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">
                                        ${buyer.cashPrice?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-red-400">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {buyer.provenance && <FreshnessDot dataSource={buyer.provenance.freight} />}
                                            ${Math.abs(buyer.freightCost ?? 0).toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-base font-bold text-green-400">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm">
                                        {buyer.benchmarkDiff !== undefined ? (
                                            <span className={`font-semibold ${buyer.benchmarkDiff >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                {buyer.benchmarkDiff >= 0 ? '+' : ''}{buyer.benchmarkDiff.toFixed(2)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-4 flex justify-center gap-2">
                                        {buyer.railAccessible && (
                                            <div className="px-2 py-1 bg-cyan-500/10 rounded-md text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5" title="Rail Accessible">
                                                <Train size={14} />
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Rail</span>
                                            </div>
                                        )}
                                        {buyer.nearTransload && (
                                            <div className="px-2 py-1 bg-purple-500/10 rounded-md text-purple-400 border border-purple-500/20 flex items-center gap-1.5" title="Near Transload">
                                                <Truck size={14} />
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Truck</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col gap-3 p-3">
                    {buyers.map((buyer) => (
                        <div
                            key={buyer.id}
                            onClick={() => onSelect(buyer)}
                            className="bg-white/5 rounded-lg p-4 border border-white/5 active:bg-white/10 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg flex items-center gap-1.5">
                                            {buyer.name}
                                            {buyer.provenance && (
                                                <TrustBadge
                                                    confidence={getOverallConfidence(buyer.provenance)}
                                                    source={buyer.provenance.basis.source}
                                                    timestamp={buyer.provenance.basis.timestamp}
                                                    staleAfterMinutes={60}
                                                />
                                            )}
                                        </h4>
                                        <div className="text-sm text-slate-400">{buyer.city}, {buyer.state}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Net Price</div>
                                        <div className="text-xl font-mono font-bold text-green-400">
                                            ${buyer.netPrice?.toFixed(2) || '-'}
                                        </div>
                                        <div className="text-xs text-red-400 font-mono mt-1">
                                            Freight: -${Math.abs(buyer.freightCost ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize border border-white/5
                                    ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {buyer.type}
                                    </span>
                                    <span className="text-xs text-slate-500 px-2 border-l border-white/10">{buyer.region}</span>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <div className="flex gap-2">
                                        {buyer.railAccessible && (
                                            <div className="p-1.5 bg-cyan-500/10 rounded text-cyan-400 border border-cyan-500/20">
                                                <Train size={14} />
                                            </div>
                                        )}
                                        {buyer.nearTransload && (
                                            <div className="p-1.5 bg-purple-500/10 rounded text-purple-400 border border-purple-500/20">
                                                <Truck size={14} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-white">{buyer.contactName}</div>
                                        <div className="text-xs text-slate-500 font-mono">{buyer.contactPhone}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {buyers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        Loading buyer data...
                    </div>
                )}
            </div>
        </div>
    );
};
